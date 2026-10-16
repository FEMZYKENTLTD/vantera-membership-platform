import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { CancelOrderForm } from '@/components/admin/order-actions';
import { formatMoney, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const ctx = await requireAdmin(PERMISSIONS.ORDERS_VIEW);
  const admin = createAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: payments }, { data: profile }, { data: membership }] = await Promise.all([
    admin
      .from('payment_submissions')
      .select('id, method, status, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false }),
    admin.from('profiles').select('full_name').eq('id', order.user_id).maybeSingle(),
    admin
      .from('memberships')
      .select('id, membership_number, status')
      .eq('order_id', order.id)
      .maybeSingle()
  ]);

  const canManage = ctx.permissions.has(PERMISSIONS.ORDERS_MANAGE);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/orders"
          className="text-xs uppercase tracking-[0.2em] text-ivory-100/40 hover:text-ivory-100/70"
        >
          ← Orders
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            title={`Order ${order.reference}`}
            description={`Placed ${formatDateTime(order.created_at)} by ${profile?.full_name || 'customer'}`}
          />
          <StatusBadge status={order.status} className="text-xs" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            <CardDescription>Price snapshot frozen at order time</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ['Tier (at order time)', order.tier_name_snapshot],
                ['Unit price', formatMoney(order.unit_price, order.currency)],
                ['Total', formatMoney(order.total_price, order.currency)],
                ['Currency', order.currency],
                ['Status', <StatusBadge key="s" status={order.status} />],
                ...(order.cancelled_at
                  ? [
                      ['Cancelled', formatDateTime(order.cancelled_at)],
                      ['Reason', order.cancellation_reason ?? '—']
                    ]
                  : [])
              ].map(([k, v]) => (
                <div
                  key={k as string}
                  className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-0"
                >
                  <dt className="text-ivory-100/40">{k}</dt>
                  <dd className="text-right text-ivory-100/85">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <ul className="space-y-2.5">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-noir-800 px-4 py-3 text-sm"
                    >
                      <span>
                        {p.method === 'crypto' ? 'Cryptocurrency' : 'Gift card'}
                        <span className="text-ivory-100/35"> · {formatDateTime(p.created_at)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <StatusBadge status={p.status} />
                        {ctx.permissions.has(PERMISSIONS.PAYMENTS_REVIEW) && (
                          <Link
                            href={`/admin/payments/${p.id}`}
                            className="text-xs text-gold-300 underline-offset-2 hover:underline"
                          >
                            Review
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ivory-100/40">No payment submissions yet.</p>
              )}
            </CardContent>
          </Card>

          {membership && (
            <Card>
              <CardHeader>
                <CardTitle>Membership</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <Link
                  href={`/admin/memberships/${membership.id}`}
                  className="text-gold-300 underline-offset-2 hover:underline"
                >
                  {membership.membership_number}
                </Link>
                <StatusBadge status={membership.status} />
              </CardContent>
            </Card>
          )}

          {canManage && !['completed', 'cancelled'].includes(order.status) && (
            <Card className="border-warning/30">
              <CardHeader>
                <CardTitle className="text-lg">Cancel order</CardTitle>
                <CardDescription>The member will be notified</CardDescription>
              </CardHeader>
              <CardContent>
                <CancelOrderForm orderId={order.id} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
