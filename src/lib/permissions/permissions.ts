/**
 * Permission model.
 *
 * Permissions are stored in admin_permissions + admin_role_permissions and
 * are ONLY grantable through:
 *   1. the service-role bootstrap script (scripts/grant-admin.mjs), or
 *   2. an administrator holding 'roles.manage' (who can never edit their own
 *      roles — enforced by RLS and server actions).
 *
 * Nothing in the browser bundle can grant a permission.
 */

export const PERMISSIONS = {
  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',
  PAYMENTS_REVIEW: 'payments.review',
  PAYMENTS_APPROVE: 'payments.approve',
  PAYMENTS_REJECT: 'payments.reject',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  MEMBERSHIPS_MANAGE: 'memberships.manage',
  CARDS_MANAGE: 'cards.manage',
  PACKAGES_MANAGE: 'packages.manage',
  ROLES_MANAGE: 'roles.manage',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view'
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

/** Built-in role presets. Custom roles can be assembled from any subset. */
export const ROLE_PRESETS: Record<string, { label: string; permissions: PermissionKey[] }> = {
  super_admin: {
    label: 'Super administrator',
    permissions: [...ALL_PERMISSIONS]
  },
  payments_admin: {
    label: 'Payments administrator',
    permissions: [
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.PAYMENTS_REVIEW,
      PERMISSIONS.PAYMENTS_APPROVE,
      PERMISSIONS.PAYMENTS_REJECT,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.AUDIT_VIEW
    ]
  },
  designer: {
    label: 'Card designer',
    permissions: [PERMISSIONS.CARDS_MANAGE, PERMISSIONS.CUSTOMERS_VIEW]
  },
  support: {
    label: 'Member support',
    permissions: [PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.ORDERS_VIEW]
  }
};

/**
 * Pure matrix check used by tests and server code.
 * A designer, for example, holds cards.manage but NOT payments.approve —
 * payments can only be approved with an explicit payments.approve grant.
 */
export function rolePresetHas(roleKey: string, permission: PermissionKey): boolean {
  return ROLE_PRESETS[roleKey]?.permissions.includes(permission) ?? false;
}
