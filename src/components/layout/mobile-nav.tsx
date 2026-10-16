'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MenuIcon, XIcon } from '@/components/icons';
import { publicNav } from '@/config/site';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MobileNav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ivory-100/80 hover:bg-ivory-100/5"
      >
        {open ? <XIcon /> : <MenuIcon />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-noir-900/95 backdrop-blur px-6 pb-6 pt-2 animate-fade-in">
          <nav className="flex flex-col gap-1">
            {publicNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-ivory-100/80 hover:bg-ivory-100/5"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              {signedIn ? (
                <>
                  <Link
                    href="/portal"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: 'secondary' }), 'w-full')}
                  >
                    Member portal
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}
                    >
                      Administration
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: 'primary' }), 'w-full')}
                  >
                    Become a member
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
