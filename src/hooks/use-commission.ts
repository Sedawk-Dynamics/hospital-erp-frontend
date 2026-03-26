import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface CommissionSettingData {
  id: string;
  defaultPercent: number;
  minPercent: number;
  maxPercent: number;
  updatedAt: string;
}

export interface HospitalCommissionItem {
  id: string;
  name: string;
  slug: string;
  bankVerified: boolean;
  linkedAccountId: string | null;
  hospitalCommission: {
    commissionPercent: number;
    notes: string | null;
  } | null;
}

export interface AllCommissionsData {
  defaultPercent: number;
  hospitals: HospitalCommissionItem[];
}

// ============================================================
// Query Keys
// ============================================================

export const commissionKeys = {
  all: ['commission'] as const,
  default: () => [...commissionKeys.all, 'default'] as const,
  hospitals: () => [...commissionKeys.all, 'hospitals'] as const,
};

// ============================================================
// Hooks
// ============================================================

export function useDefaultCommission() {
  return useQuery<CommissionSettingData>({
    queryKey: commissionKeys.default(),
    queryFn: async () => {
      const response = await apiGet<CommissionSettingData>('/commission/default');
      return response.data;
    },
  });
}

export function useUpdateDefaultCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { defaultPercent: number; minPercent?: number; maxPercent?: number }) => {
      const response = await apiPut<CommissionSettingData>('/commission/default', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.all });
    },
  });
}

export function useAllCommissions() {
  return useQuery<AllCommissionsData>({
    queryKey: commissionKeys.hospitals(),
    queryFn: async () => {
      const response = await apiGet<AllCommissionsData>('/commission/hospitals');
      return response.data;
    },
  });
}

export function useSetHospitalCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, commissionPercent, notes }: { tenantId: string; commissionPercent: number; notes?: string }) => {
      const response = await apiPut(`/commission/hospitals/${tenantId}`, { commissionPercent, notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.hospitals() });
    },
  });
}

export function useDeleteHospitalCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiDelete(`/commission/hospitals/${tenantId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.hospitals() });
    },
  });
}
