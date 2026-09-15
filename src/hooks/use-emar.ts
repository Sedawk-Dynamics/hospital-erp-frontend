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
  drugBatchId?: string | null;
  dispensingRecordId?: string | null;
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
  ndpsPatientDose?: NdpsPatientDoseSummary | null;
}

export interface NdpsPatientDoseSummary {
  id: string;
  labelledQuantity: number | string;
  administeredQuantity: number | string;
  residualQuantity: number | string;
  quantityUnit: string;
  status: 'fully_administered' | 'destroyed' | 'quarantined';
  disposition: 'none' | 'destroyed' | 'quarantined';
  quarantineLocation?: string | null;
  disposalMethod?: string | null;
  emergencyUse?: boolean;
}

export interface NdpsPatientDoseInput {
  drugBatchId: string;
  ndpsLocationId: string;
  labelledQuantity: number;
  administeredQuantity: number;
  quantityUnit: string;
  containerQuantity?: number;
  disposition: 'none' | 'destroyed' | 'quarantined';
  disposalMethod?: string;
  quarantineLocation?: string;
  witnessedById?: string;
  witnessPassword?: string;
  emergencyUse?: boolean;
  emergencyReason?: string;
  notes?: string;
}

export interface NdpsDoseContext {
  isNdps: boolean;
  drug?: { id: string; name: string; strength: string | null };
  linkedBatchId?: string | null;
  dispensingRecordId?: string | null;
  requiresEmergencyReason?: boolean;
  clinicalDetails?: {
    doctorRegistration: string | null;
    bedNumber: string | null;
    diagnosis: string | null;
  };
  batches?: Array<{ id: string; batchNumber: string; expiryDate: string; quantityInStock: number }>;
  locations?: Array<{
    id: string;
    name: string;
    type: string;
    wardId: string | null;
    availableContainers: number;
    preferred: boolean;
  }>;
  existingDose?: NdpsPatientDoseSummary | null;
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
  ndpsContext: (id: string) => ['emar', 'ndps-context', id] as const,
  ndpsItemContext: (id: string) => ['emar', 'ndps-item-context', id] as const,
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
  /**
   * Query ACROSS patients instead of within one.
   *
   * The hook normally refuses to run unscoped, which is right for the eMAR
   * board — it is a per-patient chart. But "12 doses overdue" on the nurse
   * dashboard is a ward-wide fact, and answering "which patients?" by making
   * the nurse pick admissions one at a time is exactly the round trip that
   * question exists to avoid. The API has always allowed a tenant-wide read;
   * this is the opt-in. Never sent to the server.
   */
  allPatients?: boolean;
}) {
  const { allPatients, ...queryParams } = params;
  return useQuery({
    queryKey: keys.schedules(params),
    queryFn: async () => {
      const res = await apiGet<EmarSchedule[]>('/emar/doses', { params: queryParams });
      return res;
    },
    enabled: !!(params.patientId || params.admissionId || params.wardId || allPatients),
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

export function useNdpsDoseContext(id: string | null, enabled = true) {
  return useQuery({
    queryKey: keys.ndpsContext(id ?? ''),
    queryFn: async () => (await apiGet<NdpsDoseContext>(`/emar/doses/${id}/ndps-context`)).data,
    enabled: Boolean(id && enabled),
    staleTime: 15_000,
  });
}

export function useNdpsPrescriptionItemContext(id: string | null, enabled = true) {
  return useQuery({
    queryKey: keys.ndpsItemContext(id ?? ''),
    queryFn: async () => (await apiGet<NdpsDoseContext>(`/emar/prescription-items/${id}/ndps-context`)).data,
    enabled: Boolean(id && enabled),
    staleTime: 15_000,
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
    mutationFn: async (vars: { id: string; actualGivenTime?: string; notes?: string; ndps?: NdpsPatientDoseInput }) => {
      const res = await apiPost<EmarSchedule>(`/emar/doses/${vars.id}/give`, {
        actualGivenTime: vars.actualGivenTime,
        notes: vars.notes,
        ndps: vars.ndps,
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
      ndps?: NdpsPatientDoseInput;
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
    mutationFn: async (vars: { prescriptionItemId: string; actualGivenTime?: string; notes?: string; ndps?: NdpsPatientDoseInput }) => {
      const res = await apiPost<EmarSchedule>(`/emar/prn/${vars.prescriptionItemId}`, {
        actualGivenTime: vars.actualGivenTime,
        notes: vars.notes,
        ndps: vars.ndps,
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

// Record an outcome for a slot whose dose row was never generated (its time
// had already passed when the order was written). Materializes + actions in one.
export function useCatchUpDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      prescriptionItemId: string;
      slotCode: string;
      date: string; // YYYY-MM-DD
      action: 'give' | 'hold' | 'refuse' | 'missed';
      actualGivenTime?: string;
      reason?: string;
      notes?: string;
      ndps?: NdpsPatientDoseInput;
    }) => {
      const res = await apiPost<EmarSchedule>('/emar/catch-up', vars);
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
