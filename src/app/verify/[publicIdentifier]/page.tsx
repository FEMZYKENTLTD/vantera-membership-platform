import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { publicIdentifierSchema } from '@/lib/validation/schemas';
import { buildVerificationPayload } from '@/lib/verify/payload';
import { getCardDisplaySettings } from '@/lib/settings';
import { StatusBadge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { VerifiedIcon, XIcon, AlertIcon, LockIcon } from '@/components/icons';
import type { CardStatus, MembershipStatus } from '@/types/database';

export const metadata: Metadata = {
  title: 'Card verification',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

/**
 * PUBLIC card verification. Deliberately minimal by privacy contract:
 * authenticity status, membership reference, and (when enabled) tier and
 * expiry — never identity. Backed by the security-definer verify_card RPC.
 */
export default async function VerifyCardPage({
  params
}: {
  params: Promise<{ publicIdentifier: string }>;
}) {
  const { publicIdentifier } = await params;
  const parsed = publicIdentifierSchema.safeParse(publicIdentifier);
  const supabase = await createClient();

  let payload: ReturnType<typeof buildVerificationPayload> | null = null;

  if (parsed.success) {
    const { data } = await supabase.rpc('verify_card', {
      p_identifier: parsed.data
    });
    const row = data?.[0];
    if (row) {
      const display = await getCardDisplaySettings();
      payload = buildVerificationPayload({
        membershipStatus: row.membership_status as MembershipStatus,
        cardStatus: row.card_status as CardStatus,
        membershipNumber: row.membership_number,
        tierName: row.tier_name,
        expiresAt: row.expires_at,
        display
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-raised p-8 text-center">
        <p className="eyebrow">Card verification</p>

        {payload ? (
          <>
            <div className="mx-auto mt-6 flex size-16 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10">
              {payload.state === 'valid' ? (
                <VerifiedIcon className="size-8 text-gold-400" />
              ) : payload.state === 'suspended' || payload.state === 'expired' ? (
                <AlertIcon className="size-8 text-warning" />
              ) : (
                <XIcon className="size-8 text-danger" />
              )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
              <h1 className="font-display text-3xl">
                {payload.state === 'valid'
                  ? 'Authentic'
                  : payload.state === 'suspended'
                    ? 'Suspended'
                    : payload.state === 'revoked'
                      ? 'Revoked'
                      : payload.state === 'expired'
                        ? 'Expired'
                        : 'Invalid'}
              </h1>
              <StatusBadge status={payload.state === 'valid' ? 'valid' : 'invalid'} />
            </div>

            <dl className="mt-8 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <dt className="text-ivory-100/40">Membership reference</dt>
                <dd className="font-mono text-ivory-100/85">{payload.membershipReference}</dd>
              </div>
              {payload.tierName && (
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <dt className="text-ivory-100/40">Tier</dt>
                  <dd className="text-ivory-100/85">{payload.tierName}</dd>
                </div>
              )}
              {payload.expiresOn && (
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <dt className="text-ivory-100/40">Valid until</dt>
                  <dd className="text-ivory-100/85">{formatDate(payload.expiresOn)}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <>
            <div className="mx-auto mt-6 flex size-16 items-center justify-center rounded-full border border-danger/30 bg-danger/10">
              <XIcon className="size-8 text-danger" />
            </div>
            <h1 className="mt-5 font-display text-3xl">Not recognised</h1>
            <p className="mt-3 text-sm leading-relaxed text-ivory-100/55">
              No Vantera membership card matches this verification code. It may
              be incomplete, or the card may not be genuine.
            </p>
          </>
        )}
      </div>

      <p className="flex items-start justify-center gap-2 text-center text-[11px] leading-relaxed text-ivory-100/35">
        <LockIcon className="mt-0.5 size-3 shrink-0" />
        Vantera verification confirms authenticity only. It never displays the
        member’s name or personal information.{' '}
        <Link href="/contact" className="underline underline-offset-2 hover:text-ivory-100/60">
          Report a concern
        </Link>
      </p>
    </div>
  );
}
