import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface LoincConcept {
  id: string;
  loincCode: string;
  displayName: string;
  component?: string | null;
  system?: string | null;
  scaleType?: string | null;
}

export function useLoincSearch(query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: ['loinc', 'search', q],
    queryFn: async () => {
      const res = await apiGet<LoincConcept[]>('/loinc/search', { params: { q } });
      return res.data;
    },
    enabled: enabled && q.length >= 1,
    staleTime: 60 * 1000,
  });
}
