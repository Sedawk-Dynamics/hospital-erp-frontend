import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';

// ============================================================
// Controlled-drug policy + the hospital's statutory drug licences.
//
// The mode decides whether a controlled medicine can be dispensed from the
// screen the user is already on, or is refused the way it always was. The
// licences are what every printed register carries in its header — without them
// the document has a blank space where a legal identifier belongs.
// ============================================================

export interface ControlledDrugSettings {
  /**
   * `legacy_block` — a vault narcotic is refused at every ordinary counter,
   *   exactly as it has been for years.
   * `inline` — the dispense completes on the same screen once its
   *   requirements (prescription, witness, vault stock) are met.
   */
  mode: 'legacy_block' | 'inline';
  witnessRoles: string[];
}

export interface DrugLicenceSettings {
  retailLicenceNumber: string;
  wholesaleLicenceNumber: string;
  ndpsLicenceNumber: string;
  state: string;
  licenceHolderName: string;
  premisesAddress: string;
}

export function useControlledDrugPolicy() {
  return useQuery({
    queryKey: ['hospital-settings', 'controlled-drugs'],
    queryFn: async () =>
      (await apiGet<ControlledDrugSettings>('/hospital-settings/controlled-drugs')).data,
  });
}

export function useUpdateControlledDrugPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ControlledDrugSettings>) =>
      (await apiPut<ControlledDrugSettings>('/hospital-settings/controlled-drugs', patch)).data,
    onSuccess: () => {
      // The counter reads this to decide whether to enforce, so every open
      // screen has to pick the change up rather than keep the old mode.
      qc.invalidateQueries({ queryKey: ['hospital-settings', 'controlled-drugs'] });
    },
  });
}

export function useDrugLicence() {
  return useQuery({
    queryKey: ['hospital-settings', 'drug-licence'],
    queryFn: async () =>
      (await apiGet<DrugLicenceSettings>('/hospital-settings/drug-licence')).data,
  });
}

export function useUpdateDrugLicence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<DrugLicenceSettings>) =>
      (await apiPut<DrugLicenceSettings>('/hospital-settings/drug-licence', patch)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-settings', 'drug-licence'] });
    },
  });
}

/** The roles a hospital can choose from when deciding who may witness. */
export const WITNESS_ROLE_CHOICES = [
  { value: 'nurse', label: 'Nurse' },
  { value: 'nurse_admin', label: 'Nurse Admin' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'pharmacy_admin', label: 'Pharmacy Admin' },
];
