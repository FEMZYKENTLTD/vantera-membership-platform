import Link from 'next/link';
import type { MembershipTierRow } from '@/types/database';
import { formatMoney } from '@/lib/utils';
import { CheckIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export function benefitsOf(tier: MembershipTierRow): string[] {
  return Array.isArray(tier.benefits)
    ? (tier.benefits as unknown[]).filter((b): b is string => typeof b === 'string')
    : [];
}

export function TierCard({
  tier,
  featured = false
}: {
  tier: MembershipTierRow;
  featured?: boolean;
}) {
  const benefits = benefitsOf(tier);
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border p-8 transition-colors',
        featured
          ? 'border-gold-500/50 bg-gradient-to-b from-gold-500/[0.07] to-transparent'
          : 'border-border bg-noir-850 hover:border-gold-500/30'
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-8 rounded-full border border-gold-500/40 bg-noir-900 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gold-300">
          Most distinguished
        </span>
      )}
      <p className="eyebrow">{tier.name}</p>
      <p className="mt-4 font-display text-4xl text-ivory-100">
        {formatMoney(tier.price, tier.currency)}
        <span className="ml-2 align-middle text-xs font-sans uppercase tracking-[0.2em] text-ivory-100/40">
          {tier.currency}
        </span>
      </p>
      {tier.duration_months && (
        <p className="mt-1 text-xs text-ivory-100/40">
          {tier.duration_months}-month membership
        </p>
      )}
      <p className="mt-4 text-sm leading-relaxed text-ivory-100/55">{tier.description}</p>
      <ul className="mt-6 space-y-2.5 text-sm text-ivory-100/70 flex-1">
        {benefits.map((b) => (
          <li key={b} className="flex gap-2.5">
            <CheckIcon className="mt-0.5 size-3.5 text-gold-400" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/membership/${tier.slug}`}
        className="mt-8 inline-flex items-center justify-center rounded-md border border-gold-500/40 px-4 py-2.5 text-sm text-gold-300 transition-colors hover:bg-gold-500/10 hover:border-gold-500/70"
      >
        View {tier.name}
      </Link>
    </div>
  );
}
