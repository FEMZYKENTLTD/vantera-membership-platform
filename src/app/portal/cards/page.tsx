import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import { DownloadIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'My card' };
export const dynamic = 'force-dynamic';

export default async function CardsPage() {
  const user = await requireUser('/portal/cards');
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('memberships')
    .select('*')
    .order('created_at', { ascending: false });

  const membershipIds = (memberships ?? []).map((m) => m.id);
  const { data: cards } = membershipIds.length
    ? await supabase.from('membership_cards').select('*').in('membership_id', membershipIds)
    : { data: [] };
  const cardByMembership = new Map((cards ?? []).map((c) => [c.membership_id, c]));

  const tierIds = [...new Set((memberships ?? []).map((m) => m.tier_id))];
  const { data: tiers } = tierIds.length
    ? await supabase.from('membership_tiers').select('id, name').in('id', tierIds)
    : { data: [] };
  const tierName = new Map((tiers ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Member portal</p>
        <h1 className="display-3 mt-2">My membership card</h1>
        <p className="mt-2 max-w-lg text-sm text-ivory-100/50">
          Cards are released after payment verification and individual design
          review. Downloads are private to your account.
        </p>
      </div>

      {memberships && memberships.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {memberships.map((m) => {
            const card = cardByMembership.get(m.id);
            const ready = card?.status === 'ready' && card.current_version_id;
            return (
              <Card key={m.id} className={ready ? 'border-gold-500/30' : undefined}>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-xl">{tierName.get(m.tier_id)}</p>
                      <p className="text-xs text-ivory-100/40">{m.membership_number}</p>
                    </div>
                    {card && <StatusBadge status={card.status} />}
                  </div>
                  <p className="text-xs text-ivory-100/40">
                    {m.expires_at ? `Valid until ${formatDate(m.expires_at)}` : 'Membership'}
                  </p>
                  {ready ? (
                    <a
                      href={`/api/cards/${m.id}/download`}
                      className={cn(buttonVariants(), 'w-full')}
                    >
                      <DownloadIcon /> Download card
                    </a>
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-4 py-3 text-center text-xs text-ivory-100/40">
                      {m.status === 'suspended' || m.status === 'revoked'
                        ? 'Unavailable while your membership is not active'
                        : 'Being prepared — you will be notified when it is ready'}
                    </p>
                  )}
                  <Link
                    href={`/portal/memberships/${m.id}`}
                    className="block text-center text-xs uppercase tracking-[0.15em] text-gold-300 hover:text-gold-200"
                  >
                    Membership details →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No cards yet"
          body="Once your membership is approved, your personalised card will be prepared and released here."
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
