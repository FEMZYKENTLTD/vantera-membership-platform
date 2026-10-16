import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Membership' };
export const dynamic = 'force-dynamic';

export default async function MembershipsPage() {
  const user = await requireUser('/portal/memberships');
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('memberships')
    .select('*')
    .order('created_at', { ascending: false });

  const tierIds = [...new Set((memberships ?? []).map((m) => m.tier_id))];
  const { data: tiers } = tierIds.length
    ? await supabase.from('membership_tiers').select('id, name').in('id', tierIds)
    : { data: [] };
  const tierName = new Map((tiers ?? []).map((t) => [t.id, t.name]));

  const { data: orders } = (memberships ?? []).length
    ? await supabase
        .from('orders')
        .select('id, reference')
        .in('id', (memberships ?? []).map((m) => m.order_id))
    : { data: [] };
  const orderRef = new Map((orders ?? []).map((o) => [o.id, o.reference]));

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Member portal</p>
        <h1 className="display-3 mt-2">Your membership</h1>
      </div>

      {memberships && memberships.length > 0 ? (
        <div className="grid gap-5">
          {memberships.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-display text-2xl text-ivory-100">
                    {tierName.get(m.tier_id) ?? 'Membership'}
                  </p>
                  <p className="mt-1 text-sm text-ivory-100/45">
                    {m.membership_number} · order {orderRef.get(m.order_id) ?? ''}
                  </p>
                  <p className="mt-1 text-xs text-ivory-100/35">
                    {m.issued_at ? `Issued ${formatDate(m.issued_at)}` : 'Not yet issued'}
                    {m.expires_at ? ` · Valid until ${formatDate(m.expires_at)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={m.status} />
                  <Link
                    href={`/portal/memberships/${m.id}`}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                  >
                    View
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No membership issued yet"
          body="Your membership appears here as soon as your payment has been verified and approved."
          action={
            <Link href="/membership" className={cn(buttonVariants())}>
              Choose a membership
            </Link>
          }
        />
      )}
    </div>
  );
}
