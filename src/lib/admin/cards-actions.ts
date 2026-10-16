'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { uuidSchema } from '@/lib/validation/schemas';
import { validateUpload } from '@/lib/storage/upload-validation';
import { canTransitionCard } from '@/lib/memberships/transitions';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { templates } from '@/lib/email/templates';
import { z } from 'zod';

export interface AdminActionState {
  error?: string;
  success?: string;
}

const MEMBERSHIP_STATES_ACCEPTING_ARTWORK = ['processing', 'card_ready', 'active'];

/**
 * Upload (or replace) a manually designed membership card.
 * Every upload becomes a new immutable version; replacements return the card
 * to "in_preparation" so the new file must be explicitly re-confirmed ready.
 */
export async function uploadCardDesignAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.CARDS_MANAGE);

  const membershipIdParsed = uuidSchema.safeParse(formData.get('membershipId'));
  const file = formData.get('file');
  const replaceReasonRaw = formData.get('replaceReason');
  const replaceReason =
    typeof replaceReasonRaw === 'string' && replaceReasonRaw.trim()
      ? replaceReasonRaw.trim().slice(0, 500)
      : null;

  if (!membershipIdParsed.success || !(file instanceof File)) {
    return { error: 'Choose a card design file to upload.' };
  }
  const membershipId = membershipIdParsed.data;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('memberships')
    .select('*')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) return { error: 'Membership not found.' };

  if (!MEMBERSHIP_STATES_ACCEPTING_ARTWORK.includes(membership.status)) {
    return {
      error:
        'Cards can only be prepared for memberships in processing, card-ready or active state.'
    };
  }

  const { data: order } = await admin
    .from('orders')
    .select('status')
    .eq('id', membership.order_id)
    .maybeSingle();
  if (!order || !['payment_approved', 'membership_processing', 'card_ready', 'completed'].includes(order.status)) {
    return { error: 'The order payment must be approved before card preparation.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUpload({
    fileName: file.name,
    declaredMime: file.type,
    bytes,
    kind: 'card'
  });
  if (!validation.ok) return { error: validation.error };

  // Ensure a card record exists (created at approval, but be defensive).
  let { data: card } = await admin
    .from('membership_cards')
    .select('*')
    .eq('membership_id', membershipId)
    .maybeSingle();
  if (!card) {
    const { data: created, error: createError } = await admin
      .from('membership_cards')
      .insert({ membership_id: membershipId })
      .select('*')
      .single();
    if (createError || !created) return { error: 'Could not initialise the card record.' };
    card = created;
  }

  if (!canTransitionCard(card.status, 'in_preparation')) {
    return { error: `A card in state "${card.status}" cannot receive new artwork.` };
  }

  const { data: latestVersions } = await admin
    .from('membership_card_versions')
    .select('version')
    .eq('card_id', card.id)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = (latestVersions?.[0]?.version ?? 0) + 1;

  const path = `${membershipId}/v${nextVersion}-${validation.safeFileName}`;
  const { error: uploadError } = await admin.storage
    .from('membership-cards')
    .upload(path, bytes, {
      contentType: validation.detectedMime,
      cacheControl: '3600',
      upsert: false
    });
  if (uploadError) return { error: 'Upload failed. Please try again.' };

  const { data: version, error: versionError } = await admin
    .from('membership_card_versions')
    .insert({
      card_id: card.id,
      version: nextVersion,
      storage_bucket: 'membership-cards',
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: validation.detectedMime,
      size_bytes: validation.sizeBytes,
      uploaded_by: ctx.user.id,
      replaced_reason: nextVersion > 1 ? replaceReason : null
    })
    .select('id')
    .single();

  if (versionError || !version) {
    await admin.storage.from('membership-cards').remove([path]);
    return { error: 'We could not record the new card version. Please try again.' };
  }

  const { error: cardUpdateError } = await admin
    .from('membership_cards')
    .update({
      current_version_id: version.id,
      status: 'in_preparation',
      ready_at: null,
      ready_by: null,
      revoked_at: null,
      revocation_reason: null
    })
    .eq('id', card.id);
  if (cardUpdateError) {
    return { error: 'The card record could not be updated. Please try again.' };
  }

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: nextVersion > 1 ? 'card.version_replaced' : 'card.uploaded',
    entityType: 'membership_card',
    entityId: card.id,
    previousState: card.status,
    newState: 'in_preparation',
    metadata: {
      membershipId,
      version: nextVersion,
      file: validation.safeFileName,
      sizeBytes: validation.sizeBytes,
      replaceReason: replaceReason ?? ''
    }
  });

  revalidatePath('/admin/card-designs');
  revalidatePath(`/admin/memberships/${membershipId}`);
  return {
    success: `Card design v${nextVersion} uploaded. Confirm the member and tier, then mark it ready.`
  };
}

/**
 * Mark the current card version ready for member download. Membership moves
 * to card_ready and the member is notified.
 */
export async function markCardReadyAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.CARDS_MANAGE);

  const parsed = uuidSchema.safeParse(formData.get('membershipId'));
  if (!parsed.success) return { error: 'Invalid membership.' };
  const membershipId = parsed.data;

  const admin = createAdminClient();
  const { data: card } = await admin
    .from('membership_cards')
    .select('*')
    .eq('membership_id', membershipId)
    .maybeSingle();
  if (!card || !card.current_version_id) {
    return { error: 'Upload a card design before marking it ready.' };
  }
  if (!canTransitionCard(card.status, 'ready')) {
    return { error: `A card in state "${card.status}" cannot be marked ready.` };
  }

  const { data: membership } = await admin
    .from('memberships')
    .select('*')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) return { error: 'Membership not found.' };

  const { data: updated } = await admin
    .from('membership_cards')
    .update({
      status: 'ready',
      ready_at: new Date().toISOString(),
      ready_by: ctx.user.id
    })
    .eq('id', card.id)
    .eq('status', card.status)
    .select('id');
  if (!updated || updated.length === 0) {
    return { error: 'The card changed while you were confirming it. Refresh and try again.' };
  }

  if (membership.status === 'processing') {
    await admin
      .from('memberships')
      .update({ status: 'card_ready' })
      .eq('id', membershipId)
      .eq('status', 'processing');
    await admin.from('membership_status_history').insert({
      membership_id: membershipId,
      previous_status: 'processing',
      new_status: 'card_ready',
      changed_by: ctx.user.id,
      reason: 'Card design marked ready for delivery'
    });
    await admin
      .from('orders')
      .update({ status: 'card_ready' })
      .eq('id', membership.order_id)
      .eq('status', 'membership_processing');
  }

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: 'card.marked_ready',
    entityType: 'membership_card',
    entityId: card.id,
    previousState: card.status,
    newState: 'ready',
    metadata: { membershipId, versionId: card.current_version_id }
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', membership.user_id)
    .maybeSingle();
  await notify(admin, {
    userId: membership.user_id,
    type: 'card_ready',
    title: 'Your membership card is ready',
    body: `Your personalised Vantera card (${membership.membership_number}) is ready to download in your portal.`,
    data: { membershipId },
    email: templates.cardReady(
      profile?.full_name?.trim() || 'member',
      membership.membership_number
    )
  });

  revalidatePath('/admin/card-designs');
  revalidatePath(`/admin/memberships/${membershipId}`);
  return { success: 'Card marked ready. The member has been notified.' };
}

/** Revoke a card (e.g. compromised or issued in error). Requires a reason. */
export async function revokeCardAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.CARDS_MANAGE);

  const schema = z.object({
    membershipId: uuidSchema,
    reason: z.string().trim().min(5, 'A reason is required').max(500)
  });
  const parsed = schema.safeParse({
    membershipId: formData.get('membershipId'),
    reason: formData.get('reason')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'A reason is required.' };
  }

  const admin = createAdminClient();
  const { data: card } = await admin
    .from('membership_cards')
    .select('*')
    .eq('membership_id', parsed.data.membershipId)
    .maybeSingle();
  if (!card) return { error: 'Card not found.' };
  if (!canTransitionCard(card.status, 'revoked')) {
    return { error: `A card in state "${card.status}" cannot be revoked.` };
  }

  await admin
    .from('membership_cards')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revocation_reason: parsed.data.reason
    })
    .eq('id', card.id);

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: 'card.revoked',
    entityType: 'membership_card',
    entityId: card.id,
    previousState: card.status,
    newState: 'revoked',
    metadata: { membershipId: parsed.data.membershipId, reason: parsed.data.reason }
  });

  revalidatePath('/admin/card-designs');
  revalidatePath(`/admin/memberships/${parsed.data.membershipId}`);
  return {
    success: 'Card revoked. It now shows as invalid on the public verification page.'
  };
}
