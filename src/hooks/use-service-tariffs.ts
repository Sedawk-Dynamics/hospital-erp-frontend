// Service tariff hooks — wraps /billing/tariffs. Used by radiology/laboratory
// settings to manage the price catalog. Backend maps request fields name/code/
// taxRate → DB columns serviceName/serviceCode/gstRatePercent; the response
// uses the DB column names which we expose verbatim in the types below.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

export type ServiceTariffCategory =
  | 'consultation' | 'procedure' | 'lab' | 'imaging' | 'pharmacy'
  | 'room' | 'nursing' | 'surgery' | 'other';

export interface ServiceTariff {
  id: string;
  tenantId: string;
  serviceName: string;
  serviceCode: string | null;
  category: ServiceTariffCategory;
  basePrice: number | string;
  gstRatePercent: number | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TariffListParams {
  category?: ServiceTariffCategory;
  search?: string;
  isActive?: string | boolean;
  page?: number;
  limit?: number;
}

export const tariffKeys = {
  all: ['tariffs'] as const,
  list: (params?: TariffListParams) => ['tariffs', 'list', params] as const,
};

export function useServiceTariffs(params?: TariffListParams) {
  return useQuery({
    queryKey: tariffKeys.list(params),
    queryFn: async () => {
      const response = await apiGet<ServiceTariff[]>('/billing/tariffs', { params });
      return { data: response.data, meta: response.meta };
    },
  });
}

export interface CreateTariffInput {
  name: string;
  code: string;
  category: ServiceTariffCategory;
  description?: string;
  basePrice: number;
  taxRate?: number;
  isActive?: boolean;
}

export function useCreateServiceTariff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTariffInput) => {
      const response = await apiPost<ServiceTariff>('/billing/tariffs', data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tariffKeys.all });
    },
  });
}

export interface UpdateTariffInput {
  id: string;
  name?: string;
  code?: string;
  category?: ServiceTariffCategory;
  description?: string | null;
  basePrice?: number;
  taxRate?: number;
  isActive?: boolean;
}

export function useUpdateServiceTariff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateTariffInput) => {
      const response = await apiPut<ServiceTariff>(`/billing/tariffs/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tariffKeys.all });
    },
  });
}
