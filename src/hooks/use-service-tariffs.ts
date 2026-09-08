// Service tariff hooks — wraps /billing/tariffs. Used by radiology/laboratory
// settings to manage the price catalog. Backend maps request fields name/code/
// taxRate → DB columns serviceName/serviceCode/gstRatePercent; the response
// uses the DB column names which we expose verbatim in the types below.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPut, apiDelete } from '@/lib/api';

export type ServiceTariffCategory =
  | 'consultation' | 'procedure' | 'lab' | 'imaging' | 'pharmacy'
  | 'room' | 'nursing' | 'surgery' | 'other';

export type ImagingModality =
  | 'xray' | 'mri' | 'ct_scan' | 'ultrasound' | 'ecg' | 'echo' | 'other';

export interface ServiceTariff {
  id: string;
  tenantId: string;
  serviceName: string;
  serviceCode: string | null;
  category: ServiceTariffCategory;
  basePrice: number | string;
  gstRatePercent: number | string;
  /**
   * The tariff's GST classification.
   *
   * `sacCode` is what the resolution chain resolves a SERVICE's rate through,
   * and `isCosmetic` is the whole of how a hospital tells an exempt procedure
   * from an 18% one. Neither create nor update ever wrote them.
   */
  sacCode?: string | null;
  gstTreatment?: 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'zero_rated' | null;
  isCosmetic?: boolean;
  /**
   * Signed off by the hospital's auditor.
   *
   * Until it is, the IP charge path DISCARDS this tariff's configured rate and
   * takes one off the request instead — so an unapproved classification is
   * worse than none.
   */
  gstApproved?: boolean;
  /** Imaging tariffs only — the modality this study runs on. */
  modality?: ImagingModality | null;
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
  /**
   * The tariff's GST classification.
   *
   * `sacCode` is what the resolution chain resolves a SERVICE's rate through,
   * and `isCosmetic` is the whole of how a hospital tells an exempt procedure
   * from an 18% one. Neither create nor update ever wrote them.
   */
  sacCode?: string | null;
  gstTreatment?: 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'zero_rated' | null;
  isCosmetic?: boolean;
  isActive?: boolean;
  modality?: ImagingModality | null;
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
  /**
   * The tariff's GST classification.
   *
   * `sacCode` is what the resolution chain resolves a SERVICE's rate through,
   * and `isCosmetic` is the whole of how a hospital tells an exempt procedure
   * from an 18% one. Neither create nor update ever wrote them.
   */
  sacCode?: string | null;
  gstTreatment?: 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'zero_rated' | null;
  isCosmetic?: boolean;
  isActive?: boolean;
  modality?: ImagingModality | null;
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

export function useDeleteServiceTariff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/billing/tariffs/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tariffKeys.all });
    },
  });
}

/**
 * The auditor's sign-off on a tariff's GST classification.
 *
 * Its own mutation rather than a field on update, because it is a different act
 * by a different person: the GST report puts the item-to-code mapping in the
 * hospital's CA's hands, not the billing clerk's. Editing any part of the
 * classification withdraws the approval again.
 */
export function useSetTariffGstApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) =>
      (await apiPatch<ServiceTariff>(`/billing/tariffs/${id}/gst-approval`, { approved })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tariffKeys.all });
    },
  });
}
