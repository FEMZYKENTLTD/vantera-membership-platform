import type { Metadata } from 'next';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/misc';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Vantera is a luxury membership brand. Learn how membership, verification and card issuance work.'
};

export default function AboutPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-prose">
        <p className="eyebrow">About Vantera</p>
        <h1 className="display-2 mt-4">Recognition, earned properly</h1>

        <div className="relative mt-10 aspect-[21/10] overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/about.jpg"
            alt="Warm gold light across a dark desk with Vantera membership cards"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        </div>

        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-ivory-100/65">
          <p>
            Vantera is a luxury membership brand. We issue personalised
            membership cards to approved members — cards that represent
            belonging to a private circle, prepared individually rather than
            printed in bulk.
          </p>
          <p>
            We believe a membership card should be a considered object: designed
            deliberately, verified carefully, and delivered privately. That is
            why every Vantera membership follows the same uncompromising path:
            an application, a payment reviewed by a person, a card prepared by
            our designer, and a private download available only to its owner.
          </p>
        </div>

        <Separator className="my-12" />

        <h2 className="display-3">What a Vantera card is — and is not</h2>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ivory-100/65">
          <p>
            A Vantera card is a <strong className="text-ivory-100">membership card issued by Vantera</strong>.
            It is not a bank card, debit card, credit card or ATM card. It does
            not store money, provide credit, pay interest, or connect to any
            payment network. Membership comes with the published benefits shown
            on each tier page — nothing more is promised, or implied.
          </p>
        </div>

        <Separator className="my-12" />

        <h2 className="display-3">How we treat your information</h2>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ivory-100/65">
          <p>
            We collect only the information needed to administer your
            membership. Payment evidence and membership cards live in private
            storage, reachable only to you and authorised team members. Our
            public card-verification page confirms authenticity without ever
            exposing who a card belongs to.
          </p>
        </div>

        <div className="mt-12 flex gap-3">
          <Link href="/membership" className={cn(buttonVariants())}>
            Explore membership
          </Link>
          <Link href="/faq" className={cn(buttonVariants({ variant: 'secondary' }))}>
            Read the FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
