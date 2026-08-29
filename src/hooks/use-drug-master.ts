import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DrugSchedule } from './use-pharmacy';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiClient } from '@/lib/api';
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
  // The hand-typed legacy field. Left NULL platform-wide on purpose: the old
  // counter compliance check reads it, so filling it would switch enforcement
  // on as a side effect. Use scheduleResolved below for what the drug IS.
  schedule: string | null;
  // ── Resolved by the schedule classifier from the composition ──
  scheduleResolved?: DrugSchedule | null;
  /** Why — e.g. "Schedule H1 — matched Tramadol." */
  scheduleReason?: string | null;
  /** NDPS overlay, independent of the schedule. */
  controlledClass?: 'narcotic' | 'psychotropic' | null;
  vaultControlled?: boolean;
  requiresQrScan?: boolean;
  // Product Resolution Engine / compliance identity.
  gtin?: string | null;
  casePackGtin?: string | null;
  unitsPerCase?: number | null;
  manufacturerCode?: string | null;
  hsnCode?: string | null;
  gstRate?: number | string | null;
  aliases: string[];
  tags: string[];
  isPublished: boolean;
  // Rich clinical detail
  saltComposition?: string | null;
  description?: string | null;
  sideEffects?: string | null;
  drugInteractions?: { drug?: string[]; brand?: string[]; effect?: string[] } | null;
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
  packSize: number | null;
  hsnCode: string | null;
  gtin: string | null;
  mrp: number | string | null;
  type: string | null;
  schedule: string | null;
}

// ============================================================
// HSN → GST tax reference. In India the GST rate is decided by an item's HSN
// code; the stock-inward UI caches this reference once and auto-fills GST from
// the entered HSN locally (no round trip per keystroke).
// ============================================================

export interface HsnGstRate {
  id: string;
  hsnCode: string;
  description: string | null;
  gstRate: number;
  category: string | null;
  // Present on the super-admin list (`/hsn/all`); absent on the cached public list.
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useHsnGstRates(enabled = true) {
  return useQuery({
    queryKey: ['drug-master', 'hsn-gst'],
    queryFn: async () => {
      const response = await apiGet<HsnGstRate[]>('/drug-master/hsn');
      return response.data ?? [];
    },
    enabled,
    // Platform reference data — rarely changes; cache generously.
    staleTime: 60 * 60 * 1000,
  });
}

// ── Super-admin management of the HSN → GST reference ──

export interface HsnGstRateInput {
  hsnCode: string;
  description?: string | null;
  gstRate: number;
  category?: string | null;
  isActive?: boolean;
}

const hsnGstKeys = {
  all: ['drug-master', 'hsn-gst'] as const,
  admin: ['drug-master', 'hsn-gst', 'all'] as const,
};

export function useHsnGstRatesAdmin(enabled = true) {
  return useQuery({
    queryKey: hsnGstKeys.admin,
    queryFn: async () => {
      const response = await apiGet<HsnGstRate[]>('/drug-master/hsn/all');
      return response.data ?? [];
    },
    enabled,
  });
}

function invalidateHsn(qc: ReturnType<typeof useQueryClient>) {
  // Refresh both the admin table and the cached public reference used at inward.
  qc.invalidateQueries({ queryKey: hsnGstKeys.all });
}

export function useCreateHsnGstRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: HsnGstRateInput) => {
      const response = await apiPost<HsnGstRate>('/drug-master/hsn', data);
      return response.data;
    },
    onSuccess: () => invalidateHsn(qc),
  });
}

export interface BulkHsnGstResult {
  created: number;
  updated: number;
  skipped: Array<{ hsnCode: string; reason: string }>;
}

export function useBulkHsnGstRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: HsnGstRateInput[]) => {
      const response = await apiPost<BulkHsnGstResult>('/drug-master/hsn/bulk', { rows });
      return response.data;
    },
    onSuccess: () => invalidateHsn(qc),
  });
}

export function useUpdateHsnGstRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<HsnGstRateInput>) => {
      const response = await apiPut<HsnGstRate>(`/drug-master/hsn/${id}`, data);
      return response.data;
    },
    onSuccess: () => invalidateHsn(qc),
  });
}

export function useDeleteHsnGstRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete<{ id: string }>(`/drug-master/hsn/${id}`);
      return response.data;
    },
    onSuccess: () => invalidateHsn(qc),
  });
}

/**
 * Longest-prefix match against the HSN → GST reference: an 8-digit tariff item
 * (e.g. ORS 30049010 → nil) wins over its 4-digit chapter heading (3004 → 5%).
 * Mirrors the backend matcher so client and server agree. Returns null when no
 * seeded row is a prefix of the input.
 */
export function matchHsnGstRate(code: string | null | undefined, rows: HsnGstRate[]): HsnGstRate | null {
  const input = (code ?? '').replace(/\D/g, '');
  if (!input || !rows.length) return null;
  let best: HsnGstRate | null = null;
  for (const r of rows) {
    if (input === r.hsnCode || input.startsWith(r.hsnCode)) {
      if (!best || r.hsnCode.length > best.hsnCode.length) best = r;
    }
  }
  return best;
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
  /** Filter on the classifier's answer, not the legacy column. */
  schedule?: DrugSchedule;
  /** Drugs the NDPS list names, whatever their schedule. */
  controlled?: boolean;
  /** Schedule H2 formulations, whose packs must be QR-scanned at sale. */
  qrTracked?: boolean;
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

/** One molecule of a structured composition. */
export interface SaltInput {
  name: string;
  strengthValue?: number | null;
  strengthUnit?: string | null;
  perVolumeValue?: number | null;
  perVolumeUnit?: string | null;
}

export interface DrugMasterInput {
  name: string;
  genericName?: string | null;
  saltComposition?: string | null;
  /**
   * The composition as DATA. Authoritative when sent: the server writes the
   * salt links from it with no parsing, and renders saltComposition from it.
   * Omit to keep the old text-only behaviour.
   */
  salts?: SaltInput[];
  manufacturer?: string | null;
  type?: string | null;
  dosageForm?: DosageForm | null;
  strength?: string | null;
  packSizeLabel?: string | null;
  mrp?: number | null;
  isDiscontinued?: boolean;
  schedule?: string | null;
  gtin?: string | null;
  casePackGtin?: string | null;
  unitsPerCase?: number | null;
  manufacturerCode?: string | null;
  hsnCode?: string | null;
  gstRate?: number | null;
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

// ── Salt review queue ──────────────────────────────────────────────────────
// A molecule no published schedule names is stored UNDECIDED rather than
// over-the-counter, so it appears here as work instead of quietly reading as
// safe. Ranked by product count, because that is the order in which the
// decisions matter.

export interface Salt {
  id: string;
  name: string;
  norm: string;
  scheduleCode: DrugSchedule | null;
  controlledClass: 'narcotic' | 'psychotropic' | null;
  vaultControlled: boolean;
  source: 'cdsco' | 'class' | 'ndps' | 'manual' | null;
  scheduleNote: string | null;
  reviewedAt: string | null;
  productCount: number;
  synonyms: string[];
  classes: string[];
}

export interface SaltReviewSummary {
  undecided: number;
  decided: number;
  manual: number;
  /** Catalog products containing at least one undecided molecule. */
  productsAffected: number;
}

export interface SaltListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'undecided' | 'decided' | 'all';
  schedule?: DrugSchedule;
  controlled?: boolean;
}

export const saltKeys = {
  all: ['salts'] as const,
  list: (p?: Record<string, unknown>) => ['salts', 'list', p ?? {}] as const,
  summary: () => ['salts', 'summary'] as const,
};

export function useSalts(params?: SaltListParams) {
  return useQuery({
    queryKey: saltKeys.list(params as Record<string, unknown> | undefined),
    queryFn: async () => {
      const response = await apiGet<Salt[]>('/drug-master/salts', { params });
      return { data: response.data ?? [], meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useSaltReviewSummary() {
  return useQuery({
    queryKey: saltKeys.summary(),
    queryFn: async () => (await apiGet<SaltReviewSummary>('/drug-master/salts/summary')).data,
  });
}

export interface SaltDecision {
  scheduleCode: DrugSchedule | null;
  controlledClass?: 'narcotic' | 'psychotropic' | null;
  vaultControlled?: boolean;
  note?: string | null;
}

export function useDecideSalt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SaltDecision }) =>
      (await apiPatch<Salt>(`/drug-master/salts/${id}`, data)).data,
    onSuccess: () => {
      // The decision re-classifies every product containing the molecule, so
      // the catalog list is stale too, not just the queue.
      qc.invalidateQueries({ queryKey: saltKeys.all });
      qc.invalidateQueries({ queryKey: drugMasterKeys.all });
    },
  });
}
