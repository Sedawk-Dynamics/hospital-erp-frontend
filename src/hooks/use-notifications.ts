'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  notificationType?: string;
  isRead: boolean;
  readAt?: string | null;
  // Deep-link target (e.g. progress_note_mention → patient id).
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

const KEYS = {
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread-count'] as const,
};

/**
 * Recent notifications for the bell dropdown. Polls so a freshly-created
 * notification (e.g. a doctor mention) surfaces without a manual refresh.
 */
export function useNotifications(limit = 8) {
  return useQuery({
    queryKey: [...KEYS.list, limit],
    queryFn: async () => {
      const res = await apiGet<AppNotification[]>('/communication/notifications', {
        params: { page: 1, limit },
      });
      return res.data ?? [];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Unread badge count — polled every 30s so the bell dot is live. */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: KEYS.unread,
    queryFn: async () => {
      const res = await apiGet<{ unreadCount: number }>(
        '/communication/notifications/unread-count',
      );
      return res.data?.unreadCount ?? 0;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch(`/communication/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.unread });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPatch('/communication/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.unread });
    },
  });
}

/**
 * Map a notification's reference to an in-app route so clicking it opens the
 * relevant record. Kept in sync with the notifications page.
 */
export function notificationLink(n: AppNotification): string | null {
  if (n.referenceType === 'progress_note_mention' && n.referenceId) {
    return `/doctor/consultation/${n.referenceId}`;
  }
  return null;
}
