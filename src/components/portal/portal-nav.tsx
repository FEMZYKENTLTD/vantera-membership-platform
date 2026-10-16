'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  CardIcon,
  UserIcon,
  PackageIcon,
  BellIcon,
  LockIcon,
  SettingsIcon,
  ClockIcon,
  LogoutIcon,
  VerifiedIcon,
  MenuIcon,
  XIcon
} from '@/components/icons';
import { useState } from 'react';

export interface PortalNavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

const ICONS = {
  overview: SettingsIcon,
  profile: UserIcon,
  orders: PackageIcon,
  payments: ClockIcon,
  memberships: VerifiedIcon,
  cards: CardIcon,
  notifications: BellIcon,
  security: LockIcon
} as const;

export function PortalNavLinks({
  unreadCount = 0,
  isAdmin = false,
  onNavigate
}: {
  unreadCount?: number;
  isAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items: { href: string; label: string; icon: keyof typeof ICONS }[] = [
    { href: '/portal', label: 'Overview', icon: 'overview' },
    { href: '/portal/profile', label: 'Profile', icon: 'profile' },
    { href: '/portal/orders', label: 'Orders', icon: 'orders' },
    { href: '/portal/payments', label: 'Payments', icon: 'payments' },
    { href: '/portal/memberships', label: 'Membership', icon: 'memberships' },
    { href: '/portal/cards', label: 'My card', icon: 'cards' },
    { href: '/portal/notifications', label: 'Notifications', icon: 'notifications' },
    { href: '/portal/security', label: 'Security', icon: 'security' }
  ];

  return (
    <nav className="flex flex-col gap-1" aria-label="Member portal">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm transition-colors',
              active
                ? 'bg-gold-500/10 text-gold-300 border border-gold-500/20'
                : 'text-ivory-100/60 hover:bg-ivory-100/5 hover:text-ivory-100 border border-transparent'
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {item.href === '/portal/notifications' && unreadCount > 0 && (
              <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-semibold text-noir-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="mt-4 flex items-center gap-3 rounded-md border border-border px-3.5 py-2.5 text-sm text-ivory-100/50 hover:bg-ivory-100/5 hover:text-ivory-100"
        >
          <SettingsIcon className="size-4" />
          Administration
        </Link>
      )}
      <form action="/auth/signout" method="post" className="mt-1">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm text-ivory-100/50 hover:bg-ivory-100/5 hover:text-ivory-100"
        >
          <LogoutIcon className="size-4" />
          Sign out
        </button>
      </form>
    </nav>
  );
}

export function PortalMobileNav({
  unreadCount,
  isAdmin,
  name
}: {
  unreadCount: number;
  isAdmin: boolean;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-noir-900/90 px-5 py-3 backdrop-blur lg:hidden">
      <div>
        <p className="wordmark text-sm">VANTERA</p>
        <p className="text-[11px] text-ivory-100/40 truncate max-w-[160px]">{name}</p>
      </div>
      <div className="flex items-center gap-2">
        {unreadCount > 0 && (
          <Link href="/portal/notifications" className="relative p-2">
            <BellIcon className="size-5 text-ivory-100/70" />
            <span className="absolute right-1 top-1 size-2 rounded-full bg-gold-500" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ivory-100/80 hover:bg-ivory-100/5"
        >
          {open ? <XIcon /> : <MenuIcon />}
        </button>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-noir-900/95 p-5 backdrop-blur animate-fade-in">
          <PortalNavLinks
            unreadCount={unreadCount}
            isAdmin={isAdmin}
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
