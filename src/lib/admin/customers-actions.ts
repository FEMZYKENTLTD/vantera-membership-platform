'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { customerStatusSchema } from '@/lib/validation/schemas';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit } from '@/lib/audit/log';

export interface AdminActionState {
  error?: string;
  success?: string;
}

/** Suspend or reinstate a customer account. Suspension requires a reason. */
export async function setCustomerStatusAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);

  const parsed = customerStatusSchema.safeParse({
    userId: formData.get('userId'),
    status: formData.get('status'),
    reason: formData.get('reason')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  }
  const { userId, status, reason } = parsed.data;

  if (status === 'suspended' && (!reason || reason.trim().length < 5)) {
    return { error: 'A reason of at least 5 characters is required to suspend an account.' };
  }
  if (userId === ctx.user.id) {
    return { error: 'You cannot change the status of your own account.' };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('status')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return { error: 'Customer not found.' };

  const { error } = await admin
    .from('profiles')
    .update({ status })
    .eq('id', userId);
  if (error) return { error: 'The account could not be updated.' };

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: status === 'suspended' ? 'customer.suspended' : 'customer.reinstated',
    entityType: 'profile',
    entityId: userId,
    previousState: profile.status,
    newState: status,
    metadata: { reason: reason ?? '' }
  });

  revalidatePath('/admin/customers');
  revalidatePath(`/admin/customers/${userId}`);
  return { success: status === 'suspended' ? 'Account suspended.' : 'Account reinstated.' };
}
