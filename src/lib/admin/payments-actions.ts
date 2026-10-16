'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { reviewActionSchema } from '@/lib/validation/schemas';
import {
  assertReviewAction,
  allowedSourcesFor,
  REVIEW_ACTION_TARGET,
  PAYMENT_EVENT_TO_ORDER_STATUS,
  type ReviewAction
} from '@/lib/payments/state-machine';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { templates } from '@/lib/email/templates';
import { getBusinessVerification, holidaySet } from '@/lib/settings';
import { verificationEstimate } from '@/lib/business-days';
import type { PaymentStatus } from '@/types/database';

export interface AdminActionState {
  error?: string;
  success?: string;
}

const ACTION_PERMISSION: Record<ReviewAction, string> = {
  mark_under_review: PERMISSIONS.PAYMENTS_REVIEW,
  approve: PERMISSIONS.PAYMENTS_APPROVE,
  reject: PERMISSIONS.PAYMENTS_REJECT,
  request_info: PERMISSIONS.PAYMENTS_REVIEW
};

/**
 * The single, audited payment-review action used by the admin queue.
 *
 * Guarantees:
 *  - Caller holds the action-specific permission (re-derived server-side).
 *  - Transition is legal for the payment's CURRENT status.
 *  - The update is conditional on the still-current status + version, so two
 *    reviewers can never process the same submission twice.
 *  - Rejections / info requests require a reason (validated twice).
 *  - Every decision writes payment_review_history, an audit row, and mirrors
 *    the event onto the order — then notifies the member.
 */
export async function paymentReviewAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = reviewActionSchema.safeParse({
    paymentId: formData.get('paymentId'),
    action: formData.get('action'),
    reason: formData.get('reason')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid review request.' };
  }

  const { paymentId, action, reason } = parsed.data;
  const ctx = await requirePermission(
    ACTION_PERMISSION[action] as (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
  );

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from('payment_submissions')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment) return { error: 'Payment submission not found.' };

  // A cancelled order is dead: its payment must never be settled (which would
  // mint a membership from a dead order).
  const { data: orderOfPayment } = await admin
    .from('orders')
    .select('status')
    .eq('id', payment.order_id)
    .maybeSingle();
  if (orderOfPayment?.status === 'cancelled') {
    return {
      error: 'This order was cancelled. Its payment can no longer be reviewed. Handle any refund manually outside the platform.'
    };
  }

  const transitionError = assertReviewAction(
    payment.status as PaymentStatus,
    action,
    reason
  );
  if (transitionError) return { error: transitionError };

  const target = REVIEW_ACTION_TARGET[action];
  const settles = action === 'approve' || action === 'reject' || action === 'request_info';

  // Conditional update = idempotency under concurrent reviewers.
  const { data: updatedRows, error: updateError } = await admin
    .from('payment_submissions')
    .update({
      status: target,
      reviewed_by: settles ? ctx.user.id : payment.reviewed_by,
      reviewed_at: settles ? new Date().toISOString() : payment.reviewed_at,
      review_note: reason ?? payment.review_note,
      version: payment.version + 1
    })
    .eq('id', paymentId)
    .eq('version', payment.version)
    .in('status', [...allowedSourcesFor(action)])
    .select('id');

  if (updateError) return { error: 'The review could not be saved. Please try again.' };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      error: 'This payment was already processed by another reviewer. Refresh to see the latest state.'
    };
  }

  await admin.from('payment_review_history').insert({
    payment_id: paymentId,
    previous_status: payment.status,
    new_status: target,
    actor_id: ctx.user.id,
    reason: reason ?? null
  });

  await admin
    .from('orders')
    .update({ status: PAYMENT_EVENT_TO_ORDER_STATUS[target] })
    .eq('id', payment.order_id);

  // Approval makes the order eligible for membership processing: create the
  // membership (pending) and its card record (awaiting upload) exactly once.
  if (action === 'approve') {
    const { data: order } = await admin
      .from('orders')
      .select('tier_id')
      .eq('id', payment.order_id)
      .single();

    if (order) {
      const { data: membership } = await admin
        .from('memberships')
        .upsert(
          {
            user_id: payment.user_id,
            order_id: payment.order_id,
            tier_id: order.tier_id,
            status: 'pending'
          },
          { onConflict: 'order_id', ignoreDuplicates: true }
        )
        .select('id')
        .single();

      if (membership) {
        await admin
          .from('membership_cards')
          .upsert(
            { membership_id: membership.id },
            { onConflict: 'membership_id', ignoreDuplicates: true }
          );
        await admin.from('membership_status_history').insert({
          membership_id: membership.id,
          previous_status: null,
          new_status: 'pending',
          changed_by: ctx.user.id,
          reason: 'Created automatically upon payment approval'
        });
      }
    }
  }

  // The audit row is mandatory for privileged decisions: if it fails, the
  // whole action fails loudly rather than proceeding silently.
  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: `payment.${target}`,
    entityType: 'payment_submission',
    entityId: paymentId,
    previousState: payment.status,
    newState: target,
    metadata: { orderId: payment.order_id, method: payment.method, reason: reason ?? '' }
  });

  const { data: order } = await admin
    .from('orders')
    .select('reference')
    .eq('id', payment.order_id)
    .single();
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', payment.user_id)
    .maybeSingle();
  const name = profile?.full_name?.trim() || 'member';
  const reference = order?.reference ?? '';

  const notifications: Record<
    ReviewAction,
    { type: string; title: string; body: string; email: ReturnType<typeof templates.paymentApproved> }
  > = {
    mark_under_review: {
      type: 'payment_under_review',
      title: 'Your payment is under review',
      body: `Your payment for order ${reference} is now being reviewed.`,
      email: templates.paymentUnderReview(name, reference)
    },
    approve: {
      type: 'payment_approved',
      title: 'Payment approved',
      body: `Your payment for order ${reference} has been approved. Your membership card is being prepared.`,
      email: templates.paymentApproved(name, reference)
    },
    reject: {
      type: 'payment_rejected',
      title: 'Payment could not be approved',
      body: `Your payment for order ${reference} was not approved. Reason: ${reason}`,
      email: templates.paymentRejected(name, reference, reason ?? '')
    },
    request_info: {
      type: 'additional_info_requested',
      title: 'Additional information required',
      body: `We need more information to verify your payment for order ${reference}.`,
      email: templates.additionalInfoRequested(name, reference, reason ?? '')
    }
  };

  const n = notifications[action];
  await notify(admin, {
    userId: payment.user_id,
    type: n.type as never,
    title: n.title,
    body: n.body,
    data: { paymentId, orderId: payment.order_id },
    email: n.email ?? undefined
  });

  revalidatePath('/admin/payments');
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath(`/admin/orders/${payment.order_id}`);

  const cfg = await getBusinessVerification();
  const estimate = verificationEstimate(payment.created_at ? new Date(payment.created_at) : new Date(), cfg.workingDays, holidaySet(cfg));
  void estimate;

  return {
    success:
      action === 'approve'
        ? 'Payment approved. The membership is now eligible for processing.'
        : action === 'reject'
          ? 'Payment rejected and the member has been notified.'
          : action === 'request_info'
            ? 'The member has been asked for additional information.'
            : 'Payment marked as under review.'
  };
}
