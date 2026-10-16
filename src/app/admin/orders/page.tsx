import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Table, THead, TBody, TRow, TH, TD } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { formatMoney, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUSES = [
  'awaiting_payment',
  'payment_submitted',
  'under_review',
  'payment_approved',
  'payment_rejected',
  'additional_information_required',
  'membership_processing',
  'card_ready',
  'completed',
  'cancelled'
] as const;

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin(PERMISSIONS.ORDERS_VIEW);
  const { status, q } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status as (typeof STATUSES)[number]);
  }
  if (q?.trim()) {
    const term = q.trim().replace(/[%_]/g, '');
    query = query.or(`reference.ilike.%${term}%,tier_name_snapshot.ilike.%${term}%`);
  }
  const { data: orders } = await query;

  return (
    <div className="space-y-8">
      <PageHeader title="Orders" description="All membership orders with locked-in prices." />

      <form method="get" className="flex max-w-2xl gap-3">
        <Select name="status" defaultValue={status ?? ''} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Input name="q" placeholder="Search reference or tier…" defaultValue={q ?? ''} />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

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
              {orders.map((o) => (
                <TRow key={o.id}>
                  <TD className="font-medium text-ivory-100">{o.reference}</TD>
                  <TD>{o.tier_name_snapshot}</TD>
                  <TD>{formatMoney(o.total_price, o.currency)}</TD>
                  <TD>{formatDateTime(o.created_at)}</TD>
                  <TD>
                    <StatusBadge status={o.status} />
                  </TD>
                  <TD>
                    <Link
                      href={`/admin/orders/${o.id}`}
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
        <EmptyState title="No orders found" />
      )}
    </div>
  );
}
