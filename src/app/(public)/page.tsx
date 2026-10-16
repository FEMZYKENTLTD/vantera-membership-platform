import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { TierCard } from '@/components/membership/tier-card';
import { ShieldIcon, ClockIcon, CardIcon, DownloadIcon } from '@/components/icons';
import { getVerificationNotice } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: tiers } = await supabase
    .from('membership_tiers')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: true });
  const notice = await getVerificationNotice();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: 'url(/images/hero.jpg)' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-noir-900/60 via-noir-900/80 to-noir-900" aria-hidden />
        <div className="relative container py-28 md:py-40 text-center">
          <p className="eyebrow animate-fade-in">A private circle, issued to a few</p>
          <h1 className="display-1 mx-auto mt-6 max-w-3xl animate-fade-up">
            Membership, considered.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ivory-100/60 animate-fade-up">
            Vantera issues personalised membership cards to approved members.
            Each application is verified deliberately — never instantly —
            because recognition should mean something.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up">
            <Link href="/membership" className={cn(buttonVariants({ size: 'lg' }))}>
              Explore membership
            </Link>
            <Link href="/about" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
              Our approach
            </Link>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="container py-20 md:py-28" id="tiers">
        <div className="mb-12 text-center">
          <p className="eyebrow">The collection</p>
          <h2 className="display-2 mt-4">Four tiers of membership</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ivory-100/50">
            {notice.text}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {(tiers ?? []).map((tier, i) => (
            <TierCard key={tier.id} tier={tier} featured={i === (tiers?.length ?? 0) - 1} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/60 bg-noir-950">
        <div className="container py-20 md:py-24">
          <div className="mb-14 max-w-lg">
            <p className="eyebrow">The process</p>
            <h2 className="display-2 mt-4">How membership is issued</h2>
          </div>
          <div className="grid gap-10 md:grid-cols-4">
            {[
              {
                icon: CardIcon,
                step: '01',
                title: 'Choose your tier',
                body: 'Select the membership that suits you and create your order. The price shown is the price agreed, locked into your order.'
              },
              {
                icon: ClockIcon,
                step: '02',
                title: 'Payment, verified',
                body: 'Pay by an approved method and submit the details. Our team verifies every payment within 1–3 working days — nothing is approved automatically.'
              },
              {
                icon: ShieldIcon,
                step: '03',
                title: 'Card, prepared',
                body: 'Once verified, our designer prepares your personalised Vantera card and it is reviewed before release.'
              },
              {
                icon: DownloadIcon,
                step: '04',
                title: 'Yours, privately',
                body: 'Sign in to your private portal to download your card. Your files are never public and never shared.'
              }
            ].map((item) => (
              <div key={item.step}>
                <div className="flex items-center justify-between">
                  <item.icon className="size-6 text-gold-400" />
                  <span className="font-display text-sm text-ivory-100/25">{item.step}</span>
                </div>
                <h3 className="mt-4 font-display text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ivory-100/55">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Assurance */}
      <section className="container py-20 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="eyebrow">Discretion by design</p>
            <h2 className="display-3 mt-4">Your privacy is part of the product</h2>
            <p className="mt-5 text-sm leading-relaxed text-ivory-100/55">
              We collect only what membership administration requires, store your
              documents in private storage, and print nothing personal on your
              card beyond your display name, tier and membership reference. Card
              verification reveals authenticity — never identity.
            </p>
            <div className="mt-8 flex gap-3">
              <Link href="/privacy" className={cn(buttonVariants({ variant: 'secondary' }))}>
                Privacy policy
              </Link>
              <Link href="/verify" className={cn(buttonVariants({ variant: 'ghost' }))}>
                Verify a card
              </Link>
            </div>
          </div>
          <div className="surface-raised p-8 md:p-10">
            <p className="eyebrow mb-6">Our commitments</p>
            <ul className="space-y-5 text-sm leading-relaxed text-ivory-100/65">
              <li className="flex gap-3">
                <ShieldIcon className="mt-0.5 size-4 text-gold-400" />
                Payments are reviewed by people, always. Submitting payment
                details is not approval, and we say so plainly.
              </li>
              <li className="flex gap-3">
                <ShieldIcon className="mt-0.5 size-4 text-gold-400" />
                A Vantera card is a membership card — it is not a bank card,
                debit card, credit card or ATM card.
              </li>
              <li className="flex gap-3">
                <ShieldIcon className="mt-0.5 size-4 text-gold-400" />
                We will never ask for gift-card PINs, redemption codes, wallet
                private keys or seed phrases. Ever.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-gradient-to-b from-noir-950 to-noir-900">
        <div className="container py-20 text-center">
          <h2 className="display-3">Begin your application</h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-ivory-100/50 leading-relaxed">
            Create your account, choose a tier, and our team will guide your
            membership through verification.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/register" className={cn(buttonVariants({ size: 'lg' }))}>
              Create your account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
