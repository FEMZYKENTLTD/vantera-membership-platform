import Link from 'next/link';
import { getSessionUser, getAdminContext } from '@/lib/auth/session';
import { Logo } from '@/components/layout/logo';
import { MobileNav } from '@/components/layout/mobile-nav';
import { publicNav } from '@/config/site';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export async function SiteHeader() {
  const user = await getSessionUser();
  const ctx = user ? await getAdminContext(user.id) : null;
  const isAdmin = (ctx?.roles.length ?? 0) > 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-noir-900/80 backdrop-blur supports-[backdrop-filter]:bg-noir-900/60">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] uppercase tracking-[0.18em] text-ivory-100/60 hover:text-ivory-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/portal"
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
              >
                Member portal
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  Administration
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}
              >
                Become a member
              </Link>
            </>
          )}
        </div>
        <MobileNav signedIn={!!user} isAdmin={isAdmin} />
      </div>
    </header>
  );
}
