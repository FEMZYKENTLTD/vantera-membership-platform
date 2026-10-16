import type { Metadata } from 'next';
import { getContactConfig } from '@/lib/settings';
import { ContactForm } from './contact-form';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact the Vantera membership office.'
};

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const contact = await getContactConfig();

  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto grid max-w-5xl gap-14 md:grid-cols-2">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="display-2 mt-4">Speak with us</h1>
          <p className="mt-5 text-sm leading-relaxed text-ivory-100/55">
            Questions about membership, verification or your application — the
            membership office is here to help.
          </p>

          <div className="mt-10 space-y-6 text-sm">
            {contact.email ? (
              <div>
                <p className="eyebrow mb-2">Email</p>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-ivory-100/80 underline decoration-gold-500/40 underline-offset-4 hover:text-ivory-100"
                >
                  {contact.email}
                </a>
              </div>
            ) : (
              <Alert tone="info">
                Our direct contact addresses are being configured. The form
                alongside reaches the team in the meantime.
              </Alert>
            )}
            {contact.whatsapp && (
              <div>
                <p className="eyebrow mb-2">WhatsApp</p>
                <p className="text-ivory-100/80">{contact.whatsapp}</p>
              </div>
            )}
            <div>
              <p className="eyebrow mb-2">Response time</p>
              <p className="text-ivory-100/60">{contact.responseTime}</p>
            </div>
          </div>
        </div>

        <div className="surface p-7 md:p-9">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
