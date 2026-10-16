import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Table, THead, TBody, TRow, TH, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { formatDateTime, truncateMiddle } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ENTITY_TYPES = [
  'payment_submission',
  'membership',
  'membership_card',
  'membership_tier',
  'order',
  'profile',
  'admin_role',
  'site_setting',
  'permission'
] as const;

export default async function AdminAuditLogsPage({
  searchParams
}: {
  searchParams: Promise<{ action?: string; entity?: string }>;
}) {
  await requireAdmin(PERMISSIONS.AUDIT_VIEW);
  const { action, entity } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (action?.trim()) {
    query = query.ilike('action', `%${action.trim().replace(/[%_]/g, '')}%`);
  }
  if (entity && (ENTITY_TYPES as readonly string[]).includes(entity)) {
    query = query.eq('entity_type', entity);
  }
  const { data: logs } = await query;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit logs"
        description="Security-relevant administrative events. These records cannot be edited or deleted through the application."
      />

      <form method="get" className="flex max-w-xl gap-3">
        <Input name="action" placeholder="Filter by action, e.g. payment.approved" defaultValue={action ?? ''} />
        <Select name="entity" defaultValue={entity ?? ''} aria-label="Entity type">
          <option value="">All entities</option>
          {ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>
              {e.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {logs && logs.length > 0 ? (
        <div className="surface overflow-hidden">
          <Table>
            <THead>
              <TRow>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Change</TH>
                <TH>Actor</TH>
              </TRow>
            </THead>
            <TBody>
              {logs.map((log) => (
                <TRow key={log.id}>
                  <TD className="whitespace-nowrap">{formatDateTime(log.created_at)}</TD>
                  <TD>
                    <code className="text-xs text-gold-300">{log.action}</code>
                  </TD>
                  <TD className="text-xs">
                    {log.entity_type}
                    {log.entity_id && (
                      <span className="text-ivory-100/30"> {truncateMiddle(log.entity_id, 8, 4)}</span>
                    )}
                  </TD>
                  <TD className="max-w-[220px] truncate text-xs text-ivory-100/50">
                    {log.previous_state ? `${log.previous_state} → ` : ''}
                    {log.new_state ?? ''}
                  </TD>
                  <TD className="text-xs text-ivory-100/40">
                    {log.actor_id ? truncateMiddle(log.actor_id, 8, 4) : 'system'}
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No audit events match" />
      )}
    </div>
  );
}
