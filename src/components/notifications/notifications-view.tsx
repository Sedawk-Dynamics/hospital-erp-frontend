'use client';

// ============================================================
// The notification list, shared by every portal.
//
// The bell only ever shows the most recent handful, so anything that arrived
// while someone was off shift fell off the end and was effectively lost. This
// is the full history: grouped by day, newest first, filterable, and every row
// opens the record it is about.
//
// One component, mounted per layout group, because the surrounding chrome
// differs (module sidebar / patient portal / super-admin) but the list does not.
// ============================================================

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  ChevronRight as Chevron,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuthStore } from '@/stores/auth-store';
import {
  useNotificationList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
  notificationLink,
  type AppNotification,
} from '@/hooks/use-notifications';

const PAGE_SIZE = 25;

/** The filter tabs. `undefined` means "no isRead filter at all". */
const TABS: Array<{ key: 'all' | 'unread' | 'read'; label: string; isRead?: boolean }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread', isRead: false },
  { key: 'read', label: 'Read', isRead: true },
];

// Matches the NotificationType enum on the server.
const TYPE_LABELS: Record<string, string> = {
  appointment: 'Appointment',
  lab_result: 'Lab',
  prescription: 'Prescription',
  billing: 'Billing',
  system: 'System',
  reminder: 'Reminder',
  alert: 'Alert',
  subscription: 'Subscription',
};

const TYPE_TONE: Record<string, string> = {
  alert: 'bg-red-100 text-red-700 border-red-200',
  lab_result: 'bg-amber-100 text-amber-800 border-amber-200',
  billing: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  appointment: 'bg-sky-100 text-sky-800 border-sky-200',
  prescription: 'bg-violet-100 text-violet-800 border-violet-200',
};

/**
 * Day heading for a notification. Relative for the two days people actually
 * scan, absolute after that — "3 days ago" stops being useful quickly.
 */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

export function NotificationsView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 300);

  const isRead = TABS.find((t) => t.key === tab)?.isRead;
  const { data, isLoading } = useNotificationList({
    page,
    limit: PAGE_SIZE,
    isRead,
    search: debounced,
  });
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const rows = useMemo(() => data?.notifications ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Group into day buckets, preserving the server's newest-first order.
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: AppNotification[] }> = [];
    for (const n of rows) {
      const label = dayLabel(n.createdAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [rows]);

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    // Roles matter: several references are written for both sides of a
    // conversation, and for the patient as well as for staff.
    const link = notificationLink(n, user?.roles);
    if (link) router.push(link);
  };

  const switchTab = (key: 'all' | 'unread' | 'read') => {
    setTab(key);
    setPage(1);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
            <Bell className="h-5 w-5 text-primary" /> Notifications
            {unreadCount > 0 && (
              <Badge className="bg-primary/10 text-primary">{unreadCount} unread</Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            Everything sent to you, newest first. Opening one takes you to the record it is about.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || unreadCount === 0}
        >
          {markAllRead.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCheck className="h-3.5 w-3.5" />
          )}
          Mark all read
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(t.key)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                tab === t.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.key === 'unread' && unreadCount > 0 && (
                <span className="ml-1 text-primary">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search notifications…"
            className="h-9 pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Loading…' : `${total.toLocaleString('en-IN')} total`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              {tab === 'unread'
                ? 'Nothing unread — you are all caught up.'
                : debounced
                  ? 'No notifications match that search.'
                  : 'No notifications yet.'}
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <p className="sticky top-0 z-10 border-b bg-muted/50 px-4 py-1.5 font-label text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
                {g.label}
              </p>
              <ul className="divide-y">
                {g.items.map((n) => {
                  const link = notificationLink(n, user?.roles);
                  const type = n.notificationType ?? '';
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => open(n)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                          !n.isRead && 'bg-primary/[0.035]',
                        )}
                      >
                        {/* Unread marker — a dot rather than bold text, so the
                            message stays readable either way. */}
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            n.isRead ? 'bg-transparent' : 'bg-primary',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'text-sm',
                                n.isRead ? 'font-medium text-foreground' : 'font-semibold',
                              )}
                            >
                              {n.title}
                            </span>
                            {type && TYPE_LABELS[type] && (
                              <Badge
                                variant="outline"
                                className={cn('text-[10px]', TYPE_TONE[type])}
                              >
                                {TYPE_LABELS[type]}
                              </Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {n.message}
                          </span>
                          <span className="mt-1 block text-[11px] text-muted-foreground">
                            {timeLabel(n.createdAt)} ·{' '}
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                        </span>
                        {/* Only promise navigation when there is somewhere to go. */}
                        {link && (
                          <Chevron className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length} of {total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={page <= 1}
                onClick={() => setPage((v) => v - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={page >= totalPages}
                onClick={() => setPage((v) => v + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
