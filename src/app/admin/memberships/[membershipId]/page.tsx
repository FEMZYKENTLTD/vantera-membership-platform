import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { MembershipActions } from '@/components/admin/membership-actions';
import { CardDesignPanel } from '@/components/admin/card-design-panel';
import { env } from '@/lib/env';
import { formatDate, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminMembershipDetailPage({
  params
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const ctx = await requireAdmin(PERMISSIONS.MEMBERSHIPS_MANAGE);
  const admin = createAdminClient();

  const { data: membership } = await admin
    .from('memberships')
    .select('*')
    .eq('id', membershipId)
    .maybeSingle();
  if (!membership) notFound();

  const [
    { data: profile },
    { data: tier },
    { data: order },
    { data: card },
    { data: history }
  ] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', membership.user_id).maybeSingle(),
    admin.from('membership_tiers').select('name').eq('id', membership.tier_id).maybeSingle(),
    admin
      .from('orders')
      .select('reference, status')
      .eq('id', membership.order_id)
      .maybeSingle(),
    admin
      .from('membership_cards')
      .select('*')
      .eq('membership_id', membership.id)
      .maybeSingle(),
    admin
      .from('membership_status_history')
      .select('*')
      .eq('membership_id', membership.id)
      .order('created_at', { ascending: false })
      .limit(15)
  ]);

  const { data: versions } = card
    ? await admin
        .from('membership_card_versions')
        .select('*')
        .eq('card_id', card.id)
        .order('version', { ascending: false })
    : { data: [] };

  const canDesign = ctx.permissions.has(PERMISSIONS.CARDS_MANAGE);
  const verifyUrl = card ? `${env.siteUrl()}/verify/${card.public_identifier}` : null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/memberships"
          className="text-xs uppercase tracking-[0.2em] text-ivory-100/40 hover:text-ivory-100/70"
        >
          ← Memberships
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            title={membership.membership_number}
            description={`${tier?.name ?? ''} · ${profile?.full_name || 'member'} · order ${order?.reference ?? ''}`}
          />
          <StatusBadge status={membership.status} className="text-xs" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {([
                ['Member', profile?.full_name || '—'],
                ['Tier', tier?.name ?? '—'],
                ['Order', `${order?.reference ?? '—'} (${order?.status.replace(/_/g, ' ')})`],
                ['Status', <StatusBadge key="s" status={membership.status} />],
                ['Issued', membership.issued_at ? formatDate(membership.issued_at) : '—'],
                ['Expires', membership.expires_at ? formatDate(membership.expires_at) : '—'],
                ...(membership.suspended_at
                  ? [
                      ['Suspended', formatDateTime(membership.suspended_at)],
                      ['Reason', membership.suspension_reason ?? '—']
                    ]
                  : []),
                ...(membership.revoked_at
                  ? [
                      ['Revoked', formatDateTime(membership.revoked_at)],
                      ['Reason', membership.revocation_reason ?? '—']
                    ]
                  : [])
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start justify-between gap-6 border-b border-border/50 pb-3 last:border-0"
                >
                  <dt className="shrink-0 text-ivory-100/40">{k}</dt>
                  <dd className="text-right text-ivory-100/85">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="border-gold-500/25">
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>All transitions are audited and history-recorded</CardDescription>
          </CardHeader>
          <CardContent>
            <MembershipActions
              membershipId={membership.id}
              status={membership.status}
              cardReady={card?.status === 'ready' && !!card.current_version_id}
              paymentApproved={order?.status === 'payment_approved'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Card design panel */}
      {canDesign ? (
        <CardDesignPanel
          membershipId={membership.id}
          membershipNumber={membership.membership_number}
          tierName={tier?.name ?? ''}
          memberName={profile?.full_name || ''}
          card={
            card
              ? {
                  status: card.status,
                  currentVersionId: card.current_version_id,
                  readyAt: card.ready_at,
                  publicIdentifier: card.public_identifier,
                  revokedAt: card.revoked_at,
                  revocationReason: card.revocation_reason,
                  versions: (versions ?? []).map((v) => ({
                    id: v.id,
                    version: v.version,
                    fileName: v.file_name,
                    mimeType: v.mime_type,
                    sizeBytes: v.size_bytes,
                    createdAt: v.created_at,
                    replacedReason: v.replaced_reason
                  }))
                }
              : null
          }
          verifyUrl={verifyUrl}
        />
      ) : (
        card && (
          <Alert tone="info">
            A card record exists for this membership. Card management requires
            the design permission.
          </Alert>
        )
      )}

      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3 text-sm last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {h.previous_status && (
                      <>
                        <StatusBadge status={h.previous_status} />
                        <span className="text-ivory-100/30">→</span>
                      </>
                    )}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
