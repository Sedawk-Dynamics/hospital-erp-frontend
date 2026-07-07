import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// OT Kit — surgical preference-card templates + issue-bulk / reconcile-net
// virtual OT ledger (design doc III).
// ============================================================

export interface SurgicalTemplateItem {
  id: string;
  templateId: string;
  drugFormularyId: string;
  defaultQuantity: number;
  notes?: string | null;
  drugName?: string;
  genericName?: string | null;
  looseUnitLabel?: string | null;
}

export interface SurgicalTemplate {
  id: string;
  name: string;
  procedureName?: string | null;
  doctorId?: string | null;
  kitBarcode?: string | null;
  notes?: string | null;
  isActive: boolean;
  items: SurgicalTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OtKitIssueItem {
  id: string;
  issueId: string;
  drugFormularyId: string;
  drugBatchId?: string | null;
  issuedQty: number;
  returnedQty: number;
  consumedQty?: number | null;
  unitPrice?: number | null;
  taxPercent?: number | null;
  lineTotal?: number | null;
  drugName?: string;
  looseUnitLabel?: string | null;
}

export interface OtKitIssue {
  id: string;
  issueNumber: string;
  otRequestId?: string | null;
  patientId: string;
  patientName?: string | null;
  patientMrn?: string | null;
  visitId?: string | null;
  templateId?: string | null;
  status: 'requested' | 'issued' | 'reconciled' | 'cancelled' | string;
  requestedById?: string | null;
  issuedById?: string | null;
  issuedAt?: string | null;
  reconciledById?: string | null;
  reconciledAt?: string | null;
  billId?: string | null;
  notes?: string | null;
  items: OtKitIssueItem[];
  createdAt: string;
  updatedAt: string;
}

interface ListWrap<T> { items: T[]; total: number }

export const otKitKeys = {
  all: ['ot-kit'] as const,
  templates: (params?: any) => ['ot-kit', 'templates', params] as const,
  template: (id: string) => ['ot-kit', 'template', id] as const,
  issues: (params?: any) => ['ot-kit', 'issues', params] as const,
  issue: (id: string) => ['ot-kit', 'issue', id] as const,
};

// --- Templates ---
export function useSurgicalTemplates(params?: { search?: string; doctorId?: string; includeInactive?: boolean }) {
  return useQuery({
    queryKey: otKitKeys.templates(params),
    queryFn: async () => {
      const res = await apiGet<ListWrap<SurgicalTemplate>>('/ot-kit/templates', { params });
      return res.data;
    },
  });
}

export interface TemplateInput {
  name: string;
  procedureName?: string;
  doctorId?: string;
  kitBarcode?: string;
  notes?: string;
  items: Array<{ drugFormularyId: string; defaultQuantity: number; notes?: string }>;
}

export function useCreateSurgicalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: TemplateInput) => (await apiPost<SurgicalTemplate>('/ot-kit/templates', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: otKitKeys.all }),
  });
}

export function useUpdateSurgicalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TemplateInput>) =>
      (await apiPut<SurgicalTemplate>(`/ot-kit/templates/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: otKitKeys.all }),
  });
}

export function useDeleteSurgicalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiDelete(`/ot-kit/templates/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: otKitKeys.all }),
  });
}

// --- Kit issue lifecycle ---
export function useOtKitIssues(params?: { status?: string; patientId?: string; otRequestId?: string }) {
  return useQuery({
    queryKey: otKitKeys.issues(params),
    queryFn: async () => {
      const res = await apiGet<ListWrap<OtKitIssue>>('/ot-kit/issues', { params });
      return res.data;
    },
  });
}

export function useOtKitIssue(id: string | null) {
  return useQuery({
    queryKey: otKitKeys.issue(id ?? ''),
    queryFn: async () => (await apiGet<OtKitIssue>(`/ot-kit/issues/${id}`)).data,
    enabled: !!id,
  });
}

export function useRequestKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { otRequestId?: string; patientId: string; visitId?: string; templateId?: string; notes?: string }) =>
      (await apiPost<OtKitIssue>('/ot-kit/issues/request', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: otKitKeys.all }),
  });
}

export function useIssueKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      issueId?: string;
      otRequestId?: string;
      patientId?: string;
      visitId?: string;
      templateId?: string;
      kitBarcode?: string;
      items?: Array<{ drugFormularyId: string; quantity: number }>;
      notes?: string;
    }) => (await apiPost<OtKitIssue>('/ot-kit/issues/issue', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: otKitKeys.all }),
  });
}

export function useReconcileKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { issueId: string; returns?: Array<{ itemId: string; returnedQty: number }>; notes?: string }) =>
      (await apiPost<OtKitIssue>('/ot-kit/issues/reconcile', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: otKitKeys.all }),
  });
}

export function useCancelKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await apiPatch<OtKitIssue>(`/ot-kit/issues/${id}/cancel`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: otKitKeys.all }),
  });
}
