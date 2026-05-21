// React Query hooks for platform lab test templates + the hospital-side
// clone calls. Mirrors the patient-form `use-forms` pattern.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type LabParameterInputType = 'number' | 'text' | 'select';

export interface LabParameterOption {
  value: string;
  label: string;
}

// Mirrors backend parameterSpecSchema (lab.validation.ts).
export interface LabParameterSpec {
  id: string;
  name: string;
  code?: string | null;
  unit?: string | null;
  refLow?: number | null;
  refHigh?: number | null;
  refRangeText?: string | null;
  decimals?: number | null;
  group?: string | null;
  inputType: LabParameterInputType;
  options?: LabParameterOption[] | null;
  notes?: string | null;
}

export interface LabTestTemplate {
  id: string;
  name: string;
  code?: string | null;
  departmentName: string;
  sampleType?: string | null;
  specimen?: string | null;
  instructions?: string | null;
  description?: string | null;
  defaultPrice?: string | number | null;
  turnaroundHours?: number | null;
  parameters: LabParameterSpec[];
  interpretation?: string | null;
  isPublished: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  _count?: { catalogs: number } | null;
}

export type LabTestTemplateInput = {
  name: string;
  code?: string | null;
  departmentName: string;
  sampleType?: string | null;
  specimen?: string | null;
  instructions?: string | null;
  description?: string | null;
  defaultPrice?: number | null;
  turnaroundHours?: number | null;
  parameters: LabParameterSpec[];
  interpretation?: string | null;
  isPublished?: boolean;
};

const keys = {
  all: ['lab-templates'] as const,
  list: (q?: unknown) => [...keys.all, 'list', q] as const,
  detail: (id: string) => [...keys.all, 'detail', id] as const,
};

// ─────────────────────────────────────────────────────────────
// Templates (super-admin)
// ─────────────────────────────────────────────────────────────

export function useLabTemplates(params?: { search?: string; departmentName?: string; isPublished?: boolean; page?: number; limit?: number }) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: async () => {
      const res = await apiGet<LabTestTemplate[]>('/lab/templates', { params });
      return { data: res.data, meta: res.meta };
    },
  });
}

export function useLabTemplate(id: string | null) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: async () => {
      const res = await apiGet<LabTestTemplate>(`/lab/templates/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateLabTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LabTestTemplateInput) => {
      const res = await apiPost<LabTestTemplate>('/lab/templates', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useUpdateLabTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Partial<LabTestTemplateInput>) => {
      const res = await apiPut<LabTestTemplate>(`/lab/templates/${id}`, body);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: keys.detail(vars.id) });
    },
  });
}

export function useDeleteLabTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete(`/lab/templates/${id}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

// ─────────────────────────────────────────────────────────────
// Clone (hospital admin)
// ─────────────────────────────────────────────────────────────

export function useCloneOneLabTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      overridePrice,
      overrideTurnaroundHours,
    }: {
      templateId: string;
      overridePrice?: number;
      overrideTurnaroundHours?: number;
    }) => {
      const res = await apiPost(`/lab/templates/${templateId}/clone`, {
        overridePrice,
        overrideTurnaroundHours,
      });
      return res.data;
    },
    onSuccess: () => {
      // Invalidate both the catalog list (so the new test appears) and the
      // template list (so the "_count.catalogs" badge re-renders).
      qc.invalidateQueries({ queryKey: ['lab', 'tests'] });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useCloneAllLabTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: { departmentName?: string; overwriteExisting?: boolean }) => {
      const res = await apiPost<{ created: number; updated: number; skipped: number; total: number }>(
        '/lab/templates/clone-all',
        body ?? {},
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab', 'tests'] });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}
