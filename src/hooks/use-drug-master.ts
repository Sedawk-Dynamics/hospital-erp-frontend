import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiClient } from '@/lib/api';
import type { DosageForm } from './use-pharmacy';

// ============================================================
// Platform-wide Indian drug catalog (DrugMaster). Super-admin
// authors it; any clinical/pharmacy user searches it. Hospitals
// import entries into their per-tenant formulary.
// ============================================================

export interface DrugMaster {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  type: string | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  packSizeLabel: string | null;
  mrp: number | string | null;
  isDiscontinued: boolean;
  schedule: string | null;
  aliases: string[];
  tags: string[];
  isPublished: boolean;
  // Rich clinical detail
  saltComposition?: string | null;
  description?: string | null;
  sideEffects?: string | null;
  drugInteractions?: { drug?: string[]; brand?: string[]; effect?: string[] } | null;
  // NPPA / DPCO price control (official reference; never affects hospital price)
  isScheduled?: boolean;
  ceilingPrice?: number | string | null;
  ceilingUnit?: string | null;
  nppaNotification?: string | null;
  ceilingEffectiveDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const drugMasterKeys = {
  all: ['drug-master'] as const,
  search: (q: string) => ['drug-master', 'search', q] as const,
  list: (params?: Record<string, unknown>) => ['drug-master', 'list', params] as const,
};

// Lightweight search result (subset returned by /drug-master/search).
export interface DrugMasterSearchResult {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  packSizeLabel: string | null;
  mrp: number | string | null;
  type: string | null;
  schedule: string | null;
}

export function useDrugMasterSearch(query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: drugMasterKeys.search(q),
    queryFn: async () => {
      const response = await apiGet<DrugMasterSearchResult[]>('/drug-master/search', {
        params: { q },
      });
      return response.data ?? [];
    },
    enabled: enabled && q.length >= 2,
  });
}

export interface DrugMasterListParams {
  page?: number;
  limit?: number;
  search?: string;
  isPublished?: boolean;
  includeDiscontinued?: boolean;
}

export function useDrugMasterList(params?: DrugMasterListParams) {
  return useQuery({
    queryKey: drugMasterKeys.list(params as Record<string, unknown> | undefined),
    queryFn: async () => {
      const response = await apiGet<DrugMaster[]>('/drug-master', { params });
      return { data: response.data ?? [], meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export interface DrugMasterInput {
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  type?: string | null;
  dosageForm?: DosageForm | null;
  strength?: string | null;
  packSizeLabel?: string | null;
  mrp?: number | null;
  isDiscontinued?: boolean;
  schedule?: string | null;
  aliases?: string[];
  tags?: string[];
  isPublished?: boolean;
}

export function useCreateDrugMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: DrugMasterInput) => {
      const response = await apiPost<DrugMaster>('/drug-master', data);
      return response.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: drugMasterKeys.all }),
  });
}

export function useUpdateDrugMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<DrugMasterInput>) => {
      const response = await apiPut<DrugMaster>(`/drug-master/${id}`, data);
      return response.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: drugMasterKeys.all }),
  });
}

export function useDeleteDrugMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete<{ id: string }>(`/drug-master/${id}`);
      return response.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: drugMasterKeys.all }),
  });
}

// ============================================================
// Catalog refresh (super-admin). Upserts the catalog against a CSV snapshot —
// preserves ids + hospital import links, only moves mrp/discontinued/comp.
// ============================================================

export interface RefreshSummary {
  existingBefore: number;
  incoming: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface RefreshState {
  status: 'idle' | 'running' | 'success' | 'error';
  startedAt: string | null;
  finishedAt: string | null;
  source: string | null;
  result: RefreshSummary | null;
  error: string | null;
}

export function useRefreshStatus(enabled = true) {
  return useQuery({
    queryKey: ['drug-master', 'refresh-status'],
    queryFn: async () => {
      const response = await apiGet<RefreshState>('/drug-master/refresh/status');
      return response.data as RefreshState;
    },
    enabled,
    // Poll while a refresh is running.
    refetchInterval: (query) =>
      (query.state.data as RefreshState | undefined)?.status === 'running' ? 2000 : false,
  });
}

export interface DrugProviderInfo {
  name: string;
  label: string;
  description: string;
  configured: boolean;
}

export function useDrugProviders(enabled = true) {
  return useQuery({
    queryKey: ['drug-master', 'providers'],
    queryFn: async () => {
      const response = await apiGet<DrugProviderInfo[]>('/drug-master/providers');
      return response.data ?? [];
    },
    enabled,
  });
}

export function useStartRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file?: File; url?: string; provider?: string }) => {
      if (input.file) {
        const fd = new FormData();
        fd.append('file', input.file);
        // Let the browser set the multipart boundary by clearing the default
        // application/json content-type.
        const res = await apiClient.post('/drug-master/refresh', fd, {
          headers: { 'Content-Type': undefined },
        });
        return res.data?.data as RefreshState;
      }
      const response = await apiPost<RefreshState>('/drug-master/refresh', {
        url: input.url || undefined,
        provider: input.provider || undefined,
      });
      return response.data as RefreshState;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drug-master', 'refresh-status'] });
      qc.invalidateQueries({ queryKey: drugMasterKeys.all });
    },
  });
}

// ============================================================
// NPPA / DPCO official ceiling-price import (super-admin)
// ============================================================

export interface NppaSummary {
  rows: number;
  ceilingsUpserted: number;
  drugsMatched: number;
  ceilingsUnmatched: number;
}

export interface NppaState {
  status: 'idle' | 'running' | 'success' | 'error';
  startedAt: string | null;
  finishedAt: string | null;
  source: string | null;
  result: NppaSummary | null;
  error: string | null;
}

export function useNppaStatus(enabled = true) {
  return useQuery({
    queryKey: ['drug-master', 'nppa-status'],
    queryFn: async () => {
      const response = await apiGet<NppaState>('/drug-master/nppa/status');
      return response.data as NppaState;
    },
    enabled,
    refetchInterval: (query) =>
      (query.state.data as NppaState | undefined)?.status === 'running' ? 2000 : false,
  });
}

export function useImportNppa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/drug-master/nppa/import', fd, {
        headers: { 'Content-Type': undefined },
      });
      return res.data?.data as NppaState;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drug-master', 'nppa-status'] });
      qc.invalidateQueries({ queryKey: drugMasterKeys.all });
    },
  });
}
