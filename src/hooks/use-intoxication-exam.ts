import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface IntoxicationExamRecord {
  id: string;
  tenantId: string;
  patientId: string;
  admissionId: string;
  visitId: string | null;

  // A) Clinical examination
  alcoholSmell: string | null;
  speech: string | null;
  pupilsConjunctiva: string | null;
  gaitBalance: string | null;
  rombergSign: string | null;
  fingerToNose: string | null;

  // B) Blood alcohol (mg/dL) — Decimal is serialized as string over JSON
  recordedBac: string | number | null;

  // C) Statutory certificate of opinion
  opinion: string | null;

  // D) Examining medical officer
  examinerName: string | null;
  examinerNmcNo: string | null;
  examinedAt: string | null;

  // E) Police IO witness
  witnessName: string | null;
  witnessBuckleNo: string | null;
  witnessPoliceStation: string | null;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddIntoxicationExamInput {
  patientId: string;
  admissionId: string;
  visitId?: string;

  alcoholSmell?: string;
  speech?: string;
  pupilsConjunctiva?: string;
  gaitBalance?: string;
  rombergSign?: string;
  fingerToNose?: string;

  recordedBac?: number;

  opinion?: string;

  examinerName?: string;
  examinerNmcNo?: string;
  examinedAt?: string;

  witnessName?: string;
  witnessBuckleNo?: string;
  witnessPoliceStation?: string;
}

export const intoxicationExamKeys = {
  all: ['intoxication-exam'] as const,
  list: (admissionId: string) => ['intoxication-exam', admissionId] as const,
};

export function useIntoxicationExams(admissionId: string | null) {
  return useQuery({
    queryKey: intoxicationExamKeys.list(admissionId ?? ''),
    queryFn: async () => {
      const res = await apiGet<IntoxicationExamRecord[]>('/intoxication-examination', {
        params: { admissionId },
      });
      return res.data;
    },
    enabled: !!admissionId,
  });
}

/** Create an intoxication exam (Form 39) for a patient's admission. */
export function useAddIntoxicationExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddIntoxicationExamInput) => {
      const res = await apiPost<IntoxicationExamRecord>('/intoxication-examination', data);
      return res.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: intoxicationExamKeys.list(created.admissionId) });
    },
  });
}
