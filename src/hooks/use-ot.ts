import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface OTRequest {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    uhid?: string;
  };
  surgeryName: string;
  surgeryType?: string;
  speciality?: string;
  otName?: string;
  surgeonId?: string;
  surgeon?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  anaesthetistId?: string;
  anaesthetist?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status: string;
  priority?: string;
  estimatedDuration?: number;
  preOpDiagnosis?: string;
  postOpDiagnosis?: string;
  notes?: string;
  billingAmount?: number;
  billingStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface OTRequestParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortOrder?: 'asc' | 'desc';
  date?: string;
}

// ============================================================
// Query Keys
// ============================================================

export const otKeys = {
  all: ['ot'] as const,
  requests: {
    all: ['ot', 'requests'] as const,
    list: (params?: OTRequestParams) => ['ot', 'requests', 'list', params] as const,
    detail: (id: string) => ['ot', 'requests', 'detail', id] as const,
  },
};

// ============================================================
// OT Request Hooks
// ============================================================

export function useOTRequests(params?: OTRequestParams) {
  return useQuery({
    queryKey: otKeys.requests.list(params),
    queryFn: async () => {
      const response = await apiGet<OTRequest[]>('/compliance/ot-requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useOTRequest(id: string) {
  return useQuery({
    queryKey: otKeys.requests.detail(id),
    queryFn: async () => {
      const response = await apiGet<OTRequest>(`/compliance/ot-requests/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateOTRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      surgeryName: string;
      surgeryType?: string;
      speciality?: string;
      surgeonId?: string;
      anaesthetistId?: string;
      scheduledDate?: string;
      scheduledStartTime?: string;
      scheduledEndTime?: string;
      estimatedDuration?: number;
      priority?: string;
      preOpDiagnosis?: string;
      notes?: string;
    }) => {
      const response = await apiPost<OTRequest>('/compliance/ot-requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
    },
  });
}

export function useApproveOTRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<OTRequest>(`/compliance/ot-requests/${id}/approve`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: otKeys.requests.detail(id) });
    },
  });
}

export function useScheduleOT() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      scheduledDate: string;
      scheduledStartTime: string;
      scheduledEndTime?: string;
      otName?: string;
    }) => {
      const response = await apiPatch<OTRequest>(`/compliance/ot-requests/${id}/schedule`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: otKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: otKeys.requests.detail(variables.id) });
    },
  });
}
