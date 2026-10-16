import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/components/auth/reset-form';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <div className="surface-raised p-8 md:p-10">
      <h1 className="font-display text-2xl">Choose a new password</h1>
      <p className="mt-2 text-sm text-ivory-100/50">
        Your reset link is confirmed. Set your new password below.
      </p>
      {user ? (
        <div className="mt-8">
          <ResetPasswordForm />
        </div>
      ) : (
        <Alert tone="error" className="mt-8">
          This reset link is invalid or has expired.{' '}
          <Link href="/forgot-password" className="underline underline-offset-2">
            Request a new one
          </Link>
          .
        </Alert>
      )}
    </div>
  );
}
