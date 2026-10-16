import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { AdminNavLinks, AdminMobileNav } from '@/components/admin/admin-nav';

export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const permissions = Array.from(ctx.permissions);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminMobileNav permissions={permissions} />
      <aside className="hidden w-64 shrink-0 border-r border-border bg-noir-950 lg:flex lg:flex-col">
        <div className="border-b border-border px-6 py-6">
          <p className="wordmark text-base">VANTERA</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ivory-100/35">
            Administration
          </p>
        </div>
        <div className="border-b border-border px-6 py-4">
          <p className="truncate text-sm text-ivory-100/90">{ctx.user.email}</p>
          <p className="mt-1 text-[11px] text-ivory-100/35">
            {ctx.roles.join(', ')} · {permissions.length} permission(s)
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <AdminNavLinks permissions={permissions} />
        </div>
      </aside>
      <main className="flex-1 px-5 py-8 md:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
