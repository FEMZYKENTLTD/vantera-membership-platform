import Link from 'next/link';
import { getContactConfig, getBrandConfig } from '@/lib/settings';

export async function SiteFooter() {
  const contact = await getContactConfig();
  const brand = await getBrandConfig();

  return (
    <footer className="border-t border-border/60 bg-noir-950">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="wordmark text-lg">VANTERA</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ivory-100/50">
              {brand.tagline} Personalised membership cards, issued to approved members
              after careful payment verification.
            </p>
          </div>
          <div>
            <p className="eyebrow mb-4">Explore</p>
            <ul className="space-y-2.5 text-sm text-ivory-100/60">
              <li><Link className="hover:text-ivory-100" href="/membership">Membership</Link></li>
              <li><Link className="hover:text-ivory-100" href="/about">About</Link></li>
              <li><Link className="hover:text-ivory-100" href="/faq">FAQ</Link></li>
              <li><Link className="hover:text-ivory-100" href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">Legal &amp; support</p>
            <ul className="space-y-2.5 text-sm text-ivory-100/60">
              <li><Link className="hover:text-ivory-100" href="/terms">Membership terms</Link></li>
              <li><Link className="hover:text-ivory-100" href="/privacy">Privacy policy</Link></li>
              <li><Link className="hover:text-ivory-100" href="/verify">Verify a card</Link></li>
              {contact.email ? (
                <li>
                  <a className="hover:text-ivory-100" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </li>
              ) : (
                <li className="text-ivory-100/35">Support contact is being configured</li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border/50 pt-6 text-xs text-ivory-100/35 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
          <p>Membership is issued only after payment verification — never instantly.</p>
        </div>
      </div>
    </footer>
  );
}
