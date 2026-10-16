import type { Metadata } from 'next';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Membership terms',
  description: 'The terms that govern Vantera membership.'
};

export default function TermsPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-prose">
        <p className="eyebrow">Legal</p>
        <h1 className="display-2 mt-4">Membership terms</h1>
        <p className="mt-3 text-sm text-ivory-100/40">Last updated: to be confirmed by the business</p>

        <Alert tone="warning" className="mt-8" title="Draft pending legal review">
          These terms are a structural draft. They must be reviewed and approved
          by the business and its legal advisers against the laws applicable to
          its customers before launch. Sections marked for configuration will be
          finalised through the administration dashboard.
        </Alert>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-ivory-100/65">
          <section>
            <h2 className="font-display text-xl text-ivory-100">1. Membership</h2>
            <p className="mt-3">
              Vantera membership is a personal, non-transferable membership of
              the Vantera circle. A personalised membership card is issued to
              approved members. The card evidences membership only: it is not a
              bank card, debit card, credit card or ATM card, it holds no stored
              value, and it provides no investment, interest, returns or
              financial product of any kind.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">2. Orders and verification</h2>
            <p className="mt-3">
              Placing an order fixes the package price shown at that time for
              that order. Payments are verified manually, normally within 1–3
              working days (weekends and configured public holidays excluded).
              Submitting payment details does not constitute payment approval.
              Vantera may request additional information, and may decline
              payments that cannot be verified, with reasons provided.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">3. Card issuance and use</h2>
            <p className="mt-3">
              Membership cards are prepared individually after payment approval
              and delivered digitally through the private member portal.
              Membership may be suspended or revoked with reasons where this is
              justified (for example, fraud or misuse); suspended or revoked
              cards no longer verify as valid. Membership duration, where it
              applies, is shown on the tier page and on the card.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">4. Acceptable use</h2>
            <p className="mt-3">
              Members must provide accurate information and must never share
              payment credentials, gift-card codes, private keys or similar
              secrets with anyone, including anyone claiming to represent
              Vantera. Vantera will never ask for them.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">5. Benefits, changes and contact</h2>
            <p className="mt-3">
              Member benefits are those published on each tier page at the time
              of order; the business may update published benefits for future
              orders through the administration dashboard. Refund, cooling-off
              and cancellation terms will be configured by the business before
              launch. Questions may be raised through the published contact
              method.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
