import type { CardStatus, MembershipStatus } from '@/types/database';

/**
 * Membership lifecycle state machine.
 */
export const MEMBERSHIP_TRANSITIONS: Readonly<
  Record<MembershipStatus, readonly MembershipStatus[]>
> = {
  pending: ['processing', 'cancelled'],
  processing: ['card_ready', 'suspended', 'cancelled'],
  card_ready: ['active', 'suspended', 'revoked'],
  active: ['suspended', 'revoked', 'expired'],
  suspended: ['active', 'revoked', 'cancelled'],
  revoked: [],
  expired: [],
  cancelled: []
};

/** Transitions that ALWAYS require a recorded reason. */
export const REASON_REQUIRED: ReadonlySet<MembershipStatus> = new Set([
  'suspended',
  'revoked',
  'cancelled'
]);

export function canTransitionMembership(
  from: MembershipStatus,
  to: MembershipStatus
): boolean {
  return MEMBERSHIP_TRANSITIONS[from].includes(to);
}

export function assertMembershipTransition(
  from: MembershipStatus,
  to: MembershipStatus,
  reason: string | null | undefined
): string | null {
  if (!canTransitionMembership(from, to)) {
    return `Cannot move a membership from "${from}" to "${to}".`;
  }
  if (REASON_REQUIRED.has(to) && (!reason || reason.trim().length < 5)) {
    return `A reason of at least 5 characters is required to set a membership to "${to}".`;
  }
  return null;
}

/**
 * Card lifecycle. Uploading artwork moves a card to in_preparation; the
 * designer must explicitly mark it ready before a member can download it.
 * Replacing artwork after "ready" returns the card to in_preparation so the
 * new file always goes through confirmation again.
 */
export const CARD_TRANSITIONS: Readonly<Record<CardStatus, readonly CardStatus[]>> = {
  awaiting_upload: ['in_preparation'],
  in_preparation: ['ready', 'in_preparation', 'revoked'],
  ready: ['in_preparation', 'revoked'], // replacement -> in_preparation
  revoked: []
};

export function canTransitionCard(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to);
}

/**
 * Public verification visibility rule: a card presents as valid ONLY when
 * the membership is active AND the card is ready AND neither is revoked or
 * suspended. The public page never explains more than this summary.
 */
export function publicVerificationState(
  membershipStatus: MembershipStatus,
  cardStatus: CardStatus,
  expiresAt: string | null,
  now: Date = new Date()
): 'valid' | 'invalid' | 'suspended' | 'revoked' | 'expired' {
  if (membershipStatus === 'revoked' || cardStatus === 'revoked') return 'revoked';
  if (membershipStatus === 'suspended') return 'suspended';
  if (membershipStatus === 'expired') return 'expired';
  if (expiresAt && new Date(expiresAt) < now) return 'expired';
  if (membershipStatus === 'active' && cardStatus === 'ready') return 'valid';
  return 'invalid';
}
