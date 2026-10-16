import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Designer queue: memberships whose payment is approved and whose card
 * artwork is awaited or in preparation.
 */
export default async function AdminCardDesignsPage() {
  await requireAdmin(PERMISSIONS.CARDS_MANAGE);
  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from('memberships')
    .select('*')
    .in('status', ['processing', 'card_ready'])
    .order('created_at', { ascending: true })
    .limit(100);

  const membershipIds = (memberships ?? []).map((m) => m.id);
  const { data: cards } = membershipIds.length
    ? await admin.from('membership_cards').select('*').in('membership_id', membershipIds)
    : { data: [] };
  const cardByMembership = new Map((cards ?? []).map((c) => [c.membership_id, c]));

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

  const awaiting = (memberships ?? []).filter(
    (m) => !cardByMembership.get(m.id) || cardByMembership.get(m.id)?.status === 'awaiting_upload'
  );
  const inPrep = (memberships ?? []).filter(
    (m) => cardByMembership.get(m.id)?.status === 'in_preparation'
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Card designs"
        description="Memberships waiting for card artwork. Open one to upload, confirm and release."
      />

        {(awaiting.length > 0 || inPrep.length > 0) ? (
        <div className="space-y-10">
          {[
            { title: 'Awaiting artwork', list: awaiting },
            { title: 'Artwork uploaded — confirm & release', list: inPrep }
          ].map((section) =>
            section.list.length > 0 ? (
              <section key={section.title}>
                <h2 className="eyebrow mb-4">{section.title}</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {section.list.map((m) => {
                    const card = cardByMembership.get(m.id);
                    return (
                      <Card key={m.id}>
                        <CardContent className="flex items-center justify-between gap-4 py-5">
                          <div>
                            <p className="font-display text-lg">
                              {tierName.get(m.tier_id)} · {memberName.get(m.user_id) || 'Member'}
                            </p>
                            <p className="mt-1 text-xs text-ivory-100/40">
                              {m.membership_number}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {card && <StatusBadge status={card.status} />}
                            <Link
                              href={`/admin/memberships/${m.id}`}
                              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                            >
                              Open
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ) : null
          )}
        </div>
      ) : (
        <EmptyState
          title="Nothing awaiting design"
          body="When a payment is approved, the membership appears here for card preparation."
        />
      )}
    </div>
  );
}
