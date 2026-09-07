import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

// ============================================================
// The platform SAC master.
//
// In India the GST on a SERVICE is decided by its Service Accounting Code, the
// way an HSN decides it for goods. This is the platform-wide reference that
// turns a SAC into a rate — the twin of the HSN master beside it.
//
// Why it is platform data and not per hospital: 999311 is inpatient care in
// every hospital in the country. A per-hospital copy is how two hospitals end
// up filing the same service under two different codes, and neither of them
// finds out until a notice arrives.
// ============================================================

export type GstTreatment = 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'zero_rated';

export interface SacCode {
  id: string;
  sacCode: string;
  description: string | null;
  gstRate: number;
  treatment: GstTreatment;
  category: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SacCodeInput {
  sacCode: string;
  description?: string | null;
  gstRate: number;
  treatment?: GstTreatment;
  category?: string | null;
  isActive?: boolean;
}

const key = ['gst', 'sac-codes'] as const;

export function useSacCodes() {
  return useQuery({
    queryKey: key,
    queryFn: async () => (await apiGet<SacCode[]>('/gst/sac-codes')).data ?? [],
  });
}

export function useCreateSacCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SacCodeInput) => (await apiPost<SacCode>('/gst/sac-codes', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateSacCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: SacCodeInput & { id: string }) =>
      (await apiPatch<SacCode>(`/gst/sac-codes/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Deactivates rather than deletes — a bill line already carries the code. */
export function useDeactivateSacCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiDelete<SacCode>(`/gst/sac-codes/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
