// Gap 369: lab catalogue governance: range approval, price review, duplicates, import.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type { LabImportRow } from '@/lib/lab-catalog-import';

export type RangeStatus = 'signed_off' | 'not_signed_off' | 'no_range';
export type RangeFilter = 'all' | 'not_signed_off' | 'pending' | 'no_range';

export interface RangeSlot {
  key: string;
  name: string;
  inputType: 'number' | 'text' | 'select';
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  rangeText: string;
  liveHash: string;
  status: RangeStatus;
  signedOffBy: string | null;
  signedOffAt: string | null;
}

export interface RangeStatusRow {
  testId: string;
  testName: string;
  testCode: string | null;
  sampleType: string | null;
  signedOff: number;
  notSignedOff: number;
  noRange: number;
  pending: number;
  ranges: RangeSlot[];
}

export interface RangeStatusData {
  totals: {
    tests: number;
    signedOff: number;
    notSignedOff: number;
    noRange: number;
    pending: number;
    testsNotSignedOff: number;
  };
  tests: RangeStatusRow[];
}

export interface RangeProposal {
  id: string;
  testId: string;
  parameterKey: string;
  parameterName: string;
  source: 'ai' | 'manual';
  origin: string;
  status: 'pending' | 'approved' | 'rejected';
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  proposedText: string;
  rationale: string | null;
  warnings: string[] | null;
  aiModel: string | null;
  proposedById: string | null;
  proposedByName: string | null;
  proposedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  editedValues: { refLow: number | null; refHigh: number | null; refText: string | null } | null;
  previousLive: { refLow: number | null; refHigh: number | null; refText: string | null; unit: string | null } | null;
  appliedLive: { refLow: number | null; refHigh: number | null; refText: string | null; unit: string | null } | null;
}

export interface PendingProposal extends RangeProposal {
  test: { id: string; testName: string; testCode: string | null; sampleType: string | null };
  live: { unit: string | null; rangeText: string } | null;
  liveHash: string | null;
  stale: boolean;
  orphaned: boolean;
}

export interface RangeEdits {
  unit?: string | null;
  refLow?: number | null;
  refHigh?: number | null;
  refText?: string | null;
}

export interface PriceReviewRow {
  testId: string;
  testName: string;
  price: number;
  panelId: string;
  panelName: string;
  panelPrice: number;
  message: string;
  confirmed: boolean;
  confirmedReason: string | null;
  confirmedAt: string | null;
}

export interface CatalogueTestBrief {
  id: string;
  testName: string;
  testCode: string | null;
  sampleType: string | null;
  specimen: string | null;
  unit: string | null;
  price: string | number | null;
  isActive: boolean;
  ranges: { name: string; unit: string | null; rangeText: string }[];
}

export interface RetirePreview {
  retire: CatalogueTestBrief;
  keep: CatalogueTestBrief;
  differences: string[];
  references: {
    orderItems: number;
    openOrderItems: number;
    pendingRanges: number;
    needsAttention: { kind: string; label: string }[];
  };
}

export interface ImportPlan {
  key: string;
  rowNumbers: number[];
  action: 'create' | 'update';
  testId: string | null;
  stamp: string | null;
  testName: string;
  testCode: string | null;
  changes: string[];
  rangeChanges: string[];
  priceConflicts: { message: string }[];
  errors: string[];
  warnings: string[];
}

// Under ['lab', 'catalog'], not ['lab', 'tests']: the latter is cached for an
// hour as reference data, and an approval queue must not be.
const root = ['lab', 'catalog'] as const;

function useCatalogMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: root });
      qc.invalidateQueries({ queryKey: ['lab', 'tests'] });
    },
  });
}

export function useRangeStatus(enabled = true) {
  return useQuery({
    queryKey: [...root, 'range-status'],
    queryFn: async () => (await apiGet<RangeStatusData>('/lab/catalog/range-status')).data,
    enabled,
  });
}

export function usePendingRanges() {
  return useQuery({
    queryKey: [...root, 'pending'],
    queryFn: async () => (await apiGet<PendingProposal[]>('/lab/catalog/range-proposals')).data ?? [],
  });
}

export function useTestRanges(testId: string | null) {
  return useQuery({
    queryKey: [...root, 'ranges', testId],
    queryFn: async () =>
      (
        await apiGet<{ ranges: RangeSlot[]; history: RangeProposal[] }>(`/lab/catalog/tests/${testId}/ranges`)
      ).data,
    enabled: !!testId,
  });
}

export const useSuggestRange = () =>
  useCatalogMutation(async (v: { testId: string; parameterKey: string }) =>
    (await apiPost<RangeProposal>(`/lab/catalog/tests/${v.testId}/ranges/suggest`, { parameterKey: v.parameterKey })).data,
  );

export const useProposeRange = () =>
  useCatalogMutation(
    async ({ testId, ...body }: { testId: string; parameterKey: string; rationale?: string } & RangeEdits) =>
      (await apiPost<RangeProposal>(`/lab/catalog/tests/${testId}/ranges/propose`, body)).data,
  );

export const useConfirmRanges = () =>
  useCatalogMutation(
    async (v: { testId: string; items: { parameterKey: string; expectedLiveHash: string }[]; note?: string }) =>
      (await apiPost(`/lab/catalog/tests/${v.testId}/ranges/confirm`, { items: v.items, note: v.note })).data,
  );

export const useApproveRanges = () =>
  useCatalogMutation(
    async (items: { id: string; expectedLiveHash: string; edits?: RangeEdits; note?: string }[]) =>
      (await apiPost('/lab/catalog/range-proposals/approve', { items })).data,
  );

export const useRejectRange = () =>
  useCatalogMutation(
    async (v: { id: string; reason: string }) =>
      (await apiPost(`/lab/catalog/range-proposals/${v.id}/reject`, { reason: v.reason })).data,
  );

export function usePriceReview() {
  return useQuery({
    queryKey: [...root, 'price-review'],
    queryFn: async () => (await apiGet<PriceReviewRow[]>('/lab/catalog/price-review')).data ?? [],
  });
}

export function useDuplicateGroups() {
  return useQuery({
    queryKey: [...root, 'duplicates'],
    queryFn: async () =>
      (await apiGet<{ message: string; tests: CatalogueTestBrief[] }[]>('/lab/catalog/duplicates')).data ?? [],
  });
}

export function useRetirePreview(retireId: string | null, keepId: string | null) {
  return useQuery({
    queryKey: [...root, 'retire-preview', retireId, keepId],
    queryFn: async () =>
      (
        await apiGet<RetirePreview>(`/lab/catalog/tests/${retireId}/retire-preview`, {
          params: { keepTestId: keepId },
        })
      ).data,
    enabled: !!retireId && !!keepId && retireId !== keepId,
  });
}

export const useRetireTest = () =>
  useCatalogMutation(
    async (v: { retireId: string; keepTestId: string; reason?: string; confirmDifferences?: boolean }) =>
      (
        await apiPost(`/lab/catalog/tests/${v.retireId}/retire`, {
          keepTestId: v.keepTestId,
          reason: v.reason || undefined,
          confirmDifferences: v.confirmDifferences,
        })
      ).data,
  );

export const usePreviewLabImport = () =>
  useMutation({
    mutationFn: async (rows: LabImportRow[]) =>
      (
        await apiPost<{
          tests: ImportPlan[];
          summary: { rows: number; create: number; update: number; errors: number; needPriceReason: number };
        }>('/lab/catalog/import/preview', { rows })
      ).data,
  });

export const useCommitLabImport = () =>
  useCatalogMutation(
    async (v: {
      rows: LabImportRow[];
      confirmed: { key: string; action: 'create' | 'update'; testId: string | null; stamp: string | null; priceReason?: string }[];
    }) =>
      (
        await apiPost<{
          saved: number;
          failed: number;
          results: { key: string; testName: string; status: 'saved' | 'failed'; message: string; rangeProposals?: number }[];
        }>('/lab/catalog/import/commit', v)
      ).data,
  );

/** The machine-readable part of a refused save, when there is one. */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
}
