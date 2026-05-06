import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { ApiResponse } from '@/lib/api-client';

// ──────────────────────────────────────────────────────────
// Field + form schema types — keep parallel with backend
// `forms.validation.ts` discriminated union.
// ──────────────────────────────────────────────────────────

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'section'
  | 'divider';

export type FormCategory =
  | 'assessment'
  | 'screening'
  | 'intake'
  | 'vitals'
  | 'daily_note'
  | 'procedure'
  | 'discharge'
  | 'other';

export const FORM_CATEGORIES: { value: FormCategory; label: string }[] = [
  { value: 'assessment', label: 'Assessment' },
  { value: 'screening', label: 'Screening' },
  { value: 'intake', label: 'Intake' },
  { value: 'vitals', label: 'Vitals' },
  { value: 'daily_note', label: 'Daily Note' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'discharge', label: 'Discharge' },
  { value: 'other', label: 'Other' },
];

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldBase {
  id: string;
  key: string;
  label: string;
  type: FormFieldType;
  helpText?: string | null;
  required?: boolean;
  width?: 'full' | 'half' | 'third';
  placeholder?: string | null;
  defaultValue?: unknown;
  options?: FormFieldOption[];
  rows?: number;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  unit?: string | null;
  maxLength?: number | null;
}

export type FormField = FormFieldBase;

export interface FormSchema {
  fields: FormField[];
  version: number;
}

export interface UserStub {
  id: string;
  firstName: string;
  lastName: string | null;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  category: FormCategory;
  schema: FormSchema;
  isPublished: boolean;
  version: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: UserStub;
  _count?: { hospitalForms: number };
}

export interface HospitalForm {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: FormCategory;
  schema: FormSchema;
  isPublished: boolean;
  version: number;
  templateId: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: UserStub;
  archivedBy?: UserStub | null;
  template?: { id: string; name: string } | null;
  _count?: { submissions: number };
}

export interface FormSubmission {
  id: string;
  tenantId: string;
  formId: string;
  formVersion: number;
  formSnapshot: FormSchema;
  patientId: string;
  visitId: string | null;
  admissionId: string | null;
  appointmentId: string | null;
  submittedById: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  submittedBy?: UserStub;
  form?: { id: string; name: string; category: FormCategory; archivedAt?: string | null };
  patient?: { id: string; firstName: string; lastName: string | null; mrn: string };
}

interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ──────────────────────────────────────────────────────────
// Query keys
// ──────────────────────────────────────────────────────────

export const formsKeys = {
  templates: (q?: Record<string, unknown>) => ['form-templates', 'list', q ?? {}] as const,
  template: (id: string) => ['form-templates', 'detail', id] as const,
  hospitalForms: (q?: Record<string, unknown>) => ['hospital-forms', 'list', q ?? {}] as const,
  hospitalForm: (id: string) => ['hospital-forms', 'detail', id] as const,
  submissions: (q?: Record<string, unknown>) => ['form-submissions', 'list', q ?? {}] as const,
  submission: (id: string) => ['form-submissions', 'detail', id] as const,
};

// ──────────────────────────────────────────────────────────
// Templates
// ──────────────────────────────────────────────────────────

interface ListTemplatesParams {
  page?: number;
  limit?: number;
  category?: FormCategory;
  isPublished?: boolean;
}

export function useFormTemplates(params: ListTemplatesParams = {}) {
  return useQuery({
    queryKey: formsKeys.templates(params as Record<string, unknown>),
    queryFn: async (): Promise<ApiResponse<FormTemplate[]>> => {
      return apiGet<FormTemplate[]>('/forms/templates', { params });
    },
  });
}

export function useTemplateDetail(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: formsKeys.template(id ?? ''),
    enabled: !!id && enabled,
    queryFn: async (): Promise<ApiResponse<FormTemplate>> => apiGet<FormTemplate>(`/forms/templates/${id}`),
  });
}

export interface UpsertTemplateInput {
  name: string;
  description?: string | null;
  category: FormCategory;
  schema: FormSchema;
  isPublished?: boolean;
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertTemplateInput) => apiPost<FormTemplate>('/forms/templates', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-templates'] });
    },
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<UpsertTemplateInput>) => apiPut<FormTemplate>(`/forms/templates/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/forms/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-templates'] });
    },
  });
}

// ──────────────────────────────────────────────────────────
// Hospital forms
// ──────────────────────────────────────────────────────────

interface ListHospitalFormsParams {
  page?: number;
  limit?: number;
  status?: 'active' | 'archived' | 'all';
  category?: FormCategory;
  isPublished?: boolean;
}

export function useHospitalForms(params: ListHospitalFormsParams = {}) {
  return useQuery({
    queryKey: formsKeys.hospitalForms(params as Record<string, unknown>),
    queryFn: async (): Promise<ApiResponse<HospitalForm[]>> => apiGet<HospitalForm[]>('/forms', { params }),
  });
}

export function useHospitalFormDetail(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: formsKeys.hospitalForm(id ?? ''),
    enabled: !!id && enabled,
    queryFn: async (): Promise<ApiResponse<HospitalForm>> => apiGet<HospitalForm>(`/forms/${id}`),
  });
}

export interface UpsertHospitalFormInput {
  name: string;
  description?: string | null;
  category: FormCategory;
  schema: FormSchema;
  isPublished?: boolean;
}

export function useCreateHospitalForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertHospitalFormInput) => apiPost<HospitalForm>('/forms', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-forms'] });
    },
  });
}

export function useUpdateHospitalForm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<UpsertHospitalFormInput>) => apiPut<HospitalForm>(`/forms/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-forms'] });
    },
  });
}

export function useCloneTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name?: string }) =>
      apiPost<HospitalForm>(`/forms/clone-template/${templateId}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-forms'] });
    },
  });
}

export function useArchiveHospitalForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiPost<HospitalForm>(`/forms/${id}/archive`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-forms'] });
    },
  });
}

export function useRestoreHospitalForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<HospitalForm>(`/forms/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-forms'] });
    },
  });
}

// ──────────────────────────────────────────────────────────
// Submissions
// ──────────────────────────────────────────────────────────

interface ListSubmissionsParams {
  page?: number;
  limit?: number;
  patientId?: string;
  formId?: string;
  visitId?: string;
  admissionId?: string;
}

export function useFormSubmissions(params: ListSubmissionsParams) {
  return useQuery({
    queryKey: formsKeys.submissions(params as Record<string, unknown>),
    enabled: !!(params.patientId || params.formId),
    queryFn: async (): Promise<ApiResponse<FormSubmission[]>> => apiGet<FormSubmission[]>('/forms/submissions', { params }),
  });
}

export function useSubmissionDetail(id: string | undefined) {
  return useQuery({
    queryKey: formsKeys.submission(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<ApiResponse<FormSubmission>> => apiGet<FormSubmission>(`/forms/submissions/${id}`),
  });
}

export interface CreateSubmissionInput {
  patientId: string;
  visitId?: string;
  admissionId?: string;
  appointmentId?: string;
  data: Record<string, unknown>;
}

export function useCreateSubmission(formId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSubmissionInput) => apiPost<FormSubmission>(`/forms/${formId}/submissions`, body),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['form-submissions'] });
      qc.invalidateQueries({ queryKey: formsKeys.submissions({ patientId: variables.patientId }) });
    },
  });
}

// Helper for hooks above + form-renderer pagination meta typing
export type { PaginatedMeta };
