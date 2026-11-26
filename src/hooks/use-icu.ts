import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type {
  FluidBalanceValues,
  AbgVentValues,
  FastHugSepsisValues,
  InvasiveLineValues,
  InfusionPumpValues,
  SeverityScoreValues,
} from '@/lib/schema/icu-schema';

// All ICU endpoints are scoped to an admission:
//   POST /icu/admission/:admissionId/<module>
const base = (admissionId: string) => `/icu/admission/${admissionId}`;

/** Each mutation takes the admission id plus that module's form values. */
type WithAdmission<T> = { admissionId: string } & T;

/** Shared: refresh the matching list query after a successful save. */
function useSaveIcu<T>(module: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ admissionId, ...body }: WithAdmission<T>) => {
      const res = await apiPost(`${base(admissionId)}/${module}`, body);
      return res.data;
    },
    onSuccess: (_data, { admissionId }) => {
      queryClient.invalidateQueries({ queryKey: ['icu', module, admissionId] });
    },
  });
}

export const useSaveFluidBalance = () => useSaveIcu<FluidBalanceValues>('fluid-balance');
export const useSaveAbgVent = () => useSaveIcu<AbgVentValues>('abg-vent');
export const useSaveFastHugSepsis = () => useSaveIcu<FastHugSepsisValues>('fast-hug');
export const useSaveInvasiveLine = () => useSaveIcu<InvasiveLineValues>('invasive-line');
export const useSaveInfusionPump = () => useSaveIcu<InfusionPumpValues>('infusion-pump');
export const useSaveSeverityScore = () => useSaveIcu<SeverityScoreValues>('severity-scores');

// ---------------------------------------------------------------------------
// List (GET) hooks — one per module, keyed by admission.
// ---------------------------------------------------------------------------

function useIcuList<T>(admissionId: string | undefined, module: string) {
  return useQuery({
    queryKey: ['icu', module, admissionId],
    enabled: !!admissionId,
    queryFn: async () => {
      const res = await apiGet<T[]>(`${base(admissionId as string)}/${module}`);
      return res.data;
    },
  });
}

export const useFluidBalanceList = (admissionId?: string) =>
  useIcuList<FluidBalanceValues>(admissionId, 'fluid-balance');

export const useAbgVentList = (admissionId?: string) =>
  useIcuList<AbgVentValues>(admissionId, 'abg-vent');

export const useFastHugSepsisList = (admissionId?: string) =>
  useIcuList<FastHugSepsisValues>(admissionId, 'fast-hug');

export const useInvasiveLineList = (admissionId?: string) =>
  useIcuList<InvasiveLineValues>(admissionId, 'invasive-line');

export const useInfusionPumpList = (admissionId?: string) =>
  useIcuList<InfusionPumpValues>(admissionId, 'infusion-pump');

export const useSeverityScoreList = (admissionId?: string) =>
  useIcuList<SeverityScoreValues>(admissionId, 'severity-scores');
