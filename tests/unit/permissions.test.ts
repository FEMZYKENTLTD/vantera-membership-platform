import { describe, it, expect } from 'vitest';
import { ROLE_PRESETS, rolePresetHas, ALL_PERMISSIONS } from '@/lib/permissions/permissions';

describe('role permission presets', () => {
  it('a card DESIGNER can manage cards but CANNOT approve payments', () => {
    const perms = ROLE_PRESETS.designer.permissions;
    expect(perms).toContain('cards.manage');
    expect(perms).not.toContain('payments.approve');
    expect(perms).not.toContain('payments.reject');
    expect(perms).not.toContain('payments.review');
    expect(perms).not.toContain('packages.manage');
    expect(perms).not.toContain('roles.manage');
    expect(perms).not.toContain('settings.manage');
    expect(rolePresetHas('designer', 'payments.approve')).toBe(false);
    expect(rolePresetHas('designer', 'cards.manage')).toBe(true);
  });

  it('a payments admin can approve but NOT manage admins, packages or settings', () => {
    const perms = ROLE_PRESETS.payments_admin.permissions;
    expect(perms).toContain('payments.approve');
    expect(perms).toContain('payments.reject');
    expect(perms).not.toContain('roles.manage');
    expect(perms).not.toContain('settings.manage');
    expect(perms).not.toContain('packages.manage');
    expect(perms).not.toContain('cards.manage'); // separation of duties
  });

  it('support is read-only — never payment approval or mutations', () => {
    const perms = ROLE_PRESETS.support.permissions;
    expect(perms).not.toContain('payments.approve');
    expect(perms).not.toContain('payments.reject');
    expect(perms).not.toContain('customers.manage');
    expect(perms).not.toContain('memberships.manage');
    expect(perms).toContain('customers.view');
  });

  it('super_admin carries every permission in the catalog', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(ROLE_PRESETS.super_admin.permissions).toContain(p);
    }
  });

  it('unknown roles never implicitly grant anything', () => {
    expect(rolePresetHas('marketing_intern', 'payments.approve')).toBe(false);
  });
});
