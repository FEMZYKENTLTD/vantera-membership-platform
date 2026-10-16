/**
 * Transactional email templates. Plain, on-brand, and strictly minimal:
 * emails never include payment evidence contents, full profile data,
 * gift-card details beyond the issuer, or any credential.
 */

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const BRAND = 'Vantera';

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0A0A09;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:Georgia,'Times New Roman',serif;color:#F5F1E8;">
    <div style="letter-spacing:0.35em;font-size:18px;color:#C6A468;text-align:center;margin-bottom:32px;">VANTERA</div>
    <h1 style="font-size:22px;font-weight:normal;color:#F5F1E8;margin:0 0 16px;">${title}</h1>
    <div style="font-size:15px;line-height:1.7;color:#CDC6B8;">${bodyHtml}</div>
    <div style="margin-top:36px;padding-top:20px;border-top:1px solid rgba(245,241,232,0.1);font-size:12px;color:#8B8578;line-height:1.6;">
      This message concerns your Vantera membership account. If you did not expect it, please contact Vantera support.
    </div>
  </div>
</body></html>`;
}

function text(title: string, lines: string[]): string {
  return `${BRAND}\n\n${title}\n\n${lines.join('\n\n')}`;
}

function build(title: string, lines: string[], htmlParagraphs: string[]): EmailContent {
  const body = htmlParagraphs.map((p) => `<p style="margin:0 0 14px;">${p}</p>`).join('');
  return { subject: `${title} — ${BRAND}`, text: text(title, lines), html: layout(title, body) };
}

export const templates = {
  welcome(name: string) {
    return build(
      'Welcome to Vantera',
      [
        `Dear ${name},`,
        'Your Vantera account has been created. You can now explore the membership tiers and begin your application from your member portal.',
        'Membership is issued only after your selected package payment has been verified (1–3 working days).'
      ],
      [
        `Dear ${name},`,
        'Your Vantera account has been created. You can now explore the membership tiers and begin your application from your member portal.',
        'Membership is issued only after your selected package payment has been verified (1–3 working days).'
      ]
    );
  },

  orderCreated(name: string, reference: string, amount: string) {
    return build(
      'Your order has been created',
      [
        `Dear ${name},`,
        `Order ${reference} for ${amount} is awaiting payment. Sign in to your portal to view payment instructions.`,
        'Submitting payment information does not mean your payment has been approved.'
      ],
      [
        `Dear ${name},`,
        `Order <strong>${reference}</strong> for <strong>${amount}</strong> is awaiting payment. Sign in to your portal to view payment instructions.`,
        'Submitting payment information does not mean your payment has been approved.'
      ]
    );
  },

  paymentSubmitted(name: string, reference: string, estimate: string) {
    return build(
      'Payment submission received',
      [
        `Dear ${name},`,
        `We have received your payment submission for order ${reference}. It is now awaiting verification.`,
        `Verification normally takes ${estimate} (weekends excluded). We will notify you as soon as the review is complete.`
      ],
      [
        `Dear ${name},`,
        `We have received your payment submission for order <strong>${reference}</strong>. It is now awaiting verification.`,
        `Verification normally takes <strong>${estimate}</strong> (weekends excluded). We will notify you as soon as the review is complete.`
      ]
    );
  },

  paymentUnderReview(name: string, reference: string) {
    return build(
      'Your payment is under review',
      [
        `Dear ${name},`,
        `Your payment submission for order ${reference} is now being reviewed by our team.`
      ],
      [
        `Dear ${name},`,
        `Your payment submission for order <strong>${reference}</strong> is now being reviewed by our team.`
      ]
    );
  },

  additionalInfoRequested(name: string, reference: string, reason: string) {
    return build(
      'Additional information required',
      [
        `Dear ${name},`,
        `To continue verifying your payment for order ${reference}, we need some additional information:`,
        reason,
        'Sign in to your member portal to respond. Never send gift-card PINs, redemption codes, private keys or seed phrases — Vantera will never ask for them.'
      ],
      [
        `Dear ${name},`,
        `To continue verifying your payment for order <strong>${reference}</strong>, we need some additional information:`,
        `<em>${reason}</em>`,
        'Sign in to your member portal to respond. <strong>Never send gift-card PINs, redemption codes, private keys or seed phrases — Vantera will never ask for them.</strong>'
      ]
    );
  },

  paymentApproved(name: string, reference: string) {
    return build(
      'Payment approved',
      [
        `Dear ${name},`,
        `Your payment for order ${reference} has been approved. Your membership card is now being prepared.`,
        'You will receive another message as soon as your personalised card is ready to download.'
      ],
      [
        `Dear ${name},`,
        `Your payment for order <strong>${reference}</strong> has been approved. Your membership card is now being prepared.`,
        'You will receive another message as soon as your personalised card is ready to download.'
      ]
    );
  },

  paymentRejected(name: string, reference: string, reason: string) {
    return build(
      'Payment could not be approved',
      [
        `Dear ${name},`,
        `Unfortunately we could not approve the payment submitted for order ${reference}.`,
        `Reason: ${reason}`,
        'You may submit a new payment from your member portal, or contact support if you believe this is a mistake.'
      ],
      [
        `Dear ${name},`,
        `Unfortunately we could not approve the payment submitted for order <strong>${reference}</strong>.`,
        `Reason: <em>${reason}</em>`,
        'You may submit a new payment from your member portal, or contact support if you believe this is a mistake.'
      ]
    );
  },

  membershipProcessing(name: string, membershipNumber: string) {
    return build(
      'Your membership is being prepared',
      [
        `Dear ${name},`,
        `Membership ${membershipNumber} is now being prepared by our team.`
      ],
      [
        `Dear ${name},`,
        `Membership <strong>${membershipNumber}</strong> is now being prepared by our team.`
      ]
    );
  },

  cardReady(name: string, membershipNumber: string) {
    return build(
      'Your membership card is ready',
      [
        `Dear ${name},`,
        `Your personalised Vantera membership card (${membershipNumber}) is ready. Sign in to your member portal to view and download it.`,
        'Your card file is private — it is only ever accessible after signing in.'
      ],
      [
        `Dear ${name},`,
        `Your personalised Vantera membership card (<strong>${membershipNumber}</strong>) is ready. Sign in to your member portal to view and download it.`,
        'Your card file is private — it is only ever accessible after signing in.'
      ]
    );
  },

  membershipSuspended(name: string, membershipNumber: string, reason: string) {
    return build(
      'Membership suspended',
      [
        `Dear ${name},`,
        `Your membership ${membershipNumber} has been suspended.`,
        `Reason: ${reason}`,
        'Please contact Vantera support for assistance.'
      ],
      [
        `Dear ${name},`,
        `Your membership <strong>${membershipNumber}</strong> has been suspended.`,
        `Reason: <em>${reason}</em>`,
        'Please contact Vantera support for assistance.'
      ]
    );
  },

  membershipRevoked(name: string, membershipNumber: string, reason: string) {
    return build(
      'Membership revoked',
      [
        `Dear ${name},`,
        `Your membership ${membershipNumber} has been revoked.`,
        `Reason: ${reason}`,
        'Please contact Vantera support if you have questions.'
      ],
      [
        `Dear ${name},`,
        `Your membership <strong>${membershipNumber}</strong> has been revoked.`,
        `Reason: <em>${reason}</em>`,
        'Please contact Vantera support if you have questions.'
      ]
    );
  }
};
