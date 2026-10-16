import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { CustomerStatusForm } from '@/components/admin/customer-actions';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerDetailPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const ctx = await requireAdmin(PERMISSIONS.CUSTOMERS_VIEW);
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, phone, country, city, status, created_at')
    .eq('id', customerId)
    .maybeSingle();
  if (!profile) notFound();

  // Email comes from Auth (admin API), not stored in profiles — least duplication.
  const { data: authUser } = await admin.auth.admin.getUserById(customerId);
  const email = authUser.user?.email ?? '';

  const [{ data: orders }, { data: memberships }] = await Promise.all([
    admin
      .from('orders')
      .select('id, reference, tier_name_snapshot, total_price, currency, status, created_at')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('memberships')
      .select('id, membership_number, status, issued_at, expires_at, tier_id')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  const canManage = ctx.permissions.has(PERMISSIONS.CUSTOMERS_MANAGE);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/customers"
          className="text-xs uppercase tracking-[0.2em] text-ivory-100/40 hover:text-ivory-100/70"
        >
          ← Customers
        </Link>
        <PageHeader
          title={profile.full_name || 'Customer'}
          description={`Member since ${formatDate(profile.created_at)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Minimum necessary for support tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ['Email', email || '—'],
                ['Phone', profile.phone ?? '—'],
                ['Location', [profile.city, profile.country].filter(Boolean).join(', ') || '—'],
                ['Status', <StatusBadge key="s" status={profile.status} />]
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-4">
                  <dt className="text-ivory-100/40">{k}</dt>
                  <dd className="text-right text-ivory-100/85">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 rounded-md border border-border bg-noir-800 px-3 py-2 text-[11px] leading-relaxed text-ivory-100/35">
              Address and date of birth are withheld from this view — they are
              only shown where the task requires them.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders && orders.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="text-sm">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-gold-300 underline-offset-2 hover:underline"
                        >
                          {o.reference}
                        </Link>
                        <span className="text-ivory-100/40">
                          {' '}
                          · {o.tier_name_snapshot} · {formatMoney(o.total_price, o.currency)}
                        </span>
                      </div>
                      <StatusBadge status={o.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No orders" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Memberships</CardTitle>
            </CardHeader>
            <CardContent>
              {memberships && memberships.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {memberships.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link
                        href={`/admin/memberships/${m.id}`}
                        className="text-sm text-gold-300 underline-offset-2 hover:underline"
                      >
                        {m.membership_number}
                      </Link>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ivory-100/35">
                          {m.expires_at ? `until ${formatDate(m.expires_at)}` : ''}
                        </span>
                        <StatusBadge status={m.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No memberships" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {canManage && (
        <Card className="max-w-md border-warning/30">
          <CardHeader>
            <CardTitle className="text-lg">Account controls</CardTitle>
            <CardDescription>Recorded in the audit log</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerStatusForm userId={profile.id} status={profile.status} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
