#!/usr/bin/env node
/**
 * Vantera — secure administrator bootstrap.
 *
 * Creates the FIRST administrator (or upgrades an existing account) by
 * granting a full-permission super_admin role. This runs offline against the
 * database with the SERVICE ROLE key — there is deliberately NO web endpoint
 * for this, so privilege can never be claimed from a browser.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node scripts/grant-admin.mjs admin@your-domain.com
 *
 * The account must already exist (register it on the site first).
 */
import { createClient } from '@supabase/supabase-js';

const ALL_PERMISSIONS = [
  'orders.view',
  'orders.manage',
  'payments.review',
  'payments.approve',
  'payments.reject',
  'customers.view',
  'customers.manage',
  'memberships.manage',
  'cards.manage',
  'packages.manage',
  'roles.manage',
  'settings.manage',
  'audit.view'
];

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: node scripts/grant-admin.mjs <admin-email>');
    process.exit(1);
  }
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Find the user by email.
  let target = null;
  for (let page = 1; page <= 20 && !target; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    target = data.users.find((u) => u.email?.toLowerCase() === email);
    if (data.users.length < 50) break;
  }
  if (!target) {
    console.error(
      `No account found for ${email}. Register the account on the website first, then re-run.`
    );
    process.exit(1);
  }

  // Grant the super_admin role (idempotent).
  const { data: role, error: roleError } = await supabase
    .from('admin_roles')
    .upsert(
      { user_id: target.id, role_key: 'super_admin', is_active: true },
      { onConflict: 'user_id,role_key' }
    )
    .select('id')
    .single();
  if (roleError) throw new Error(`role grant failed: ${roleError.message}`);

  // Wipe + grant the full permission set.
  await supabase.from('admin_role_permissions').delete().eq('role_id', role.id);
  const { error: permError } = await supabase.from('admin_role_permissions').insert(
    ALL_PERMISSIONS.map((p) => ({ role_id: role.id, permission_key: p }))
  );
  if (permError) throw new Error(`permission grant failed: ${permError.message}`);

  // Audit the bootstrap (actor = the operator running this script).
  await supabase.from('audit_logs').insert({
    actor_id: target.id,
    action: 'admin.bootstrap',
    entity_type: 'admin_role',
    entity_id: role.id,
    metadata: { roleKey: 'super_admin', via: 'scripts/grant-admin.mjs' }
  });

  console.log(`✔ ${email} is now a super_admin with ${ALL_PERMISSIONS.length} permissions.`);
  console.log('  Sign in and open /admin to begin. Grant further roles from /admin/roles.');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
