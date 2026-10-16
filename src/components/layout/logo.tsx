import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('wordmark text-lg md:text-xl select-none', className)}
      aria-label="Vantera home"
    >
      VANTERA
    </Link>
  );
}
