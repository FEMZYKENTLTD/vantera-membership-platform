import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Table, THead, TBody, TRow, TH, TD } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchIcon } from '@/components/icons';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin(PERMISSIONS.CUSTOMERS_VIEW);
  const { q } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('profiles')
    .select('id, full_name, phone, country, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (q?.trim()) {
    const term = `%${q.trim().replace(/[%_]/g, '')}%`;
    query = query.or(`full_name.ilike.${term},phone.ilike.${term},country.ilike.${term}`);
  }
  const { data: customers } = await query;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customers"
        description="Search and manage member accounts. Personal data shown is limited to what support tasks require."
      />

      <form method="get" className="flex max-w-md gap-2">
        <Input name="q" placeholder="Search name, phone or country…" defaultValue={q ?? ''} />
        <Button type="submit" variant="secondary">
          <SearchIcon /> Search
        </Button>
      </form>

      {customers && customers.length > 0 ? (
        <div className="surface overflow-hidden">
          <Table>
            <THead>
              <TRow>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH>Country</TH>
                <TH>Joined</TH>
                <TH>Status</TH>
                <TH className="sr-only">Open</TH>
              </TRow>
            </THead>
            <TBody>
              {customers.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-medium text-ivory-100">{c.full_name || '—'}</TD>
                  <TD>{c.phone ?? '—'}</TD>
                  <TD>{c.country ?? '—'}</TD>
                  <TD>{formatDate(c.created_at)}</TD>
                  <TD>
                    <StatusBadge status={c.status} />
                  </TD>
                  <TD>
                    <Link
                      href={`/admin/customers/${c.id}`}
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
        <EmptyState
          title={q ? 'No customers match that search' : 'No customers yet'}
          body={q ? 'Try a different name, phone or country.' : undefined}
        />
      )}
    </div>
  );
}
