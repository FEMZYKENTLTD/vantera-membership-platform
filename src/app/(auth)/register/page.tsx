import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Become a member' };

export default function RegisterPage() {
  return (
    <div className="surface-raised p-8 md:p-10">
      <h1 className="font-display text-2xl">Become a member</h1>
      <p className="mt-2 text-sm text-ivory-100/50">
        Create your account to begin your Vantera application.
      </p>
      <Alert tone="info" className="mt-6">
        We ask only for what membership administration needs. Your information
        stays private — see our privacy policy.
      </Alert>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-6 text-sm text-ivory-100/50">
        Already a member?{' '}
        <Link href="/login" className="text-gold-300 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
