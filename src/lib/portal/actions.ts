'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { computeOrderAmount } from '@/lib/payments/pricing';
import {
  createOrderSchema,
  cryptoPaymentSchema,
  giftCardPaymentSchema,
  cryptoResubmitSchema,
  giftCardResubmitSchema,
  profileUpdateSchema,
  checkDobPolicy
} from '@/lib/validation/schemas';
import { validateUpload, looksLikeGiftCardSecret } from '@/lib/storage/upload-validation';
import {
  ORDER_ACCEPTS_PAYMENT,
  MEMBER_REOPENABLE_PAYMENT_STATUSES
} from '@/lib/payments/state-machine';
import { notify } from '@/lib/notifications/notify';
import { templates } from '@/lib/email/templates';
import { tryAudit } from '@/lib/audit/log';
import {
  getCryptoConfig,
  getGiftCardConfig,
  getBusinessVerification,
  getDobPolicy,
  holidaySet
} from '@/lib/settings';
import { verificationEstimate } from '@/lib/business-days';
import { formatMoney } from '@/lib/utils';
import type { PaymentSubmissionRow } from '@/types/database';

export interface ActionState {
  error?: string;
  success?: string;
}

async function rateKey(scope: string, userId: string): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return `${scope}:${userId}:${ip}`;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser('/portal/profile');

  const parsed = profileUpdateSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    addressLine1: formData.get('addressLine1'),
    addressLine2: formData.get('addressLine2'),
    city: formData.get('city'),
    region: formData.get('region'),
    postalCode: formData.get('postalCode'),
    country: formData.get('country'),
    dateOfBirth: formData.get('dateOfBirth')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const policy = await getDobPolicy();
  const dobError = checkDobPolicy(parsed.data.dateOfBirth, policy);
  if (dobError) return { error: dobError };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      address_line1: parsed.data.addressLine1,
      address_line2: parsed.data.addressLine2,
      city: parsed.data.city,
      region: parsed.data.region,
      postal_code: parsed.data.postalCode,
      country: parsed.data.country,
      ...(parsed.data.dateOfBirth
        ? {
            date_of_birth: parsed.data.dateOfBirth,
            date_of_birth_captured_at: new Date().toISOString()
          }
        : {})
    })
    .eq('id', user.id);

  if (error) return { error: 'We could not save your profile. Please try again.' };

  revalidatePath('/portal/profile');
  return { success: 'Your profile has been saved.' };
}

// ---------------------------------------------------------------------------
// Orders — created ONLY via the security-definer create_order() RPC.
// The price snapshot, active-profile guard, duplicate-order idempotency and
// the open-order cap are all enforced inside the database function, so the
// public anon key can never be used to place an order with a forged price.
// ---------------------------------------------------------------------------

export async function createOrderAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser('/membership');

  const rl = checkRateLimit(await rateKey('create-order', user.id), 10, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a moment.' };

  const parsed = createOrderSchema.safeParse({ tierId: formData.get('tierId') });
  if (!parsed.success) return { error: 'Choose a membership package to continue.' };

  // Session-bound client so the RPC runs as the member (auth.uid()). The
  // function itself is security definer and performs all privileged checks.
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc('create_order', {
    p_tier_id: parsed.data.tierId
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('profile_not_active')) {
      return { error: 'Your account is not able to create orders. Please contact support.' };
    }
    if (message.includes('open_order_limit')) {
      return {
        error: 'You already have open orders. Complete or contact support before creating another.'
      };
    }
    if (message.includes('tier_not_available')) {
      return { error: 'This membership package is not available.' };
    }
    return { error: 'We could not create your order. Please try again.' };
  }

  const order = rows?.[0];
  if (!order) {
    return { error: 'We could not create your order. Please try again.' };
  }
  const created = order.created;

  // Load tier name/price for the confirmation artefacts only — the order's
  // own stored snapshot is authoritative from here on.
  const admin = createAdminClient();
  const { data: tierSnapshot } = await admin
    .from('orders')
    .select('tier_name_snapshot, total_price, currency')
    .eq('id', order.id)
    .single();
  const tierName = tierSnapshot?.tier_name_snapshot ?? '';
  const totalPrice = tierSnapshot ? String(tierSnapshot.total_price) : '';
  const currency = tierSnapshot?.currency ?? 'USD';

  // Only brand-new creations write artefacts — an idempotent replay reuses
  // the existing order without duplicating notifications/audit noise.
  if (created) {
    await tryAudit(admin, {
      actorId: user.id,
      action: 'order.created',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        reference: order.reference,
        tier: tierName,
        total: `${totalPrice} ${currency}`
      }
    });

    const displayName = await displayNameFor(user.id);
    await notify(admin, {
      userId: user.id,
      type: 'order_created',
      title: 'Order created',
      body: `Order ${order.reference} (${tierName}) is awaiting payment.`,
      data: { orderId: order.id },
      email: templates.orderCreated(
        displayName,
        order.reference,
        formatMoney(totalPrice, currency)
      )
    });
  }

  // Duplicate submission lands on the SAME order (true idempotency).
  redirect(`/portal/orders/${order.id}?${created ? 'created=1' : 'existing=1'}`);
}

async function displayNameFor(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  return data?.full_name?.trim() || 'member';
}

// ---------------------------------------------------------------------------
// Payment submissions (crypto + gift card)
// ---------------------------------------------------------------------------

async function loadOrderForPayment(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  return order;
}

async function ensureOrderAcceptsPayment(
  orderId: string
): Promise<{ ok: true; order: NonNullable<Awaited<ReturnType<typeof loadOrderForPayment>>> } | { ok: false; error: string }> {
  const order = await loadOrderForPayment(orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (!ORDER_ACCEPTS_PAYMENT.includes(order.status)) {
    return { ok: false, error: 'This order is not accepting payment submissions.' };
  }
  const supabase = await createClient();
  const { data: approved } = await supabase
    .from('payment_submissions')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'approved')
    .limit(1);
  if (approved && approved.length > 0) {
    return { ok: false, error: 'This order already has an approved payment.' };
  }
  return { ok: true, order };
}

async function afterPaymentSubmitted(payment: PaymentSubmissionRow, orderId: string) {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('reference, user_id, tier_name_snapshot')
    .eq('id', orderId)
    .single();

  // Mirror the payment event on the order (service role: customers cannot
  // update orders, by design).
  await admin
    .from('orders')
    .update({ status: 'payment_submitted' })
    .eq('id', orderId)
    .in('status', ['awaiting_payment', 'additional_information_required']);

  await admin.from('payment_review_history').insert({
    payment_id: payment.id,
    previous_status: null,
    new_status: payment.status,
    actor_id: payment.user_id,
    reason: 'Payment submitted by customer'
  });

  await tryAudit(admin, {
    actorId: payment.user_id,
    action: 'payment.submitted',
    entityType: 'payment_submission',
    entityId: payment.id,
    metadata: { method: payment.method, orderId }
  });

  const cfg = await getBusinessVerification();
  const estimate = verificationEstimate(
    new Date(),
    cfg.workingDays,
    holidaySet(cfg)
  );
  const displayName = await displayNameFor(payment.user_id);

  await notify(admin, {
    userId: payment.user_id,
    type: 'payment_submitted',
    title: 'Payment submission received',
    body: `Your payment for order ${order?.reference ?? ''} is awaiting verification (${estimate.label}).`,
    data: { paymentId: payment.id, orderId },
    email: templates.paymentSubmitted(displayName, order?.reference ?? '', estimate.label)
  });

  // Alert reviewers (in-app only; no sensitive data).
  const { data: reviewerRoles } = await admin
    .from('admin_role_permissions')
    .select('role_id')
    .eq('permission_key', 'payments.review');
  if (reviewerRoles && reviewerRoles.length > 0) {
    const roleIds = reviewerRoles.map((r) => r.role_id);
    const { data: reviewers } = await admin
      .from('admin_roles')
      .select('user_id')
      .in('id', roleIds)
      .eq('is_active', true);
    for (const reviewer of reviewers ?? []) {
      await notify(admin, {
        userId: reviewer.user_id,
        type: 'system',
        title: 'New payment awaiting review',
        body: `Order ${order?.reference ?? ''}: a ${payment.method.replace('_', ' ')} payment needs review.`,
        data: { paymentId: payment.id }
      });
    }
  }
}

function paymentErrorMessage(code?: string, fallback = 'We could not record your payment. Please try again.'): string {
  if (code === '23505') {
    return 'This transaction has already been submitted. If you believe this is an error, contact support with your order reference.';
  }
  return fallback;
}

export async function submitCryptoPaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser('/portal/orders');

  const rl = checkRateLimit(await rateKey('submit-payment', user.id), 6, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a moment.' };

  const parsed = cryptoPaymentSchema.safeParse({
    orderId: formData.get('orderId'),
    cryptoCurrency: formData.get('cryptoCurrency'),
    network: formData.get('network'),
    expectedAmount: formData.get('expectedAmount'),
    txHash: formData.get('txHash'),
    paidAt: formData.get('paidAt'),
    notes: formData.get('notes')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  // The submitted asset/network must be one the administrator configured.
  const cryptoCfg = await getCryptoConfig();
  if (!cryptoCfg.enabled || cryptoCfg.currencies.length === 0) {
    return { error: 'Cryptocurrency payments are not currently available for this order.' };
  }
  const pair = cryptoCfg.currencies.find(
    (c) => c.asset === parsed.data.cryptoCurrency && c.network === parsed.data.network
  );
  if (!pair) {
    return { error: 'Select one of the listed cryptocurrencies and networks.' };
  }

  const gate = await ensureOrderAcceptsPayment(parsed.data.orderId);
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from('payment_submissions')
    .insert({
      order_id: gate.order.id,
      user_id: user.id,
      method: 'crypto',
      status: 'pending_review',
      crypto_currency: parsed.data.cryptoCurrency,
      network: parsed.data.network,
      expected_amount: parsed.data.expectedAmount,
      tx_hash: parsed.data.txHash ?? null,
      paid_at: parsed.data.paidAt
        ? new Date(parsed.data.paidAt).toISOString()
        : new Date().toISOString(),
      submitter_notes: parsed.data.notes ?? null
    })
    .select('*')
    .single();

  if (error || !payment) {
    return { error: paymentErrorMessage(error?.code) };
  }

  await afterPaymentSubmitted(payment, gate.order.id);
  revalidatePath(`/portal/orders/${gate.order.id}`);
  redirect(`/portal/orders/${gate.order.id}?submitted=1`);
}

export async function submitGiftCardPaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser('/portal/orders');

  const rl = checkRateLimit(await rateKey('submit-payment', user.id), 6, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a moment.' };

  const parsed = giftCardPaymentSchema.safeParse({
    orderId: formData.get('orderId'),
    issuer: formData.get('issuer'),
    denomination: formData.get('denomination'),
    currency: formData.get('currency'),
    purchaseReference: formData.get('purchaseReference'),
    notes: formData.get('notes')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const giftCfg = await getGiftCardConfig();
  if (!giftCfg.enabled) {
    return { error: 'Gift-card payments are not currently available for this order.' };
  }
  if (giftCfg.issuers.length > 0 && !giftCfg.issuers.includes(parsed.data.issuer)) {
    return { error: 'Select one of the listed gift-card issuers.' };
  }

  // Defence in depth: refuse anything that resembles a redeemable secret.
  for (const value of [
    parsed.data.purchaseReference ?? '',
    parsed.data.notes ?? ''
  ]) {
    if (value && looksLikeGiftCardSecret(value)) {
      return {
        error:
          'For your security, never submit gift-card PINs or redemption codes. Remove any long card numbers and try again.'
      };
    }
  }

  const gate = await ensureOrderAcceptsPayment(parsed.data.orderId);
  if (!gate.ok) return { error: gate.error };

  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from('payment_submissions')
    .insert({
      order_id: gate.order.id,
      user_id: user.id,
      method: 'gift_card',
      status: 'pending_review',
      gift_card_issuer: parsed.data.issuer,
      gift_card_denomination: parsed.data.denomination,
      gift_card_currency: parsed.data.currency,
      purchase_reference: parsed.data.purchaseReference ?? null,
      submitter_notes: parsed.data.notes ?? null
    })
    .select('*')
    .single();

  if (error || !payment) {
    return { error: paymentErrorMessage(error?.code) };
  }

  await afterPaymentSubmitted(payment, gate.order.id);
  revalidatePath(`/portal/orders/${gate.order.id}`);
  redirect(`/portal/orders/${gate.order.id}?submitted=1`);
}

// ---------------------------------------------------------------------------
// Re-submission (correction / answering an information request)
// The SAME payment row is updated in place: there is only ever one open
// payment per order (partial unique index), and the row's full lifecycle
// stays attached to the audit trail of that row.
// ---------------------------------------------------------------------------

async function loadOwnedReopenablePayment(paymentId: string, userId: string) {
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('id', paymentId)
    .eq('user_id', userId)
    .maybeSingle();
  return payment;
}

export async function resubmitCryptoPaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser('/portal/orders');

  const rl = checkRateLimit(await rateKey('submit-payment', user.id), 6, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a moment.' };

  const parsed = cryptoResubmitSchema.safeParse({
    paymentId: formData.get('paymentId'),
    cryptoCurrency: formData.get('cryptoCurrency'),
    network: formData.get('network'),
    expectedAmount: formData.get('expectedAmount'),
    txHash: formData.get('txHash'),
    paidAt: formData.get('paidAt'),
    notes: formData.get('notes')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const cryptoCfg = await getCryptoConfig();
  if (!cryptoCfg.enabled || cryptoCfg.currencies.length === 0) {
    return { error: 'Cryptocurrency payments are not currently available for this order.' };
  }
  const pair = cryptoCfg.currencies.find(
    (c) => c.asset === parsed.data.cryptoCurrency && c.network === parsed.data.network
  );
  if (!pair) {
    return { error: 'Select one of the listed cryptocurrencies and networks.' };
  }

  const payment = await loadOwnedReopenablePayment(parsed.data.paymentId, user.id);
  if (!payment) return { error: 'Payment submission not found.' };
  if (!MEMBER_REOPENABLE_PAYMENT_STATUSES.includes(payment.status)) {
    return { error: 'This submission can no longer be edited.' };
  }

  // Conditional replace: refuses silently when a reviewer has meanwhile
  // picked the payment up (under_review) or settled it.
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('payment_submissions')
    .update({
      method: 'crypto',
      status: 'pending_review',
      crypto_currency: parsed.data.cryptoCurrency,
      network: parsed.data.network,
      expected_amount: parsed.data.expectedAmount,
      tx_hash: parsed.data.txHash ?? null,
      paid_at: parsed.data.paidAt
        ? new Date(parsed.data.paidAt).toISOString()
        : new Date().toISOString(),
      // Clear the other method's fields so the row is internally consistent.
      gift_card_issuer: null,
      gift_card_denomination: null,
      gift_card_currency: null,
      purchase_reference: null,
      submitter_notes: parsed.data.notes ?? null,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      version: payment.version + 1
    })
    .eq('id', payment.id)
    .eq('user_id', user.id)
    .in('status', [...MEMBER_REOPENABLE_PAYMENT_STATUSES])
    .select('*');

  if (error) return { error: paymentErrorMessage(error.code) };
  if (!updated || updated.length === 0) {
    return {
      error: 'This payment is already being reviewed, so it can no longer be edited. Our team will follow up shortly.'
    };
  }

  await afterPaymentSubmitted(updated[0], updated[0].order_id);
  revalidatePath(`/portal/orders/${updated[0].order_id}`);
  redirect(`/portal/orders/${updated[0].order_id}?submitted=1`);
}

export async function resubmitGiftCardPaymentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser('/portal/orders');

  const rl = checkRateLimit(await rateKey('submit-payment', user.id), 6, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a moment.' };

  const parsed = giftCardResubmitSchema.safeParse({
    paymentId: formData.get('paymentId'),
    issuer: formData.get('issuer'),
    denomination: formData.get('denomination'),
    currency: formData.get('currency'),
    purchaseReference: formData.get('purchaseReference'),
    notes: formData.get('notes')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const giftCfg = await getGiftCardConfig();
  if (!giftCfg.enabled) {
    return { error: 'Gift-card payments are not currently available for this order.' };
  }
  if (giftCfg.issuers.length > 0 && !giftCfg.issuers.includes(parsed.data.issuer)) {
    return { error: 'Select one of the listed gift-card issuers.' };
  }

  for (const value of [parsed.data.purchaseReference ?? '', parsed.data.notes ?? '']) {
    if (value && looksLikeGiftCardSecret(value)) {
      return {
        error:
          'For your security, never submit gift-card PINs or redemption codes. Remove any long card numbers and try again.'
      };
    }
  }

  const payment = await loadOwnedReopenablePayment(parsed.data.paymentId, user.id);
  if (!payment) return { error: 'Payment submission not found.' };
  if (!MEMBER_REOPENABLE_PAYMENT_STATUSES.includes(payment.status)) {
    return { error: 'This submission can no longer be edited.' };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('payment_submissions')
    .update({
      method: 'gift_card',
      status: 'pending_review',
      gift_card_issuer: parsed.data.issuer,
      gift_card_denomination: parsed.data.denomination,
      gift_card_currency: parsed.data.currency,
      purchase_reference: parsed.data.purchaseReference ?? null,
      crypto_currency: null,
      network: null,
      expected_amount: null,
      tx_hash: null,
      paid_at: null,
      submitter_notes: parsed.data.notes ?? null,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      version: payment.version + 1
    })
    .eq('id', payment.id)
    .eq('user_id', user.id)
    .in('status', [...MEMBER_REOPENABLE_PAYMENT_STATUSES])
    .select('*');

  if (error) return { error: paymentErrorMessage(error.code) };
  if (!updated || updated.length === 0) {
    return {
      error: 'This payment is already being reviewed, so it can no longer be edited. Our team will follow up shortly.'
    };
  }

  await afterPaymentSubmitted(updated[0], updated[0].order_id);
  revalidatePath(`/portal/orders/${updated[0].order_id}`);
  redirect(`/portal/orders/${updated[0].order_id}?submitted=1`);
}

// ---------------------------------------------------------------------------
// Evidence upload
// ---------------------------------------------------------------------------

export async function uploadEvidenceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser('/portal/orders');

  const rl = checkRateLimit(await rateKey('upload-evidence', user.id), 10, 3_600_000);
  if (!rl.ok) return { error: 'Upload limit reached. Please try again later.' };

  const paymentId = formData.get('paymentId');
  const file = formData.get('file');
  if (typeof paymentId !== 'string' || !(file instanceof File)) {
    return { error: 'Choose a file to upload.' };
  }

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment) return { error: 'Payment not found.' };
  if (!['pending_review', 'under_review', 'additional_information_required', 'submitted'].includes(payment.status)) {
    return { error: 'Evidence can no longer be added to this submission.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUpload({
    fileName: file.name,
    declaredMime: file.type,
    bytes,
    kind: 'evidence'
  });
  if (!validation.ok) return { error: validation.error };

  const path = `${user.id}/${payment.id}/${validation.safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from('payment-evidence')
    .upload(path, bytes, {
      contentType: validation.detectedMime,
      cacheControl: '3600',
      upsert: false
    });
  if (uploadError) {
    return { error: 'Upload failed. Please try a smaller file or contact support.' };
  }

  const { error: insertError } = await supabase.from('payment_evidence').insert({
    payment_id: payment.id,
    storage_bucket: 'payment-evidence',
    storage_path: path,
    file_name: file.name.slice(0, 200),
    mime_type: validation.detectedMime,
    size_bytes: validation.sizeBytes,
    uploaded_by: user.id
  });
  if (insertError) {
    // Roll back the orphaned object so storage and metadata stay consistent.
    // Members have no storage DELETE policy (by design) — use the service role.
    const rollback = createAdminClient();
    await rollback.storage.from('payment-evidence').remove([path]);
    return { error: 'We could not record the upload. Please try again.' };
  }

  const admin = createAdminClient();
  await tryAudit(admin, {
    actorId: user.id,
    action: 'payment.evidence_uploaded',
    entityType: 'payment_submission',
    entityId: payment.id,
    metadata: { file: validation.safeFileName, sizeBytes: validation.sizeBytes }
  });

  revalidatePath(`/portal/orders/${payment.order_id}`);
  revalidatePath('/portal/payments');
  return { success: 'Evidence uploaded. Our review team can now see it.' };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const user = await requireUser('/portal/notifications');
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id);
  revalidatePath('/portal/notifications');
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser('/portal/notifications');
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  revalidatePath('/portal/notifications');
}
