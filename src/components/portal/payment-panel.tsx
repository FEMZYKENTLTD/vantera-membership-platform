'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  submitCryptoPaymentAction,
  submitGiftCardPaymentAction,
  resubmitCryptoPaymentAction,
  resubmitGiftCardPaymentAction,
  uploadEvidenceAction
} from '@/lib/portal/actions';
import { MEMBER_REOPENABLE_PAYMENT_STATUSES } from '@/lib/payments/state-machine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { StatusBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { cn, formatDateTime, truncateMiddle } from '@/lib/utils';
import { FileIcon, UploadIcon, LockIcon } from '@/components/icons';
import type { PaymentMethod, PaymentStatus } from '@/types/database';

interface CryptoCurrencyOption {
  asset: string;
  network: string;
  address: string;
  instructions: string;
  confirmationsRequired: number;
}

export interface SerializedPayment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  reviewNote: string | null;
  cryptoCurrency: string | null;
  network: string | null;
  expectedAmount: string | null;
  txHash: string | null;
  issuer: string | null;
  denomination: string | null;
  giftCurrency: string | null;
  purchaseReference: string | null;
  evidence: { id: string; fileName: string; sizeBytes: number; createdAt: string }[];
}

interface Props {
  order: {
    id: string;
    reference: string;
    totalPrice: string;
    currency: string;
    status: string;
    tierName: string;
  };
  acceptsPayment: boolean;
  verificationNotice: string;
  cryptoConfig:
    | { enabled: false }
    | { enabled: true; instructions: string; currencies: CryptoCurrencyOption[] };
  giftCardConfig:
    | { enabled: false }
    | { enabled: true; instructions: string; reviewNotice: string; issuers: string[] };
  payments: SerializedPayment[];
}

export function PaymentPanel({
  order,
  acceptsPayment,
  verificationNotice,
  cryptoConfig,
  giftCardConfig,
  payments
}: Props) {
  const methods: { key: PaymentMethod; label: string }[] = [];
  if (cryptoConfig.enabled && cryptoConfig.currencies.length > 0) {
    methods.push({ key: 'crypto', label: 'Cryptocurrency' });
  }
  if (giftCardConfig.enabled) {
    methods.push({ key: 'gift_card', label: 'Gift card' });
  }
  const [method, setMethod] = useState<PaymentMethod | null>(methods[0]?.key ?? null);

  // The newest submission still open for member correction (pre-review or
  // answering an information request). When present, that SAME row is
  // edited in place instead of filing a duplicate submission.
  const latest = payments[0];
  const editable =
    latest && MEMBER_REOPENABLE_PAYMENT_STATUSES.includes(latest.status) ? latest : null;

  return (
    <div className="space-y-8">
      {acceptsPayment ? (
        editable ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {editable.status === 'additional_information_required'
                  ? 'Update your submission'
                  : 'Amend your submission'}
              </CardTitle>
              <CardDescription>
                Order {order.reference} · total {order.totalPrice} {order.currency}
                {editable.status === 'additional_information_required' && editable.reviewNote
                  ? ` — our team asked: “${editable.reviewNote}”`
                  : ' — you can correct your submission until a reviewer begins working on it'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert tone="warning" title="Please read before paying">
                {verificationNotice}
              </Alert>
              {editable.method === 'crypto' && cryptoConfig.enabled && (
                <CryptoForm orderId={order.id} config={cryptoConfig} editing={editable} />
              )}
              {editable.method === 'gift_card' && giftCardConfig.enabled && (
                <GiftCardForm orderId={order.id} config={giftCardConfig} editing={editable} />
              )}
              {((editable.method === 'crypto' && !cryptoConfig.enabled) ||
                (editable.method === 'gift_card' && !giftCardConfig.enabled)) && (
                <Alert tone="info">
                  This payment method is temporarily paused by the business. You can provide
                  any requested evidence below — the review team will continue if the method is
                  re-enabled, otherwise a fresh submission will be possible.
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : methods.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Submit your payment</CardTitle>
              <CardDescription>
                Order {order.reference} · total {order.totalPrice} {order.currency}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert tone="warning" title="Please read before paying">
                {verificationNotice}
              </Alert>

              {/* If another open submission exists while re-openable editing
                  is not applicable (e.g. method currently disabled), a fresh
                  submission is blocked by the unique open-payment index — the
                  server maps that to a friendly error. */}

              {/* Method tabs */}
              <div
                role="tablist"
                aria-label="Payment method"
                className="flex gap-2 border-b border-border pb-px"
              >
                {methods.map((m) => (
                  <button
                    key={m.key}
                    role="tab"
                    aria-selected={method === m.key}
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      '-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors',
                      method === m.key
                        ? 'border-gold-500 text-gold-300'
                        : 'border-transparent text-ivory-100/50 hover:text-ivory-100'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {method === 'crypto' && cryptoConfig.enabled && (
                <CryptoForm orderId={order.id} config={cryptoConfig} />
              )}
              {method === 'gift_card' && giftCardConfig.enabled && (
                <GiftCardForm orderId={order.id} config={giftCardConfig} />
              )}
            </CardContent>
          </Card>
        ) : (
          <Alert tone="info" title="Payment methods are not yet enabled">
            The business is finalising payment configuration. As soon as an
            approved method is available, it will appear here. Nothing has been
            charged.
          </Alert>
        )
      ) : (
        <Alert tone="info">
          This order is no longer accepting new payment submissions.
        </Alert>
      )}

      {/* Submission history */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your submissions</CardTitle>
            <CardDescription>Payment details you have sent for review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {payments.map((p) => (
              <SubmissionCard key={p.id} payment={p} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CryptoForm({
  orderId,
  config,
  editing
}: {
  orderId: string;
  config: { instructions: string; currencies: CryptoCurrencyOption[] };
  editing?: SerializedPayment | null;
}) {
  const [state, formAction] = useActionState(
    editing ? resubmitCryptoPaymentAction : submitCryptoPaymentAction,
    {}
  );
  const [selection, setSelection] = useState(
    editing?.cryptoCurrency && editing.network
      ? `${editing.cryptoCurrency}|${editing.network}`
      : ''
  );
  const selected = useMemo(
    () => config.currencies.find((c) => `${c.asset}|${c.network}` === selection) ?? null,
    [selection, config.currencies]
  );

  return (
    <div className="space-y-5">
      {config.instructions && (
        <p className="text-sm leading-relaxed text-ivory-100/60 whitespace-pre-line">
          {config.instructions}
        </p>
      )}
      <form action={formAction} className="space-y-5">
        {editing ? (
          <input type="hidden" name="paymentId" value={editing.id} />
        ) : (
          <input type="hidden" name="orderId" value={orderId} />
        )}

        <Field label="Cryptocurrency and network" htmlFor="pair" required>
          <Select
            id="pair"
            required
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="" disabled>
              Select a cryptocurrency…
            </option>
            {config.currencies.map((c) => (
              <option key={`${c.asset}|${c.network}`} value={`${c.asset}|${c.network}`}>
                {c.asset} — {c.network}
              </option>
            ))}
          </Select>
          <input type="hidden" name="cryptoCurrency" value={selected?.asset ?? ''} />
          <input type="hidden" name="network" value={selected?.network ?? ''} />
        </Field>

        {selected && (
          <div className="rounded-md border border-gold-500/30 bg-gold-500/[0.06] p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400">
              Send {selected.asset} on {selected.network} to
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="break-all font-mono text-sm text-ivory-100">
                {selected.address}
              </code>
              <CopyButton value={selected.address} />
            </div>
            {selected.instructions && (
              <p className="mt-2 text-xs leading-relaxed text-ivory-100/55">
                {selected.instructions}
              </p>
            )}
            <p className="mt-2 text-xs text-ivory-100/40">
              Reviewed after {selected.confirmationsRequired} network confirmation
              {selected.confirmationsRequired > 1 ? 's' : ''} at minimum.
            </p>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label={`Amount sent (${selected?.asset ?? 'crypto'})`}
            htmlFor="expectedAmount"
            required
            hint="The exact amount you transferred, e.g. 0.05250000"
          >
            <Input
              id="expectedAmount"
              name="expectedAmount"
              inputMode="decimal"
              placeholder="0.00000000"
              defaultValue={editing?.expectedAmount ?? undefined}
              required
            />
          </Field>
          <Field
            label="Payment date and time"
            htmlFor="paidAt"
            hint="Approximately when you sent it (your local time)"
          >
            <Input id="paidAt" name="paidAt" type="datetime-local" />
          </Field>
        </div>

        <Field
          label="Transaction hash"
          htmlFor="txHash"
          hint="Optional, but it speeds up verification. Letters and numbers only."
        >
          <Input
            id="txHash"
            name="txHash"
            placeholder="9f2c…"
            maxLength={128}
            defaultValue={editing?.txHash ?? undefined}
          />
        </Field>

        <Field label="Notes for the review team" htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="Anything that helps us match your transfer (no sensitive information)."
          />
        </Field>

        <Alert tone="info">
          A transaction hash or screenshot alone does not approve your payment —
          our team verifies it against the receiving wallet before approving.
          Vantera will never ask for your wallet private keys or seed phrase.
        </Alert>

        <SubmitButton pendingLabel="Submitting for review…">
          {editing ? 'Save changes for review' : 'Submit payment for review'}
        </SubmitButton>
        <FormStateMessage state={state} />
      </form>
    </div>
  );
}

function GiftCardForm({
  orderId,
  config,
  editing
}: {
  orderId: string;
  config: { instructions: string; reviewNotice: string; issuers: string[] };
  editing?: SerializedPayment | null;
}) {
  const [state, formAction] = useActionState(
    editing ? resubmitGiftCardPaymentAction : submitGiftCardPaymentAction,
    {}
  );

  return (
    <div className="space-y-5">
      <Alert tone="warning" title="Never share gift-card secrets">
        Do <strong>not</strong> submit card PINs, redemption codes or claim
        codes — in this form, in notes, or in uploaded evidence (obscure them
        on receipts). Vantera will never ask for them.
      </Alert>
      {config.instructions && (
        <p className="text-sm leading-relaxed text-ivory-100/60 whitespace-pre-line">
          {config.instructions}
        </p>
      )}
      {config.reviewNotice && (
        <p className="text-xs leading-relaxed text-ivory-100/45">{config.reviewNotice}</p>
      )}

      <form action={formAction} className="space-y-5">
        {editing ? (
          <input type="hidden" name="paymentId" value={editing.id} />
        ) : (
          <input type="hidden" name="orderId" value={orderId} />
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Gift-card issuer" htmlFor="issuer" required>
            {config.issuers.length > 0 ? (
              <Select
                id="issuer"
                name="issuer"
                required
                defaultValue={editing?.issuer ?? undefined}
              >
                <option value="" disabled>
                  Select an approved issuer…
                </option>
                {config.issuers.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id="issuer"
                name="issuer"
                required
                maxLength={100}
                defaultValue={editing?.issuer ?? undefined}
              />
            )}
          </Field>
          <Field label="Purchase / order reference" htmlFor="purchaseReference">
            <Input
              id="purchaseReference"
              name="purchaseReference"
              maxLength={120}
              placeholder="Receipt or order number from your purchase"
              defaultValue={editing?.purchaseReference ?? undefined}
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Card denomination" htmlFor="denomination" required>
            <Input
              id="denomination"
              name="denomination"
              inputMode="decimal"
              placeholder="e.g. 1000.00"
              defaultValue={editing?.denomination ?? undefined}
              required
            />
          </Field>
          <Field label="Currency" htmlFor="currency" required>
            <Input
              id="currency"
              name="currency"
              defaultValue={editing?.giftCurrency ?? 'USD'}
              maxLength={3}
              required
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="Where and when the card was purchased. Do not include the card number or PIN."
          />
        </Field>

        <SubmitButton pendingLabel="Submitting for review…">
          {editing ? 'Save changes for review' : 'Submit for review'}
        </SubmitButton>
        <FormStateMessage state={state} />
      </form>
    </div>
  );
}

function SubmissionCard({ payment }: { payment: SerializedPayment }) {
  return (
    <div className="rounded-lg border border-border bg-noir-850 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ivory-100">
            {payment.method === 'crypto' ? 'Cryptocurrency' : 'Gift card'} submission
          </p>
          <p className="text-xs text-ivory-100/40">Submitted {formatDateTime(payment.createdAt)}</p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {payment.method === 'crypto' ? (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-ivory-100/40">Asset</dt>
              <dd className="text-ivory-100/80">
                {payment.cryptoCurrency} · {payment.network}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ivory-100/40">Declared amount</dt>
              <dd className="text-ivory-100/80">{payment.expectedAmount}</dd>
            </div>
            {payment.txHash && (
              <div className="flex justify-between gap-2 sm:col-span-2">
                <dt className="text-ivory-100/40">Transaction</dt>
                <dd className="font-mono text-xs text-ivory-100/70">
                  {truncateMiddle(payment.txHash, 14, 8)}
                </dd>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-ivory-100/40">Issuer</dt>
              <dd className="text-ivory-100/80">{payment.issuer}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ivory-100/40">Denomination</dt>
              <dd className="text-ivory-100/80">
                {payment.denomination} {payment.giftCurrency}
              </dd>
            </div>
            {payment.purchaseReference && (
              <div className="flex justify-between gap-2 sm:col-span-2">
                <dt className="text-ivory-100/40">Purchase reference</dt>
                <dd className="text-ivory-100/70">{payment.purchaseReference}</dd>
              </div>
            )}
          </>
        )}
      </dl>

      {payment.reviewNote &&
        ['rejected', 'additional_information_required'].includes(payment.status) && (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-[#E3C893]">
            Message from the review team: {payment.reviewNote}
          </div>
        )}

      {/* Evidence */}
      <div className="mt-4 border-t border-border/60 pt-4">
        {payment.evidence.length > 0 && (
          <ul className="mb-4 space-y-2">
            {payment.evidence.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 text-xs text-ivory-100/60">
                <FileIcon className="size-3.5 text-gold-400" />
                <a
                  href={`/api/evidence/${e.id}`}
                  className="underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {e.fileName}
                </a>
                <span className="text-ivory-100/30">
                  ({Math.round(e.sizeBytes / 1024)} KB · {formatDateTime(e.createdAt)})
                </span>
              </li>
            ))}
          </ul>
        )}
        {['pending_review', 'submitted', 'under_review', 'additional_information_required'].includes(
          payment.status
        ) && <EvidenceUpload paymentId={payment.id} />}
      </div>
    </div>
  );
}

function EvidenceUpload({ paymentId }: { paymentId: string }) {
  const [state, formAction] = useActionState(uploadEvidenceAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="paymentId" value={paymentId} />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-4 text-xs text-ivory-100/50 transition-colors hover:border-gold-500/40 hover:text-ivory-100/80">
        <UploadIcon className="size-4" />
        Upload supporting evidence — PNG, JPEG or PDF, max 10 MB
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,application/pdf"
          className="sr-only"
          required
        />
      </label>
      <p className="flex items-center gap-1.5 text-[11px] text-ivory-100/35">
        <LockIcon className="size-3" /> Stored privately. Never include PINs,
        codes, keys or seed phrases.
      </p>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Uploading…" className="self-start">
        Upload
      </SubmitButton>
      <FormStateMessage state={state} />
    </form>
  );
}
