import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export type FastTrackCode =
  | 'code_red_trauma'
  | 'code_stemi'
  | 'code_stroke'
  | 'code_sepsis'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'black';

export interface FastTrackCodeRecord {
  id: string;
  tenantId: string;
  patientId: string;
  admissionId: string;
  visitId: string | null;
  code: FastTrackCode;
  details: Record<string, unknown>;
  activatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddFastTrackCodeInput {
  patientId: string;
  admissionId: string;
  visitId?: string;
  code: FastTrackCode;
  details: Record<string, unknown>;
}

export const fastTrackKeys = {
  all: ['fast-track-codes'] as const,
  list: (admissionId: string) => ['fast-track-codes', admissionId] as const,
};


export function useFastTrackCodes(admissionId: string | null) {
  return useQuery({
    queryKey: fastTrackKeys.list(admissionId ?? ''),
    queryFn: async () => {
      const res = await apiGet<FastTrackCodeRecord[]>('/fast-track-codes', {
        params: { admissionId },
      });
      return res.data;
    },
    enabled: !!admissionId,
  });
}

export function useAddFastTrackCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddFastTrackCodeInput) => {
      const res = await apiPost<FastTrackCodeRecord>('/fast-track-codes', data);
      return res.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: fastTrackKeys.list(created.admissionId) });
    },
  });
}


