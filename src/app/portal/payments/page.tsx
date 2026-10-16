import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Table, THead, TBody, TRow, TH, TD } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const user = await requireUser('/portal/payments');
  const supabase = await createClient();

  const { data: payments } = await supabase
    .from('payment_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  const orderIds = [...new Set((payments ?? []).map((p) => p.order_id))];
  const { data: orders } = orderIds.length
    ? await supabase.from('orders').select('id, reference').in('id', orderIds)
    : { data: [] };
  const refById = new Map((orders ?? []).map((o) => [o.id, o.reference]));

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Member portal</p>
        <h1 className="display-3 mt-2">Payment submissions</h1>
        <p className="mt-2 max-w-lg text-sm text-ivory-100/50">
          Evidence and details you have submitted for review. A submission is
          never an approval — every payment is verified by our team.
        </p>
      </div>

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
              </TRow>
            </THead>
            <TBody>
              {payments.map((p) => (
                <TRow key={p.id}>
                  <TD>
                    <Link
                      href={`/portal/orders/${p.order_id}`}
                      className="text-gold-300 underline-offset-2 hover:underline"
                    >
                      {refById.get(p.order_id) ?? 'Order'}
                    </Link>
                  </TD>
                  <TD>{p.method === 'crypto' ? 'Cryptocurrency' : 'Gift card'}</TD>
                  <TD className="text-xs">
                    {p.method === 'crypto'
                      ? `${p.crypto_currency} · ${p.network} · ${String(p.expected_amount ?? '')}`
                      : `${p.gift_card_issuer} · ${String(p.gift_card_denomination ?? '')} ${p.gift_card_currency}`}
                  </TD>
                  <TD>{formatDateTime(p.created_at)}</TD>
                  <TD>
                    <StatusBadge status={p.status} />
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No payment submissions"
          body="When you submit payment details from one of your orders, they will appear here with live review status."
        />
      )}
    </div>
  );
}
