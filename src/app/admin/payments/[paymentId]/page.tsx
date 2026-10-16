import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { PaymentReviewForm } from '@/components/admin/payment-review-form';
import { FileIcon } from '@/components/icons';
import { formatDateTime, formatMoney, truncateMiddle } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentDetailPage({
  params
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const ctx = await requireAdmin(PERMISSIONS.PAYMENTS_REVIEW);
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from('payment_submissions')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment) notFound();

  const [{ data: order }, { data: evidence }, { data: history }, { data: profile }] =
    await Promise.all([
      admin.from('orders').select('*').eq('id', payment.order_id).maybeSingle(),
      admin
        .from('payment_evidence')
        .select('*')
        .eq('payment_id', payment.id)
        .order('created_at', { ascending: true }),
      admin
        .from('payment_review_history')
        .select('*')
        .eq('payment_id', payment.id)
        .order('created_at', { ascending: false }),
      admin
        .from('profiles')
        .select('full_name')
        .eq('id', payment.user_id)
        .maybeSingle()
    ]);

  const permissions = Array.from(ctx.permissions);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/payments"
          className="text-xs uppercase tracking-[0.2em] text-ivory-100/40 hover:text-ivory-100/70"
        >
          ← Payment queue
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            title={`${payment.method === 'crypto' ? 'Cryptocurrency' : 'Gift-card'} submission`}
            description={`Order ${order?.reference ?? ''} · submitted ${formatDateTime(payment.created_at)}`}
          />
          <StatusBadge status={payment.status} className="text-xs" />
        </div>
      </div>

      {payment.method === 'gift_card' && (
        <Alert tone="warning" title="Gift-card review policy">
          Verify issuer terms and proof of purchase only. Customers must never
          submit PINs or redemption codes; if any evidence contains them, do
          not record or forward those values anywhere.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Submission details */}
        <Card>
          <CardHeader>
            <CardTitle>Submission details</CardTitle>
            <CardDescription>As declared by the customer</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {([
                ['Customer', profile?.full_name || '—'],
                ['Order', `${order?.reference ?? '—'} · ${order?.tier_name_snapshot ?? ''}`],
                [
                  'Order amount',
                  order ? formatMoney(order.total_price, order.currency) : '—'
                ],
                ...(payment.method === 'crypto'
                  ? [
                      ['Asset', `${payment.crypto_currency} on ${payment.network}`],
                      ['Declared amount', String(payment.expected_amount ?? '—')],
                      [
                        'Transaction hash',
                        payment.tx_hash ? (
                          <span key="tx" className="font-mono text-xs">
                            {truncateMiddle(payment.tx_hash, 16, 10)}
                          </span>
                        ) : (
                          'Not provided'
                        )
                      ],
                      ['Paid at', formatDateTime(payment.paid_at)]
                    ]
                  : [
                      ['Issuer', payment.gift_card_issuer ?? '—'],
                      [
                        'Denomination',
                        `${String(payment.gift_card_denomination ?? '')} ${payment.gift_card_currency}`
                      ],
                      ['Purchase reference', payment.purchase_reference ?? 'Not provided']
                    ]),
                ['Submitted', formatDateTime(payment.created_at)],
                ['Customer notes', payment.submitter_notes ?? '—']
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start justify-between gap-6 border-b border-border/50 pb-3 last:border-0"
                >
                  <dt className="shrink-0 text-ivory-100/40">{k}</dt>
                  <dd className="break-words text-right text-ivory-100/85">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Evidence */}
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              <CardDescription>Private files; authorised access only</CardDescription>
            </CardHeader>
            <CardContent>
              {evidence && evidence.length > 0 ? (
                <ul className="space-y-2.5">
                  {evidence.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-noir-800 px-4 py-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileIcon className="size-4 shrink-0 text-gold-400" />
                        <span className="truncate">{e.file_name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-ivory-100/40">
                        {Math.round(e.size_bytes / 1024)} KB
                        <a
                          href={`/api/evidence/${e.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gold-300 underline-offset-2 hover:underline"
                        >
                          Open
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ivory-100/40">No evidence files uploaded.</p>
              )}
            </CardContent>
          </Card>

          {/* Review actions */}
          <Card className="border-gold-500/25">
            <CardHeader>
              <CardTitle>Review decision</CardTitle>
              <CardDescription>
                Recorded with your identity, the previous status and your reason
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentReviewForm
                paymentId={payment.id}
                status={payment.status}
                permissions={permissions}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review history */}
      <Card>
        <CardHeader>
          <CardTitle>Review history</CardTitle>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <ul className="space-y-3">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3 text-sm last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {h.previous_status ? (
                      <>
                        <StatusBadge status={h.previous_status} />
                        <span className="text-ivory-100/30">→</span>
                      </>
                    ) : null}
                    <StatusBadge status={h.new_status} />
                    {h.reason && (
                      <span className="max-w-md truncate text-xs italic text-ivory-100/40">
                        “{h.reason}”
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ivory-100/35">{formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ivory-100/40">No review events yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
