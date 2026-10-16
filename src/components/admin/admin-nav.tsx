'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  SettingsIcon,
  UserIcon,
  PackageIcon,
  ClockIcon,
  VerifiedIcon,
  CardIcon,
  AuditIcon,
  RolesIcon,
  QrIcon,
  LogoutIcon,
  MenuIcon,
  XIcon,
  SearchIcon
} from '@/components/icons';

export interface AdminNavProps {
  isAdmin?: boolean;
}

const LINKS = [
  { href: '/admin', label: 'Overview', icon: SettingsIcon, exact: true },
  { href: '/admin/customers', label: 'Customers', icon: UserIcon },
  { href: '/admin/orders', label: 'Orders', icon: PackageIcon },
  { href: '/admin/payments', label: 'Payment review', icon: ClockIcon },
  { href: '/admin/memberships', label: 'Memberships', icon: VerifiedIcon },
  { href: '/admin/card-designs', label: 'Card designs', icon: CardIcon },
  { href: '/admin/packages', label: 'Packages', icon: QrIcon },
  { href: '/admin/roles', label: 'Roles & access', icon: RolesIcon },
  { href: '/admin/audit-logs', label: 'Audit logs', icon: AuditIcon },
  { href: '/admin/settings', label: 'Settings', icon: SearchIcon }
] as const;

export function AdminNavLinks({
  permissions,
  onNavigate
}: {
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = LINKS.filter((l) => {
    if (l.href === '/admin/payments') return permissions.includes('payments.review');
    if (l.href === '/admin/customers') return permissions.includes('customers.view');
    if (l.href === '/admin/orders') return permissions.includes('orders.view');
    if (l.href === '/admin/memberships') return permissions.includes('memberships.manage');
    if (l.href === '/admin/card-designs') return permissions.includes('cards.manage');
    if (l.href === '/admin/packages') return permissions.includes('packages.manage');
    if (l.href === '/admin/roles') return permissions.includes('roles.manage');
    if (l.href === '/admin/audit-logs') return permissions.includes('audit.view');
    if (l.href === '/admin/settings') return permissions.includes('settings.manage');
    return true;
  });

  return (
    <nav className="flex flex-col gap-1" aria-label="Administration">
      {visible.map((item) => {
        const active =
          'exact' in item && item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
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
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 border-t border-border pt-4">
        <Link
          href="/portal"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm text-ivory-100/50 hover:bg-ivory-100/5 hover:text-ivory-100"
        >
          <UserIcon className="size-4" /> Member portal
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm text-ivory-100/50 hover:bg-ivory-100/5 hover:text-ivory-100"
          >
            <LogoutIcon className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}

export function AdminMobileNav({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-noir-900/90 px-5 py-3 backdrop-blur lg:hidden">
      <div>
        <p className="wordmark text-sm">VANTERA</p>
        <p className="text-[11px] text-ivory-100/40">Administration</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ivory-100/80 hover:bg-ivory-100/5"
      >
        {open ? <XIcon /> : <MenuIcon />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-noir-900/95 p-5 backdrop-blur animate-fade-in">
          <AdminNavLinks permissions={permissions} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
