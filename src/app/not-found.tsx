import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display-2 mt-4">This page has not been issued</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory-100/55">
        The address may have changed, been withdrawn, or never existed. A
        missing page here never reveals whether a private identifier or record
        exists — by design.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className={buttonVariants()}>Return home</Link>
        <Link href="/portal" className={buttonVariants({ variant: 'secondary' })}>
          Go to your portal
        </Link>
      </div>
    </div>
  );
}
