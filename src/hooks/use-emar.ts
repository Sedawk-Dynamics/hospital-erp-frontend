import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export type EmarDoseStatus =
  | 'pending'
  | 'due'
  | 'overdue'
  | 'given'
  | 'given_late'
  | 'missed'
  | 'held'
  | 'refused'
  | 'cancelled';

export type EmarFrequencyType = 'slot' | 'interval' | 'once' | 'prn';

export interface EmarTimeSlot {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  time: string; // HH:mm
  sortOrder: number;
  isActive: boolean;
}

export interface EmarFrequency {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  type: EmarFrequencyType;
  slotCodes: string[];
  intervalHours: number | null;
  minPrnIntervalMinutes: number | null;
  isActive: boolean;
}

export interface EmarSettings {
  id: string;
  tenantId: string;
  gracePeriodMinutes: number;
  defaultPrnMinIntervalMinutes: number;
}

export interface EmarSchedule {
  id: string;
  tenantId: string;
  prescriptionId: string;
  prescriptionItemId: string;
  patientId: string;
  admissionId: string | null;
  drugName: string;
  dosage: string;
  route: string;
  frequencyCode: string | null;
  slotCode: string | null;
  scheduledAt: string;
  status: EmarDoseStatus;
  isPrn: boolean;
  actionedAt: string | null;
  actualGivenTime: string | null;
  givenById: string | null;
  delayMinutes: number | null;
  reason: string | null;
  notes: string | null;
  amendedAt: string | null;
  amendedById: string | null;
  previousStatus: EmarDoseStatus | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt?: string;
  updatedAt?: string;
  prescriptionItem?: {
    id: string;
    drugName: string;
    dosage: string;
    frequency: string;
    route: string;
    instructions: string | null;
    isPrn: boolean;
  };
  patient?: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
  };
  givenBy?: { id: string; firstName: string; lastName: string | null };
  amendedBy?: { id: string; firstName: string; lastName: string | null };
}

export interface EmarAuditEntry {
  id: string;
  tenantId: string;
  scheduleId: string;
  action: string;
  fromStatus: EmarDoseStatus | null;
  toStatus: EmarDoseStatus;
  performedAt: string;
  serverTime: string;
  reason: string | null;
  notes: string | null;
  delayMinutes: number | null;
  performedBy?: { id: string; firstName: string; lastName: string | null };
  metadata?: Record<string, unknown>;
}

// ============================================================
// Query keys
// ============================================================

const keys = {
  schedules: (params?: Record<string, unknown>) => ['emar', 'schedules', params] as const,
  schedule: (id: string) => ['emar', 'schedule', id] as const,
  audit: (id: string) => ['emar', 'audit', id] as const,
  timeSlots: ['emar', 'time-slots'] as const,
  frequencies: ['emar', 'frequencies'] as const,
  settings: ['emar', 'settings'] as const,
};

// ============================================================
// Schedules
// ============================================================

export function useEmarSchedules(params: {
  patientId?: string;
  admissionId?: string;
  wardId?: string;
  fromDate?: string;
  toDate?: string;
  status?: EmarDoseStatus | EmarDoseStatus[];
  includePrn?: boolean;
  limit?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: keys.schedules(params),
    queryFn: async () => {
      const res = await apiGet<EmarSchedule[]>('/emar/doses', { params });
      return res;
    },
    enabled: !!(params.patientId || params.admissionId || params.wardId),
  });
}

export function useEmarSchedule(id: string | null) {
  return useQuery({
    queryKey: keys.schedule(id ?? ''),
    queryFn: async () => {
      const res = await apiGet<EmarSchedule>(`/emar/doses/${id}`);
      return res;
    },
    enabled: !!id,
  });
}

export function useEmarAudit(id: string | null) {
  return useQuery({
    queryKey: keys.audit(id ?? ''),
    queryFn: async () => {
      const res = await apiGet<EmarAuditEntry[]>(`/emar/audit/${id}`);
      return res;
    },
    enabled: !!id,
  });
}

// ============================================================
// Dose mutations
// ============================================================

function invalidateSchedules(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['emar'] });
}

export function useGiveDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; actualGivenTime?: string; notes?: string }) => {
      const res = await apiPost<EmarSchedule>(`/emar/doses/${vars.id}/give`, {
        actualGivenTime: vars.actualGivenTime,
        notes: vars.notes,
      });
      return res;
    },
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useHoldDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reason: string; notes?: string }) => {
      const res = await apiPost<EmarSchedule>(`/emar/doses/${vars.id}/hold`, {
        reason: vars.reason,
        notes: vars.notes,
      });
      return res;
    },
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useRefuseDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reason: string; notes?: string }) => {
      const res = await apiPost<EmarSchedule>(`/emar/doses/${vars.id}/refuse`, {
        reason: vars.reason,
        notes: vars.notes,
      });
      return res;
    },
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useMarkMissed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reason?: string; notes?: string }) => {
      const res = await apiPost<EmarSchedule>(`/emar/doses/${vars.id}/missed`, {
        reason: vars.reason,
        notes: vars.notes,
      });
      return res;
    },
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useAmendDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      toStatus: 'given' | 'given_late' | 'missed' | 'held' | 'refused';
      actualGivenTime?: string;
      reason?: string;
      notes?: string;
    }) => {
      const { id, ...body } = vars;
      const res = await apiPost<EmarSchedule>(`/emar/doses/${id}/amend`, body);
      return res;
    },
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useTriggerPrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { prescriptionItemId: string; actualGivenTime?: string; notes?: string }) => {
      const res = await apiPost<EmarSchedule>(`/emar/prn/${vars.prescriptionItemId}`, {
        actualGivenTime: vars.actualGivenTime,
        notes: vars.notes,
      });
      return res;
    },
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useRegenerateSchedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { prescriptionId: string }) => {
      const res = await apiPost<{ prescriptionId: string; rowsCreated: number }>(
        `/emar/regenerate/${vars.prescriptionId}`,
      );
      return res;
    },
    onSuccess: () => invalidateSchedules(qc),
  });
}

// ============================================================
// Time Slot Master
// ============================================================

export function useEmarTimeSlots() {
  return useQuery({
    queryKey: keys.timeSlots,
    queryFn: async () => {
      const res = await apiGet<EmarTimeSlot[]>('/emar/settings/time-slots');
      return res;
    },
  });
}

export function useCreateTimeSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EmarTimeSlot>) => {
      const res = await apiPost<EmarTimeSlot>('/emar/settings/time-slots', data);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.timeSlots }),
  });
}

export function useUpdateTimeSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: Partial<EmarTimeSlot> }) => {
      const res = await apiPut<EmarTimeSlot>(`/emar/settings/time-slots/${vars.id}`, vars.data);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.timeSlots }),
  });
}

export function useDeleteTimeSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete<{ id: string; deleted: boolean }>(`/emar/settings/time-slots/${id}`);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.timeSlots }),
  });
}

// ============================================================
// Frequency Master
// ============================================================

export function useEmarFrequencies() {
  return useQuery({
    queryKey: keys.frequencies,
    queryFn: async () => {
      const res = await apiGet<EmarFrequency[]>('/emar/settings/frequencies');
      return res;
    },
  });
}

export function useCreateFrequency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EmarFrequency>) => {
      const res = await apiPost<EmarFrequency>('/emar/settings/frequencies', data);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.frequencies }),
  });
}

export function useUpdateFrequency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: Partial<EmarFrequency> }) => {
      const res = await apiPut<EmarFrequency>(`/emar/settings/frequencies/${vars.id}`, vars.data);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.frequencies }),
  });
}

export function useDeleteFrequency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete<{ id: string; deleted: boolean }>(`/emar/settings/frequencies/${id}`);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.frequencies }),
  });
}

// ============================================================
// Settings
// ============================================================

export function useEmarSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: async () => {
      const res = await apiGet<EmarSettings>('/emar/settings');
      return res;
    },
  });
}

export function useUpdateEmarSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { gracePeriodMinutes?: number; defaultPrnMinIntervalMinutes?: number }) => {
      const res = await apiPut<EmarSettings>('/emar/settings', data);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
}
