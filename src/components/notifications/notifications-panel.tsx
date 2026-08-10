'use client';

// The full notification history as a slide-over, opened from "See all
// notifications" in the bell dropdown.
//
// A panel rather than a page because notifications are checked WHILE doing
// something else — a nurse mid-round, a pharmacist mid-sale. Sending them to a
// separate route threw away the screen they were working on and left them to
// find their way back to it. This slides over, and closing it puts them exactly
// where they were.
//
// Rendered by NotificationBell, which already sits in every portal's header, so
// there is nothing to mount per layout and no global state to keep in sync.

import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationsView } from '@/components/notifications/notifications-view';
import {
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
} from '@/hooks/use-notifications';

export function NotificationsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* No padding and a column layout: the filters and the paging footer stay
          put while only the list between them scrolls.
          The width override has to repeat the `data-[side=right]:` variant —
          that is how the base class states its own max-width, and a plain
          `sm:max-w-xl` is a different variant chain, so tailwind-merge would
          keep BOTH and leave the panel at the narrower default. */}
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="space-y-2 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-primary/10 text-primary">{unreadCount} unread</Badge>
              )}
            </SheetTitle>
            <Button
              size="sm"
              variant="outline"
              className="mr-8 gap-1.5"
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
          <SheetDescription className="text-left">
            Everything sent to you, newest first. Opening one takes you to the record it is about.
          </SheetDescription>
        </SheetHeader>

        {/* Mounted only while open, so the list is fetched on demand rather
            than by every header on every page. */}
        {open && <NotificationsView onNavigate={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}
