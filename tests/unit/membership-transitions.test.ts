import { describe, it, expect } from 'vitest';
import {
  canTransitionMembership,
  assertMembershipTransition,
  canTransitionCard,
  publicVerificationState
} from '@/lib/memberships/transitions';

describe('membership lifecycle', () => {
  it('follows the sanctioned path: pending → processing → card_ready → active', () => {
    expect(canTransitionMembership('pending', 'processing')).toBe(true);
    expect(canTransitionMembership('processing', 'card_ready')).toBe(true);
    expect(canTransitionMembership('card_ready', 'active')).toBe(true);
  });

  it('cannot skip stages (no card before payment approval path)', () => {
    expect(canTransitionMembership('pending', 'active')).toBe(false);
    expect(canTransitionMembership('pending', 'card_ready')).toBe(false);
    expect(canTransitionMembership('processing', 'active')).toBe(false);
  });

  it('revoked, expired and cancelled memberships are terminal', () => {
    for (const s of ['revoked', 'expired', 'cancelled'] as const) {
      expect(canTransitionMembership(s, 'active')).toBe(false);
      expect(canTransitionMembership(s, 'processing')).toBe(false);
    }
  });

  it('suspension and revocation REQUIRE a reason', () => {
    expect(assertMembershipTransition('active', 'suspended', null)).toMatch(/reason/i);
    expect(assertMembershipTransition('active', 'revoked', 'fraud investigation')).toBeNull();
    expect(assertMembershipTransition('suspended', 'active', null)).toBeNull(); // reinstate
  });

  it('card readiness follows upload → prepare → ready', () => {
    expect(canTransitionCard('awaiting_upload', 'in_preparation')).toBe(true);
    expect(canTransitionCard('awaiting_upload', 'ready')).toBe(false);
    expect(canTransitionCard('in_preparation', 'ready')).toBe(true);
    // Replacing artwork after ready forces re-confirmation:
    expect(canTransitionCard('ready', 'in_preparation')).toBe(true);
  });
});

describe('public verification state', () => {
  const future = new Date(Date.now() + 365 * 864e5).toISOString();

  it('only active + ready verifies as valid', () => {
    expect(publicVerificationState('active', 'ready', future)).toBe('valid');
    expect(publicVerificationState('active', 'in_preparation', future)).toBe('invalid');
    expect(publicVerificationState('processing', 'ready', future)).toBe('invalid');
    expect(publicVerificationState('pending', 'awaiting_upload', null)).toBe('invalid');
  });

  it('revoked memberships or cards verify as revoked', () => {
    expect(publicVerificationState('revoked', 'ready', future)).toBe('revoked');
    expect(publicVerificationState('active', 'revoked', future)).toBe('revoked');
  });

  it('suspended cards no longer appear valid', () => {
    expect(publicVerificationState('suspended', 'ready', future)).toBe('suspended');
  });

  it('expired by date verifies as expired', () => {
    const past = new Date(Date.now() - 864e5).toISOString();
    expect(publicVerificationState('active', 'ready', past)).toBe('expired');
  });
});
