import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/utils';
import { benefitsOf } from '@/components/membership/tier-card';
import { SelectTierButton } from '@/components/membership/select-tier-button';
import { getVerificationNotice, getGiftCardConfig, getCryptoConfig } from '@/lib/settings';
import { CheckIcon, ShieldIcon, ClockIcon, LockIcon } from '@/components/icons';
import { Alert } from '@/components/ui/alert';
import { Separator } from '@/components/ui/misc';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tier } = await supabase
    .from('membership_tiers')
    .select('name, description')
    .eq('slug', slug)
    .maybeSingle();
  if (!tier) return { title: 'Membership' };
  return { title: `${tier.name} membership`, description: tier.description };
}

export default async function TierDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tier } = await supabase
    .from('membership_tiers')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!tier) notFound();

  const [notice, cryptoCfg, giftCfg] = await Promise.all([
    getVerificationNotice(),
    getCryptoConfig(),
    getGiftCardConfig()
  ]);
  const benefits = benefitsOf(tier);

  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <Link href="/membership" className="text-xs uppercase tracking-[0.2em] text-ivory-100/40 hover:text-ivory-100/70">
          ← All tiers
        </Link>

        <div className="mt-8 grid gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="eyebrow">{tier.name}</p>
            <h1 className="display-2 mt-4">
              {formatMoney(tier.price, tier.currency)}{' '}
              <span className="text-lg text-ivory-100/40 font-sans tracking-[0.15em]">
                {tier.currency}
              </span>
            </h1>
            {tier.duration_months && (
              <p className="mt-2 text-sm text-ivory-100/45">
                {tier.duration_months}-month membership
              </p>
            )}
            <p className="mt-6 leading-relaxed text-ivory-100/60">{tier.description}</p>

            <Separator className="my-8" />

            <h2 className="font-display text-xl">Approved benefits</h2>
            <ul className="mt-4 space-y-3 text-sm text-ivory-100/70">
              {benefits.map((b) => (
                <li key={b} className="flex gap-3">
                  <CheckIcon className="mt-0.5 size-4 text-gold-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <Separator className="my-8" />

            <h2 className="font-display text-xl">Membership terms</h2>
            <p className="mt-4 text-sm leading-relaxed text-ivory-100/55 whitespace-pre-line">
              {tier.terms}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ivory-100/45">
              Membership does not provide investment returns, cash withdrawal or
              any financial product. A Vantera card is a personalised membership
              card — not a bank, debit, credit or ATM card.
            </p>
          </div>

          <div className="md:pt-16">
            <div className="surface-raised p-7">
              <p className="eyebrow mb-6">Your application</p>
              <SelectTierButton tierId={tier.id} />
              <ul className="mt-7 space-y-4 text-sm text-ivory-100/55">
                <li className="flex gap-3">
                  <ClockIcon className="mt-0.5 size-4 shrink-0 text-gold-400" />
                  <span>{notice.text}</span>
                </li>
                <li className="flex gap-3">
                  <ShieldIcon className="mt-0.5 size-4 shrink-0 text-gold-400" />
                  <span>
                    {cryptoCfg.enabled || giftCfg.enabled
                      ? 'Approved payment instructions are shown privately after your order is created.'
                      : 'Payment methods are being configured. You can review tiers now; instructions will appear once enabled.'}
                  </span>
                </li>
                <li className="flex gap-3">
                  <LockIcon className="mt-0.5 size-4 shrink-0 text-gold-400" />
                  <span>
                    We never ask for gift-card PINs, redemption codes, wallet
                    private keys or seed phrases.
                  </span>
                </li>
              </ul>
              <Alert tone="info" className="mt-6">
                Creating an order reserves nothing and charges nothing — it
                opens your private application with the price locked in.
              </Alert>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
