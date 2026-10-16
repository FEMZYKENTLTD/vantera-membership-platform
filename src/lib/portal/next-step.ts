import type {
  CardStatus,
  MembershipStatus,
  OrderStatus,
  PaymentStatus
} from '@/types/database';

/**
 * Computes the single most useful "what happens next" summary for the member
 * dashboard. Honest by construction: a pending payment is never described as
 * approved.
 */
export interface NextStep {
  state:
    | 'choose_tier'
    | 'pay'
    | 'verifying'
    | 'more_info'
    | 'rejected'
    | 'preparing'
    | 'card_ready'
    | 'active'
    | 'suspended';
  title: string;
  body: string;
  cta?: { href: string; label: string };
  orderId?: string;
  membershipId?: string;
}

export function computeNextStep(input: {
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  membershipStatus?: MembershipStatus;
  cardStatus?: CardStatus;
  orderId?: string;
  membershipId?: string;
  orderRejected?: boolean;
}): NextStep {
  const { membershipStatus, cardStatus, orderStatus, paymentStatus } = input;

  if (membershipStatus === 'suspended') {
    return {
      state: 'suspended',
      title: 'Your membership is suspended',
      body: 'Contact Vantera support for assistance with your membership.',
      cta: { href: '/contact', label: 'Contact support' }
    };
  }

  if (membershipStatus === 'active' && cardStatus === 'ready') {
    return {
      state: 'active',
      title: 'Your membership is active',
      body: 'Your personalised card is ready in your portal whenever you need it.',
      cta: { href: '/portal/cards', label: 'View my card' },
      membershipId: input.membershipId
    };
  }

  if (cardStatus === 'ready' || membershipStatus === 'card_ready') {
    return {
      state: 'card_ready',
      title: 'Your membership card is ready to download',
      body: 'Your personalised Vantera card has been prepared and is waiting in your portal.',
      cta: { href: '/portal/cards', label: 'Download my card' },
      membershipId: input.membershipId
    };
  }

  if (membershipStatus === 'processing' || orderStatus === 'membership_processing') {
    return {
      state: 'preparing',
      title: 'Your membership card is being prepared',
      body: 'Payment approved. Our designer is preparing your personalised card now.',
      cta: { href: '/portal/memberships', label: 'View membership' }
    };
  }

  if (paymentStatus === 'approved' || orderStatus === 'payment_approved') {
    return {
      state: 'preparing',
      title: 'Payment approved — preparing your membership',
      body: 'Your payment has been verified and approved. Your membership enters preparation shortly.',
      cta: { href: '/portal/memberships', label: 'View membership' }
    };
  }

  if (
    paymentStatus === 'additional_information_required' ||
    orderStatus === 'additional_information_required'
  ) {
    return {
      state: 'more_info',
      title: 'Additional information is required',
      body: 'Our review team needs a little more information to verify your payment. Open your order to respond.',
      cta: input.orderId
        ? { href: `/portal/orders/${input.orderId}`, label: 'Respond now' }
        : { href: '/portal/orders', label: 'View orders' },
      orderId: input.orderId
    };
  }

  if (paymentStatus === 'under_review' || orderStatus === 'under_review') {
    return {
      state: 'verifying',
      title: 'Your payment is being verified',
      body: 'A member of our team is reviewing your payment now.',
      cta: input.orderId
        ? { href: `/portal/orders/${input.orderId}`, label: 'Track verification' }
        : undefined,
      orderId: input.orderId
    };
  }

  if (paymentStatus === 'pending_review' || orderStatus === 'payment_submitted') {
    return {
      state: 'verifying',
      title: 'Payment submission received',
      body: 'Your payment is awaiting verification. This normally takes 1–3 working days.',
      cta: input.orderId
        ? { href: `/portal/orders/${input.orderId}`, label: 'Track verification' }
        : undefined,
      orderId: input.orderId
    };
  }

  if (input.orderRejected) {
    return {
      state: 'rejected',
      title: 'A payment could not be approved',
      body: 'Review the reason on your order and submit a new payment when ready.',
      cta: input.orderId
        ? { href: `/portal/orders/${input.orderId}`, label: 'View the reason' }
        : { href: '/portal/orders', label: 'View orders' },
      orderId: input.orderId
    };
  }

  if (orderStatus === 'awaiting_payment') {
    return {
      state: 'pay',
      title: 'Complete your payment',
      body: 'Your order is reserved at the agreed price. Follow the payment instructions on your order.',
      cta: input.orderId
        ? { href: `/portal/orders/${input.orderId}`, label: 'Pay now' }
        : { href: '/portal/orders', label: 'View orders' },
      orderId: input.orderId
    };
  }

  return {
    state: 'choose_tier',
    title: 'Begin your Vantera membership',
    body: 'Choose one of the four membership tiers to start your application.',
    cta: { href: '/membership', label: 'Choose a membership' }
  };
}
