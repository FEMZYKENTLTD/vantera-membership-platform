import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 bg-[radial-gradient(ellipse_at_top,rgba(198,164,104,0.06),transparent_55%)]">
      <Logo className="mb-10" />
      <div className="w-full max-w-md">{children}</div>
      <Link
        href="/"
        className="mt-10 text-xs uppercase tracking-[0.2em] text-ivory-100/35 hover:text-ivory-100/70"
      >
        ← Back to Vantera
      </Link>
    </main>
  );
}
