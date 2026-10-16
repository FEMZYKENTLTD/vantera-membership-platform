import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { PackageEditor } from '@/components/admin/package-form';
import { Alert } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

export default async function AdminPackagesPage() {
  await requireAdmin(PERMISSIONS.PACKAGES_MANAGE);
  const admin = createAdminClient();
  const { data: tiers } = await admin
    .from('membership_tiers')
    .select('*')
    .order('display_order', { ascending: true });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Membership packages"
        description="Prices are locked into orders when created — editing a package never changes an existing order. Price edits are audit-logged automatically."
      />
      <Alert tone="info">
        Publish only content the business has approved. Benefits must never
        imply investment returns, stored value or financial products.
      </Alert>
      <PackageEditor tiers={tiers ?? []} />
    </div>
  );
}
