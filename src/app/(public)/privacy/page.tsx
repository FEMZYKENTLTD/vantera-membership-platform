import type { Metadata } from 'next';
import { getRetentionPolicy } from '@/lib/settings';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Vantera collects, uses and protects personal information.'
};

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const retention = await getRetentionPolicy();

  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-prose">
        <p className="eyebrow">Privacy</p>
        <h1 className="display-2 mt-4">Privacy policy</h1>
        <p className="mt-3 text-sm text-ivory-100/40">Last updated: to be confirmed by the business</p>

        <Alert tone="info" className="mt-8" title="Plain-language summary">
          We collect only what membership administration requires; we never sell
          your information; your documents and card live in private storage; and
          card verification never exposes who you are.
        </Alert>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-ivory-100/65">
          <section>
            <h2 className="font-display text-xl text-ivory-100">What we collect, and why</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-ivory-100">Identity and contact:</strong> your full
                legal name, email address, phone number and mailing address, to
                administer your membership and personalise your card.
              </li>
              <li>
                <strong className="text-ivory-100">Date of birth:</strong> only when the
                business enables an age-eligibility requirement, with a clear
                notice at the point of collection. It is optional until that
                policy is approved.
              </li>
              <li>
                <strong className="text-ivory-100">Order and payment review data:</strong>{' '}
                order references, the blockchain transaction reference or
                gift-card purchase evidence you submit for verification. We
                never ask for or store gift-card PINs, redemption codes, wallet
                private keys or seed phrases.
              </li>
              <li>
                <strong className="text-ivory-100">Account activity:</strong> status history
                and security-relevant audit events, held for the protection of
                members and the integrity of the platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">How your data is stored and shared</h2>
            <p className="mt-3">
              Data is stored in a secured PostgreSQL database with row-level
              access control. Uploaded evidence and membership cards are held in
              private file storage and are reachable only through short-lived,
              authorised links — never via public URLs. Access by team members
              is role-based and audited. We do not share personal information
              with third parties except the infrastructure providers that
              operate the platform under appropriate safeguards, and we never
              sell personal data.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">Card verification and privacy</h2>
            <p className="mt-3">
              Anyone holding a Vantera card may check its authenticity on the
              public verification page. That page reveals only validity, the
              membership reference and — where enabled — the tier and expiry.
              It never reveals a member’s name, contact details or account
              information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">Retention and your rights</h2>
            <p className="mt-3">
              Account records are retained while your membership is active and
              for up to {retention.inactiveAccountMonths} months of inactivity
              thereafter; payment evidence is retained for up to{' '}
              {retention.evidenceMonths} months, after which it is securely
              deleted. You may view and correct your information in your member
              portal, and you may request correction, export or deletion of your
              personal information through the published contact method
              {retention.contact ? ` (${retention.contact})` : ''}. We will
              respond within the period required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ivory-100">Legal review</h2>
            <p className="mt-3">
              This policy is a working document. It does not assert compliance
              with any specific regulation; the business will complete a
              documented legal review against the laws applicable to its
              customers before launch.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
