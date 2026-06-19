import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/api';

// ============================================================
// OT Surgical Kits — "Issue Bulk, Reconcile Net"
// ============================================================

export interface KitTemplateItem {
  id: string;
  drugFormularyId: string;
  quantity: number;
  drug?: { id: string; drugName: string; strength: string | null };
}
export interface KitTemplate {
  id: string;
  name: string;
  surgeryType: string | null;
  doctorId: string | null;
  description: string | null;
  isActive: boolean;
  items: KitTemplateItem[];
}

export interface KitIssueItem {
  id: string;
  drugName: string;
  strength: string | null;
  batchNumber: string | null;
  issuedQty: number;
  returnedQty: number;
  consumedQty: number;
  unitPrice: number | null;
}
export interface KitIssue {
  id: string;
  surgeryName: string;
  status: 'issued' | 'reconciled' | 'cancelled';
  issuedAt: string;
  reconciledAt: string | null;
  patient: { mrn: string; name: string } | null;
  items: KitIssueItem[];
}

const keys = {
  templates: (s?: string) => ['ot-kits', 'templates', s ?? null] as const,
  issues: (p: unknown) => ['ot-kits', 'issues', p] as const,
};

export function useKitTemplates(search?: string) {
  return useQuery({
    queryKey: keys.templates(search),
    queryFn: async () => (await apiGet<KitTemplate[]>('/ot-kits/templates', { params: { search } })).data,
  });
}

export function useKitIssues(params: { status?: string; patientId?: string } = {}) {
  return useQuery({
    queryKey: keys.issues(params),
    queryFn: async () => (await apiGet<{ items: KitIssue[]; total: number }>('/ot-kits/issues', { params })).data,
  });
}

type KitItemInput = { drugFormularyId: string; quantity: number };

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['ot-kits'] });
}

export function useCreateKitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; surgeryType?: string; doctorId?: string; description?: string; items: KitItemInput[] }) =>
      (await apiPost('/ot-kits/templates', body)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateKitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Partial<{ name: string; surgeryType: string | null; description: string | null; isActive: boolean; items: KitItemInput[] }>) =>
      (await apiPut(`/ot-kits/templates/${id}`, body)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteKitTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiDelete(`/ot-kits/templates/${id}`)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useIssueKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { patientId: string; admissionId?: string; templateId?: string; surgeryName: string; items?: KitItemInput[] }) =>
      (await apiPost('/ot-kits/issues', body)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useReconcileKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, returns }: { id: string; returns: { itemId: string; returnedQty: number }[] }) =>
      (await apiPatch(`/ot-kits/issues/${id}/reconcile`, { returns })).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useCancelKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiPatch(`/ot-kits/issues/${id}/cancel`, {})).data,
    onSuccess: () => invalidate(qc),
  });
}
