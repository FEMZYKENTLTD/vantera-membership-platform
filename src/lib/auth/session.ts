import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PermissionKey } from '@/lib/permissions/permissions';

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Resolve the current authenticated user using the server-session client.
 * Uses auth.getUser() (validates with the Auth server), never the raw
 * session object — cached per request so layouts and pages share one call.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
});

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    redirect(`/login${next}`);
  }
  return user;
}

export interface AdminContext {
  user: SessionUser;
  roles: string[];
  permissions: ReadonlySet<string>;
}

// Collector for granted permissions; service-role reads join across users,
// so resolve admin context via the privileged client but ONLY by user id
// derived from the verified session — never from request data.
export async function getAdminContext(userId: string): Promise<AdminContext | null> {
  const user = await getSessionUser();
  if (!user || user.id !== userId) return null;

  const admin = createAdminClient();
  const { data: roles } = await admin
    .from('admin_roles')
    .select('id, role_key, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!roles || roles.length === 0) {
    return { user, roles: [], permissions: new Set() };
  }

  const roleIds = roles.map((r) => r.id);
  const { data: perms } = await admin
    .from('admin_role_permissions')
    .select('permission_key')
    .in('role_id', roleIds);

  return {
    user,
    roles: roles.map((r) => r.role_key),
    permissions: new Set((perms ?? []).map((p) => p.permission_key))
  };
}

/**
 * Require a signed-in administrator holding `permission` (or any admin role
 * when omitted). Redirects unauthenticated visitors to login and
 * non-administrators to the member portal.
 */
export async function requireAdmin(permission?: PermissionKey): Promise<AdminContext> {
  const user = await requireUser();
  const ctx = await getAdminContext(user.id);
  if (!ctx || ctx.roles.length === 0) redirect('/portal?denied=admin');
  if (permission && !ctx.permissions.has(permission)) redirect('/admin?denied=permission');
  return ctx;
}

/**
 * Permission check for server actions: returns the context or throws.
 * Server actions must NEVER trust role claims arriving from the browser —
 * authority is re-derived here on every call.
 */
export async function requirePermission(permission: PermissionKey): Promise<AdminContext> {
  const user = await getSessionUser();
  if (!user) throw new Error('Authentication required.');
  const ctx = await getAdminContext(user.id);
  if (!ctx || ctx.roles.length === 0) throw new Error('Administrator access required.');
  if (!ctx.permissions.has(permission)) {
    // Failed privileged actions are security-relevant: audit them.
    try {
      const admin = createAdminClient();
      await admin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'security.permission_denied',
        entity_type: 'permission',
        entity_id: null,
        metadata: { permission }
      });
    } catch {
      /* never block on audit */
    }
    throw new Error('You do not have permission to perform this action.');
  }
  return ctx;
}
