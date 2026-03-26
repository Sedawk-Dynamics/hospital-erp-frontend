import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { CreateHospitalData, MyHospital, SwitchHospitalResponse } from '@/types';

// ============================================================
// Query Keys
// ============================================================

export const hospitalKeys = {
  all: ['my-hospitals'] as const,
  list: () => ['my-hospitals', 'list'] as const,
  detail: (id: string) => ['my-hospitals', 'detail', id] as const,
};

// ============================================================
// Hooks
// ============================================================

/** Fetch all hospitals owned by the current user */
export function useMyHospitals() {
  return useQuery<MyHospital[]>({
    queryKey: hospitalKeys.list(),
    queryFn: async () => {
      const response = await apiGet<MyHospital[]>('/hospitals/my');
      return response.data;
    },
  });
}

/** Fetch a single hospital by ID */
export function useMyHospital(id: string) {
  return useQuery<MyHospital>({
    queryKey: hospitalKeys.detail(id),
    queryFn: async () => {
      const response = await apiGet<MyHospital>(`/hospitals/my/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// ============================================================
// Types
// ============================================================

export interface HospitalLimit {
  current: number;
  max: number | null;
  canCreate: boolean;
}

/** Fetch the user's hospital creation limit info */
export function useHospitalLimit() {
  return useQuery<HospitalLimit>({
    queryKey: [...hospitalKeys.all, 'limit'] as const,
    queryFn: async () => {
      const response = await apiGet<HospitalLimit>('/hospitals/my/limit');
      return response.data;
    },
  });
}

/** Create a new hospital */
export function useCreateHospital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateHospitalData) => {
      const response = await apiPost<MyHospital>('/hospitals', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
      queryClient.invalidateQueries({ queryKey: [...hospitalKeys.all, 'limit'] });
    },
  });
}

/** Switch into a hospital — returns new JWT tokens scoped to that tenant */
export function useSwitchHospital() {
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiPost<SwitchHospitalResponse>(`/hospitals/switch/${tenantId}`);
      return response.data;
    },
  });
}

/** Update an existing hospital */
export function useUpdateHospital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateHospitalData>) => {
      const response = await apiPut<MyHospital>(`/hospitals/my/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
      queryClient.invalidateQueries({ queryKey: hospitalKeys.detail(variables.id) });
    },
  });
}
