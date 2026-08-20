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

export interface NotificationPage {
  notifications: AppNotification[];
  total: number;
  page: number;
  limit: number;
}

/**
 * The full notification list for the dedicated page — paginated and filterable,
 * unlike the bell which only ever shows the most recent few.
 */
export function useNotificationList(params: {
  page?: number;
  limit?: number;
  isRead?: boolean;
  notificationType?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: [...KEYS.list, 'page', params],
    queryFn: async (): Promise<NotificationPage> => {
      const res = await apiGet<AppNotification[]>('/communication/notifications', {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 25,
          // Only send it when filtering — the server treats any present value
          // as a filter, so `undefined` must not become "false".
          isRead: params.isRead === undefined ? undefined : String(params.isRead),
          notificationType: params.notificationType || undefined,
          search: params.search || undefined,
        },
      });
      return {
        notifications: res.data ?? [],
        total: res.meta?.total ?? 0,
        page: res.meta?.page ?? 1,
        limit: res.meta?.limit ?? 25,
      };
    },
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
 * Where clicking a notification should take the reader.
 *
 * Three things make this more than a lookup table:
 *
 *  1. Some references are written for BOTH sides of a conversation, so the
 *     destination depends on who is reading. `ot_response` goes to the OT desk
 *     when a doctor answers a proposal AND to the doctor when the desk cancels
 *     a surgery — and a doctor cannot even open the OT desk's board, since
 *     `doctor` is their only module.
 *  2. Some go to the PATIENT, not to staff. A discharge summary or a refund
 *     notification belongs on the portal, not on a hospital screen the patient
 *     has no access to.
 *  3. A user can hold several roles, so the checks run most-specific first.
 *
 * Only reference types that are genuinely emitted as notifications appear here.
 * Several similar-looking strings — `lab_order_item`, `ward_dispense`,
 * `ot_kit_issue`, `purchase_order`, `supply_request` — are BillItem or
 * StockTransaction references, never notifications, so listing them would
 * suggest a notification exists that does not.
 *
 * Roles are optional: without them the shared references resolve to the staff
 * destination, which is where they pointed before this existed. Anything
 * unmapped returns null and the bell just marks it read in place rather than
 * navigating somewhere unhelpful.
 */
export function notificationLink(n: AppNotification, roles?: string[]): string | null {
  const has = (r: string) => !!roles?.includes(r);
  const isPatient = has('patient');
  const isDoctor = has('doctor');
  const isPharmacy = has('pharmacist') || has('pharmacy_admin');
  const isAdmin = has('admin') || has('super_admin');
  const ref = n.referenceId;

  switch (n.referenceType) {
    // ── Clinical mentions ──────────────────────────────────────────────
    // referenceId = admissionId for IP, patientId for OP.
    case 'progress_note_mention_ip':
      return ref ? `/doctor/ip/${ref}` : '/doctor/ip';
    case 'progress_note_mention':
      return ref ? `/doctor/consultation/${ref}` : '/doctor/progress-notes';

    // ── Operating theatre ──────────────────────────────────────────────
    // Only ever sent to the doctor: the desk moved their slot and needs an
    // answer.
    case 'ot_reschedule':
      return '/doctor/ot-list';
    // Sent to the doctor when the desk books their case.
    case 'ot_scheduled':
      return isDoctor ? '/doctor/ot-list' : '/ot';
    // Both directions: the doctor answered a proposal (read by the desk), or
    // the desk cancelled a surgery (read by the doctor).
    case 'ot_response':
      return isDoctor ? '/doctor/ot-list' : '/ot';

    // ── Discharge ──────────────────────────────────────────────────────
    // The counter has to clear the bill before the patient can leave; land on
    // that stay's bill with it already open.
    case 'discharge_ready':
    // Legacy alias: older "Patient ready for discharge" notices were filed
    // under 'admission' before discharge_ready existed. Same recipient, same
    // admissionId — nothing emits it now, but the ones on file should still
    // open rather than dead-end.
    case 'admission':
      return ref ? `/hospital/billing?tab=ip&admissionId=${ref}` : '/hospital/billing?tab=ip';
    // Goes to the PATIENT — their copy is on the portal.
    case 'discharge_summary':
      return isPatient || !roles?.length
        ? '/patient-portal/discharge-summaries'
        : '/doctor/discharge-summary';

    // ── Admission requests ─────────────────────────────────────────────
    // Goes to front desk / admin / billing — they hold the bed. The IP
    // Requests tab is where it is actioned, so land on it rather than the
    // ward list the page opens on by default.
    case 'admission_request':
      return '/hospital/ip?tab=ip-requests';

    // ── Insurance ──────────────────────────────────────────────────────
    // Claim-expiry warnings from the nightly job. referenceId is the claim,
    // and chasing a TPA starts on that claim, not a list of all of them.
    case 'insurance_claim':
      return ref ? `/insurance/claims/${ref}` : '/insurance/claims';

    // ── Appointments ───────────────────────────────────────────────────
    // Written for the PATIENT by the reminder job.
    case 'appointment_reminder':
      if (isPatient || !roles?.length) return '/patient-portal/appointments';
      return isDoctor ? '/doctor' : '/hospital';

    // ── Lab & imaging ──────────────────────────────────────────────────
    // A critical value must not be a dead end — the doctor needs the record,
    // not a worklist.
    case 'lab_critical':
    case 'lab_order':
    case 'lab_report':
      if (isPatient) return '/patient-portal/lab-reports';
      return isDoctor ? '/doctor/registry' : '/laboratory';
    // 'imaging_request' is the order moving (payment verified, accepted);
    // 'imaging_result' is the report itself being published. The second is the
    // one the doctor is waiting on, and it was the only diagnostic reference
    // with no destination — so "Radiology report ready" arrived in the bell and
    // went nowhere when clicked, while its lab twin opened the record. That
    // reads as the radiology notification not working at all.
    case 'imaging_request':
    case 'imaging_result':
      if (isPatient) return '/patient-portal/imaging-reports';
      return isDoctor ? '/doctor/registry' : '/radiology';

    // ── Pharmacy ───────────────────────────────────────────────────────
    case 'prescription':
      if (isPatient) return '/patient-portal/prescriptions';
      return isDoctor ? '/doctor/progress-notes' : '/pharmacy/queue';
    // Refund on a returned medicine — sent to the patient.
    case 'drug_return':
      return isPharmacy ? '/pharmacy/returns' : '/patient-portal/billing';
    // A recalled batch goes to pharmacy + inventory staff.
    case 'drug_batch':
    case 'pharmacy_expiry':
      return '/pharmacy/stock-ledger';

    // ── Inventory ──────────────────────────────────────────────────────
    case 'inventory_low_stock':
      return '/inventory';
    case 'inventory_expiry':
      return '/inventory/reports/expiry-waste';

    // ── HR ─────────────────────────────────────────────────────────────
    // The doctor's own leave lives in their portal; HR reviews everyone's.
    case 'leave_request':
      return isDoctor ? '/doctor/leaves' : '/hr/leaves';

    // ── Platform ───────────────────────────────────────────────────────
    case 'subscription':
    case 'offered_plans':
      return isAdmin ? '/hospital/settings' : null;

    default:
      return null;
  }
}
