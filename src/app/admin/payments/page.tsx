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
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  'pending_review',
  'under_review',
  'approved',
  'rejected',
  'additional_information_required'
] as const;

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    method?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireAdmin(PERMISSIONS.PAYMENTS_REVIEW);
  const { status, method, q, from, to } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('payment_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
    query = query.eq(
      'status',
      status as (typeof STATUS_OPTIONS)[number]
    );
  }
  if (method === 'crypto' || method === 'gift_card') query = query.eq('method', method);
  if (from) query = query.gte('created_at', new Date(from).toISOString());
  if (to) query = query.lte('created_at', new Date(`${to}T23:59:59Z`).toISOString());
  if (q?.trim()) {
    const term = q.trim().replace(/[%_]/g, '');
    query = query.or(
      `tx_hash.ilike.%${term}%,gift_card_issuer.ilike.%${term}%,purchase_reference.ilike.%${term}%`
    );
  }
  const { data: payments } = await query;

  // Order references + packages for display/filter context.
  const orderIds = [...new Set((payments ?? []).map((p) => p.order_id))];
  const { data: orders } = orderIds.length
    ? await admin
        .from('orders')
        .select('id, reference, tier_name_snapshot')
        .in('id', orderIds)
    : { data: [] };
  const orderInfo = new Map(
    (orders ?? []).map((o) => [o.id, `${o.reference} · ${o.tier_name_snapshot}`])
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payment review queue"
        description="Verify each submission against receiving records. Decisions are confirmed, reasoned and audit-logged."
      />

      <form method="get" className="grid gap-3 rounded-lg border border-border bg-noir-850 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select name="status" defaultValue={status ?? ''} aria-label="Status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Select name="method" defaultValue={method ?? ''} aria-label="Method">
          <option value="">All methods</option>
          <option value="crypto">Cryptocurrency</option>
          <option value="gift_card">Gift card</option>
        </Select>
        <Input type="date" name="from" defaultValue={from ?? ''} aria-label="From date" />
        <Input type="date" name="to" defaultValue={to ?? ''} aria-label="To date" />
        <div className="flex gap-2">
          <Input
            name="q"
            placeholder="Ref, hash or issuer…"
            defaultValue={q ?? ''}
            aria-label="Search"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-10">
            Filter
          </Button>
        </div>
      </form>

      {payments && payments.length > 0 ? (
        <div className="surface overflow-hidden">
          <Table>
            <THead>
              <TRow>
                <TH>Order</TH>
                <TH>Method</TH>
                <TH>Details</TH>
                <TH>Submitted</TH>
                <TH>Status</TH>
                <TH className="sr-only">Review</TH>
              </TRow>
            </THead>
            <TBody>
              {payments.map((p) => (
                <TRow key={p.id}>
                  <TD className="text-ivory-100">{orderInfo.get(p.order_id) ?? 'Order'}</TD>
                  <TD>{p.method === 'crypto' ? 'Crypto' : 'Gift card'}</TD>
                  <TD className="max-w-[240px] truncate text-xs">
                    {p.method === 'crypto'
                      ? `${p.crypto_currency} · ${p.network} · ${String(p.expected_amount ?? '')}`
                      : `${p.gift_card_issuer} · ${String(p.gift_card_denomination ?? '')} ${p.gift_card_currency}`}
                  </TD>
                  <TD>{formatDateTime(p.created_at)}</TD>
                  <TD>
                    <StatusBadge status={p.status} />
                  </TD>
                  <TD>
                    <Link
                      href={`/admin/payments/${p.id}`}
                      className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
                    >
                      Review →
                    </Link>
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="The queue is clear"
          body="No payment submissions match these filters."
        />
      )}
    </div>
  );
}
