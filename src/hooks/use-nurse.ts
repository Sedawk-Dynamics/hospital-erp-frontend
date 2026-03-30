import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiPatch } from '@/lib/api';
import type { Patient } from '@/types';

// ============================================================
// Types
// ============================================================

export interface NurseAdmission {
  id: string;
  ipNumber?: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone' | 'gender' | 'dateOfBirth'> & { uhid?: string; allergies?: string[] };
  doctorId?: string;
  doctor?: { id: string; user?: { firstName: string; lastName: string }; specialization?: string };
  wardId?: string;
  ward?: { id: string; name: string };
  bedId?: string;
  bed?: { id: string; bedNumber: string };
  admissionDate: string;
  dischargeDate?: string;
  status: string;
  diagnosis?: string;
  complaints?: string;
  notes?: string;
  medicoLegal?: string;
  procedure?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vital {
  id: string;
  patientId: string;
  visitId?: string;
  admissionId?: string;
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bloodSugar?: number;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NursingNote {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  admissionId?: string;
  noteType: 'observation' | 'wound_care' | 'iv_line' | 'intake_output' | 'general';
  content: string;
  metadata?: Record<string, unknown>;
  createdById?: string;
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionItem {
  id?: string;
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions?: string;
  quantity?: number;
}

export interface Prescription {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  doctorId: string;
  doctor?: { id: string; user?: { firstName: string; lastName: string } };
  visitId?: string;
  admissionId?: string;
  items: PrescriptionItem[];
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdministrationRecord {
  id: string;
  prescriptionId: string;
  prescriptionItemId?: string;
  patientId: string;
  drugName: string;
  dose: string;
  route?: string;
  scheduledTime: string;
  administeredTime?: string;
  administeredBy?: string;
  status: 'scheduled' | 'administered' | 'missed' | 'held' | 'refused';
  reason?: string;
  notes?: string;
  createdAt: string;
}

export interface MedicationSchedule {
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  admissionId?: string;
  schedules: {
    prescriptionId: string;
    prescriptionItemId: string;
    drugName: string;
    dosage: string;
    frequency: string;
    route?: string;
    timeSlots: {
      time: string;
      status: 'scheduled' | 'administered' | 'missed' | 'held' | 'refused';
      administrationId?: string;
    }[];
  }[];
}

export interface ShiftHandover {
  id: string;
  fromUserId: string;
  fromUser?: { firstName: string; lastName: string };
  toUserId?: string;
  toUser?: { firstName: string; lastName: string };
  wardId?: string;
  ward?: { id: string; name: string };
  shiftType: 'morning' | 'afternoon' | 'night';
  summary: string;
  patientNotes?: { patientId: string; patientName: string; note: string; priority?: string }[];
  outstandingTasks?: string[];
  specialInstructions?: string;
  status: 'draft' | 'submitted' | 'acknowledged';
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DutyRoster {
  id: string;
  staffId: string;
  staff?: { firstName: string; lastName: string };
  departmentId?: string;
  department?: { name: string };
  shiftType: string;
  shiftStart: string;
  shiftEnd: string;
  date: string;
  status?: string;
}

export interface BedInfo {
  id: string;
  bedNumber: string;
  roomId?: string;
  room?: { id: string; roomNumber: string };
  wardId: string;
  ward?: { id: string; name: string };
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  currentPatient?: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'mrn'>;
}

export interface SupplyRequest {
  id: string;
  requestedById: string;
  requestedBy?: { firstName: string; lastName: string };
  wardId?: string;
  ward?: { name: string };
  items: { itemId: string; itemName: string; quantity: number; unit?: string }[];
  priority: 'low' | 'normal' | 'urgent';
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category?: string;
  sku?: string;
  currentStock: number;
  reorderLevel?: number;
  unit?: string;
  status?: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================
// Query Keys
// ============================================================

export const nurseKeys = {
  all: ['nurse'] as const,
  admissions: {
    all: ['nurse', 'admissions'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'admissions', 'list', params] as const,
    detail: (id: string) => ['nurse', 'admissions', 'detail', id] as const,
  },
  vitals: {
    all: ['nurse', 'vitals'] as const,
    patient: (patientId: string, params?: Record<string, unknown>) => ['nurse', 'vitals', patientId, params] as const,
    latest: (patientId: string) => ['nurse', 'vitals', 'latest', patientId] as const,
  },
  nursingNotes: {
    all: ['nurse', 'nursing-notes'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'nursing-notes', 'list', params] as const,
  },
  prescriptions: {
    all: ['nurse', 'prescriptions'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'prescriptions', 'list', params] as const,
  },
  administration: {
    all: ['nurse', 'administration'] as const,
    records: (params?: Record<string, unknown>) => ['nurse', 'administration', 'records', params] as const,
    schedule: (params?: Record<string, unknown>) => ['nurse', 'administration', 'schedule', params] as const,
  },
  handovers: {
    all: ['nurse', 'handovers'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'handovers', 'list', params] as const,
    detail: (id: string) => ['nurse', 'handovers', 'detail', id] as const,
  },
  roster: {
    all: ['nurse', 'roster'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'roster', 'list', params] as const,
  },
  beds: {
    all: ['nurse', 'beds'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'beds', 'list', params] as const,
  },
  orders: {
    all: ['nurse', 'orders'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'orders', 'list', params] as const,
  },
  inventory: {
    all: ['nurse', 'inventory'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'inventory', 'list', params] as const,
  },
  supplyRequests: {
    all: ['nurse', 'supply-requests'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'supply-requests', 'list', params] as const,
  },
  samples: {
    all: ['nurse', 'samples'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'samples', 'list', params] as const,
  },
};

// ============================================================
// Admissions (Assigned Patients)
// ============================================================

export function useNurseAdmissions(params?: {
  page?: number;
  limit?: number;
  wardId?: string;
  nurseId?: string;
  status?: string;
  search?: string;
  date?: string;
}) {
  return useQuery({
    queryKey: nurseKeys.admissions.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<NurseAdmission[]>('/clinical/admissions', { params });
      return res;
    },
  });
}

export function useAdmissionDetail(id: string) {
  return useQuery({
    queryKey: nurseKeys.admissions.detail(id),
    queryFn: async () => {
      const res = await apiGet<NurseAdmission>(`/clinical/admissions/${id}`);
      return res;
    },
    enabled: !!id,
  });
}

// ============================================================
// Vitals
// ============================================================

export function usePatientVitals(patientId: string, params?: { from?: string; to?: string; limit?: number }) {
  return useQuery({
    queryKey: nurseKeys.vitals.patient(patientId, params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<Vital[]>(`/clinical/vitals/${patientId}`, { params });
      return res;
    },
    enabled: !!patientId,
  });
}

export function useLatestVitals(patientId: string) {
  return useQuery({
    queryKey: nurseKeys.vitals.latest(patientId),
    queryFn: async () => {
      const res = await apiGet<Vital>(`/clinical/vitals/${patientId}/latest`);
      return res;
    },
    enabled: !!patientId,
  });
}

export function useRecordVitals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId?: string;
      admissionId?: string;
      temperature?: number;
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      pulseRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      weightKg?: number;
      heightCm?: number;
      bloodSugar?: number;
      notes?: string;
    }) => {
      const res = await apiPost<Vital>('/clinical/vitals', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.vitals.all });
    },
  });
}

// ============================================================
// Nursing Notes (observations, wound care, IV lines, intake/output)
// ============================================================

export function useNursingNotes(params?: {
  patientId?: string;
  admissionId?: string;
  noteType?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.nursingNotes.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<NursingNote[]>('/progress-notes/nursing', { params });
      return res;
    },
  });
}

export function useCreateNursingNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      admissionId?: string;
      noteType: string;
      content: string;
      metadata?: Record<string, unknown>;
    }) => {
      const res = await apiPost<NursingNote>('/progress-notes/nursing', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.nursingNotes.all });
    },
  });
}

export function useUpdateNursingNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; content?: string; noteType?: string; metadata?: Record<string, unknown> }) => {
      const res = await apiPut<NursingNote>(`/progress-notes/nursing/${id}`, data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.nursingNotes.all });
    },
  });
}

// ============================================================
// Prescriptions & eMAR
// ============================================================

export function useActivePrescriptions(params?: {
  patientId?: string;
  status?: string;
  prescriptionType?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.prescriptions.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<Prescription[]>('/prescriptions', {
        params: {
          ...params,
          status: params?.status || 'active',
          prescriptionType: params?.prescriptionType || 'ip',
        },
      });
      return res;
    },
  });
}

export function useMedicationSchedule(params?: { patientId?: string; date?: string }) {
  return useQuery({
    queryKey: nurseKeys.administration.schedule(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<MedicationSchedule[]>('/prescriptions/administration/schedule', { params });
      return res;
    },
    enabled: !!params?.patientId,
  });
}

export function useAdministrationRecords(params?: {
  prescriptionItemId?: string;
  patientId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.administration.records(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<AdministrationRecord[]>('/prescriptions/administration', { params });
      return res;
    },
  });
}

export function useRecordAdministration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      prescriptionItemId: string;
      patientId: string;
      administeredAt: string;
      doseGiven?: string;
      status: 'given' | 'missed' | 'refused' | 'held';
      notes?: string;
    }) => {
      const res = await apiPost<AdministrationRecord>('/prescriptions/administration', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.administration.all });
      qc.invalidateQueries({ queryKey: nurseKeys.prescriptions.all });
    },
  });
}

export function useAllergyCheck(patientId: string, drugName: string) {
  return useQuery({
    queryKey: ['nurse', 'allergy-check', patientId, drugName],
    queryFn: async () => {
      const res = await apiGet<{ hasAllergy: boolean; allergies: string[] }>('/prescriptions/allergy-check', {
        params: { patientId, drugName },
      });
      return res;
    },
    enabled: !!patientId && !!drugName,
  });
}

// ============================================================
// Shift Handover
// ============================================================

export function useHandovers(params?: {
  wardId?: string;
  shiftType?: string;
  shiftDate?: string;
  isAcknowledged?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.handovers.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<ShiftHandover[]>('/communication/handovers', { params });
      return res;
    },
  });
}

export function useHandoverDetail(id: string) {
  return useQuery({
    queryKey: nurseKeys.handovers.detail(id),
    queryFn: async () => {
      const res = await apiGet<ShiftHandover>(`/communication/handovers/${id}`);
      return res;
    },
    enabled: !!id,
  });
}

export function useCreateHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      toNurseId?: string;
      wardId: string;
      shiftDate: string;
      shiftType: string;
      content: string;
      patientStatuses?: unknown;
      outstandingTasks?: unknown;
    }) => {
      const res = await apiPost<ShiftHandover>('/communication/handovers', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.handovers.all });
    },
  });
}

export function useAcknowledgeHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<ShiftHandover>(`/communication/handovers/${id}/acknowledge`);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.handovers.all });
    },
  });
}

// ============================================================
// Duty Roster
// ============================================================

export function useDutyRoster(params?: { date?: string; departmentId?: string; staffId?: string }) {
  return useQuery({
    queryKey: nurseKeys.roster.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<DutyRoster[]>('/hr/duty-rosters', { params });
      return res;
    },
  });
}

// ============================================================
// Beds & Ward
// ============================================================

export function useWardBeds(params?: { wardId?: string; status?: string }) {
  return useQuery({
    queryKey: nurseKeys.beds.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<BedInfo[]>('/infrastructure/beds', { params });
      return res;
    },
  });
}

// ============================================================
// Orders (Doctor → Nurse)
// ============================================================

export function usePendingOrders(params?: { wardId?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: nurseKeys.orders.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<unknown[]>('/lab/orders', { params: { ...params, status: params?.status || 'pending' } });
      return res;
    },
  });
}

// ============================================================
// Lab Samples
// ============================================================

export function useLabSamples(params?: { wardId?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: nurseKeys.samples.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<unknown[]>('/lab/samples', { params });
      return res;
    },
  });
}

export function useUpdateSampleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiPatch(`/lab/samples/${id}/status`, { status });
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.samples.all });
      qc.invalidateQueries({ queryKey: nurseKeys.orders.all });
    },
  });
}

// ============================================================
// Patient Transfer
// ============================================================

export function useRequestTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      admissionId: string;
      fromWardId: string;
      toWardId: string;
      toBedId?: string;
      reason: string;
      notes?: string;
    }) => {
      const res = await apiPost('/clinical/transfers', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.admissions.all });
      qc.invalidateQueries({ queryKey: nurseKeys.beds.all });
    },
  });
}

// ============================================================
// Inventory & Supply Requests
// ============================================================

export function useWardInventory(params?: { wardId?: string; category?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: nurseKeys.inventory.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<InventoryItem[]>('/inventory/items', { params });
      return res;
    },
  });
}

export function useSupplyRequests(params?: { wardId?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: nurseKeys.supplyRequests.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<SupplyRequest[]>('/inventory/supply-requests', { params });
      return res;
    },
  });
}

export function useCreateSupplyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      departmentId: string;
      wardId?: string;
      inventoryItemId: string;
      quantityRequested: number;
      urgency?: 'routine' | 'urgent';
      notes?: string;
    }) => {
      const res = await apiPost<SupplyRequest>('/inventory/supply-requests', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.supplyRequests.all });
    },
  });
}
