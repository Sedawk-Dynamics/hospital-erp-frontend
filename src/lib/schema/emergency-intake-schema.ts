import { z } from 'zod/v4';

export const emergencyIntakeSchema = z.object({
  // Section 1 — ESI Triage Classification
  priority: z.string().min(1, 'Select a triage priority'),
  chiefComplaint: z.string().trim().max(2000),
  // Section 2 — Brought-By Provenance & Transport Registry
  broughtBy: z.string().min(1, 'Select who brought the patient'),
  informantName: z.string().trim().min(1, 'Informant / escort name is required'),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[\d+\-\s()]{7,20}$/, 'Enter a valid contact phone number'),
  relationship: z.string().trim(),
  ambulanceNumber: z.string().trim(),
  policeBadgeStation: z.string().trim(),
});

/** Details captured by the emergency-intake form. */
export type EmergencyIntakeDetails = z.infer<typeof emergencyIntakeSchema>;

/** Empty defaults for the form. */
export const EMERGENCY_INTAKE_DEFAULTS: EmergencyIntakeDetails = {
  priority: '',
  chiefComplaint: '',
  broughtBy: '',
  informantName: '',
  contactPhone: '',
  relationship: '',
  ambulanceNumber: '',
  policeBadgeStation: '',
};
