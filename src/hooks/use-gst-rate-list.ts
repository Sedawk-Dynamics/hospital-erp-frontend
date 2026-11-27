import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type { RateListInputRow } from '@/lib/gst-rate-list';

// #262 — medicines on a retired GST rate, and the rate-list import.

/** Mirrors the server's GST_RATE_EDIT_ROLES. */
export const GST_RATE_EDIT_ROLES = ['super_admin', 'admin', 'pharmacy_admin', 'inventory_manager', 'billing_admin'];

export interface RetiredRateMedicine {
  drugId: string;
  drugName: string;
  strength: string | null;
  manufacturer: string | null;
  hsnCode: string | null;
  ratePercent: number;
  source: 'item_master' | 'hsn_master' | 'category_default';
  sourceLabel: string;
  fixedBy: string;
  reason: string;
  stockOnHand: number;
  stockText: string;
  isActive: boolean;
}

export interface RetiredRateList {
  asOf: string;
  allowedRates: number[];
  allowed: string;
  slabsConfigured: boolean;
  items: RetiredRateMedicine[];
  total: number;
  inStock: number;
}

export type RateListStatus = 'ready' | 'unchanged' | 'not_due' | 'unmatched' | 'error';

export interface RateListChange {
  drugId: string;
  drugName: string;
  strength: string | null;
  hsnCode: string | null;
  currentRate: number | null;
  currentTreatment: string | null;
  currentSourceLabel: string;
  newRate: number;
  newTreatment: string | null;
  stockText: string;
}

export interface RateListPreviewRow {
  rowNumber: number;
  drugCode: string | null;
  drugName: string | null;
  hsnCode: string | null;
  gstPercent: string | null;
  effectiveFrom: string | null;
  status: RateListStatus;
  message: string;
  matchedBy: 'code' | 'name' | 'hsn' | null;
  changes: RateListChange[];
}

export interface RateListPreview {
  today: string;
  allowed: string;
  rows: RateListPreviewRow[];
  summary: {
    total: number; ready: number; medicines: number; unchanged: number; notDue: number; unmatched: number; errors: number;
  };
  notCovered: Array<{ drugId: string; drugName: string; hsnCode: string | null; ratePercent: number }>;
  effectiveDateNote: string;
}

export interface ApplyRateListRow {
  drugId: string;
  gstPercent: number;
  expectedRate: number | null;
  effectiveFrom?: string | null;
  rowNumber?: number | null;
}

export interface ApplyRateListResult {
  applied: Array<{ drugId: string; drugName: string; from: number | null; to: number }>;
  skipped: Array<{ drugId: string; drugName: string | null; rowNumber: number | null; reason: string }>;
  appliedCount: number;
  skippedCount: number;
}

const key = ['pharmacy', 'gst-rates', 'retired'] as const;

export function useRetiredGstRates(enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: async () => (await apiGet<RetiredRateList>('/pharmacy/gst-rates/retired')).data,
    enabled,
  });
}

export function usePreviewGstRateList() {
  return useMutation({
    mutationFn: async (rows: RateListInputRow[]) =>
      (await apiPost<RateListPreview>('/pharmacy/gst-rates/preview', { rows })).data,
  });
}

export function useApplyGstRateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { reason: string; rows: ApplyRateListRow[] }) =>
      (await apiPost<ApplyRateListResult>('/pharmacy/gst-rates/apply', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy'] });
    },
  });
}
