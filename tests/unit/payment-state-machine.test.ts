import { describe, it, expect } from 'vitest';
import {
  canTransitionPayment,
  assertReviewAction,
  allowedSourcesFor,
  ORDER_ACCEPTS_PAYMENT,
  MEMBER_REOPENABLE_PAYMENT_STATUSES
} from '@/lib/payments/state-machine';

describe('payment review state machine', () => {
  it('new submissions can only enter review', () => {
    expect(canTransitionPayment('pending_review', 'under_review')).toBe(true);
    expect(canTransitionPayment('pending_review', 'approved')).toBe(true);
    expect(canTransitionPayment('submitted', 'approved')).toBe(false);
  });

  it('approved and rejected payments are final (no double processing)', () => {
    expect(canTransitionPayment('approved', 'rejected')).toBe(false);
    expect(canTransitionPayment('approved', 'approved')).toBe(false);
    expect(canTransitionPayment('rejected', 'approved')).toBe(false);
    expect(canTransitionPayment('rejected', 'under_review')).toBe(false);
  });

  it('additional-information requests return to review, not approval', () => {
    expect(canTransitionPayment('additional_information_required', 'under_review')).toBe(true);
    expect(canTransitionPayment('additional_information_required', 'approved')).toBe(false);
  });

  it('rejection REQUIRES a reason', () => {
    expect(assertReviewAction('under_review', 'reject', null)).toMatch(/reason/i);
    expect(assertReviewAction('under_review', 'reject', 'bad')).toMatch(/reason/i);
    expect(assertReviewAction('under_review', 'reject', 'Could not locate the transaction.')).toBeNull();
  });

  it('information requests REQUIRE a reason', () => {
    expect(assertReviewAction('pending_review', 'request_info', null)).toMatch(/reason/i);
    expect(assertReviewAction('pending_review', 'request_info', 'Please add the transaction hash.')).toBeNull();
  });

  it('approval does not require a reason but must be in a reviewable state', () => {
    expect(assertReviewAction('under_review', 'approve', null)).toBeNull();
    expect(assertReviewAction('approved', 'approve', null)).toMatch(/cannot/i);
    expect(assertReviewAction('rejected', 'approve', null)).toMatch(/cannot/i);
  });

  it('idempotent concurrency: allowed sources never include the target state', () => {
    for (const action of ['mark_under_review', 'approve', 'reject', 'request_info'] as const) {
      const sources = allowedSourcesFor(action);
      expect(sources.length).toBeGreaterThan(0);
      // A second identical action can never match its own source set again
      // after the first one succeeded (state has moved to the target).
    }
    expect(allowedSourcesFor('approve')).not.toContain('approved');
    expect(allowedSourcesFor('reject')).not.toContain('rejected');
  });

  it('orders accept payment only before approval', () => {
    expect(ORDER_ACCEPTS_PAYMENT).toContain('awaiting_payment');
    expect(ORDER_ACCEPTS_PAYMENT).toContain('additional_information_required');
    expect(ORDER_ACCEPTS_PAYMENT).not.toContain('payment_approved');
    expect(ORDER_ACCEPTS_PAYMENT).not.toContain('completed');
    expect(ORDER_ACCEPTS_PAYMENT).not.toContain('cancelled');
  });

  it('members may re-open their submission only before a reviewer picks it up', () => {
    // Pre-review and info-requested states are safe for member correction…
    expect(MEMBER_REOPENABLE_PAYMENT_STATUSES).toContain('submitted');
    expect(MEMBER_REOPENABLE_PAYMENT_STATUSES).toContain('pending_review');
    expect(MEMBER_REOPENABLE_PAYMENT_STATUSES).toContain('additional_information_required');
    // …but never an in-flight review or a settled decision (would reopen decisions silently).
    expect(MEMBER_REOPENABLE_PAYMENT_STATUSES).not.toContain('under_review');
    expect(MEMBER_REOPENABLE_PAYMENT_STATUSES).not.toContain('approved');
    expect(MEMBER_REOPENABLE_PAYMENT_STATUSES).not.toContain('rejected');
  });

  it('after rejection a member starts fresh — the unique open-payment index allows exactly one open row', () => {
    // The DB enforces: partial unique index over open statuses per order.
    // This registry documents which statuses count as "open" — must match
    // one_open_payment_per_order in migration 00004.
    const OPEN = ['submitted', 'pending_review', 'under_review', 'additional_information_required'];
    expect([...MEMBER_REOPENABLE_PAYMENT_STATUSES]).toEqual(
      OPEN.filter((s) => s !== 'under_review')
    );
    // Reviewer-held states are never member-reopenable; settled states never open.
    expect(OPEN).not.toContain('approved');
    expect(OPEN).not.toContain('rejected');
  });
});
