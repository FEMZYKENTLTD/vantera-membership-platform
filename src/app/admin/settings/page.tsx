import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { SettingsManager } from '@/components/admin/settings-manager';
import { Alert } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireAdmin(PERMISSIONS.SETTINGS_MANAGE);
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('site_settings')
    .select('*')
    .order('key', { ascending: true });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Site & payment configuration"
        description="Business-editable configuration. Changes are audit-logged; payment methods go live only when you enable them here."
      />
      <Alert tone="warning" title="Before launch">
        Configure the public contact method, review the verification notice,
        and enter real, verified payment configuration. Nothing is charged and
        no payment method appears to members until enabled here.
      </Alert>
      <SettingsManager
        rows={(settings ?? []).map((s) => ({
          key: s.key,
          value: s.value,
          description: s.description,
          is_public: s.is_public
        }))}
      />
    </div>
  );
}
