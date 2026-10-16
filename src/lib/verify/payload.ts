import type { CardStatus, MembershipStatus } from '@/types/database';
import { publicVerificationState } from '@/lib/memberships/transitions';

/**
 * Builds the public card-verification payload.
 *
 * PRIVACY CONTRACT: this is the ONLY shape ever rendered by the public
 * /verify/[publicIdentifier] page. It must never contain a member's name,
 * contact details, address, date of birth, payment information, user ids or
 * account data — only the minimum required to confirm authenticity.
 */
export interface VerificationPayload {
  state: 'valid' | 'invalid' | 'suspended' | 'revoked' | 'expired';
  membershipReference: string;
  tierName?: string;
  expiresOn?: string; // date only, never a timestamp
}

export function buildVerificationPayload(input: {
  membershipStatus: MembershipStatus;
  cardStatus: CardStatus;
  membershipNumber: string;
  tierName: string;
  expiresAt: string | null;
  display: { showTier: boolean; showExpiry: boolean };
  now?: Date;
}): VerificationPayload {
  const state = publicVerificationState(
    input.membershipStatus,
    input.cardStatus,
    input.expiresAt,
    input.now ?? new Date()
  );

  const payload: VerificationPayload = {
    state,
    membershipReference: input.membershipNumber
  };

  if (input.display.showTier) payload.tierName = input.tierName;
  if (input.display.showExpiry && input.expiresAt) {
    payload.expiresOn = input.expiresAt.slice(0, 10);
  }

  return payload;
}

/** Keys that must never appear anywhere in a verification payload. */
export const FORBIDDEN_VERIFICATION_KEYS = [
  'full_name',
  'email',
  'phone',
  'address',
  'address_line1',
  'address_line2',
  'city',
  'region',
  'postal_code',
  'country',
  'date_of_birth',
  'user_id',
  'order_id',
  'payment',
  'tx_hash'
] as const;
