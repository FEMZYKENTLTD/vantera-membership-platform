import { env, emailConfigured } from '@/lib/env';
import type { EmailContent } from '@/lib/email/templates';

export interface SendResult {
  delivered: boolean;
  reason?: string;
}

/**
 * Transactional email sender.
 *
 * Honest by design: until a provider is configured (EMAIL_PROVIDER=resend,
 * RESEND_API_KEY, EMAIL_FROM), messages are logged and reported as
 * NOT delivered — nothing pretends email works before it truly does.
 * Sending is best-effort: failures never propagate into database flows.
 */
export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  if (!emailConfigured()) {
    console.info(
      `[email:not-configured] Would send "${content.subject}" to ${maskEmail(to)}`
    );
    return { delivered: false, reason: 'provider_not_configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.emailFrom(),
        to: [to],
        subject: content.subject,
        text: content.text,
        html: content.html
      })
    });

    if (!res.ok) {
      console.error(`[email] provider error ${res.status} for ${maskEmail(to)}`);
      return { delivered: false, reason: `provider_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error('[email] send failed', err);
    return { delivered: false, reason: 'send_exception' };
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
