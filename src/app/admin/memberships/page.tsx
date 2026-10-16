import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Table, THead, TBody, TRow, TH, TD } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUSES = [
  'pending',
  'processing',
  'card_ready',
  'active',
  'suspended',
  'revoked',
  'expired',
  'cancelled'
] as const;

export default async function AdminMembershipsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin(PERMISSIONS.MEMBERSHIPS_MANAGE);
  const { status } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('memberships')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && (STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status as (typeof STATUSES)[number]);
  }
  const { data: memberships } = await query;

  const tierIds = [...new Set((memberships ?? []).map((m) => m.tier_id))];
  const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
  const [{ data: tiers }, { data: profiles }] = await Promise.all([
    tierIds.length
      ? admin.from('membership_tiers').select('id, name').in('id', tierIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] })
  ]);
  const tierName = new Map((tiers ?? []).map((t) => [t.id, t.name]));
  const memberName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Memberships"
        description="Process, suspend or revoke memberships. Every transition is recorded."
      />

      <form method="get" className="flex max-w-sm gap-3">
        <Select name="status" defaultValue={status ?? ''} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {memberships && memberships.length > 0 ? (
        <div className="surface overflow-hidden">
          <Table>
            <THead>
              <TRow>
                <TH>Reference</TH>
                <TH>Member</TH>
                <TH>Tier</TH>
                <TH>Issued</TH>
                <TH>Expires</TH>
                <TH>Status</TH>
                <TH className="sr-only">Open</TH>
              </TRow>
            </THead>
            <TBody>
              {memberships.map((m) => (
                <TRow key={m.id}>
                  <TD className="font-medium text-ivory-100">{m.membership_number}</TD>
                  <TD>{memberName.get(m.user_id) || '—'}</TD>
                  <TD>{tierName.get(m.tier_id) ?? '—'}</TD>
                  <TD>{m.issued_at ? formatDate(m.issued_at) : '—'}</TD>
                  <TD>{m.expires_at ? formatDate(m.expires_at) : '—'}</TD>
                  <TD>
                    <StatusBadge status={m.status} />
                  </TD>
                  <TD>
                    <Link
                      href={`/admin/memberships/${m.id}`}
                      className="text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
                    >
                      Open →
                    </Link>
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No memberships found" />
      )}
    </div>
  );
}
