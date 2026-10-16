import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  getCryptoConfig,
  getGiftCardConfig,
  getVerificationNotice,
  getBusinessVerification,
  holidaySet
} from '@/lib/settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { OrderTimeline } from '@/components/portal/order-timeline';
import { PaymentPanel } from '@/components/portal/payment-panel';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { verificationEstimate } from '@/lib/business-days';
import { ORDER_ACCEPTS_PAYMENT } from '@/lib/payments/state-machine';

export const metadata: Metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ created?: string; submitted?: string }>;
}) {
  const { orderId } = await params;
  const { created, submitted } = await searchParams;
  const user = await requireUser('/portal/orders');
  const supabase = await createClient();

  // RLS scopes this to the member's own orders — a foreign id yields null.
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: payments }, notice, cryptoCfg, giftCfg, bizCfg] = await Promise.all([
    supabase
      .from('payment_submissions')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false }),
    getVerificationNotice(),
    getCryptoConfig(),
    getGiftCardConfig(),
    getBusinessVerification()
  ]);

  const paymentIds = (payments ?? []).map((p) => p.id);
  const { data: evidence } = paymentIds.length
    ? await supabase
        .from('payment_evidence')
        .select('*')
        .in('payment_id', paymentIds)
        .order('created_at', { ascending: true })
    : { data: [] };

  const latestPayment = payments?.[0];
  const estimate = latestPayment
    ? verificationEstimate(
        new Date(latestPayment.created_at),
        bizCfg.workingDays,
        holidaySet(bizCfg)
      )
    : null;

  const acceptsPayment = ORDER_ACCEPTS_PAYMENT.includes(order.status);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/orders"
          className="text-xs uppercase tracking-[0.2em] text-ivory-100/40 hover:text-ivory-100/70"
        >
          ← Orders
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display-3">
              {order.tier_name_snapshot}{' '}
              <span className="font-sans text-base text-ivory-100/40">{order.reference}</span>
            </h1>
            <p className="mt-1 text-sm text-ivory-100/50">
              Placed {formatDateTime(order.created_at)} ·{' '}
              {formatMoney(order.total_price, order.currency)} (price locked)
            </p>
          </div>
          <StatusBadge status={order.status} className="text-xs" />
        </div>
      </div>

      {created && (
        <Alert tone="success" title="Order created">
          Your order {order.reference} is open. Choose an approved payment
          method below and submit the details for verification.
        </Alert>
      )}
      {submitted && (
        <Alert tone="success" title="Payment submission received">
          Your payment is now awaiting verification — submitting payment
          details is not an approval, and our team will review everything
          manually.
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {/* Review status banner */}
          {latestPayment && ['pending_review', 'submitted', 'under_review'].includes(latestPayment.status) && estimate && (
            <Alert tone="info" title="Verification in progress">
              Submitted {formatDateTime(latestPayment.created_at)}. Expected
              within {estimate.label} (weekends and configured holidays
              excluded)
              {estimate.overdue &&
                ' — it is taking a little longer than usual. Thank you for your patience.'}
            </Alert>
          )}
          {latestPayment?.status === 'additional_information_required' && (
            <Alert tone="warning" title="Additional information required">
              {latestPayment.review_note ??
                'Our review team needs more information. Add a new submission or evidence below.'}
            </Alert>
          )}
          {latestPayment?.status === 'rejected' && (
            <Alert tone="error" title="Payment not approved">
              Reason: {latestPayment.review_note ?? 'Contact support for details.'} You may
              submit a new payment below.
            </Alert>
          )}

          <PaymentPanel
            order={{
              id: order.id,
              reference: order.reference,
              totalPrice: String(order.total_price),
              currency: order.currency,
              status: order.status,
              tierName: order.tier_name_snapshot
            }}
            acceptsPayment={acceptsPayment}
            verificationNotice={notice.text}
            cryptoConfig={
              cryptoCfg.enabled
                ? {
                    enabled: true,
                    instructions: cryptoCfg.instructions,
                    currencies: cryptoCfg.currencies
                  }
                : { enabled: false as const }
            }
            giftCardConfig={
              giftCfg.enabled
                ? {
                    enabled: true,
                    instructions: giftCfg.instructions,
                    reviewNotice: giftCfg.reviewNotice,
                    issuers: giftCfg.issuers
                  }
                : { enabled: false as const }
            }
            payments={(payments ?? []).map((p) => ({
              id: p.id,
              method: p.method,
              status: p.status,
              createdAt: p.created_at,
              reviewNote: p.review_note,
              cryptoCurrency: p.crypto_currency,
              network: p.network,
              expectedAmount: p.expected_amount ? String(p.expected_amount) : null,
              txHash: p.tx_hash,
              issuer: p.gift_card_issuer,
              denomination: p.gift_card_denomination ? String(p.gift_card_denomination) : null,
              giftCurrency: p.gift_card_currency,
              purchaseReference: p.purchase_reference,
              evidence: (evidence ?? [])
                .filter((e) => e.payment_id === p.id)
                .map((e) => ({
                  id: e.id,
                  fileName: e.file_name,
                  sizeBytes: e.size_bytes,
                  createdAt: e.created_at
                }))
            }))}
          />
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>Where this order stands</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTimeline status={order.status} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
