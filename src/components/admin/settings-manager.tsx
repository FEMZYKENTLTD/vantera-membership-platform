'use client';

import { useActionState } from 'react';
import { updateSettingAction } from '@/lib/admin/settings-actions';
import { SubmitButton, FormStateMessage, Field } from '@/components/ui/form';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Structured settings editor. Sensitive payment configuration gets guided
 * forms (so addresses/networks are entered correctly); simple content keys
 * get fields. The platform NEVER collects private keys, seed phrases, PINs
 * or redeemable codes anywhere — including here.
 */

export interface SettingRow {
  key: string;
  value: unknown;
  description: string;
  is_public: boolean;
}

function useSettingSubmit(key: string, isPublic: boolean) {
  const [state, formAction] = useActionState(updateSettingAction, {});
  const build = (value: unknown) => {
    const formData = new FormData();
    formData.set('key', key);
    formData.set('value', JSON.stringify(value));
    formData.set('isPublic', String(isPublic));
    formAction(formData);
  };
  return { state, build };
}

export function SettingsManager({ rows }: { rows: SettingRow[] }) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return (
    <div className="space-y-10">
      <BrandEditor row={byKey.get('brand')} />
      <ContactEditor row={byKey.get('contact')} />
      <CryptoEditor row={byKey.get('payments.crypto')} />
      <GiftCardEditor row={byKey.get('payments.gift_card')} />
      <VerificationEditor
        noticeRow={byKey.get('payments.verification_notice')}
        businessRow={byKey.get('business.verification')}
        displayRow={byKey.get('verification.card_display')}
      />
      <DobEditor row={byKey.get('profile.require_date_of_birth')} />
      <RetentionEditor row={byKey.get('privacy.retention')} />
    </div>
  );
}

function shell(
  title: string,
  row: SettingRow | undefined,
  children: React.ReactNode,
  note?: string
) {
  return (
    <section className="rounded-lg border border-border bg-noir-850 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">{title}</h2>
          {row?.description && (
            <p className="mt-1 text-xs text-ivory-100/40">{row.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {row && (
            <Badge tone={row.is_public ? 'blue' : 'neutral'}>
              {row.is_public ? 'publicly readable' : 'private'}
            </Badge>
          )}
        </div>
      </div>
      {children}
      {note && (
        <p className="mt-4 text-[11px] leading-relaxed text-ivory-100/35">{note}</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function BrandEditor({ row }: { row?: SettingRow }) {
  const { state, build } = useSettingSubmit('brand', true);
  const v = (row?.value ?? {}) as Record<string, string>;
  const [form, setForm] = useState({
    name: v.name ?? 'Vantera',
    tagline: v.tagline ?? '',
    supportEmail: v.supportEmail ?? '',
    phone: v.phone ?? ''
  });
  return shell(
    'Brand',
    row,
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Brand name" htmlFor="b-name">
        <Input id="b-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Tagline" htmlFor="b-tagline">
        <Input id="b-tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
      </Field>
      <Field label="Support email (public)" htmlFor="b-email">
        <Input id="b-email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
      </Field>
      <Field label="Phone (public, optional)" htmlFor="b-phone">
        <Input id="b-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton variant="secondary" onClick={() => build(form)}>
          Save brand
        </SubmitButton>
        <div className="mt-3"><FormStateMessage state={state} /></div>
      </div>
    </div>
  );
}

function ContactEditor({ row }: { row?: SettingRow }) {
  const { state, build } = useSettingSubmit('contact', true);
  const v = (row?.value ?? {}) as Record<string, string>;
  const [form, setForm] = useState({
    email: v.email ?? '',
    whatsapp: v.whatsapp ?? '',
    responseTime: v.responseTime ?? ''
  });
  return shell(
    'Public contact method',
    row,
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Contact email" htmlFor="c-email">
        <Input id="c-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="WhatsApp (optional)" htmlFor="c-whatsapp">
        <Input id="c-whatsapp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
      </Field>
      <Field label="Stated response time" htmlFor="c-response" className="sm:col-span-2">
        <Input id="c-response" value={form.responseTime} onChange={(e) => setForm({ ...form, responseTime: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton variant="secondary" onClick={() => build(form)}>
          Save contact
        </SubmitButton>
        <div className="mt-3"><FormStateMessage state={state} /></div>
      </div>
    </div>
  );
}

interface CurrencyRow {
  asset: string;
  network: string;
  address: string;
  instructions: string;
  confirmationsRequired: number;
}

function CryptoEditor({ row }: { row?: SettingRow }) {
  const { state, build } = useSettingSubmit('payments.crypto', true);
  const v = (row?.value ?? {}) as {
    enabled?: boolean;
    instructions?: string;
    currencies?: CurrencyRow[];
  };
  const [enabled, setEnabled] = useState(v.enabled ?? false);
  const [instructions, setInstructions] = useState(v.instructions ?? '');
  const [currencies, setCurrencies] = useState<CurrencyRow[]>(v.currencies ?? []);

  const update = (i: number, patch: Partial<CurrencyRow>) =>
    setCurrencies((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return shell(
    'Cryptocurrency payments',
    row,
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select
          value={enabled ? 'true' : 'false'}
          onChange={(e) => setEnabled(e.target.value === 'true')}
          className="w-56"
          aria-label="Enabled"
        >
          <option value="false">Disabled (not offered)</option>
          <option value="true">Enabled (offered to members)</option>
        </Select>
        {!enabled && (
          <span className="text-xs text-warning">Hidden from members until enabled</span>
        )}
      </div>

      <Field label="Payment instructions shown to members" htmlFor="crypto-instructions">
        <Textarea
          id="crypto-instructions"
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </Field>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="label-dark mb-0">Supported assets &amp; receiving addresses</p>
          <button
            type="button"
            onClick={() =>
              setCurrencies((rows) => [
                ...rows,
                { asset: '', network: '', address: '', instructions: '', confirmationsRequired: 3 }
              ])
            }
            className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
          >
            + Add asset
          </button>
        </div>
        {currencies.map((c, i) => (
          <div key={i} className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
            <Field label="Asset (e.g. USDT, BTC, ETH)">
              <Input value={c.asset} onChange={(e) => update(i, { asset: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Network (e.g. TRC-20, ERC-20, Bitcoin)">
              <Input value={c.network} onChange={(e) => update(i, { network: e.target.value })} />
            </Field>
            <Field label="Receiving address (public — NEVER a private key)" className="sm:col-span-2">
              <Input
                value={c.address}
                onChange={(e) => update(i, { address: e.target.value })}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Per-asset note (optional)">
              <Input value={c.instructions} onChange={(e) => update(i, { instructions: e.target.value })} />
            </Field>
            <div className="flex items-end justify-between gap-3">
              <Field label="Min. confirmations">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={c.confirmationsRequired}
                  onChange={(e) => update(i, { confirmationsRequired: Number(e.target.value) || 1 })}
                />
              </Field>
              <button
                type="button"
                onClick={() => setCurrencies((rows) => rows.filter((_, idx) => idx !== i))}
                className="pb-2 text-xs text-danger/80 hover:text-danger"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {currencies.length === 0 && (
          <p className={cn('rounded-md border border-dashed border-border p-6 text-center text-xs text-ivory-100/40')}>
            No assets configured — add one before enabling crypto payments.
          </p>
        )}
      </div>

      <div>
        <SubmitButton
          variant="secondary"
          onClick={() => build({ enabled, instructions, currencies })}
          disabled={currencies.some((c) => !c.asset || !c.network || c.address.length < 10)}
        >
          Save crypto configuration
        </SubmitButton>
        {currencies.some((c) => !c.asset || !c.network || c.address.length < 10) && (
          <p className="mt-2 text-xs text-warning">
            Every asset needs an asset code, a network and a valid receiving address.
          </p>
        )}
        <div className="mt-3"><FormStateMessage state={state} /></div>
      </div>
    </div>,
    'Receiving addresses are public payment destinations (like an invoice). Store NO private keys or seed phrases here — this platform never needs them. Transactions are verified manually at launch; automated on-chain verification can be added later via a documented integration.'
  );
}

function GiftCardEditor({ row }: { row?: SettingRow }) {
  const { state, build } = useSettingSubmit('payments.gift_card', true);
  const v = (row?.value ?? {}) as {
    enabled?: boolean;
    instructions?: string;
    reviewNotice?: string;
    issuers?: string[];
  };
  const [enabled, setEnabled] = useState(v.enabled ?? false);
  const [instructions, setInstructions] = useState(v.instructions ?? '');
  const [reviewNotice, setReviewNotice] = useState(v.reviewNotice ?? '');
  const [issuers, setIssuers] = useState((v.issuers ?? []).join('\n'));

  return shell(
    'Gift-card submissions',
    row,
    <div className="space-y-5">
      <Select value={enabled ? 'true' : 'false'} onChange={(e) => setEnabled(e.target.value === 'true')} className="w-56" aria-label="Enabled">
        <option value="false">Disabled (not offered)</option>
        <option value="true">Enabled (manual review)</option>
      </Select>
      <Field label="Approved issuers (one per line)" htmlFor="gc-issuers">
        <Textarea id="gc-issuers" rows={3} value={issuers} onChange={(e) => setIssuers(e.target.value)} placeholder="e.g. recognised retail gift-card brands" />
      </Field>
      <Field label="Instructions for members" htmlFor="gc-instructions">
        <Textarea id="gc-instructions" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </Field>
      <Field label="Review notice (policy reminder)" htmlFor="gc-notice">
        <Textarea id="gc-notice" rows={2} value={reviewNotice} onChange={(e) => setReviewNotice(e.target.value)} />
      </Field>
      <div>
        <SubmitButton
          variant="secondary"
          onClick={() =>
            build({
              enabled,
              instructions,
              reviewNotice,
              issuers: issuers.split('\n').map((s) => s.trim()).filter(Boolean)
            })
          }
        >
          Save gift-card configuration
        </SubmitButton>
        <div className="mt-3"><FormStateMessage state={state} /></div>
      </div>
    </div>,
    'Enable only after the business has confirmed issuer terms permit this use. Members are instructed NEVER to submit PINs or redemption codes; submissions are always reviewed manually.'
  );
}

function VerificationEditor({
  noticeRow,
  businessRow,
  displayRow
}: {
  noticeRow?: SettingRow;
  businessRow?: SettingRow;
  displayRow?: SettingRow;
}) {
  const notice = useSettingSubmit('payments.verification_notice', true);
  const business = useSettingSubmit('business.verification', true);
  const display = useSettingSubmit('verification.card_display', true);

  const nv = (noticeRow?.value ?? {}) as { text?: string };
  const bv = (businessRow?.value ?? {}) as { workingDays?: number; holidays?: string[] };
  const dv = (displayRow?.value ?? {}) as { showTier?: boolean; showExpiry?: boolean };

  const [noticeText, setNoticeText] = useState(nv.text ?? '');
  const [workingDays, setWorkingDays] = useState(bv.workingDays ?? 3);
  const [holidays, setHolidays] = useState((bv.holidays ?? []).join(', '));
  const [showTier, setShowTier] = useState(dv.showTier ?? true);
  const [showExpiry, setShowExpiry] = useState(dv.showExpiry ?? true);

  return shell(
    'Verification & public display',
    noticeRow,
    <div className="space-y-8">
      <div>
        <Field label="Verification notice shown at checkout" htmlFor="vn-text">
          <Textarea id="vn-text" rows={3} value={noticeText} onChange={(e) => setNoticeText(e.target.value)} />
        </Field>
        <SubmitButton variant="secondary" size="sm" onClick={() => notice.build({ text: noticeText })}>
          Save notice
        </SubmitButton>
        <div className="mt-3"><FormStateMessage state={notice.state} /></div>
      </div>

      <div className="border-t border-border/60 pt-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Verification window (working days)" htmlFor="vd-days" hint="Weekends never count.">
            <Input id="vd-days" type="number" min={1} max={10} value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value) || 3)} />
          </Field>
          <Field label="Public holidays (YYYY-MM-DD, comma separated)" htmlFor="vd-holidays">
            <Input id="vd-holidays" value={holidays} onChange={(e) => setHolidays(e.target.value)} placeholder="2026-01-01, 2026-12-25" />
          </Field>
        </div>
        <SubmitButton
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() =>
            business.build({
              workingDays,
              holidays: holidays.split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
            })
          }
        >
          Save verification policy
        </SubmitButton>
        <div className="mt-3"><FormStateMessage state={business.state} /></div>
      </div>

      <div className="border-t border-border/60 pt-6">
        <p className="label-dark">Public card-verification page may show</p>
        <div className="flex flex-wrap gap-6">
          {[
            ['Tier name', showTier, setShowTier],
            ['Expiry date', showExpiry, setShowExpiry]
          ].map(([label, val, set]) => (
            <label key={label as string} className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={val as boolean}
                onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
                className="accent-[#C6A468]"
              />
              {label as string}
            </label>
          ))}
        </div>
        <SubmitButton
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => display.build({ showTier, showExpiry })}
        >
          Save display settings
        </SubmitButton>
        <div className="mt-3"><FormStateMessage state={display.state} /></div>
      </div>
    </div>
  );
}

function DobEditor({ row }: { row?: SettingRow }) {
  const { state, build } = useSettingSubmit('profile.require_date_of_birth', false);
  const v = (row?.value ?? {}) as { required?: boolean; minimumAge?: number; notice?: string };
  const [required, setRequired] = useState(v.required ?? false);
  const [minimumAge, setMinimumAge] = useState(v.minimumAge ?? 18);
  const [notice, setNotice] = useState(v.notice ?? '');

  return shell(
    'Date-of-birth policy',
    row,
    <div className="space-y-5">
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-[#C6A468]" />
        Require date of birth for membership eligibility
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Minimum age" htmlFor="dob-age">
          <Input id="dob-age" type="number" min={0} max={120} value={minimumAge} onChange={(e) => setMinimumAge(Number(e.target.value) || 18)} />
        </Field>
        <Field label="Privacy notice shown at collection" htmlFor="dob-notice">
          <Textarea id="dob-notice" rows={2} value={notice} onChange={(e) => setNotice(e.target.value)} />
        </Field>
      </div>
      <SubmitButton variant="secondary" size="sm" onClick={() => build({ required, minimumAge, notice })}>
        Save policy
      </SubmitButton>
      <div className="mt-3"><FormStateMessage state={state} /></div>
    </div>,
    'Enable only after the business has confirmed WHY date of birth is necessary and approved the privacy wording. This setting always stays non-public.'
  );
}

function RetentionEditor({ row }: { row?: SettingRow }) {
  const { state, build } = useSettingSubmit('privacy.retention', true);
  const v = (row?.value ?? {}) as {
    inactiveAccountMonths?: number;
    evidenceMonths?: number;
    contact?: string;
  };
  const [form, setForm] = useState({
    inactiveAccountMonths: v.inactiveAccountMonths ?? 36,
    evidenceMonths: v.evidenceMonths ?? 24,
    contact: v.contact ?? ''
  });

  return shell(
    'Data retention policy',
    row,
    <div className="grid gap-5 sm:grid-cols-3">
      <Field label="Inactive account retention (months)" htmlFor="r-account">
        <Input id="r-account" type="number" min={1} max={240} value={form.inactiveAccountMonths} onChange={(e) => setForm({ ...form, inactiveAccountMonths: Number(e.target.value) || 36 })} />
      </Field>
      <Field label="Payment evidence retention (months)" htmlFor="r-evidence">
        <Input id="r-evidence" type="number" min={1} max={240} value={form.evidenceMonths} onChange={(e) => setForm({ ...form, evidenceMonths: Number(e.target.value) || 24 })} />
      </Field>
      <Field label="Privacy contact" htmlFor="r-contact">
        <Input id="r-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      </Field>
      <div className="sm:col-span-3">
        <SubmitButton variant="secondary" size="sm" onClick={() => build(form)}>
          Save retention policy
        </SubmitButton>
        <div className="mt-3"><FormStateMessage state={state} /></div>
      </div>
    </div>
  );
}
