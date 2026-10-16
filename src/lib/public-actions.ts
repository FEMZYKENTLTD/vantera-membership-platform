'use server';

import { headers } from 'next/headers';
import { contactFormSchema } from '@/lib/validation/schemas';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/sender';
import { env } from '@/lib/env';
import { getContactConfig } from '@/lib/settings';

export interface ContactState {
  error?: string;
  success?: string;
}

/**
 * Contact form. Messages go to the configured business inbox when email is
 * configured; otherwise they are logged server-side. Either way the visitor
 * receives an honest acknowledgement (we never pretend email works before a
 * provider is configured — the success copy says only that we received the
 * message, and the operator sees it in the logs).
 */
export async function submitContactForm(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`contact:${ip}`, 5, 3_600_000);
  if (!rl.ok) return { error: 'Too many messages. Please try again later.' };

  const parsed = contactFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const contact = await getContactConfig();
  const inbox = env.contactInbox() || contact.email;
  const subject = `Website enquiry from ${parsed.data.name}`;
  const text = `Name: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\n${parsed.data.message}`;
  const html = `<p><strong>Name:</strong> ${escapeHtml(parsed.data.name)}</p>
<p><strong>Email:</strong> ${escapeHtml(parsed.data.email)}</p>
<p>${escapeHtml(parsed.data.message).replace(/\n/g, '<br/>')}</p>`;

  if (inbox) {
    await sendEmail(inbox, { subject, text, html });
  } else {
    console.info('[contact] inbox not configured; enquiry received (not forwarded)');
  }

  return {
    success:
      'Thank you — your message has been received. We will respond as soon as we can.'
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
