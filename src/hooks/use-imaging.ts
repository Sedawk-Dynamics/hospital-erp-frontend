import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface ImagingRequest {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    uhid?: string;
  };
  imagingType: string;
  bodyPart?: string;
  priority: string;
  status: string;
  requestedById?: string;
  requestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  scheduledDate?: string;
  scheduledTime?: string;
  clinicalNotes?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImagingResult {
  id: string;
  requestId: string;
  request?: ImagingRequest;
  findings?: string;
  impression?: string;
  conclusion?: string;
  reportUrl?: string;
  imageUrls?: string[];
  reportedById?: string;
  reportedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  verifiedById?: string;
  verifiedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ImagingRequestParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  date?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ImagingResultParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// ============================================================
// Query Keys
// ============================================================

export const imagingKeys = {
  all: ['imaging'] as const,
  requests: {
    all: ['imaging', 'requests'] as const,
    list: (params?: ImagingRequestParams) => ['imaging', 'requests', 'list', params] as const,
    detail: (id: string) => ['imaging', 'requests', 'detail', id] as const,
  },
  results: {
    all: ['imaging', 'results'] as const,
    list: (params?: ImagingResultParams) => ['imaging', 'results', 'list', params] as const,
    detail: (id: string) => ['imaging', 'results', 'detail', id] as const,
  },
};

// ============================================================
// Imaging Request Hooks
// ============================================================

export function useImagingRequests(params?: ImagingRequestParams) {
  return useQuery({
    queryKey: imagingKeys.requests.list(params),
    queryFn: async () => {
      const response = await apiGet<ImagingRequest[]>('/imaging/requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useImagingRequest(id: string) {
  return useQuery({
    queryKey: imagingKeys.requests.detail(id),
    queryFn: async () => {
      const response = await apiGet<ImagingRequest>(`/imaging/requests/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateImagingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      imagingType: string;
      bodyPart?: string;
      priority?: string;
      clinicalNotes?: string;
      reason?: string;
      scheduledDate?: string;
      scheduledTime?: string;
    }) => {
      const response = await apiPost<ImagingRequest>('/imaging/requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
    },
  });
}

export function useCancelImagingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<ImagingRequest>(`/imaging/requests/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
    },
  });
}

export function useScheduleImaging() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      scheduledDate: string;
      scheduledTime?: string;
    }) => {
      const response = await apiPatch<ImagingRequest>(`/imaging/requests/${id}/schedule`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.detail(variables.id) });
    },
  });
}

// ============================================================
// Imaging Result Hooks
// ============================================================

export function useImagingResults(params?: ImagingResultParams) {
  return useQuery({
    queryKey: imagingKeys.results.list(params),
    queryFn: async () => {
      const response = await apiGet<ImagingResult[]>('/imaging/results', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useImagingResult(id: string) {
  return useQuery({
    queryKey: imagingKeys.results.detail(id),
    queryFn: async () => {
      const response = await apiGet<ImagingResult>(`/imaging/results/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUploadImagingResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      requestId: string;
      findings?: string;
      impression?: string;
      conclusion?: string;
      reportUrl?: string;
      imageUrls?: string[];
    }) => {
      const response = await apiPost<ImagingResult>('/imaging/results', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
    },
  });
}

export function useVerifyImagingResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<ImagingResult>(`/imaging/results/${id}/verify`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.detail(id) });
    },
  });
}
