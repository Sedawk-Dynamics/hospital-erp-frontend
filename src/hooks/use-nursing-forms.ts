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

function makeListHook<T>(slug: string) {
  return function useList(params?: ListParams, opts?: { enabled?: boolean }) {
    return useQuery({
      queryKey: nursingFormsKeys.list(slug, params as Record<string, unknown> | undefined),
      queryFn: async () => {
        const res = await apiGet<T[]>(`/nursing-forms/${slug}`, { params });
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
export const useWoundCareRecords = makeListHook<WoundCareRecord>('wound-care');
export const useNursingNotes = makeListHook<NursingNoteRecord>('nursing-notes');

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
      const res = await apiPost<WoundCareRecord>('/nursing-forms/wound-care', data);
      return res;
    },
    onSuccess: (_d, vars) => invalidateForPatient(qc, vars.patientId),
  });
}

export interface CreateNursingNoteInput {
  visitId?: string;
  patientId: string;
  admissionId?: string;
  noteType?: NursingNoteType;
  content: string;
  metadata?: Record<string, unknown>;
}

export function useCreateNursingNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateNursingNoteInput) => {
      const res = await apiPost<NursingNoteRecord>('/nursing-forms/nursing-notes', data);
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
