// Imaging service catalog — the imaging tariffs the radiology admin maintains
// in Settings, exposed as a searchable catalog the doctor uses when ordering
// imaging (mirrors the lab test catalog flow). Backed by GET /imaging/catalog
// which reads active ServiceTariff rows in the imaging (radiology) category.

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { ImagingModality } from '@/hooks/use-service-tariffs';

export interface ImagingCatalogItem {
  id: string;
  serviceName: string;
  serviceCode: string | null;
  basePrice: number;
  gstRatePercent: number;
  modality: ImagingModality | null;
  isActive: boolean;
}

export function useImagingCatalog(params?: { search?: string; modality?: string; limit?: number }) {
  return useQuery({
    queryKey: ['imaging', 'catalog', params],
    queryFn: async () => {
      const res = await apiGet<ImagingCatalogItem[]>('/imaging/catalog', { params });
      return res.data ?? [];
    },
    // Keep the catalog warm — it changes rarely (admin edits in Settings).
    staleTime: 60 * 1000,
  });
}
