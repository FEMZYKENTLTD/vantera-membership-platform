import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  markNotificationReadAction,
  markAllNotificationsReadAction
} from '@/lib/portal/actions';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { BellIcon } from '@/components/icons';
import { cn, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser('/portal/notifications');
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Member portal</p>
          <h1 className="display-3 mt-2">Notifications</h1>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all as read ({unread})
            </Button>
          </form>
        )}
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className={cn(!n.read_at && 'border-gold-500/25')}>
              <CardContent className="flex items-start gap-4 py-5">
                <BellIcon
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    n.read_at ? 'text-ivory-100/25' : 'text-gold-400'
                  )}
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={cn('text-sm font-medium', !n.read_at && 'text-ivory-100')}>
                      {n.title}
                    </p>
                    <span className="text-[11px] text-ivory-100/30">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ivory-100/55">{n.body}</p>
                </div>
                {!n.read_at && (
                  <form action={markNotificationReadAction.bind(null, n.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Mark read
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="You're all caught up"
          body="Order updates, verification progress and card releases will appear here."
        />
      )}
    </div>
  );
}
