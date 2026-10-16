'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { orderCancelSchema } from '@/lib/validation/schemas';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';

export interface AdminActionState {
  error?: string;
  success?: string;
}

/**
 * Cancel an order. Orders whose payment was already approved (or that already
 * produced an active membership) cannot be cancelled without first resolving
 * the membership — separation of concerns enforced here.
 */
export async function cancelOrderAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.ORDERS_MANAGE);

  const parsed = orderCancelSchema.safeParse({
    orderId: formData.get('orderId'),
    reason: formData.get('reason')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'A reason is required.' };
  }
  const { orderId, reason } = parsed.data;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { error: 'Order not found.' };
  if (order.status === 'completed' || order.status === 'cancelled') {
    return { error: `An order in state "${order.status}" cannot be cancelled.` };
  }

  const { data: membership } = await admin
    .from('memberships')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (membership && ['active', 'card_ready', 'processing'].includes(membership.status)) {
    return {
      error: 'This order has an in-flight membership. Resolve the membership before cancelling.'
    };
  }

  const { data: updated } = await admin
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason
    })
    .eq('id', orderId)
    .neq('status', 'cancelled')
    .select('id');
  if (!updated || updated.length === 0) {
    return { error: 'The order changed while you were working. Refresh and try again.' };
  }

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: 'order.cancelled',
    entityType: 'order',
    entityId: orderId,
    previousState: order.status,
    newState: 'cancelled',
    metadata: { reference: order.reference, reason }
  });

  await notify(admin, {
    userId: order.user_id,
    type: 'system',
    title: 'Order cancelled',
    body: `Order ${order.reference} has been cancelled. Contact support if you have questions.`,
    data: { orderId }
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { success: 'Order cancelled and the member has been notified.' };
}
