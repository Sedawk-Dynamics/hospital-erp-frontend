import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPut } from '@/lib/api';
import type { FollowUpPricing, FollowUpRuleLayer } from '@/lib/follow-up-fee';

// ============================================================
// Follow-up fee rules (gap items #331 and #019).
//
// Set by the Hospital Admin; everyone who books may read them. `canEdit` comes
// from the server, which is what enforces it.
// ============================================================

export interface DoctorFollowUpRule {
  canEdit: boolean;
  doctorId: string;
  name: string;
  department: { id: string; name: string } | null;
  consultationFee: number | null;
  override: FollowUpRuleLayer;
  summary: string | null;
  inheritedSummary: string | null;
}

export interface FollowUpRules {
  canEdit: boolean;
  hospital: FollowUpRuleLayer | null;
  hospitalSummary: string | null;
  hospitalUpdatedAt: string | null;
  departments: Array<{
    departmentId: string;
    name: string;
    override: FollowUpRuleLayer | null;
    summary: string | null;
  }>;
  doctors: Array<Omit<DoctorFollowUpRule, 'canEdit'>>;
}

const KEY = ['hospital-settings', 'follow-up-rules'] as const;
const PATH = '/hospital-settings/follow-up-rules';

export function useFollowUpRules() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await apiGet<FollowUpRules>(PATH)).data ?? null,
    retry: false,
  });
}

export function useDoctorFollowUpRule(doctorId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, 'doctor', doctorId],
    queryFn: async () => (await apiGet<DoctorFollowUpRule>(`${PATH}/doctors/${doctorId}`)).data ?? null,
    enabled: !!doctorId,
    retry: false,
  });
}

export type RuleTarget = { level: 'hospital' } | { level: 'departments' | 'doctors'; id: string };

const targetPath = (t: RuleTarget) => (t.level === 'hospital' ? `${PATH}/hospital` : `${PATH}/${t.level}/${t.id}`);

/** Save a rule, or remove it with `layer: null`. */
export function useSaveFollowUpRule(target: RuleTarget) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (layer: FollowUpRuleLayer | null) =>
      layer === null ? apiDelete(targetPath(target)) : apiPut(targetPath(target), layer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['appointments', 'charge-preview'] });
      qc.invalidateQueries({ queryKey: ['hospital', 'charge-preview'] });
      if (target.level === 'doctors') {
        qc.invalidateQueries({ queryKey: ['doctor-schedule', 'profile', target.id] });
      }
    },
  });
}

/** GET /appointments/charge-preview — what booking would charge. */
export interface BookingChargePreview {
  consultationFee: number;
  followUp: FollowUpPricing & { previousVisitDate: string | null };
  registration: { applies: boolean; label: string; totalAmount: number; reason: string };
  total: number;
}

export function useBookingChargePreview(input: {
  doctorId: string;
  patientId?: string | null;
  type: string;
  /** YYYY-MM-DD: the day of the visit, which the free days are counted to. */
  date: string;
  chargeRegistrationFee?: boolean | null;
  enabled?: boolean;
}) {
  const { doctorId, patientId, type, date, chargeRegistrationFee, enabled = true } = input;
  return useQuery({
    queryKey: [
      'appointments', 'charge-preview', doctorId, patientId ?? null, type, date, chargeRegistrationFee ?? null,
    ],
    queryFn: async () =>
      (
        await apiGet<BookingChargePreview>('/appointments/charge-preview', {
          params: {
            doctorId,
            patientId: patientId || undefined,
            type,
            date: date || undefined,
            chargeRegistrationFee: chargeRegistrationFee ?? undefined,
          },
        })
      ).data ?? null,
    enabled: enabled && !!doctorId,
    retry: false,
    // A price the desk is about to quote: never an answer from an earlier one.
    staleTime: 0,
    gcTime: 0,
  });
}
