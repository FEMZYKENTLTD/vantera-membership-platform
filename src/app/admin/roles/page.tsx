import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { PageHeader } from '@/components/admin/stat';
import { RolesManager } from '@/components/admin/roles-forms';
import { Alert } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

export default async function AdminRolesPage() {
  const ctx = await requireAdmin(PERMISSIONS.ROLES_MANAGE);
  const admin = createAdminClient();

  const [{ data: roles }, { data: catalog }] = await Promise.all([
    admin.from('admin_roles').select('*').order('created_at', { ascending: false }),
    admin.from('admin_permissions').select('*').order('key')
  ]);

  // Resolve emails for display via the Auth admin API (emails are not stored
  // in profiles — least duplication).
  const userIds = [...new Set((roles ?? []).map((r) => r.user_id))];
  const emailById = new Map<string, string>();
  for (const id of userIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data.user?.email) emailById.set(id, data.user.email);
  }

  const { data: allRolePerms } = roles?.length
    ? await admin
        .from('admin_role_permissions')
        .select('role_id, permission_key')
        .in('role_id', roles.map((r) => r.id))
    : { data: [] };
  const permsByRole = new Map<string, string[]>();
  for (const rp of allRolePerms ?? []) {
    permsByRole.set(rp.role_id, [...(permsByRole.get(rp.role_id) ?? []), rp.permission_key]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Roles & access"
        description="Administrative access is granted server-side only. There is no public path to privileges — and you cannot edit your own."
      />
      <Alert tone="info">
        The very first administrator is created with the secure bootstrap
        script (<code>npm run grant-admin</code>), never through the website.
      </Alert>
      <RolesManager
        currentUserId={ctx.user.id}
        catalog={catalog ?? []}
        roles={(roles ?? []).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          role_key: r.role_key,
          is_active: r.is_active,
          created_at: r.created_at,
          email: emailById.get(r.user_id) ?? r.user_id,
          permissions: permsByRole.get(r.id) ?? []
        }))}
      />
    </div>
  );
}
