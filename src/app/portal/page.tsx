import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { computeNextStep } from '@/lib/portal/next-step';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ArrowRightIcon, BellIcon, ClockIcon } from '@/components/icons';
import { cn, formatMoney, formatDateTime } from '@/lib/utils';
import { EmptyState } from '@/components/ui/misc';
import { verificationEstimate } from '@/lib/business-days';
import { getBusinessVerification, holidaySet } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function PortalOverviewPage() {
  const user = await requireUser('/portal');
  const supabase = await createClient();

  const [{ data: profile }, { data: orders }, { data: memberships }, { data: notifications }] =
    await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('memberships').select('*').limit(5),
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4)
    ]);

  const openOrder = orders?.find((o) => !['completed', 'cancelled'].includes(o.status));
  const latestOrder = orders?.[0];

  // Latest payment on the relevant order for the next-step calculation.
  let paymentStatus;
  let paymentCreatedAt: string | null = null;
  let orderRejected = false;
  if (openOrder) {
    const { data: payment } = await supabase
      .from('payment_submissions')
      .select('status, created_at')
      .eq('order_id', openOrder.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    paymentStatus = payment?.status;
    paymentCreatedAt = payment?.created_at ?? null;
    const { count: rejectedCount } = await supabase
      .from('payment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', openOrder.id)
      .eq('status', 'rejected')
      .limit(1);
    orderRejected = (rejectedCount ?? 0) > 0 && ['payment_rejected'].includes(openOrder.status);
  }

  const membership = memberships?.[0];
  let cardStatus;
  if (membership) {
    const { data: card } = await supabase
      .from('membership_cards')
      .select('status')
      .eq('membership_id', membership.id)
      .maybeSingle();
    cardStatus = card?.status;
  }

  const next = computeNextStep({
    orderStatus: openOrder?.status,
    paymentStatus,
    membershipStatus: membership?.status,
    cardStatus,
    orderId: openOrder?.id ?? latestOrder?.id,
    membershipId: membership?.id,
    orderRejected
  });

  const cfg = await getBusinessVerification();
  const estimate = paymentCreatedAt
    ? verificationEstimate(new Date(paymentCreatedAt), cfg.workingDays, holidaySet(cfg))
    : null;

  const name = profile?.full_name?.split(' ')[0] || 'member';

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h1 className="display-3 mt-2">{name}</h1>
      </div>

      {/* Next step */}
      <Card className="border-gold-500/30 bg-gradient-to-br from-gold-500/[0.06] to-transparent">
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow mb-2">Your next step</p>
            <h2 className="font-display text-2xl text-ivory-100">{next.title}</h2>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ivory-100/60">
              {next.body}
            </p>
            {estimate && ['verifying'].includes(next.state) && (
              <p className="mt-2 flex items-center gap-2 text-xs text-ivory-100/45">
                <ClockIcon className="size-3.5" />
                Submitted {formatDateTime(paymentCreatedAt)} · expected within{' '}
                {estimate.label}
                {estimate.overdue && ' (running longer than usual — thank you for your patience)'}
              </p>
            )}
          </div>
          {next.cta && (
            <Link
              href={next.cta.href}
              className={cn(buttonVariants({ size: 'lg' }), 'shrink-0')}
            >
              {next.cta.label} <ArrowRightIcon />
            </Link>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Orders snapshot */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription>Your recent membership orders</CardDescription>
            </div>
            <Link
              href="/portal/orders"
              className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {orders && orders.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/portal/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-ivory-100/[0.02] -mx-2 px-2 rounded"
                    >
                      <div>
                        <p className="text-sm text-ivory-100/90">{order.tier_name_snapshot}</p>
                        <p className="text-xs text-ivory-100/40">
                          {order.reference} · {formatMoney(order.total_price, order.currency)}
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No orders yet"
                body="When you choose a membership tier, your order appears here."
                action={
                  <Link
                    href="/membership"
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                  >
                    Browse tiers
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Recent notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Latest updates on your membership</CardDescription>
            </div>
            <Link
              href="/portal/notifications"
              className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {notifications && notifications.length > 0 ? (
              <ul className="space-y-4">
                {notifications.map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <BellIcon
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        n.read_at ? 'text-ivory-100/25' : 'text-gold-400'
                      )}
                    />
                    <div>
                      <p className={cn('text-sm', !n.read_at && 'text-ivory-100')}>{n.title}</p>
                      <p className="text-xs leading-relaxed text-ivory-100/45">{n.body}</p>
                      <p className="mt-1 text-[11px] text-ivory-100/30">
                        {formatDateTime(n.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing yet"
                body="Updates about your orders, payments and membership will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
