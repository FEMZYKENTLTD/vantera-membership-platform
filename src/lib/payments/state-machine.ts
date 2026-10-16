import type { OrderStatus, PaymentStatus } from '@/types/database';

/**
 * Payment review state machine — the ONLY sanctioned status transitions.
 *
 * Terminal states (approved, rejected) are immutable: once a payment is
 * approved or rejected it can never silently flip again, which also prevents
 * the same submission being processed twice.
 */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  submitted: ['pending_review', 'under_review'],
  pending_review: ['under_review', 'approved', 'rejected', 'additional_information_required'],
  under_review: ['approved', 'rejected', 'additional_information_required'],
  additional_information_required: ['under_review', 'rejected'],
  approved: [],
  rejected: []
};

export type ReviewAction = 'mark_under_review' | 'approve' | 'reject' | 'request_info';

export const REVIEW_ACTION_TARGET: Readonly<Record<ReviewAction, PaymentStatus>> = {
  mark_under_review: 'under_review',
  approve: 'approved',
  reject: 'rejected',
  request_info: 'additional_information_required'
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/**
 * Validate an administrator review action.
 * Returns an error message, or null when the action is permitted.
 * Rejections and information requests ALWAYS require a reason.
 */
export function assertReviewAction(
  from: PaymentStatus,
  action: ReviewAction,
  reason: string | null | undefined
): string | null {
  const target = REVIEW_ACTION_TARGET[action];
  if (!canTransitionPayment(from, target)) {
    return `Cannot apply "${action}" to a payment in state "${from}".`;
  }
  if ((action === 'reject' || action === 'request_info') && (!reason || reason.trim().length < 5)) {
    return 'A reason of at least 5 characters is required.';
  }
  return null;
}

/**
 * The payment status values from which a given review action may start.
 * Used to build conditional UPDATE ... WHERE status IN (...) statements
 * so concurrent administrators cannot double-process a submission.
 */
export function allowedSourcesFor(action: ReviewAction): PaymentStatus[] {
  const target = REVIEW_ACTION_TARGET[action];
  return (Object.keys(PAYMENT_TRANSITIONS) as PaymentStatus[]).filter((s) =>
    canTransitionPayment(s, target)
  );
}

/** Order status that mirrors a payment lifecycle event. */
export const PAYMENT_EVENT_TO_ORDER_STATUS: Readonly<Record<PaymentStatus, OrderStatus>> = {
  submitted: 'payment_submitted',
  pending_review: 'payment_submitted',
  under_review: 'under_review',
  approved: 'payment_approved',
  rejected: 'payment_rejected',
  additional_information_required: 'additional_information_required'
};

/** Order statuses in which a customer may still submit a payment. */
export const ORDER_ACCEPTS_PAYMENT: readonly OrderStatus[] = [
  'awaiting_payment',
  'payment_submitted',
  'under_review',
  'additional_information_required'
];

/**
 * Payment statuses from which the MEMBER may still replace their own
 * submission in place (correcting typos, answering an information request).
 * Once a reviewer picks the payment up (`under_review`) or settles it,
 * replacement is refused — enforced again by the conditional UPDATE.
 * `rejected` is excluded: after rejection the member starts a FRESH
 * submission (the unique open-payment index then allows it).
 */
export const MEMBER_REOPENABLE_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'submitted',
  'pending_review',
  'additional_information_required'
];

/** Order statuses that are final. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled'];
