import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// ============================================================
// IP Medication Indents — ward→pharmacy fulfilment lifecycle (design doc I).
// raise → approve (credit-gated) → dispense (posts to IP bill) → deliver →
// acknowledge (ward nurse verifies the batch).
// ============================================================

export type IndentStatus = 'draft' | 'raised' | 'approved' | 'dispensed' | 'delivered' | 'acknowledged' | 'cancelled';

export interface MedicationIndentItem {
  id: string;
  indentId: string;
  drugFormularyId: string;
  requestedQty: number;
  approvedQty?: number | null;
  saleUnit: 'pack' | 'loose' | string;
  dispensedBatchId?: string | null;
  dispensedQty?: number | null;
  dispensingRecordId?: string | null;
  returnedQty?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  acknowledged: boolean;
  notes?: string | null;
  drugName?: string;
  looseUnitLabel?: string | null;
  isLifeSaving?: boolean;
}

export interface MedicationIndent {
  id: string;
  indentNumber: string;
  patientId: string;
  patientName?: string | null;
  patientMrn?: string | null;
  admissionId?: string | null;
  wardId?: string | null;
  prescriptionId?: string | null;
  status: IndentStatus | string;
  creditStatus: 'ok' | 'clearance_required' | 'cleared' | string;
  isTto: boolean;
  priority?: string | null;
  notes?: string | null;
  billId?: string | null;
  raisedById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  dispensedById?: string | null;
  dispensedAt?: string | null;
  deliveredAt?: string | null;
  acknowledgedById?: string | null;
  acknowledgedAt?: string | null;
  cancelledReason?: string | null;
  items: MedicationIndentItem[];
  createdAt: string;
  updatedAt: string;
}

interface ListWrap<T> { items: T[]; total: number }

export const indentKeys = {
  all: ['indents'] as const,
  list: (params?: any) => ['indents', 'list', params] as const,
  detail: (id: string) => ['indents', 'detail', id] as const,
};

export function useIndents(params?: { status?: string; patientId?: string; wardId?: string; isTto?: boolean }) {
  return useQuery({
    queryKey: indentKeys.list(params),
    queryFn: async () => {
      const res = await apiGet<ListWrap<MedicationIndent>>('/indents', { params });
      return res.data;
    },
  });
}

export function useIndent(id: string | null) {
  return useQuery({
    queryKey: indentKeys.detail(id ?? ''),
    queryFn: async () => (await apiGet<MedicationIndent>(`/indents/${id}`)).data,
    enabled: !!id,
  });
}

export interface RaiseIndentInput {
  patientId: string;
  admissionId?: string;
  wardId?: string;
  prescriptionId?: string;
  isTto?: boolean;
  priority?: string;
  notes?: string;
  items: Array<{ drugFormularyId: string; requestedQty: number; saleUnit?: 'pack' | 'loose'; notes?: string }>;
}

export function useRaiseIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RaiseIndentInput) => (await apiPost<MedicationIndent>('/indents', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

// Confirm an auto-created DRAFT indent (from the doctor's Rx) → raise it to pharmacy.
// Optionally replace the item lines with the nurse's edits.
export function useConfirmIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, items, priority, notes }: { id: string; items?: RaiseIndentInput['items']; priority?: string; notes?: string }) =>
      (await apiPatch<MedicationIndent>(`/indents/${id}/confirm`, { items, priority, notes })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

// TTO / discharge meds: raise a full-pack TTO indent from a discharge prescription.
export function useCreateTtoIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prescriptionId: string) =>
      (await apiPost<MedicationIndent>(`/indents/from-prescription/${prescriptionId}/tto`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

export function useApproveIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approvals, override }: { id: string; approvals?: Array<{ itemId: string; approvedQty: number }>; override?: boolean }) =>
      (await apiPatch<MedicationIndent>(`/indents/${id}/approve`, { approvals, override })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

export function useDispenseIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, batches }: { id: string; batches?: Array<{ itemId: string; drugBatchId: string }> }) =>
      (await apiPatch<MedicationIndent>(`/indents/${id}/dispense`, { batches })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

export function useReturnIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, items, reason }: { id: string; items: Array<{ itemId: string; returnQty: number }>; reason?: string }) =>
      (await apiPost<MedicationIndent>(`/indents/${id}/return`, { items, reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

export function useDeliverIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiPatch<MedicationIndent>(`/indents/${id}/deliver`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

export function useAcknowledgeIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, itemIds }: { id: string; itemIds?: string[] }) =>
      (await apiPatch<MedicationIndent>(`/indents/${id}/acknowledge`, { itemIds })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}

export function useCancelIndent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await apiPatch<MedicationIndent>(`/indents/${id}/cancel`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: indentKeys.all }),
  });
}
