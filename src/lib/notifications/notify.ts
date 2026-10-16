import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { EmailContent } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/sender';

export type NotificationType =
  | 'welcome'
  | 'order_created'
  | 'payment_submitted'
  | 'payment_under_review'
  | 'additional_info_requested'
  | 'payment_approved'
  | 'payment_rejected'
  | 'membership_processing'
  | 'card_ready'
  | 'membership_suspended'
  | 'membership_revoked'
  | 'system';

/**
 * Create an in-app notification and, when an email template is supplied,
 * best-effort send the corresponding transactional email.
 *
 * Email delivery failure (or an unconfigured provider) NEVER throws and
 * NEVER rolls back the database work that triggered the notification.
 */
export async function notify(
  admin: SupabaseClient<Database>,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, Json>;
    email?: EmailContent;
  }
): Promise<void> {
  const { error } = await admin.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? {}
  });
  if (error) {
    // In-app notifications are core UX — log loudly but do not break flows.
    console.error('[notify] failed to insert notification', error.message);
  }

  if (input.email) {
    try {
      const { data: userData, error: userError } =
        await admin.auth.admin.getUserById(input.userId);
      const email = userData.user?.email;
      if (userError || !email) {
        console.error('[notify] could not resolve recipient email', userError?.message);
        return;
      }
      await sendEmail(email, input.email);
    } catch (err) {
      console.error('[notify] email side-effect failed', err);
    }
  }
}
