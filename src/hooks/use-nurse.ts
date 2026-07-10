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
  // Visit FK on the admission row. Vitals creation requires visitId, so we
  // pass the admission's visitId straight through.
  visitId?: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone' | 'gender' | 'dateOfBirth' | 'bloodGroup' | 'email'> & { uhid?: string; allergies?: string[] };
  doctorId?: string;
  doctor?: {
    id: string;
    userId?: string;
    user?: { firstName: string; lastName: string };
    specialization?: string;
  };
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
  recordedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  // Formulary link (DrugFormulary.id) when the doctor picked from the formulary;
  // null for free-text lines. Used to pre-fill a pharmacy indent from the Rx.
  drugId?: string | null;
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions?: string;
  quantity?: number;
  isPrn?: boolean;
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
  staff?: {
    id: string;
    employeeId?: string;
    user?: { firstName: string; lastName: string };
  };
  departmentId?: string;
  department?: { id: string; name: string };
  shiftType: 'morning' | 'afternoon' | 'night' | 'general';
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'swapped' | 'cancelled';
}

export interface BedInfo {
  id: string;
  bedNumber: string;
  wardId: string;
  ward?: {
    id: string;
    name: string;
    floor?: { id: string; name: string; level: number } | null;
  };
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

// ── Structured nursing records ─────────────────────────────

export type WoundType = 'surgical' | 'pressure_ulcer' | 'laceration' | 'burn' | 'diabetic_ulcer' | 'other';
export type WoundStage = 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'unstageable';
export type ExudateType = 'none' | 'serous' | 'sanguineous' | 'purulent';
export type ExudateAmount = 'none' | 'scant' | 'moderate' | 'heavy';
export type WoundStatus = 'active' | 'healing' | 'healed' | 'worsening';

export interface WoundCareRecord {
  id: string;
  visitId: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'mrn'>;
  nurseId: string;
  nurse?: { id: string; firstName: string; lastName: string };
  woundLocation: string;
  woundType?: WoundType;
  woundStage?: WoundStage;
  lengthCm?: number | string;
  widthCm?: number | string;
  depthCm?: number | string;
  exudateType?: ExudateType;
  exudateAmount?: ExudateAmount;
  dressingApplied?: string;
  treatmentNotes?: string;
  photoUrl?: string;
  assessedAt: string;
  nextAssessmentDue?: string;
  status: WoundStatus;
  createdAt: string;
}

export type IVLineType =
  | 'peripheral'
  | 'central_picc'
  | 'central_subclavian'
  | 'central_jugular'
  | 'arterial'
  | 'midline';
export type IVRemovalReason =
  | 'completed'
  | 'infiltration'
  | 'phlebitis'
  | 'dislodged'
  | 'infection'
  | 'scheduled_change';
export type IVLineStatus = 'active' | 'removed' | 'replaced';

export interface IVLineRecord {
  id: string;
  visitId: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'mrn'>;
  admissionId?: string | null;
  lineType: IVLineType;
  catheterGauge?: string;
  insertionSite: string;
  insertedAt: string;
  insertedBy: string;
  inserter?: { id: string; firstName: string; lastName: string };
  removedAt?: string | null;
  removedBy?: string | null;
  remover?: { id: string; firstName: string; lastName: string } | null;
  removalReason?: IVRemovalReason | null;
  dressingChangeFrequencyHours: number;
  lastDressingChangeAt?: string | null;
  lastFlushedAt?: string | null;
  fluidType?: string | null;
  flowRateMlPerHr?: number | null;
  status: IVLineStatus;
  complications?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IOEntryType = 'intake' | 'output';
export type IOCategory =
  | 'oral'
  | 'iv_fluid'
  | 'blood_product'
  | 'tube_feed'
  | 'urine'
  | 'drain'
  | 'vomit'
  | 'stool'
  | 'blood_loss'
  | 'other';

export interface IntakeOutputRecord {
  id: string;
  visitId: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'firstName' | 'lastName' | 'mrn'>;
  nurseId: string;
  nurse?: { id: string; firstName: string; lastName: string };
  recordDatetime: string;
  entryType: IOEntryType;
  category: IOCategory;
  volumeMl: number;
  fluidDescription?: string | null;
  ivLineId?: string | null;
  ivLine?: { id: string; insertionSite: string; lineType: IVLineType } | null;
  notes?: string | null;
  createdAt: string;
}

export interface IntakeOutputSummary {
  intakeMl: number;
  outputMl: number;
  balanceMl: number;
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
  woundCare: {
    all: ['nurse', 'wound-care'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'wound-care', 'list', params] as const,
  },
  ivLines: {
    all: ['nurse', 'iv-lines'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'iv-lines', 'list', params] as const,
  },
  intakeOutput: {
    all: ['nurse', 'intake-output'] as const,
    list: (params?: Record<string, unknown>) => ['nurse', 'intake-output', 'list', params] as const,
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

export function useAllVitals(params?: { page?: number; limit?: number; patientId?: string }) {
  return useQuery({
    queryKey: ['nurse', 'vitals', 'all', params],
    queryFn: async () => {
      const res = await apiGet<(Vital & {
        patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
      })[]>('/clinical/vitals', { params });
      return res;
    },
  });
}

export function useRecordVitals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      // One of visitId, admissionId, or appointmentId must be set. The
      // backend resolves to a Visit and auto-creates one for confirmed OPD
      // appointments that don't yet have a Visit row.
      visitId?: string;
      admissionId?: string;
      appointmentId?: string;
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

// The API returns prescription lines under Prisma's relation name
// `prescriptionItems`, but every consumer reads `items`. Normalize so the
// `items` contract is always populated regardless of which key the API sends.
function normalizeRxItems<T extends { items?: unknown[]; prescriptionItems?: unknown[] }>(rx: T): T {
  return { ...rx, items: rx.items ?? rx.prescriptionItems ?? [] } as T;
}

export function useActivePrescriptions(params?: {
  patientId?: string;
  admissionId?: string;
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
      return { ...res, data: (res.data ?? []).map(normalizeRxItems) };
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

export function useOverdueAdministrations(params?: {
  patientId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['nurse', 'administration', 'missed', params],
    queryFn: async () => {
      const res = await apiGet<AdministrationRecord[]>('/prescriptions/administration', {
        params: { ...params, status: 'missed' },
      });
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

// ── Drug Interaction Check ────────────────────────────────

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface InteractionPair {
  drugs: [string, string];
  severity: InteractionSeverity;
  description: string;
}

export interface DrugContraindicationEntry {
  drugName: string;
  matchedFormularyName?: string;
  genericName?: string | null;
  contraindications?: string | null;
}

export interface InteractionCheckResult {
  pairs: InteractionPair[];
  perDrug: DrugContraindicationEntry[];
  highestSeverity: InteractionSeverity | null;
}

/**
 * Given a list of drug names, returns pairwise interactions + per-drug
 * contraindications text from the formulary. Cache keyed on the sorted
 * drug list so switching patients reuses the cache.
 */
export function useDrugInteractions(drugs: string[]) {
  const sortedKey = [...drugs].map((d) => d.trim().toLowerCase()).sort();
  return useQuery({
    queryKey: ['nurse', 'drug-interactions', sortedKey],
    queryFn: async () => {
      const res = await apiPost<InteractionCheckResult>('/prescriptions/check-interactions', {
        drugs,
      });
      return res;
    },
    enabled: drugs.length > 0,
    staleTime: 5 * 60 * 1000,
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

export function useCompleteHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completionNote }: { id: string; completionNote?: string }) => {
      const res = await apiPatch<ShiftHandover>(
        `/communication/handovers/${id}/complete`,
        completionNote ? { completionNote } : undefined,
      );
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.handovers.all });
    },
  });
}

// ── Shift Summary (auto-compiled activity counts) ─────────

export interface ShiftSummaryCounts {
  patientsSeen: number;
  vitalsRecorded: number;
  medicationsAdministered: number;
  nursingNotes: number;
  woundCareRecords: number;
  ivLinesInserted: number;
  intakeOutputEntries: number;
  handoversReceived: number;
  handoversSubmitted: number;
}

export interface ShiftSummary {
  shiftType: 'morning' | 'afternoon' | 'night';
  shiftDate: string;
  windowFrom: string;
  windowTo: string;
  userId: string;
  counts: ShiftSummaryCounts;
}

export function useShiftSummary(params?: {
  shiftDate?: string;
  shiftType?: 'morning' | 'afternoon' | 'night';
  userId?: string;
  wardId?: string;
}) {
  return useQuery({
    queryKey: ['nurse', 'shift-summary', params],
    queryFn: async () => {
      const res = await apiGet<ShiftSummary>('/communication/shift-summary', { params });
      return res;
    },
  });
}

// ============================================================
// Duty Roster
// ============================================================

export function useDutyRoster(params?: {
  date?: string;
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
  staffId?: string;
  // Backend resolves to the user's StaffProfile; lets a nurse view "my
  // shifts" without first fetching their staff record.
  userId?: string;
  shiftType?: 'morning' | 'afternoon' | 'night' | 'general';
}) {
  // Backend supports fromDate/toDate ranges; convenience-map a single `date` to both.
  const { date, fromDate, toDate, ...rest } = params ?? {};
  const queryParams = {
    ...rest,
    fromDate: fromDate ?? date,
    toDate: toDate ?? date,
    limit: 100,
  };
  return useQuery({
    queryKey: nurseKeys.roster.list(queryParams as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<DutyRoster[]>('/hr/rosters', { params: queryParams });
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

export interface NurseClinicalOrder {
  id: string;
  orderType: 'lab' | 'imaging';
  orderNumber: string;
  status: string;
  priority: 'routine' | 'urgent' | 'stat';
  description: string;
  createdAt: string;
  patientId: string;
  patient: { id: string; firstName: string; lastName: string; mrn: string | null } | null;
  doctor: { id: string; user: { firstName: string; lastName: string } | null } | null;
  wardId: string | null;
  ward: { id: string; name: string } | null;
  completedExternallyAt: string | null;
  externalReportUrl: string | null;
  externalNotes: string | null;
  // Set when lab / radiology has uploaded their own signed report. Drives
  // the "Lab Report" / "Imaging Report" link in clinical views (the
  // patient-uploaded `externalReportUrl` takes precedence and is labelled
  // "Patient Uploaded" instead).
  reportUrl: string | null;
  reportStatus: string | null;
}

/**
 * Unified pending-orders feed for the nurse ward view. Aggregates
 * lab + imaging orders under /clinical/orders.
 */
export function useClinicalOrders(params?: {
  wardId?: string;
  status?: 'pending' | 'completed' | 'cancelled' | 'all';
  type?: 'lab' | 'imaging' | 'all';
  scope?: 'mine' | 'all';
  patientId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.orders.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<NurseClinicalOrder[]>('/clinical/orders', {
        params: { ...params, status: params?.status ?? 'pending' },
      });
      return res;
    },
  });
}

export function useAcknowledgeClinicalOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { orderType: 'lab' | 'imaging'; orderId: string; note?: string }) => {
      const res = await apiPost<{ noteId: string; orderType: string; orderId: string }>(
        '/clinical/orders/acknowledge',
        data,
      );
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.orders.all });
      qc.invalidateQueries({ queryKey: nurseKeys.nursingNotes.all });
    },
  });
}

/**
 * Legacy wrapper kept for compatibility with the nurse dashboard which
 * only cares about the count of pending orders. Delegates to the new
 * unified endpoint.
 */
export function usePendingOrders(params?: { wardId?: string; status?: string }) {
  return useQuery({
    queryKey: nurseKeys.orders.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<NurseClinicalOrder[]>('/clinical/orders', {
        params: { ...params, status: 'pending' },
      });
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
// Notifications (e.g., alert doctor on abnormal vitals)
// ============================================================

export function useCreateNotification() {
  return useMutation({
    mutationFn: async (data: {
      userId: string;
      title: string;
      message: string;
      notificationType:
        | 'appointment'
        | 'lab_result'
        | 'prescription'
        | 'billing'
        | 'system'
        | 'ticket'
        | 'alert'
        | 'general';
      channel?: 'in_app' | 'sms' | 'email' | 'push';
      referenceType?: string;
      referenceId?: string;
    }) => {
      const res = await apiPost('/communication/notifications', data);
      return res;
    },
  });
}

// ============================================================
// Wound Care
// ============================================================

export function useWoundCareRecords(params?: {
  patientId?: string;
  admissionId?: string;
  visitId?: string;
  status?: WoundStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.woundCare.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<WoundCareRecord[]>('/progress-notes/wound-care', { params });
      return res;
    },
  });
}

export function useCreateWoundCare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId?: string;
      admissionId?: string;
      woundLocation: string;
      woundType?: WoundType;
      woundStage?: WoundStage;
      lengthCm?: number;
      widthCm?: number;
      depthCm?: number;
      exudateType?: ExudateType;
      exudateAmount?: ExudateAmount;
      dressingApplied?: string;
      treatmentNotes?: string;
      photoUrl?: string;
      assessedAt?: string;
      nextAssessmentDue?: string;
      status?: WoundStatus;
    }) => {
      const res = await apiPost<WoundCareRecord>('/progress-notes/wound-care', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.woundCare.all });
    },
  });
}

// ============================================================
// IV Line Records
// ============================================================

export function useIvLineRecords(params?: {
  patientId?: string;
  admissionId?: string;
  visitId?: string;
  status?: IVLineStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.ivLines.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<IVLineRecord[]>('/progress-notes/iv-lines', { params });
      return res;
    },
  });
}

export function useCreateIvLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId?: string;
      admissionId?: string;
      lineType: IVLineType;
      catheterGauge?: string;
      insertionSite: string;
      insertedAt?: string;
      dressingChangeFrequencyHours?: number;
      lastDressingChangeAt?: string;
      lastFlushedAt?: string;
      fluidType?: string;
      flowRateMlPerHr?: number;
      complications?: string;
      notes?: string;
    }) => {
      const res = await apiPost<IVLineRecord>('/progress-notes/iv-lines', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.ivLines.all });
    },
  });
}

export function useRemoveIvLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      removedAt?: string;
      removalReason: IVRemovalReason;
      status?: 'removed' | 'replaced';
      notes?: string;
    }) => {
      const res = await apiPatch<IVLineRecord>(`/progress-notes/iv-lines/${id}/remove`, data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.ivLines.all });
      qc.invalidateQueries({ queryKey: nurseKeys.intakeOutput.all });
    },
  });
}

// ============================================================
// Intake / Output
// ============================================================

/**
 * Intake/output list endpoint also returns a `summary` field alongside meta.
 */
export function useIntakeOutputRecords(params?: {
  patientId?: string;
  admissionId?: string;
  visitId?: string;
  entryType?: IOEntryType;
  category?: IOCategory;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nurseKeys.intakeOutput.list(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<IntakeOutputRecord[]>('/progress-notes/intake-output', { params });
      // Backend attaches `summary` at the top level of the JSON envelope; axios preserves it via `res`.
      return res as typeof res & { summary?: IntakeOutputSummary };
    },
  });
}

export function useCreateIntakeOutput() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId?: string;
      admissionId?: string;
      recordDatetime?: string;
      entryType: IOEntryType;
      category: IOCategory;
      volumeMl: number;
      fluidDescription?: string;
      ivLineId?: string;
      notes?: string;
    }) => {
      const res = await apiPost<IntakeOutputRecord>('/progress-notes/intake-output', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseKeys.intakeOutput.all });
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
