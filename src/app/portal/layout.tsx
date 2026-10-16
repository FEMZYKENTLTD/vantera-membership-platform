import type { Metadata } from 'next';
import { requireUser, getAdminContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PortalNavLinks, PortalMobileNav } from '@/components/portal/portal-nav';
import { Alert } from '@/components/ui/alert';
import { initials } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Member portal',
  robots: { index: false, follow: false }
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/portal');
  const supabase = await createClient();

  const [{ data: profile }, { count: unreadCount }, adminCtx] = await Promise.all([
    supabase.from('profiles').select('full_name, status').eq('id', user.id).maybeSingle(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null),
    getAdminContext(user.id)
  ]);

  const name = profile?.full_name?.trim() || 'Member';
  const suspended = profile?.status === 'suspended';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <PortalMobileNav
        unreadCount={unreadCount ?? 0}
        isAdmin={(adminCtx?.roles.length ?? 0) > 0}
        name={name}
      />
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-noir-950 lg:flex lg:flex-col">
        <div className="border-b border-border px-6 py-6">
          <p className="wordmark text-base">VANTERA</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ivory-100/35">
            Member portal
          </p>
        </div>
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <span className="flex size-9 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 font-display text-sm text-gold-300">
            {initials(name) || 'M'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-ivory-100/90">{name}</p>
            <p className="truncate text-[11px] text-ivory-100/35">{user.email}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <PortalNavLinks
            unreadCount={unreadCount ?? 0}
            isAdmin={(adminCtx?.roles.length ?? 0) > 0}
          />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-5 py-8 md:px-10 lg:px-12">
        {suspended && (
          <Alert tone="error" title="Your membership account is suspended" className="mb-8">
            Some actions are unavailable while your account is suspended. Please
            contact Vantera support for assistance.
          </Alert>
        )}
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
