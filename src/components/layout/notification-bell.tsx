'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  notificationLink,
  type AppNotification,
} from '@/hooks/use-notifications';

/**
 * Bell with a live unread badge + a dropdown of recent notifications. Clicking
 * one marks it read and deep-links (e.g. a doctor mention → the patient's
 * consultation). Used in the module + dashboard headers.
 *
 * `variant` matches the two header styles: "module" (rounded-lg, error dot) and
 * "plain" (ghost button, destructive dot).
 */
export function NotificationBell({ variant = 'plain' }: { variant?: 'module' | 'plain' }) {
  const router = useRouter();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications(8);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = unreadCount > 0;

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const link = notificationLink(n);
    if (link) router.push(link);
    else router.push('/notifications');
  };

  const triggerClass =
    variant === 'module'
      ? 'relative p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors outline-none'
      : 'relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors outline-none';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClass} aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {hasUnread && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-background',
              variant === 'module' ? 'bg-error' : 'bg-destructive',
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {hasUnread && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {hasUnread && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-6 w-6 opacity-40" />
              You&apos;re all caught up.
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => open(n)}
                className={cn(
                  'flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/60 border-b last:border-b-0',
                  !n.isRead && 'bg-primary/[0.04]',
                )}
              >
                <span className="pt-1">
                  {!n.isRead ? (
                    <span className="block h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <span className="block h-2 w-2" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', !n.isRead ? 'font-semibold' : 'font-medium')}>
                    {n.title}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                    {n.message}
                  </span>
                  <span className="mt-1 block text-[10px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => router.push('/notifications')}
          className="block w-full border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-accent/60 transition-colors"
        >
          View all notifications
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
