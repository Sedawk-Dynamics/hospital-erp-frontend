import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface IcdCode {
  id: string;
  code: string;
  title: string;
  category: string | null;
  chapter: string | null;
  isBillable: boolean;
  isCustom: boolean;
  isActive?: boolean;
  tenantId?: string | null;
}

/** Diagnosis autocomplete — searches the shared catalog + tenant custom codes. */
export function useIcdSearch(query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: ['icd', 'search', q],
    queryFn: async () => {
      const res = await apiGet<IcdCode[]>('/icd/search', { params: { q, limit: 20 } });
      return res.data;
    },
    enabled: enabled && q.length >= 1,
    staleTime: 60 * 1000,
  });
}

// ============================================================
// Super-admin catalog management
// ============================================================

export interface IcdListParams {
  q?: string;
  category?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

export function useIcdList(params?: IcdListParams) {
  return useQuery({
    queryKey: ['icd', 'list', params],
    queryFn: async () => {
      const res = await apiGet<IcdCode[]>('/icd', { params });
      return { data: res.data, meta: res.meta };
    },
  });
}

export interface IcdCodeInput {
  code: string;
  title: string;
  category?: string;
  chapter?: string;
  isBillable?: boolean;
  keywords?: string[];
}

export function useCreateIcd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: IcdCodeInput) => {
      const res = await apiPost<IcdCode>('/icd', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icd'] }),
  });
}

export function useUpdateIcd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: IcdCodeInput & { id: string; isActive?: boolean }) => {
      const res = await apiPut<IcdCode>(`/icd/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icd'] }),
  });
}

export function useDeleteIcd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete(`/icd/${id}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icd'] }),
  });
}

/** Hospital admin adds a tenant-scoped custom code. */
export function useCreateCustomIcd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: IcdCodeInput) => {
      const res = await apiPost<IcdCode>('/icd/custom', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['icd'] }),
  });
}
