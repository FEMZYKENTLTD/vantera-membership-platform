import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Table, THead, TBody, TRow, TH, TD } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatMoney, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await requireUser('/portal/orders');
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Member portal</p>
          <h1 className="display-3 mt-2">Your orders</h1>
        </div>
        <Link href="/membership" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
          New order
        </Link>
      </div>

      {orders && orders.length > 0 ? (
        <div className="surface overflow-hidden">
          <Table>
            <THead>
              <TRow>
                <TH>Reference</TH>
                <TH>Tier</TH>
                <TH>Total</TH>
                <TH>Placed</TH>
                <TH>Status</TH>
                <TH className="sr-only">Open</TH>
              </TRow>
            </THead>
            <TBody>
              {orders.map((order) => (
                <TRow key={order.id}>
                  <TD className="font-medium text-ivory-100">{order.reference}</TD>
                  <TD>{order.tier_name_snapshot}</TD>
                  <TD>{formatMoney(order.total_price, order.currency)}</TD>
                  <TD>{formatDate(order.created_at)}</TD>
                  <TD>
                    <StatusBadge status={order.status} />
                  </TD>
                  <TD>
                    <Link
                      href={`/portal/orders/${order.id}`}
                      className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
                    >
                      Open →
                    </Link>
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No orders yet"
          body="Choose a membership tier to open your first order. Prices are locked to the published tier at the moment you order."
          action={
            <Link href="/membership" className={cn(buttonVariants())}>
              Browse membership tiers
            </Link>
          }
        />
      )}
    </div>
  );
}
