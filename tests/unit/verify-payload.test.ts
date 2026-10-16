import { describe, it, expect } from 'vitest';
import { buildVerificationPayload, FORBIDDEN_VERIFICATION_KEYS } from '@/lib/verify/payload';

const base = {
  membershipStatus: 'active' as const,
  cardStatus: 'ready' as const,
  membershipNumber: 'VT-2026-1234',
  tierName: 'Signature',
  expiresAt: '2027-10-16T00:00:00.000Z',
  now: new Date('2026-10-16T12:00:00Z')
};

describe('public verification payload', () => {
  it('produces only the minimal identification whitelist', () => {
    const payload = buildVerificationPayload({ ...base, display: { showTier: true, showExpiry: true } });
    const keys = Object.keys(payload).sort();
    expect(keys).toEqual(['expiresOn', 'membershipReference', 'state', 'tierName'].sort());
  });

  it('NEVER contains PII / account keys — this shape is the entire public contract', () => {
    const payload = buildVerificationPayload({ ...base, display: { showTier: true, showExpiry: true } });
    const serialized = JSON.stringify(payload);
    for (const forbidden of FORBIDDEN_VERIFICATION_KEYS) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    // And nothing resembling the common leak suspects:
    expect(serialized).not.toMatch(/@/); // no emails
  });

  it('truncates timestamps to a date only', () => {
    const payload = buildVerificationPayload({ ...base, display: { showTier: true, showExpiry: true } });
    expect(payload.expiresOn).toBe('2027-10-16');
    expect(payload.expiresOn).not.toContain('T');
  });

  it('honours display toggles (admin-configured privacy)', () => {
    const payload = buildVerificationPayload({ ...base, display: { showTier: false, showExpiry: false } });
    expect(payload.tierName).toBeUndefined();
    expect(payload.expiresOn).toBeUndefined();
    expect(Object.keys(payload).sort()).toEqual(['membershipReference', 'state'].sort());
  });

  it('truthfully reports invalid / suspended / revoked / expired states', () => {
    expect(
      buildVerificationPayload({ ...base, cardStatus: 'in_preparation', display: { showTier: true, showExpiry: true } }).state
    ).toBe('invalid');
    expect(
      buildVerificationPayload({ ...base, membershipStatus: 'suspended', display: { showTier: true, showExpiry: true } }).state
    ).toBe('suspended');
    expect(
      buildVerificationPayload({ ...base, membershipStatus: 'revoked', display: { showTier: true, showExpiry: true } }).state
    ).toBe('revoked');
    expect(
      buildVerificationPayload({
        ...base,
        expiresAt: '2020-01-01T00:00:00.000Z',
        display: { showTier: true, showExpiry: true }
      }).state
    ).toBe('expired');
  });
});
