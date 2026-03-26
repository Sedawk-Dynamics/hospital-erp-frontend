import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface DemoRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  hospitalName: string;
  designation: string;
  city: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'trial_active' | 'trial_ended' | 'converted';
  trialDays: number | null;
  trialEndsAt: string | null;
  trialPlanId: string | null;
  approvedById: string | null;
  createdTenantId: string | null;
  createdUserId: string | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  trialPlan?: { id: string; name: string } | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DemoRequestParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// ============================================================
// Query Keys
// ============================================================

export const demoRequestKeys = {
  all: ['demo-requests'] as const,
  list: (params?: DemoRequestParams) => ['demo-requests', 'list', params] as const,
};

// ============================================================
// Public: Submit demo request (no auth)
// ============================================================

export function useSubmitDemoRequest() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      phone: string;
      hospitalName: string;
      designation: string;
      city: string;
      message?: string;
    }) => {
      const response = await apiPost<{ id: string }>('/demo-requests', data);
      return response.data;
    },
  });
}

// ============================================================
// Super Admin: List demo requests
// ============================================================

export function useDemoRequests(params?: DemoRequestParams) {
  return useQuery({
    queryKey: demoRequestKeys.list(params),
    queryFn: async () => {
      const response = await apiGet<DemoRequest[]>('/demo-requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

// ============================================================
// Super Admin: Approve demo request
// ============================================================

export function useApproveDemoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      trialDays: number;
      planId: string;
      password: string;
    }) => {
      const response = await apiPatch(`/demo-requests/${id}/approve`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: demoRequestKeys.all });
    },
  });
}

// ============================================================
// Super Admin: Reject demo request
// ============================================================

export function useRejectDemoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rejectionNote }: { id: string; rejectionNote?: string }) => {
      const response = await apiPatch(`/demo-requests/${id}/reject`, { rejectionNote });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: demoRequestKeys.all });
    },
  });
}

// ============================================================
// Super Admin: End trial
// ============================================================

export function useEndTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch(`/demo-requests/${id}/end-trial`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: demoRequestKeys.all });
    },
  });
}

// ============================================================
// Super Admin: Delete demo request
// ============================================================

export function useDeleteDemoRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/demo-requests/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: demoRequestKeys.all });
    },
  });
}
