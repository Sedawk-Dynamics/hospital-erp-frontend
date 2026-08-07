import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from '@/lib/api';

// ============================================================
// Types — match the OtRequest schema (extended on 2026-05-14)
// ============================================================

export interface OTRequest {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    mrn?: string;
    firstName: string;
    lastName: string;
    uhid?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  visitId: string;
  doctorId: string;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  surgeonId?: string | null;
  surgeon?: {
    id: string;
    user?: { firstName: string; lastName: string };
  } | null;
  anaesthetistId?: string | null;
  anaesthetist?: {
    id: string;
    user?: { firstName: string; lastName: string };
  } | null;
  otId?: string | null;
  ot?: { id: string; name: string; location?: string | null; status?: string } | null;
  // The backend column is `procedureName`; we mirror it as `surgeryName` for the UI.
  procedureName: string;
  surgeryName: string;
  procedureDetails?: string | null;
  surgeryType?: string | null;
  speciality?: string | null;
  /** DB column. Mapped values: elective → priority "routine". */
  urgency: string;
  /** UI alias for urgency. routine / urgent / emergency. */
  priority: string;
  preferredDate?: string | null;
  preferredTime?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  durationMinutes?: number | null;
  estimatedDuration?: number | null;
  requiredEquipment?: string[] | null;
  preOpDiagnosis?: string | null;
  postOpDiagnosis?: string | null;
  notes?: string | null;
  billingAmount?: number | null;
  billingStatus?: string | null;
  cancellationReason?: string | null;
  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string;
  // ── Reschedule ↔ doctor-confirmation loop ────────────────────────────────
  // `awaiting_doctor` = the OT admin booked a slot other than the one the
  // doctor asked for; the surgery cannot start until the doctor accepts.
  scheduleState?: 'awaiting_doctor' | 'confirmed' | null;
  rescheduleReason?: string | null;
  rescheduledBy?: string | null;
  rescheduledAt?: string | null;
  previousScheduledDate?: string | null;
  previousScheduledTime?: string | null;
  doctorResponse?: 'accepted' | 'rejected' | null;
  doctorResponseNote?: string | null;
  doctorRespondedAt?: string | null;
  rescheduleCount?: number;
  // The OT Home table also handles the legacy display alias "pending" which the
  // frontend was originally mapping. We accept it on the type for back-compat.
  otName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface OTRequestParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  urgency?: string;
  sortOrder?: 'asc' | 'desc';
  date?: string;
  otId?: string;
  surgeonId?: string;
  doctorId?: string;
  /** Doctor's own list — the server resolves the caller's DoctorProfile. */
  mine?: boolean;
  scheduleState?: 'awaiting_doctor' | 'confirmed';
}

// ============================================================
// Query Keys
// ============================================================

export const otKeys = {
  all: ['ot'] as const,
  requests: {
    all: ['ot', 'requests'] as const,
    list: (params?: OTRequestParams) => ['ot', 'requests', 'list', params] as const,
    detail: (id: string) => ['ot', 'requests', 'detail', id] as const,
  },
  analytics: (params?: OTAnalyticsParams) => ['ot', 'analytics', params] as const,
  theaters: ['ot', 'theaters'] as const,
};

// ============================================================
// OT Request Hooks
// ============================================================

export function useOTRequests(params?: OTRequestParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: otKeys.requests.list(params),
    queryFn: async () => {
      const response = await apiGet<OTRequest[]>('/compliance/ot-requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
    enabled: options?.enabled ?? true,
  });
}

export function useOTRequest(id: string | null) {
  return useQuery({
    queryKey: otKeys.requests.detail(id ?? ''),
    queryFn: async () => {
      const response = await apiGet<OTRequest>(`/compliance/ot-requests/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export interface CreateOTInput {
  patientId: string;
  visitId?: string;
  doctorId?: string;
  surgeryName?: string;
  procedureName?: string;
  surgeryType?: string;
  speciality?: string;
  surgeonId?: string;
  anaesthetistId?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  estimatedDuration?: number;
  priority?: string;
  urgency?: string;
  preOpDiagnosis?: string;
  procedureDetails?: string;
  notes?: string;
  otId?: string;
  otName?: string;
  /**
   * What the *doctor* asks for. Leaving scheduledDate empty keeps the request
   * in the OT admin's pending queue instead of self-scheduling it.
   */
  preferredDate?: string;
  preferredTime?: string;
}

export function useCreateOTRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateOTInput) => {
      const response = await apiPost<OTRequest>('/compliance/ot-requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
    },
  });
}

export function useApproveOTRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<OTRequest>(`/compliance/ot-requests/${id}/approve`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: otKeys.requests.detail(id) });
    },
  });
}

export interface ScheduleOTInput {
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  otId?: string;
  otName?: string;
  surgeonId?: string;
  anaesthetistId?: string;
  durationMinutes?: number;
  /**
   * Required by the server whenever the booked slot is not the one the doctor
   * asked for, or moves an already-scheduled surgery. The doctor is notified
   * with this reason and must accept before the surgery can start.
   */
  rescheduleReason?: string;
}

export function useScheduleOT() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & ScheduleOTInput) => {
      const response = await apiPatch<OTRequest>(`/compliance/ot-requests/${id}/schedule`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: otKeys.requests.detail(variables.id) });
    },
  });
}

/**
 * The doctor's answer to a slot the OT admin proposed:
 *   accept     → booking confirmed, surgery may start
 *   reschedule → counter-proposal; needs a new preferred slot + reason, and
 *                sends the request back to the OT admin's pending queue
 *   cancel     → surgery called off, reason required
 */
export interface OtScheduleResponseInput {
  action: 'accept' | 'reschedule' | 'cancel';
  note?: string;
  preferredDate?: string;
  preferredTime?: string;
  onBehalf?: boolean;
}

export function useRespondToOtSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & OtScheduleResponseInput) => {
      const response = await apiPatch<OTRequest>(`/compliance/ot-requests/${id}/respond`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: otKeys.requests.detail(variables.id) });
      // The doctor's own OT list lives under a different key namespace.
      queryClient.invalidateQueries({ queryKey: ['doctor', 'ot-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export interface UpdateOTInput {
  status?: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  actualStartTime?: string;
  actualEndTime?: string;
  postOpDiagnosis?: string;
  cancellationReason?: string;
  notes?: string;
  billingAmount?: number;
  billingStatus?: 'pending' | 'paid' | 'partially_paid' | 'cancelled';
  surgeonId?: string;
  anaesthetistId?: string;
  surgeryType?: string;
  speciality?: string;
}

export function useUpdateOTRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateOTInput) => {
      const response = await apiPatch<OTRequest>(`/compliance/ot-requests/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: otKeys.requests.detail(variables.id) });
    },
  });
}

// Push an OT surgery's charge onto a hospital bill (+ optional full payment).
export interface BillOtResult {
  billId: string;
  billNumber: string | null;
  billStatus: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paid: boolean;
}

export function useBillOtRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      collectPayment,
      paymentMethod,
    }: { id: string; collectPayment?: boolean; paymentMethod?: string }) => {
      const response = await apiPost<BillOtResult>(`/billing/ot/${id}/bill`, { collectPayment, paymentMethod });
      return response.data;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: otKeys.requests.detail(v.id) });
    },
  });
}

// ============================================================
// OT Analytics
// ============================================================

export interface OTAnalyticsParams {
  fromDate?: string;
  toDate?: string;
  otId?: string;
  surgeonId?: string;
}

export interface OTAnalytics {
  fromDate: string;
  toDate: string;
  // Average minutes between scheduled and actual start (positive = late starts);
  // startDelaySampleSize is how many surgeries had both timestamps.
  avgStartDelayMin: number;
  startDelaySampleSize: number;
  totals: { total: number; completed: number; cancelled: number; scheduled: number; inProgress: number; requested: number };
  byStatus: Record<string, number>;
  surgeonWorkload: Array<{
    surgeonId: string;
    surgeonName: string;
    total: number;
    completed: number;
    cancelled: number;
    avgDurationMin: number;
    totalDuration: number;
    durationCount: number;
  }>;
  otUtilization: Array<{
    otId: string;
    otName: string;
    total: number;
    completed: number;
    totalDuration: number;
    utilizationPercent: number;
  }>;
  surgeryList: Array<{
    id: string;
    patient: { id: string; mrn?: string; firstName: string; lastName: string };
    procedureName: string;
    surgeryType?: string | null;
    speciality?: string | null;
    surgeonName: string;
    otName: string | null;
    status: string;
    scheduledDate?: string | null;
    scheduledStartTime?: string | null;
    durationMinutes?: number | null;
    billingAmount: number | null;
    billingStatus: string | null;
  }>;
}

export function useOTAnalytics(params?: OTAnalyticsParams) {
  return useQuery({
    queryKey: otKeys.analytics(params),
    queryFn: async () => {
      const response = await apiGet<OTAnalytics>('/compliance/ot-requests/analytics', { params });
      return response.data;
    },
  });
}

// ============================================================
// Operating Theaters (rooms)
// ============================================================

export interface OperatingTheater {
  id: string;
  name: string;
  location: string | null;
  status: 'available' | 'in_use' | 'maintenance';
  equipmentList: string[] | null;
  createdAt: string;
}

export function useOperatingTheaters() {
  return useQuery({
    queryKey: otKeys.theaters,
    queryFn: async () => {
      const response = await apiGet<OperatingTheater[]>('/compliance/operating-theaters');
      return response.data;
    },
  });
}

export interface CreateOTInputRoom {
  name: string;
  location?: string;
  status?: 'available' | 'in_use' | 'maintenance';
  equipmentList?: string[];
}

export function useCreateOperatingTheater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateOTInputRoom) => {
      const response = await apiPost<OperatingTheater>('/compliance/operating-theaters', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otKeys.theaters });
    },
  });
}

export function useUpdateOperatingTheater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateOTInputRoom>) => {
      const response = await apiPut<OperatingTheater>(`/compliance/operating-theaters/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otKeys.theaters });
    },
  });
}

export function useDeleteOperatingTheater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/compliance/operating-theaters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otKeys.theaters });
    },
  });
}

// ============================================================
// OT scheduling preferences (per tenant)
// ============================================================

export interface OtSchedulingSettings {
  defaultDurationMinutes: number;
  bufferMinutes: number;
  maxSurgeriesPerDay: number;
  dayStartTime: string | null;
  dayEndTime: string | null;
}

export function useOtSchedulingSettings() {
  return useQuery({
    queryKey: ['ot', 'settings'],
    queryFn: async () => {
      const response = await apiGet<OtSchedulingSettings>('/compliance/ot-settings');
      return response.data;
    },
  });
}

export function useUpdateOtSchedulingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<OtSchedulingSettings>) => {
      const response = await apiPut<OtSchedulingSettings>('/compliance/ot-settings', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ot', 'settings'] });
    },
  });
}
