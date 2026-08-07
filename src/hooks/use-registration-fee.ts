import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';

// ============================================================
// The hospital's one-time registration fee.
//
// Charged when a patient first attends THIS hospital. "First" is per-hospital,
// not per-platform: someone with a portal account, or a long-standing patient
// of another hospital on the same ERP, is still opening a new file here.
//
// The backend decides whether it is actually chargeable — this is only what the
// desk needs to show and pre-tick.
// ============================================================

export interface RegistrationFeeSettings {
  enabled: boolean;
  amount: number;
  gstRatePercent: number;
  label: string;
  /** When on, the fee can only ever be taken once per patient at this hospital. */
  oncePerPatient: boolean;
}

export interface PatientVisitStatus {
  patientId: string;
  isFirstVisit: boolean;
  lastVisitAt: string | null;
  lastVisitKind: 'appointment' | 'visit' | 'admission' | null;
  priorEncounters: number;
  registrationFeeCharged: boolean;
  registrationFeeChargedAt: string | null;
  settings: RegistrationFeeSettings;
  /** What the booking screen should pre-tick. */
  suggestCharge: boolean;
}

export function useRegistrationFeeSettings() {
  return useQuery({
    queryKey: ['hospital-settings', 'registration-fee'],
    queryFn: async () =>
      (await apiGet<RegistrationFeeSettings>('/hospital-settings/registration-fee')).data,
  });
}

export function useUpdateRegistrationFeeSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<RegistrationFeeSettings>) =>
      (await apiPut<RegistrationFeeSettings>('/hospital-settings/registration-fee', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-settings', 'registration-fee'] }),
  });
}

/**
 * Has this patient been to this hospital before, and is the fee due?
 *
 * `excludeAppointmentId` stops the appointment currently being edited from
 * counting as prior history.
 */
export function usePatientVisitStatus(patientId?: string | null, excludeAppointmentId?: string) {
  return useQuery({
    queryKey: ['patient-visit-status', patientId, excludeAppointmentId],
    queryFn: async () =>
      (
        await apiGet<PatientVisitStatus>(`/hospital-settings/patient-visit-status/${patientId}`, {
          params: { excludeAppointmentId },
        })
      ).data,
    enabled: !!patientId,
    staleTime: 30_000,
  });
}
