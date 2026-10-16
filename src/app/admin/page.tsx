import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { StatCard, PageHeader } from '@/components/admin/stat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { formatDateTime } from '@/lib/utils';
import { emailConfigured } from '@/lib/env';
import { getCryptoConfig, getGiftCardConfig } from '@/lib/settings';
import { PERMISSIONS } from '@/lib/permissions/permissions';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage({
  searchParams
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  const ctx = await requireAdmin();
  const admin = createAdminClient();

  const count = async (
    table:
      | 'profiles'
      | 'orders'
      | 'payment_submissions'
      | 'memberships'
      | 'membership_cards'
      | 'audit_logs',
    status?: { column: string; value: string | string[] }
  ) => {
    let q = admin.from(table).select('id', { count: 'exact', head: true });
    if (status) {
      q = Array.isArray(status.value)
        ? q.in(status.column, status.value)
        : q.eq(status.column, status.value);
    }
    const { count: c } = await q;
    return c ?? 0;
  };

  const [
    members,
    pendingReview,
    underReview,
    approved,
    rejected,
    processing,
    cardsAwaiting,
    cardsReady
  ] = await Promise.all([
    count('profiles'),
    count('payment_submissions', { column: 'status', value: ['pending_review', 'submitted'] }),
    count('payment_submissions', { column: 'status', value: 'under_review' }),
    count('payment_submissions', { column: 'status', value: 'approved' }),
    count('payment_submissions', { column: 'status', value: 'rejected' }),
    count('memberships', { column: 'status', value: 'processing' }),
    count('membership_cards', { column: 'status', value: ['awaiting_upload', 'in_preparation'] }),
    count('membership_cards', { column: 'status', value: 'ready' })
  ]);

  let recentAudit: { id: string; action: string; entity_type: string; created_at: string }[] = [];
  if (ctx.permissions.has(PERMISSIONS.AUDIT_VIEW)) {
    const { data } = await admin
      .from('audit_logs')
      .select('id, action, entity_type, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    recentAudit = data ?? [];
  }

  const [cryptoCfg, giftCfg] = await Promise.all([getCryptoConfig(), getGiftCardConfig()]);
  const setupGaps: string[] = [];
  if (!emailConfigured()) setupGaps.push('Transactional email is not configured — messages are logged, not delivered.');
  if (!cryptoCfg.enabled && !giftCfg.enabled)
    setupGaps.push('No payment method is enabled yet — customers cannot submit payments.');
  if (!cryptoCfg.enabled) setupGaps.push('Cryptocurrency payments are disabled (not configured).');
  if (!giftCfg.enabled) setupGaps.push('Gift-card submissions are disabled (not configured).');

  return (
    <div className="space-y-10">
      {denied === 'permission' && (
        <Alert tone="error" title="Insufficient permission">
          Your roles do not include the permission required for that page.
        </Alert>
      )}

      <PageHeader
        title="Overview"
        description="Operational snapshot. Counts contain no personal information."
      />

      {setupGaps.length > 0 && ctx.permissions.has(PERMISSIONS.SETTINGS_MANAGE) && (
        <Alert tone="warning" title="Setup incomplete">
          <ul className="list-disc pl-4">
            {setupGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered members" value={members} href="/admin/customers" />
        <StatCard
          label="Awaiting review"
          value={pendingReview}
          href="/admin/payments?status=pending_review"
          tone={pendingReview > 0 ? 'alert' : 'default'}
        />
        <StatCard label="Under review" value={underReview} href="/admin/payments?status=under_review" />
        <StatCard label="Approved payments" value={approved} href="/admin/payments?status=approved" />
        <StatCard label="Rejected payments" value={rejected} href="/admin/payments?status=rejected" />
        <StatCard
          label="Memberships in processing"
          value={processing}
          href="/admin/memberships?status=processing"
          tone={processing > 0 ? 'gold' : 'default'}
        />
        <StatCard
          label="Cards awaiting design"
          value={cardsAwaiting}
          href="/admin/card-designs"
          tone={cardsAwaiting > 0 ? 'alert' : 'default'}
        />
        <StatCard label="Cards ready" value={cardsReady} href="/admin/card-designs" />
      </div>

      {ctx.permissions.has(PERMISSIONS.AUDIT_VIEW) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent administrative activity</CardTitle>
            <Link
              href="/admin/audit-logs"
              className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
            >
              Audit logs →
            </Link>
          </CardHeader>
          <CardContent>
            {recentAudit.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {recentAudit.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-ivory-100/75">
                      <code className="text-gold-300/90">{a.action}</code>
                      <span className="text-ivory-100/40"> · {a.entity_type}</span>
                    </span>
                    <span className="text-xs text-ivory-100/35">{formatDateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ivory-100/40">No activity recorded yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
