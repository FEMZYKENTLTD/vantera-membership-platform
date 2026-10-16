import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="surface-raised p-8 md:p-10">
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="mt-2 text-sm text-ivory-100/50">
        Access your member portal.
      </p>
      <div className="mt-8">
        <LoginForm next={next ?? null} />
      </div>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-ivory-100/50 underline-offset-4 hover:underline"
        >
          Forgot your password?
        </Link>
        <Link href="/register" className="text-gold-300 underline-offset-4 hover:underline">
          Become a member
        </Link>
      </div>
    </div>
  );
}
