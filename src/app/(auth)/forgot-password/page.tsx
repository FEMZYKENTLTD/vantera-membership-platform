import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forgot-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <div className="surface-raised p-8 md:p-10">
      <h1 className="font-display text-2xl">Reset your password</h1>
      <p className="mt-2 text-sm text-ivory-100/50">
        Enter your account email and we will send you a secure reset link.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-ivory-100/50 underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
