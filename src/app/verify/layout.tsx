import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-noir-900 px-6 py-16">
      <Logo className="mb-12" />
      <div className="w-full max-w-md">{children}</div>
      <Link
        href="/"
        className="mt-12 text-xs uppercase tracking-[0.2em] text-ivory-100/35 hover:text-ivory-100/70"
      >
        vantera
      </Link>
    </main>
  );
}
