'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '@/lib/validation/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';
import { templates } from '@/lib/email/templates';
import { tryAudit } from '@/lib/audit/log';

export interface AuthFormState {
  error?: string;
  success?: string;
}

async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown';
  return `${scope}:${ip}`;
}

export async function registerAccount(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const rl = checkRateLimit(await clientKey('register'), 5, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a minute and try again.' };

  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.siteUrl()}/auth/callback`
    }
  });

  if (error) {
    // Safe, non-enumerating message for duplicate/existing accounts.
    return {
      error:
        error.message.toLowerCase().includes('already registered')
          ? 'An account with this email may already exist. Try signing in instead.'
          : 'We could not create your account. Please try again.'
    };
  }

  // Post-registration niceties (welcome notification/email) are best-effort
  // and never block account creation. The in-app notification is created on
  // first sign-in instead, when the user id is guaranteed to have a session.
  return {
    success:
      'Your account has been created. If email confirmation is enabled, please verify your email, then sign in.'
  };
}

export async function loginAccount(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const rl = checkRateLimit(await clientKey('login'), 5, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a minute and try again.' };

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    // Uniform failure message: does not reveal whether the account exists.
    return { error: 'Incorrect email or password, or the email is not yet verified.' };
  }

  // First-sign-in welcome artefacts (idempotent by notification type+user day).
  if (data.user) {
    const admin = createAdminClient();
    try {
      await notify(admin, {
        userId: data.user.id,
        type: 'welcome',
        title: 'Welcome to Vantera',
        body: 'Your account is ready. Choose a membership tier to begin your application.',
        email: templates.welcome(
          parsed.data.email.split('@')[0] ?? 'member'
        )
      });
    } catch {
      /* best-effort */
    }
  }

  const next = formData.get('next');
  const target =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/portal';
  redirect(target);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const rl = checkRateLimit(await clientKey('forgot'), 5, 60_000);
  if (!rl.ok) return { error: 'Too many attempts. Please wait a minute and try again.' };

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'Enter a valid email address.' };

  const supabase = await createClient();
  // Always respond identically whether or not the account exists.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl()}/auth/callback?type=recovery`
  });

  return {
    success:
      'If an account exists for that email, a password reset link has been sent. Please check your inbox.'
  };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword')
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your new password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password
  });
  if (error) {
    return { error: 'We could not update your password. The link may have expired — request a new one.' };
  }

  const admin = createAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) {
    await tryAudit(admin, {
      actorId: user.id,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: user.id
    });
  }

  redirect('/portal/security?updated=password');
}
