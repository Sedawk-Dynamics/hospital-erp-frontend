import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type {
  SystemForm,
  HospitalFormConfig,
  FormSubmission,
  FormSchema,
  FormTrigger,
  RoleSetting,
  ResolvedForm,
} from '@/types/forms';

// ============================================================
// Query Keys
// ============================================================

export const formKeys = {
  systemForms: (params?: Record<string, unknown>) => ['forms', 'system', params] as const,
  systemForm: (id: string) => ['forms', 'system', id] as const,
  triggerForms: (trigger: string) => ['forms', 'triggers', trigger] as const,
  hospitalConfigs: () => ['forms', 'hospital-config'] as const,
  submissions: (params?: Record<string, unknown>) => ['forms', 'submissions', params] as const,
  submission: (id: string) => ['forms', 'submissions', id] as const,
};

// ============================================================
// System Forms
// ============================================================

interface ListSystemFormsParams {
  page?: number;
  limit?: number;
  category?: string;
  trigger?: string;
  tenantId?: string;
}

export function useSystemForms(params?: ListSystemFormsParams) {
  return useQuery({
    queryKey: formKeys.systemForms(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<SystemForm[]>('/forms/system', { params });
      return { data: res.data ?? [], meta: res.meta };
    },
  });
}

export function useSystemForm(id: string | null | undefined) {
  return useQuery({
    queryKey: formKeys.systemForm(id || ''),
    queryFn: async () => {
      const res = await apiGet<SystemForm>(`/forms/system/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateSystemForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        description: string;
        schema: FormSchema;
        isActive: boolean;
        defaultRoleSettings: Record<string, RoleSetting>;
      }>;
    }) => {
      const res = await apiPatch<SystemForm>(`/forms/system/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['forms', 'system'] });
      qc.invalidateQueries({ queryKey: formKeys.systemForm(id) });
    },
  });
}

// ============================================================
// Trigger Resolution
// ============================================================

export function useFormsForTrigger(
  trigger: FormTrigger | null | undefined,
  tenantId?: string | null,
) {
  return useQuery({
    queryKey: [...formKeys.triggerForms(trigger || ''), tenantId ?? ''] as const,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tenantId) params.tenantId = tenantId;
      const res = await apiGet<ResolvedForm[]>(`/forms/system/trigger/${trigger}`, { params });
      return res.data ?? [];
    },
    enabled: !!trigger,
  });
}

export function usePendingFormsForContext(params: {
  trigger: FormTrigger | null | undefined;
  tenantId?: string | null;
  appointmentId?: string | null;
  admissionId?: string | null;
  visitId?: string | null;
  patientId?: string | null;
  enabled?: boolean;
}) {
  const { trigger, tenantId, appointmentId, admissionId, visitId, patientId, enabled = true } =
    params;
  return useQuery({
    queryKey: [
      'forms',
      'pending',
      trigger,
      tenantId,
      appointmentId,
      admissionId,
      visitId,
      patientId,
    ] as const,
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (trigger) queryParams.trigger = trigger;
      if (tenantId) queryParams.tenantId = tenantId;
      if (appointmentId) queryParams.appointmentId = appointmentId;
      if (admissionId) queryParams.admissionId = admissionId;
      if (visitId) queryParams.visitId = visitId;
      if (patientId) queryParams.patientId = patientId;
      const res = await apiGet<ResolvedForm[]>('/forms/pending', { params: queryParams });
      return res.data ?? [];
    },
    enabled: enabled && !!trigger,
    refetchOnWindowFocus: true,
  });
}

export function useAvailableFormsForMe(tenantId?: string | null) {
  return useQuery({
    queryKey: ['forms', 'available-for-me', tenantId] as const,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tenantId) params.tenantId = tenantId;
      const res = await apiGet<
        Array<{
          form: { id: string; name: string; description?: string | null; category: string; trigger: FormTrigger; sortOrder: number };
          isRequired: boolean;
          effectiveSchema: FormSchema;
        }>
      >('/forms/available-for-me', { params });
      return res.data ?? [];
    },
    refetchOnWindowFocus: true,
  });
}

// ============================================================
// Hospital Form Config
// ============================================================

export function useHospitalFormConfigs() {
  return useQuery({
    queryKey: formKeys.hospitalConfigs(),
    queryFn: async () => {
      const res = await apiGet<Array<SystemForm & { config: HospitalFormConfig | null }>>('/forms/hospital-config');
      return res.data ?? [];
    },
  });
}

export function useUpsertHospitalFormConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      formId: string;
      isEnabled?: boolean;
      schemaOverride?: FormSchema | null;
      roleSettings?: Record<string, RoleSetting>;
    }) => {
      const res = await apiPost<HospitalFormConfig>('/forms/hospital-config', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forms'] });
    },
  });
}

export function useUpdateHospitalFormConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      formId,
      data,
    }: {
      formId: string;
      data: {
        isEnabled?: boolean;
        schemaOverride?: FormSchema | null;
        roleSettings?: Record<string, RoleSetting>;
      };
    }) => {
      const res = await apiPatch<HospitalFormConfig>(`/forms/hospital-config/${formId}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['forms'] });
    },
  });
}

// ============================================================
// Submissions
// ============================================================

interface ListSubmissionsParams {
  page?: number;
  limit?: number;
  formId?: string;
  patientId?: string;
  appointmentId?: string;
  status?: string;
  trigger?: FormTrigger;
  viewerRole?: string;
}

export function useFormSubmissions(params?: ListSubmissionsParams) {
  return useQuery({
    queryKey: formKeys.submissions(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<FormSubmission[]>('/forms/submissions', { params });
      return { data: res.data ?? [], meta: res.meta };
    },
  });
}

export function useFormSubmission(id: string | null | undefined) {
  return useQuery({
    queryKey: formKeys.submission(id || ''),
    queryFn: async () => {
      const res = await apiGet<FormSubmission>(`/forms/submissions/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateFormSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      formId: string;
      trigger?: FormTrigger;
      responses: Record<string, unknown>;
      tenantId?: string;
      patientId?: string;
      appointmentId?: string;
      visitId?: string;
      admissionId?: string;
      status?: 'draft' | 'submitted';
      notes?: string;
    }) => {
      const res = await apiPost<FormSubmission>('/forms/submissions', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', 'submissions'] }),
  });
}

export function useUpdateFormSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        status: 'submitted' | 'verified' | 'rejected' | 'draft';
        rejectionReason: string;
        notes: string;
      }>;
    }) => {
      const res = await apiPatch<FormSubmission>(`/forms/submissions/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', 'submissions'] }),
  });
}

// ============================================================
// Legacy hook kept for backward compat during migration
// ============================================================

/** @deprecated Use useSystemForm instead */
export function useFormInstance(id: string | null | undefined) {
  return useSystemForm(id);
}
