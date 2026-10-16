import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { DownloadIcon, QrIcon, ShieldIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Membership' };
export const dynamic = 'force-dynamic';

export default async function MembershipDetailPage({
  params
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const user = await requireUser('/portal/memberships');
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('memberships')
    .select('*')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) notFound();

  const [{ data: tier }, { data: card }, { data: history }, { data: order }] = await Promise.all([
    supabase
      .from('membership_tiers')
      .select('name, description')
      .eq('id', membership.tier_id)
      .maybeSingle(),
    supabase
      .from('membership_cards')
      .select('*')
      .eq('membership_id', membership.id)
      .maybeSingle(),
    supabase
      .from('membership_status_history')
      .select('*')
      .eq('membership_id', membership.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('orders').select('reference').eq('id', membership.order_id).maybeSingle()
  ]);

  const verifyUrl = card ? `${env.siteUrl()}/verify/${card.public_identifier}` : null;
  const canDownload = card?.status === 'ready' && card.current_version_id;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/memberships"
          className="text-xs uppercase tracking-[0.2em] text-ivory-100/40 hover:text-ivory-100/70"
        >
          ← Membership
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="display-3">{tier?.name ?? 'Membership'}</h1>
            <p className="mt-1 text-sm text-ivory-100/45">
              {membership.membership_number} · order {order?.reference}
            </p>
          </div>
          <StatusBadge status={membership.status} className="text-xs" />
        </div>
      </div>

      {membership.status === 'suspended' && (
        <Alert tone="error" title="Membership suspended">
          {membership.suspension_reason
            ? `Reason: ${membership.suspension_reason}.`
            : ''}{' '}
          Please contact Vantera support for assistance.
        </Alert>
      )}
      {membership.status === 'revoked' && (
        <Alert tone="error" title="Membership revoked">
          This membership has been revoked. Contact support if you have questions.
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ['Tier', tier?.name ?? '—'],
                ['Membership reference', membership.membership_number],
                ['Status', <StatusBadge key="s" status={membership.status} />],
                ['Issued', membership.issued_at ? formatDate(membership.issued_at) : 'Not yet issued'],
                [
                  'Valid until',
                  membership.expires_at ? formatDate(membership.expires_at) : 'No expiry'
                ]
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-0">
                  <dt className="text-ivory-100/40">{k}</dt>
                  <dd className="text-ivory-100/85 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your membership card</CardTitle>
            <CardDescription>
              Designed and checked by our team before release
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ivory-100/50">Card status</p>
              {card ? <StatusBadge status={card.status} /> : <p className="text-sm">—</p>}
            </div>

            {canDownload ? (
              <>
                <a
                  href={`/api/cards/${membership.id}/download`}
                  className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
                >
                  <DownloadIcon /> Download my card
                </a>
                <p className="text-xs leading-relaxed text-ivory-100/40">
                  Downloads use a short-lived private link — your card file is
                  never publicly accessible.
                </p>
              </>
            ) : (
              <Alert tone="info">
                {membership.status === 'active'
                  ? 'Your card is being finalised and will appear here shortly.'
                  : 'The card appears here once your payment has been approved and the design is ready.'}
              </Alert>
            )}

            {card && verifyUrl && (
              <div className="rounded-md border border-border bg-noir-800 p-4">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gold-400">
                  <QrIcon className="size-4" /> Public verification
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="break-all text-xs text-ivory-100/60">{verifyUrl}</code>
                  <CopyButton value={verifyUrl} />
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ivory-100/35">
                  <ShieldIcon className="mt-0.5 size-3 shrink-0" />
                  This link confirms authenticity only — it never reveals your
                  name or personal details.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 text-sm last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {h.previous_status && (
                      <>
                        <StatusBadge status={h.previous_status} />
                        <span className="text-ivory-100/30">→</span>
                      </>
                    )}
                    <StatusBadge status={h.new_status} />
                  </div>
                  <span className="text-xs text-ivory-100/35">{formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
