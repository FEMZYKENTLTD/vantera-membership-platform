import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: 'Answers about Vantera membership, verification and membership cards.'
};

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What exactly is a Vantera membership card?',
    a: 'It is a personalised membership card issued by Vantera that represents your membership tier. It is not a bank card, debit card, credit card or ATM card, it does not store money, and it is not linked to any payment network.'
  },
  {
    q: 'How do I become a member?',
    a: 'Create an account, choose a membership tier, pay using one of the approved payment methods shown in your portal, and submit the payment details for review. Once our team verifies your payment, your personalised card is prepared and made available in your private portal.'
  },
  {
    q: 'How long does payment verification take?',
    a: 'Verification normally takes 1–3 working days. Weekends do not count as working days, and public holidays configured by our team may extend the window slightly. You can follow the live status in your portal at any time.'
  },
  {
    q: 'Is my payment approved automatically when I submit it?',
    a: 'No. Submitting payment details, a transaction hash or a receipt is a request for review — never an approval. Every payment is checked by our team against the configured receiving details before it can be approved, or you may be asked for additional information.'
  },
  {
    q: 'Which payment methods does Vantera accept?',
    a: 'The payment methods currently available are shown privately inside your order. Payment options that are not yet configured or approved by the business are never presented as ready to use.'
  },
  {
    q: 'Will you ever ask for my gift-card PIN or crypto wallet keys?',
    a: 'Never. Vantera will never request gift-card PINs, redemption or claim codes, wallet private keys, or seed phrases. Any message asking for these is not from us — please report it through the contact page.'
  },
  {
    q: 'What personal information appears on my membership card?',
    a: 'Only your approved display name, membership tier, membership reference and dates. We never print your date of birth, address, phone number or payment details on your card.'
  },
  {
    q: 'What does the public “verify a card” page show?',
    a: 'It confirms only whether a card is valid, its membership reference, and (when enabled) its tier and expiry. It never reveals the member’s name, contact details or any account information.'
  },
  {
    q: 'How do I receive my card?',
    a: 'Once your payment has been approved and your card design is ready, we notify you and the card file appears in your member portal for secure download. Cards are digital; nothing is posted.'
  },
  {
    q: 'What if my payment is not approved?',
    a: (
      <>
        You will receive the reason by notification and email, and you may
        submit a new payment or provide the requested information. For anything
        else, contact us through the{' '}
        <Link href="/contact" className="underline underline-offset-2 text-ivory-100/80">
          contact page
        </Link>
        .
      </>
    )
  },
  {
    q: 'Can I see and correct my personal information?',
    a: 'Yes. Your profile page shows what we hold and lets you correct it. For anything you cannot change yourself, or to ask about deletion, contact the membership office.'
  }
];

export default function FaqPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Questions</p>
        <h1 className="display-2 mt-4">Frequently asked</h1>
        <div className="mt-12 divide-y divide-border/60 border-y border-border/60">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-display text-lg text-ivory-100/90 hover:text-ivory-100 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-gold-400 transition-transform group-open:rotate-45 text-xl leading-none">
                  +
                </span>
              </summary>
              <div className="mt-4 text-sm leading-relaxed text-ivory-100/60">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
