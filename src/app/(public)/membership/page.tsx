import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { TierCard } from '@/components/membership/tier-card';
import { getCryptoConfig, getGiftCardConfig, getVerificationNotice } from '@/lib/settings';
import { EmptyState } from '@/components/ui/misc';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Membership',
  description:
    'Explore the Vantera membership tiers. Personalised membership cards issued after payment verification.'
};

export const dynamic = 'force-dynamic';

export default async function MembershipPage() {
  const supabase = await createClient();
  const { data: tiers } = await supabase
    .from('membership_tiers')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: true });

  const [notice, cryptoCfg, giftCfg] = await Promise.all([
    getVerificationNotice(),
    getCryptoConfig(),
    getGiftCardConfig()
  ]);
  const methodsAvailable = cryptoCfg.enabled || giftCfg.enabled;

  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="eyebrow">Membership</p>
        <h1 className="display-2 mt-4">Choose your tier</h1>
        <p className="mt-5 text-sm leading-relaxed text-ivory-100/55">
          Every Vantera membership includes a personalised membership card,
          issued only after your payment is verified by our team.
        </p>
      </div>

      <div className="mx-auto max-w-5xl">
        <Alert tone="info" className="mb-10">
          {notice.text}
        </Alert>

        {!methodsAvailable && (
          <Alert tone="warning" title="Payment methods are being configured" className="mb-10">
            Our payment options are being finalised. You may create an account
            and review the tiers; payment instructions will appear as soon as
            they are enabled.
          </Alert>
        )}

        {tiers && tiers.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {tiers.map((tier, i) => (
              <TierCard key={tier.id} tier={tier} featured={i === tiers.length - 1} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Membership tiers are being prepared"
            body="The Vantera team is finalising the published membership collection. Please check back shortly."
          />
        )}
      </div>
    </div>
  );
}
