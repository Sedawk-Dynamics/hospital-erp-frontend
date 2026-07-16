/**
 * Emergency / Casualty (Golden Hour) helpers — front-end mirror of the backend
 * convention. An emergency patient is a temporary patient distinguished ONLY by
 * its MRN prefix (`TEMP-ER-`); there is no schema flag. This drives the
 * "EMERGENCY" highlight shown wherever a patient's identity appears.
 */
export const EMERGENCY_MRN_PREFIX = 'TEMP-ER-';

/** True when a patient (or a raw MRN) is a temporary emergency record. */
export function isEmergencyPatient(
  patient?: { mrn?: string | null } | string | null,
): boolean {
  const mrn = typeof patient === 'string' ? patient : patient?.mrn;
  return !!mrn && mrn.startsWith(EMERGENCY_MRN_PREFIX);
}
