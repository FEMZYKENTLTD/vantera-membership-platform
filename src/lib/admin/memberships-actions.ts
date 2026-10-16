'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { membershipActionSchema } from '@/lib/validation/schemas';
import { assertMembershipTransition } from '@/lib/memberships/transitions';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { templates } from '@/lib/email/templates';
import type { MembershipRow, MembershipStatus } from '@/types/database';

export interface AdminActionState {
  error?: string;
  success?: string;
}

type MembershipAction =
  | 'start_processing'
  | 'activate'
  | 'suspend'
  | 'revoke'
  | 'reinstate'
  | 'cancel'
  | 'expire';

const ACTION_TARGET: Record<MembershipAction, MembershipStatus> = {
  start_processing: 'processing',
  activate: 'active',
  suspend: 'suspended',
  revoke: 'revoked',
  reinstate: 'active',
  cancel: 'cancelled',
  expire: 'expired'
};

/**
 * Membership lifecycle action — the only path that changes membership status.
 *
 * Hard invariant: a membership can only reach `active` when its payment was
 * approved AND its card design is ready (the "no issue before approval" rule;
 * no exception policy is configured in this release).
 */
export async function membershipLifecycleAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = membershipActionSchema.safeParse({
    membershipId: formData.get('membershipId'),
    action: formData.get('action'),
    reason: formData.get('reason')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid membership action.' };
  }
  const { membershipId, action, reason } = parsed.data;

  const ctx = await requirePermission(PERMISSIONS.MEMBERSHIPS_MANAGE);
  const admin = createAdminClient();

  const { data: membership } = await admin
    .from('memberships')
    .select('*')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) return { error: 'Membership not found.' };

  const [{ data: orderRow }, { data: tierRow }] = await Promise.all([
    admin.from('orders').select('status').eq('id', membership.order_id).maybeSingle(),
    admin
      .from('membership_tiers')
      .select('duration_months, name')
      .eq('id', membership.tier_id)
      .maybeSingle()
  ]);

  const target = ACTION_TARGET[action];
  const transitionError = assertMembershipTransition(
    membership.status as MembershipStatus,
    target,
    action === 'reinstate' ? 'reinstated' : reason
  );
  if (transitionError) return { error: transitionError };

  if (action === 'start_processing' && orderRow?.status !== 'payment_approved') {
    return { error: 'Only memberships with an approved payment can enter processing.' };
  }

  if (action === 'activate') {
    const { data: card } = await admin
      .from('membership_cards')
      .select('status, current_version_id')
      .eq('membership_id', membershipId)
      .maybeSingle();
    if (!card || card.status !== 'ready' || !card.current_version_id) {
      return {
        error: 'The membership card design must be uploaded and marked ready before the membership can be activated.'
      };
    }
  }

  const now = new Date();
  const updates: Partial<MembershipRow> = {
    status: target,
    suspended_at: null,
    suspension_reason: null,
    revoked_at: null,
    revocation_reason: null
  };
  if (target === 'suspended') {
    updates.suspended_at = now.toISOString();
    updates.suspension_reason = reason;
  }
  if (target === 'revoked') {
    updates.revoked_at = now.toISOString();
    updates.revocation_reason = reason;
  }
  if (target === 'active' && action === 'activate') {
    updates.issued_at = now.toISOString();
    const duration = tierRow?.duration_months ?? null;
    if (duration) {
      const expires = new Date(now);
      expires.setUTCMonth(expires.getUTCMonth() + duration);
      updates.expires_at = expires.toISOString();
    }
  }

  const { data: updated, error: updateError } = await admin
    .from('memberships')
    .update(updates)
    .eq('id', membershipId)
    .eq('status', membership.status) // optimistic guard against races
    .select('id');

  if (updateError) return { error: 'The update could not be saved. Please try again.' };
  if (!updated || updated.length === 0) {
    return { error: 'This membership changed while you were reviewing it. Refresh and try again.' };
  }

  await admin.from('membership_status_history').insert({
    membership_id: membershipId,
    previous_status: membership.status,
    new_status: target,
    changed_by: ctx.user.id,
    reason: action === 'reinstate' ? reason ?? 'Membership reinstated' : reason ?? null
  });

  // Mirror lifecycle on the order where meaningful.
  if (action === 'start_processing') {
    await admin
      .from('orders')
      .update({ status: 'membership_processing' })
      .eq('id', membership.order_id)
      .eq('status', 'payment_approved');
  }
  if (action === 'activate') {
    await admin
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', membership.order_id)
      .in('status', ['card_ready', 'membership_processing', 'payment_approved']);
  }

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: `membership.${action}`,
    entityType: 'membership',
    entityId: membershipId,
    previousState: membership.status,
    newState: target,
    metadata: { reason: reason ?? '', orderId: membership.order_id }
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', membership.user_id)
    .maybeSingle();
  const name = profile?.full_name?.trim() || 'member';

  if (action === 'start_processing') {
    await notify(admin, {
      userId: membership.user_id,
      type: 'membership_processing',
      title: 'Your membership is being prepared',
      body: `Membership ${membership.membership_number} is now being prepared by our team.`,
      data: { membershipId },
      email: templates.membershipProcessing(name, membership.membership_number)
    });
  }
  if (action === 'suspend') {
    await notify(admin, {
      userId: membership.user_id,
      type: 'membership_suspended',
      title: 'Membership suspended',
      body: `Your membership ${membership.membership_number} has been suspended. Contact support for assistance.`,
      data: { membershipId },
      email: templates.membershipSuspended(name, membership.membership_number, reason ?? '')
    });
  }
  if (action === 'revoke') {
    await notify(admin, {
      userId: membership.user_id,
      type: 'membership_revoked',
      title: 'Membership revoked',
      body: `Your membership ${membership.membership_number} has been revoked.`,
      data: { membershipId },
      email: templates.membershipRevoked(name, membership.membership_number, reason ?? '')
    });
  }

  revalidatePath('/admin/memberships');
  revalidatePath(`/admin/memberships/${membershipId}`);
  revalidatePath('/admin/card-designs');

  const labels: Record<MembershipAction, string> = {
    start_processing: 'The membership is now being processed.',
    activate: 'Membership activated. The member can now use their issued card.',
    suspend: 'Membership suspended and the member has been notified.',
    revoke: 'Membership revoked and the member has been notified.',
    reinstate: 'Membership reinstated to active.',
    cancel: 'Membership cancelled.',
    expire: 'Membership marked as expired.'
  };
  return { success: labels[action] };
}
