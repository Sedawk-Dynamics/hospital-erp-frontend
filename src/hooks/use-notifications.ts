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
 * relevant record.
 *
 * Some references are sent to BOTH sides of a conversation, so the destination
 * depends on who is reading it, not only on what happened — `ot_response` goes
 * to the OT desk when a doctor answers a proposal AND to the doctor when the
 * desk cancels a surgery. Pass the reader's roles so each lands on their own
 * screen; without them the OT links fall back to the desk's board, which is
 * where they pointed before.
 */
export function notificationLink(n: AppNotification, roles?: string[]): string | null {
  const isDoctor = !!roles?.includes('doctor');

  // IP progress-note mention → the IP workspace (referenceId = admissionId).
  if (n.referenceType === 'progress_note_mention_ip' && n.referenceId) {
    return `/doctor/ip/${n.referenceId}`;
  }
  // OP progress-note mention → the patient's consultation (referenceId = patientId).
  if (n.referenceType === 'progress_note_mention' && n.referenceId) {
    return `/doctor/consultation/${n.referenceId}`;
  }
  // OT desk moved a surgery → the doctor's OT list, where they accept the new
  // time, ask for another, or cancel. Only ever sent to the doctor.
  if (n.referenceType === 'ot_reschedule') {
    return '/doctor/ot-list';
  }
  // Either the doctor answered a proposal (read by the OT desk) or the desk
  // cancelled a surgery (read by the doctor). A doctor has no business on the
  // OT desk's board — send them to their own list.
  if (n.referenceType === 'ot_response') {
    return isDoctor ? '/doctor/ot-list' : '/ot';
  }
  // Doctor published the discharge summary → the counter has to clear the bill
  // before the patient can leave. Land straight on that stay's bill screen with
  // it already open (referenceId = admissionId).
  if (n.referenceType === 'discharge_ready' && n.referenceId) {
    return `/hospital/billing?tab=ip&admissionId=${n.referenceId}`;
  }
  return null;
}
