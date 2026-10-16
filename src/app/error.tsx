'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface unexpected failures in the operator console; never render raw
    // errors to members (they can contain sensitive internals).
    console.error('[application error]', error);
  }, [error]);

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">Something interrupted the experience</p>
      <h1 className="display-2 mt-4">An unexpected error occurred</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-ivory-100/55">
        Nothing was charged and no decision was recorded. Please try again —
        if it persists, contact us through the site contact method.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
          Return home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-[11px] text-ivory-100/25">
          reference: {error.digest}
        </p>
      )}
    </div>
  );
}
