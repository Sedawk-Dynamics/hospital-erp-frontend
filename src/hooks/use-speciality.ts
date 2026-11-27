import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

// Speciality consultation data is scoped to a visit:
//   POST /speciality/visit/:visitId   { speciality, data }
//   GET  /speciality/visit/:visitId
const base = (visitId: string) => `/speciality/visit/${visitId}`;

/** The flat specialty form values: { fieldKey: value | { value, unit } }. */
export type SpecialityData = Record<string, unknown>;

export interface SaveSpecialityPayload {
  visitId: string;
  speciality: string;
  data: SpecialityData;
}

/** Save (upsert) the specialty details for a visit. */
export function useSaveSpecialityData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, speciality, data }: SaveSpecialityPayload) => {
      const res = await apiPost(`${base(visitId)}`, { speciality, data });
      return res.data;
    },
    onSuccess: (_res, { visitId }) => {
      queryClient.invalidateQueries({ queryKey: ['speciality', visitId] });
    },
  });
}

/** Fetch the saved specialty details for a visit (null if none yet). */
export function useSpecialityData(visitId?: string) {
  return useQuery({
    queryKey: ['speciality', visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const res = await apiGet<{ data: SpecialityData } | null>(`${base(visitId as string)}`);
      return res.data;
    },
  });
}
