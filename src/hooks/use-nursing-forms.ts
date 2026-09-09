import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type { ApiResponse } from '@/lib/api-client';

// ──────────────────────────────────────────────────────────
// Types — keep parallel with backend Prisma models. Optional fields
// reflect what the Zod validation actually allows.
// ──────────────────────────────────────────────────────────

export type ArrivalMode = 'ambulance' | 'walk_in' | 'wheelchair' | 'stretcher' | 'other';
export type ConsciousnessLevel = 'alert' | 'drowsy' | 'confused' | 'unresponsive';
export type PainScale = 'numeric' | 'faces' | 'flacc' | 'pqrst';
export type FallRiskLevel = 'low' | 'moderate' | 'high';
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
  | 'other';
export type WoundType = 'surgical' | 'pressure_ulcer' | 'laceration' | 'burn' | 'diabetic_ulcer' | 'other';
export type WoundStage = 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'unstageable';
export type ExudateType = 'none' | 'serous' | 'sanguineous' | 'purulent';
export type ExudateAmount = 'none' | 'scant' | 'moderate' | 'heavy';
export type WoundStatus = 'active' | 'healing' | 'healed' | 'worsening';
export type NursingNoteType = 'observation' | 'wound_care' | 'iv_line' | 'intake_output' | 'general';

interface NurseRef {
  nurse?: { id: string; firstName: string; lastName: string | null };
}

export interface AdmissionAssessment extends NurseRef {
  id: string;
  visitId: string;
  admissionId?: string | null;
  patientId: string;
  arrivalMode?: ArrivalMode | null;
  consciousnessLevel?: ConsciousnessLevel | null;
  chiefComplaint?: string | null;
  allergies?: string | null;
  currentMedications?: string | null;
  skinCondition?: string | null;
  mobility?: string | null;
  nutritionStatus?: string | null;
  elimination?: string | null;
  preferredLanguage?: string | null;
  religiousNeeds?: string | null;
  nextOfKin?: { name?: string; relationship?: string; phone?: string } | null;
  notes?: string | null;
  assessedAt: string;
  createdAt: string;
}

export interface PainAssessment extends NurseRef {
  id: string;
  visitId: string;
  admissionId?: string | null;
  patientId: string;
  painScore: number;
  painScale: PainScale;
  painLocation?: string | null;
  painCharacter?: string | null;
  painOnsetAt?: string | null;
  aggravatingFactors?: string | null;
  relievingFactors?: string | null;
  intervention?: string | null;
  reassessmentDueAt?: string | null;
  notes?: string | null;
  assessedAt: string;
  createdAt: string;
}

export interface FallRiskAssessment extends NurseRef {
  id: string;
  visitId: string;
  admissionId?: string | null;
  patientId: string;
  historyOfFalling: number;
  secondaryDiagnosis: number;
  ambulatoryAid: number;
  ivOrSalineLock: number;
  gait: number;
  mentalStatus: number;
  totalScore: number;
  riskLevel: FallRiskLevel;
  intervention?: string | null;
  notes?: string | null;
  assessedAt: string;
  createdAt: string;
}

export interface IntakeOutputRecord extends NurseRef {
  id: string;
  visitId: string;
  patientId: string;
  recordDatetime: string;
  entryType: IOEntryType;
  category: IOCategory;
  volumeMl: number;
  fluidDescription?: string | null;
  ivLineId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface WoundCareRecord extends NurseRef {
  id: string;
  visitId: string;
  patientId: string;
  woundLocation: string;
  woundType?: WoundType | null;
  woundStage?: WoundStage | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  exudateType?: ExudateType | null;
  exudateAmount?: ExudateAmount | null;
  dressingApplied?: string | null;
  treatmentNotes?: string | null;
  photoUrl?: string | null;
  assessedAt: string;
  nextAssessmentDue?: string | null;
  status: WoundStatus;
  createdAt: string;
}

export interface NursingNoteRecord extends NurseRef {
  id: string;
  visitId?: string | null;
  patientId: string;
  admissionId?: string | null;
  noteType: NursingNoteType;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientFormsSummary {
  admissionAssessment: { latest: AdmissionAssessment | null; total: number };
  pain: { recent: PainAssessment[]; total: number };
  fallRisk: { latest: FallRiskAssessment | null; total: number };
  intakeOutput: { recent: IntakeOutputRecord[]; total: number };
  woundCare: { recent: WoundCareRecord[]; total: number };
  nursingNote: { latest: NursingNoteRecord | null; total: number };
}

// ──────────────────────────────────────────────────────────
// Query keys
// ──────────────────────────────────────────────────────────

export const nursingFormsKeys = {
  all: ['nursing-forms'] as const,
  list: (form: string, params?: Record<string, unknown>) =>
    ['nursing-forms', form, params] as const,
  summary: (patientId: string) => ['nursing-forms', 'summary', patientId] as const,
};

interface ListParams {
  patientId?: string;
  admissionId?: string;
  visitId?: string;
  page?: number;
  limit?: number;
}

// ──────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────

/**
 * A list hook for one form type.
 *
 * `slug` names the CACHE key and `path` the URL, because for two of these they
 * are no longer the same thing: wound care and nursing notes are served by the
 * progress-notes module, while every screen here still invalidates under the
 * 'nursing-forms' key. Keeping the key still means one invalidation continues
 * to refresh all of them.
 */
function makeListHook<T>(slug: string, path = `/nursing-forms/${slug}`) {
  return function useList(params?: ListParams, opts?: { enabled?: boolean }) {
    return useQuery({
      queryKey: nursingFormsKeys.list(slug, params as Record<string, unknown> | undefined),
      queryFn: async () => {
        const res = await apiGet<T[]>(path, { params });
        return res as ApiResponse<T[]>;
      },
      enabled: opts?.enabled ?? true,
    });
  };
}

export const useAdmissionAssessments = makeListHook<AdmissionAssessment>('admission-assessments');
export const usePainAssessments = makeListHook<PainAssessment>('pain-assessments');
export const useFallRiskAssessments = makeListHook<FallRiskAssessment>('fall-risks');
export const useIntakeOutputRecords = makeListHook<IntakeOutputRecord>('intake-output');
// Wound care and nursing notes live under progress-notes.
//
// Their routes were taken off the nursing-forms module in "update patient
// forms" (228f0a3) when the dynamic form system arrived, but these two were
// never dynamic forms — they are purpose-built records with their own tables,
// and the progress-notes module had been serving them all along. The hooks
// were left pointing at the old path, so the wound care panel could neither
// list nor save, and the DOCTOR's consultation page showed no nursing notes
// at all. All four were Express 404s that React Query rendered as "empty".
export const useWoundCareRecords = makeListHook<WoundCareRecord>(
  'wound-care',
  '/progress-notes/wound-care',
);
export const useNursingNotes = makeListHook<NursingNoteRecord>(
  'nursing-notes',
  '/progress-notes/nursing',
);

export function usePatientFormsSummary(patientId: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: nursingFormsKeys.summary(patientId ?? ''),
    queryFn: async () => {
      const res = await apiGet<PatientFormsSummary>(`/nursing-forms/summary/${patientId}`);
      return res;
    },
    enabled: !!patientId && (opts?.enabled ?? true),
  });
}

// ──────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────

function invalidateForPatient(qc: ReturnType<typeof useQueryClient>, patientId?: string) {
  qc.invalidateQueries({ queryKey: nursingFormsKeys.all });
  if (patientId) qc.invalidateQueries({ queryKey: nursingFormsKeys.summary(patientId) });
}

export interface CreateAdmissionAssessmentInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
  arrivalMode?: ArrivalMode;
  consciousnessLevel?: ConsciousnessLevel;
  chiefComplaint?: string;
  allergies?: string;
  currentMedications?: string;
  skinCondition?: string;
  mobility?: string;
  nutritionStatus?: string;
  elimination?: string;
  preferredLanguage?: string;
  religiousNeeds?: string;
  nextOfKin?: { name?: string; relationship?: string; phone?: string };
  notes?: string;
  assessedAt?: string;
}

export function useCreateAdmissionAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAdmissionAssessmentInput) => {
      const res = await apiPost<AdmissionAssessment>(
        '/nursing-forms/admission-assessments',
        data,
      );
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export interface CreatePainInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
  painScore: number;
  painScale?: PainScale;
  painLocation?: string;
  painCharacter?: string;
  painOnsetAt?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  intervention?: string;
  reassessmentDueAt?: string;
  notes?: string;
  assessedAt?: string;
}

export function useCreatePainAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePainInput) => {
      const res = await apiPost<PainAssessment>('/nursing-forms/pain-assessments', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export interface CreateFallRiskInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
  historyOfFalling: 0 | 25;
  secondaryDiagnosis: 0 | 15;
  ambulatoryAid: 0 | 15 | 30;
  ivOrSalineLock: 0 | 20;
  gait: 0 | 10 | 20;
  mentalStatus: 0 | 15;
  intervention?: string;
  notes?: string;
  assessedAt?: string;
}

export function useCreateFallRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFallRiskInput) => {
      const res = await apiPost<FallRiskAssessment>('/nursing-forms/fall-risks', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export interface CreateIntakeOutputInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
  recordDatetime: string;
  entryType: IOEntryType;
  category: IOCategory;
  volumeMl: number;
  fluidDescription?: string;
  ivLineId?: string;
  notes?: string;
}

export function useCreateIntakeOutput() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateIntakeOutputInput) => {
      const res = await apiPost<IntakeOutputRecord>('/nursing-forms/intake-output', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export interface CreateWoundCareInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
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
  assessedAt: string;
  nextAssessmentDue?: string;
  status?: WoundStatus;
}

export function useCreateWoundCare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateWoundCareInput) => {
      const res = await apiPost<WoundCareRecord>('/progress-notes/wound-care', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export interface CreateNursingNoteInput {
  visitId?: string;
  patientId: string;
  admissionId?: string;
  appointmentId?: string;
  noteType?: NursingNoteType;
  content: string;
  metadata?: Record<string, unknown>;
}

export function useCreateNursingNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateNursingNoteInput) => {
      const res = await apiPost<NursingNoteRecord>('/progress-notes/nursing', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

// ──────────────────────────────────────────────────────────
// Constants for UI dropdowns / labels
// ──────────────────────────────────────────────────────────

export const FORM_TYPE_LABELS: Record<string, string> = {
  admission_assessment: 'Admission Assessment',
  pain: 'Pain Assessment',
  fall_risk: 'Fall Risk (Morse)',
  intake_output: 'Intake / Output',
  wound_care: 'Wound Care',
  nursing_note: 'Nursing Daily Note',
};

export const FORM_TYPES: Array<{ key: string; label: string; description: string }> = [
  {
    key: 'admission_assessment',
    label: 'Admission Assessment',
    description: 'Initial nursing intake on admission/arrival.',
  },
  { key: 'pain', label: 'Pain Assessment', description: '0–10 score with location & intervention.' },
  { key: 'fall_risk', label: 'Fall Risk (Morse)', description: 'Morse Fall Scale screening.' },
  { key: 'intake_output', label: 'Intake / Output', description: 'Fluid balance entry.' },
  { key: 'wound_care', label: 'Wound Care', description: 'Wound assessment & dressing.' },
  { key: 'nursing_note', label: 'Nursing Daily Note', description: 'Free-text shift observation.' },
];

export const FALL_RISK_BAND_LABEL: Record<FallRiskLevel, string> = {
  low: 'Low (0–24)',
  moderate: 'Moderate (25–44)',
  high: 'High (≥ 45)',
};

// ──────────────────────────────────────────────────────────
// Clinical Charting — Observation, Device/Line, Procedure
// ──────────────────────────────────────────────────────────

export type AvpuLevel = 'alert' | 'voice' | 'pain' | 'unresponsive';
export type GeneralCondition = 'stable' | 'critical' | 'improving' | 'deteriorating';
export type MobilityLevel = 'bedridden' | 'assisted' | 'independent';

export type ClinicalDeviceType =
  | 'iv_cannula'
  | 'central_line'
  | 'urinary_catheter'
  | 'oxygen_device'
  | 'drain'
  | 'ng_tube'
  | 'other';
export type ClinicalDeviceStatus = 'active' | 'removed' | 'replaced';
export type DevicePatency = 'patent' | 'blocked';
export type DeviceSiteCondition = 'normal' | 'redness' | 'swelling' | 'infection' | 'leakage';
export type DeviceSecurement = 'secure' | 'loose';
export type DeviceFlowStatus = 'running' | 'stopped';
export type UrineFlow = 'adequate' | 'reduced' | 'none';
export type UrineColor = 'clear' | 'yellow' | 'amber' | 'dark' | 'bloody';
export type OxygenMode = 'nasal_cannula' | 'mask' | 'venturi' | 'rebreather' | 'high_flow' | 'none';

export type ProcedureStatus = 'successful' | 'failed' | 'partial';
export type ProcedureSide = 'left' | 'right' | 'midline';
export type ProcedureTolerance = 'well_tolerated' | 'poorly_tolerated';
export type ProcedureComplication = 'none' | 'bleeding' | 'pain' | 'infection_risk' | 'other';

export interface ClinicalObservation extends NurseRef {
  id: string;
  visitId: string;
  admissionId?: string | null;
  patientId: string;
  observedAt: string;
  painScore?: number | null;
  painLocation?: string | null;
  consciousnessAvpu?: AvpuLevel | null;
  generalCondition?: GeneralCondition | null;
  mobility?: MobilityLevel | null;
  fluidIntakeMl?: number | null;
  foodIntakeNotes?: string | null;
  urineOutputMl?: number | null;
  stoolPassed?: boolean | null;
  stoolCount?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ClinicalDeviceCheck extends NurseRef {
  id: string;
  deviceId: string;
  visitId: string;
  patientId: string;
  checkedAt: string;
  patency?: DevicePatency | null;
  siteCondition?: DeviceSiteCondition | null;
  painPresent?: boolean | null;
  securement?: DeviceSecurement | null;
  flowStatus?: DeviceFlowStatus | null;
  urineFlow?: UrineFlow | null;
  urineColor?: UrineColor | null;
  infectionSuspected?: boolean | null;
  dislodged?: boolean | null;
  blocked?: boolean | null;
  remarks?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ClinicalDevice {
  id: string;
  visitId: string;
  admissionId?: string | null;
  patientId: string;
  deviceType: ClinicalDeviceType;
  deviceSubtype?: string | null;
  site: string;
  insertionTime: string;
  insertedBy: string;
  inserter?: { id: string; firstName: string; lastName: string | null };
  removalTime?: string | null;
  removedBy?: string | null;
  remover?: { id: string; firstName: string; lastName: string | null } | null;
  status: ClinicalDeviceStatus;
  flowStatus?: DeviceFlowStatus | null;
  fluidType?: string | null;
  flowRateMlPerHr?: number | null;
  oxygenMode?: OxygenMode | null;
  oxygenFlowRate?: number | null;
  createdByProcedureId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  checks?: ClinicalDeviceCheck[];
}

export interface ClinicalProcedure extends NurseRef {
  id: string;
  visitId: string;
  admissionId?: string | null;
  patientId: string;
  procedureType: string;
  procedureSubtype?: string | null;
  performedAt: string;
  site?: string | null;
  side?: ProcedureSide | null;
  status: ProcedureStatus;
  attemptCount?: number | null;
  asepticTechnique?: boolean | null;
  equipmentUsed?: string | null;
  complications?: ProcedureComplication | null;
  complicationNotes?: string | null;
  tolerance?: ProcedureTolerance | null;
  painScore?: number | null;
  deviceCreated: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  devices?: { id: string; deviceType: ClinicalDeviceType; status: ClinicalDeviceStatus }[];
  createdAt: string;
}

export interface IntakeOutputTotals {
  totalIntake: number;
  totalOutput: number;
  balance: number;
  byCategory: Record<string, number>;
}

// ── Reads ────────────────────────────────────────────────

export const useClinicalObservations = makeListHook<ClinicalObservation>('observations');

export function useClinicalDevices(
  params?: ListParams & { status?: ClinicalDeviceStatus; deviceType?: ClinicalDeviceType },
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: nursingFormsKeys.list('devices', params as Record<string, unknown> | undefined),
    queryFn: async () => {
      const res = await apiGet<ClinicalDevice[]>('/nursing-forms/devices', { params });
      return res as ApiResponse<ClinicalDevice[]>;
    },
    enabled: opts?.enabled ?? true,
  });
}

export function useDeviceChecks(deviceId: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: nursingFormsKeys.list('device-checks', { deviceId }),
    queryFn: async () => {
      const res = await apiGet<ClinicalDeviceCheck[]>(`/nursing-forms/devices/${deviceId}/checks`);
      return res as ApiResponse<ClinicalDeviceCheck[]>;
    },
    enabled: !!deviceId && (opts?.enabled ?? true),
  });
}

export const useClinicalProcedures = makeListHook<ClinicalProcedure>('procedures');

export function useIntakeOutputTotals(
  params: { patientId: string; visitId?: string; admissionId?: string; fromDate?: string; toDate?: string },
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: nursingFormsKeys.list('intake-output-totals', params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<IntakeOutputTotals>('/nursing-forms/intake-output/totals', { params });
      return res;
    },
    enabled: !!params.patientId && (opts?.enabled ?? true),
  });
}

export function useChartingTimeline(patientId: string | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: nursingFormsKeys.list('timeline', { patientId }),
    queryFn: async () => {
      const res = await apiGet<Array<{ kind: string; at: string; payload: unknown }>>(
        `/nursing-forms/timeline/${patientId}`,
      );
      return res;
    },
    enabled: !!patientId && (opts?.enabled ?? true),
  });
}

// ── Mutations ────────────────────────────────────────────

export interface CreateObservationInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
  observedAt?: string;
  painScore?: number;
  painLocation?: string;
  consciousnessAvpu?: AvpuLevel;
  generalCondition?: GeneralCondition;
  mobility?: MobilityLevel;
  fluidIntakeMl?: number;
  foodIntakeNotes?: string;
  urineOutputMl?: number;
  stoolPassed?: boolean;
  stoolCount?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export function useCreateObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateObservationInput) => {
      const res = await apiPost<ClinicalObservation>('/nursing-forms/observations', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export interface CreateDeviceInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
  deviceType: ClinicalDeviceType;
  deviceSubtype?: string;
  site: string;
  insertionTime: string;
  flowStatus?: DeviceFlowStatus;
  fluidType?: string;
  flowRateMlPerHr?: number;
  oxygenMode?: OxygenMode;
  oxygenFlowRate?: number;
  createdByProcedureId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export function useCreateClinicalDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDeviceInput) => {
      const res = await apiPost<ClinicalDevice>('/nursing-forms/devices', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export function useRemoveClinicalDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      removalTime?: string;
      status?: 'removed' | 'replaced';
      notes?: string;
    }) => {
      const res = await apiPost<ClinicalDevice>(`/nursing-forms/devices/${id}/remove`, data);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: nursingFormsKeys.all }),
  });
}

export interface CreateDeviceCheckInput {
  deviceId: string;
  checkedAt?: string;
  patency?: DevicePatency;
  siteCondition?: DeviceSiteCondition;
  painPresent?: boolean;
  securement?: DeviceSecurement;
  flowStatus?: DeviceFlowStatus;
  urineFlow?: UrineFlow;
  urineColor?: UrineColor;
  infectionSuspected?: boolean;
  dislodged?: boolean;
  blocked?: boolean;
  remarks?: string;
  metadata?: Record<string, unknown>;
}

export function useCreateDeviceCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceId, ...data }: CreateDeviceCheckInput) => {
      const res = await apiPost<ClinicalDeviceCheck>(
        `/nursing-forms/devices/${deviceId}/checks`,
        data,
      );
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: nursingFormsKeys.all }),
  });
}

export interface CreateProcedureInput {
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  patientId: string;
  procedureType: string;
  procedureSubtype?: string;
  performedAt: string;
  site?: string;
  side?: ProcedureSide;
  status?: ProcedureStatus;
  attemptCount?: number;
  asepticTechnique?: boolean;
  equipmentUsed?: string;
  complications?: ProcedureComplication;
  complicationNotes?: string;
  tolerance?: ProcedureTolerance;
  painScore?: number;
  device?: {
    deviceType: ClinicalDeviceType;
    deviceSubtype?: string;
    site: string;
    flowStatus?: DeviceFlowStatus;
    fluidType?: string;
    flowRateMlPerHr?: number;
    oxygenMode?: OxygenMode;
    oxygenFlowRate?: number;
  };
  notes?: string;
  metadata?: Record<string, unknown>;
}

export function useCreateProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProcedureInput) => {
      const res = await apiPost<{ procedure: ClinicalProcedure; device: ClinicalDevice | null }>(
        '/nursing-forms/procedures',
        data,
      );
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

// ── Label maps for the UI ────────────────────────────────

export const CLINICAL_DEVICE_TYPE_LABELS: Record<ClinicalDeviceType, string> = {
  iv_cannula: 'IV Cannula',
  central_line: 'Central Line',
  urinary_catheter: 'Urinary Catheter',
  oxygen_device: 'Oxygen Device',
  drain: 'Drain',
  ng_tube: 'NG / PEG Tube',
  other: 'Other',
};

export const AVPU_LABELS: Record<AvpuLevel, string> = {
  alert: 'Alert',
  voice: 'Responds to Voice',
  pain: 'Responds to Pain',
  unresponsive: 'Unresponsive',
};

export const GENERAL_CONDITION_LABELS: Record<GeneralCondition, string> = {
  stable: 'Stable',
  critical: 'Critical',
  improving: 'Improving',
  deteriorating: 'Deteriorating',
};

export const MOBILITY_LABELS: Record<MobilityLevel, string> = {
  bedridden: 'Bedridden',
  assisted: 'Assisted',
  independent: 'Independent',
};

export const PROCEDURE_COMPLICATION_LABELS: Record<ProcedureComplication, string> = {
  none: 'None',
  bleeding: 'Bleeding',
  pain: 'Pain',
  infection_risk: 'Infection risk',
  other: 'Other',
};
