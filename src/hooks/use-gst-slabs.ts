import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

// ============================================================
// The GST slab master — the rates the law recognises, and the window each was
// legal in.
//
// Platform data. A slab is not a hospital's opinion, it is what Parliament
// enacted, so the same list binds every hospital and only super admin edits it.
// Read is open to everyone: a hospital admin classifying an item has to be able
// to see what the legal rates are, and every refusal message names them anyway.
//
// Date-ranged, because the answer changed on 22 September 2025 when the 56th
// GST Council retired 12% and 28% and brought in 40%. A retired slab is CLOSED
// with an end date rather than deleted — a bill raised while it was legal has
// to stay explainable, and every rate check is made as at the document's own
// date.
// ============================================================

export interface GstSlab {
  id: string;
  ratePercent: number;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  isActive: boolean;
  /** In force today — what a bill raised now may be charged at. */
  current: boolean;
}

const key = ['gst-slabs'] as const;

export function useGstSlabs() {
  return useQuery({
    queryKey: key,
    queryFn: async () =>
      (await apiGet<{ slabs: GstSlab[]; note: string }>('/gst/slabs')).data,
  });
}

export function useCreateGstSlab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      ratePercent: number;
      label: string;
      effectiveFrom: string;
      effectiveTo?: string | null;
      note?: string | null;
    }) => (await apiPost('/gst/slabs', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateGstSlab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      label?: string;
      effectiveTo?: string | null;
      note?: string | null;
      isActive?: boolean;
    }) => (await apiPatch(`/gst/slabs/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
