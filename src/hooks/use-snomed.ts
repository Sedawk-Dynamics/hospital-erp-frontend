import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface SnomedConcept {
  conceptId: string;
  term: string;
}

export function useSnomedSearch(query: string, enabled = true) {
  const q = query.trim();
  return useQuery({
    queryKey: ['snomed', 'search', q],
    queryFn: async () => {
      const res = await apiGet<SnomedConcept[]>('/snomed/search', { params: { q } });
      return res.data;
    },
    enabled: enabled && q.length >= 1,
    staleTime: 60 * 1000,
  });
}

// ── SNOMED → ICD cross-map (on select) ──────────────────────────────────────

export interface SnomedMapCandidate {
  icdCode: string;
  label: string; // e.g. "LEFT" / "RIGHT"
  advice: string;
}

export interface SnomedMapResult {
  snomedCode: string;
  status: 'resolved' | 'needs_detail' | 'unmapped';
  icdCodes: string[]; // final code(s); the fallback code when needs_detail
  candidates?: SnomedMapCandidate[];
}

export async function fetchSnomedMap(conceptId: string): Promise<SnomedMapResult> {
  const res = await apiGet<SnomedMapResult>(`/snomed/${conceptId}/map`);
  return res.data;
}
