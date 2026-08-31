import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

export interface Disorder {
  id: string;
  name: string;
  icdCode: string | null;
  category: string | null;
  isCustom: boolean;
  tenantId?: string | null;
  isActive?: boolean;
}

/** The picker on the clinician history panel and the patient's own portal. */
export function useDisorderSearch(query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: ['disorders', 'search', q],
    queryFn: async () => {
      const res = await apiGet<Disorder[]>('/disorders/search', { params: { q, limit: 20 } });
      return res.data;
    },
    enabled: enabled && q.length >= 1,
    staleTime: 60 * 1000,
  });
}

// ── Super-admin management ──────────────────────────────────────────────────

export interface DisorderListParams {
  q?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

export function useDisorderList(params?: DisorderListParams) {
  return useQuery({
    queryKey: ['disorders', 'list', params],
    queryFn: async () => {
      const res = await apiGet<Disorder[]>('/disorders', { params });
      return { data: res.data, meta: res.meta };
    },
  });
}

export function useCreateDisorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; icdCode?: string; category?: string }) => {
      const res = await apiPost<Disorder>('/disorders', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disorders'] }),
  });
}

export function useDeleteDisorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete(`/disorders/${id}`);
      return res.data as { removed: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disorders'] }),
  });
}

export function useRestoreDisorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPost<Disorder>(`/disorders/${id}/restore`, {});
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disorders'] }),
  });
}
