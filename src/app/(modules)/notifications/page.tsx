'use client';

// The full notification history.
//
// `(modules)` and `(dashboard)` are both root-level route groups, so this file
// owns `/notifications` for BOTH of them — two page.tsx here would be parallel
// routes resolving to one URL, which Next.js rejects outright. The legacy
// dashboard sidebar links here too and renders inside the module chrome; every
// authenticated user has picked a clinic by then, so the layout's guard passes.
//
// The patient portal and super admin live under their own path prefixes, so
// they get their own routes around the same shared view.

import { NotificationsView } from '@/components/notifications/notifications-view';

export default function NotificationsPage() {
  return <NotificationsView />;
}
