'use client';

// The full notification history. One shared view per layout group — the chrome
// around it differs (module sidebar / patient portal / super-admin / dashboard)
// but the list, its filters and its deep links do not.

import { NotificationsView } from '@/components/notifications/notifications-view';

export default function NotificationsPage() {
  return <NotificationsView />;
}
