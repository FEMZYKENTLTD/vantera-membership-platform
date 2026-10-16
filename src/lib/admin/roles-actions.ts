'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { rolesPrivilegesSchema } from '@/lib/admin/validation';
import { PERMISSIONS } from '@/lib/permissions/permissions';
import { writeAudit } from '@/lib/audit/log';

export interface AdminActionState {
  error?: string;
  success?: string;
}

/**
 * Grant a role (with an explicit permission set) to a user identified by
 * email. Authority is server-side only; there is no browser-reachable way to
 * grant yourself a role (self-targeting is rejected below and again in RLS).
 */
export async function grantRoleAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const parsed = rolesPrivilegesSchema.safeParse({
    email: formData.get('email'),
    roleKey: formData.get('roleKey'),
    permissions: formData.getAll('permissions')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the role form.' };
  }
  const { email, roleKey, permissions } = parsed.data;

  const admin = createAdminClient();

  // Resolve the user id from the email via the Auth admin API.
  let targetUserId: string | null = null;
  let page = 1;
  while (!targetUserId && page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 });
    if (error) break;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) targetUserId = found.id;
    if (data.users.length < 50) break;
    page += 1;
  }
  if (!targetUserId) return { error: 'No account exists for that email address.' };
  if (targetUserId === ctx.user.id) {
    return { error: 'For separation of duties, you cannot grant roles to your own account.' };
  }

  // Permissions must come from the catalog.
  const { data: catalog } = await admin.from('admin_permissions').select('key');
  const known = new Set((catalog ?? []).map((p) => p.key));
  const invalid = permissions.filter((p) => !known.has(p));
  if (invalid.length > 0) return { error: `Unknown permission: ${invalid.join(', ')}` };

  const { data: role, error: roleError } = await admin
    .from('admin_roles')
    .upsert(
      { user_id: targetUserId, role_key: roleKey, is_active: true, created_by: ctx.user.id },
      { onConflict: 'user_id,role_key' }
    )
    .select('id')
    .single();
  if (roleError || !role) {
    return { error: 'The role could not be created. Please try again.' };
  }

  // Replace the permission set atomically-ish: clear then grant.
  await admin.from('admin_role_permissions').delete().eq('role_id', role.id);
  if (permissions.length > 0) {
    const { error: permError } = await admin.from('admin_role_permissions').insert(
      permissions.map((p) => ({
        role_id: role.id,
        permission_key: p,
        granted_by: ctx.user.id
      }))
    );
    if (permError) return { error: 'The role was created but permissions were not saved.' };
  }

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: 'admin.role_granted',
    entityType: 'admin_role',
    entityId: role.id,
    metadata: { targetUserId, roleKey, permissions }
  });

  revalidatePath('/admin/roles');
  return { success: `Role "${roleKey}" granted with ${permissions.length} permission(s).` };
}

export async function setRolePermissionsAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.ROLES_MANAGE);

  const roleId = formData.get('roleId');
  const permissions = formData.getAll('permissions').map(String);
  if (typeof roleId !== 'string' || roleId.length < 10) {
    return { error: 'Invalid role.' };
  }

  const admin = createAdminClient();
  const { data: role } = await admin
    .from('admin_roles')
    .select('*')
    .eq('id', roleId)
    .maybeSingle();
  if (!role) return { error: 'Role not found.' };
  if (role.user_id === ctx.user.id) {
    return { error: 'You cannot modify the permissions of your own role.' };
  }

  const { data: catalog } = await admin.from('admin_permissions').select('key');
  const known = new Set((catalog ?? []).map((p) => p.key));
  if (permissions.some((p) => !known.has(p))) {
    return { error: 'One or more permissions are unknown.' };
  }

  await admin.from('admin_role_permissions').delete().eq('role_id', role.id);
  if (permissions.length > 0) {
    const { error } = await admin.from('admin_role_permissions').insert(
      permissions.map((p) => ({ role_id: role.id, permission_key: p, granted_by: ctx.user.id }))
    );
    if (error) return { error: 'Permissions could not be saved.' };
  }

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: 'admin.role_permissions_updated',
    entityType: 'admin_role',
    entityId: role.id,
    metadata: { targetUserId: role.user_id, roleKey: role.role_key, permissions }
  });

  revalidatePath('/admin/roles');
  return { success: 'Permissions updated.' };
}

/** Deactivate (revoke in practice) or reactivate a role. */
export async function setRoleActiveAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const ctx = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const roleId = formData.get('roleId');
  const isActive = formData.get('isActive') === 'true';
  if (typeof roleId !== 'string' || roleId.length < 10) return { error: 'Invalid role.' };

  const admin = createAdminClient();
  const { data: role } = await admin
    .from('admin_roles')
    .select('*')
    .eq('id', roleId)
    .maybeSingle();
  if (!role) return { error: 'Role not found.' };
  if (role.user_id === ctx.user.id) {
    return { error: 'You cannot deactivate your own role.' };
  }

  const { error } = await admin
    .from('admin_roles')
    .update({ is_active: isActive })
    .eq('id', role.id);
  if (error) return { error: 'The role could not be updated.' };

  await writeAudit(admin, {
    actorId: ctx.user.id,
    action: isActive ? 'admin.role_reactivated' : 'admin.role_deactivated',
    entityType: 'admin_role',
    entityId: role.id,
    metadata: { targetUserId: role.user_id, roleKey: role.role_key }
  });

  revalidatePath('/admin/roles');
  return { success: isActive ? 'Role reactivated.' : 'Role deactivated.' };
}
