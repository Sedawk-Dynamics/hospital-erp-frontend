
export const DOCTOR_SPECIALTIES = [
  { value: 'pediatrics_neonatology', label: 'Pediatrics & Neonatology' },
  { value: 'obstetrics_gynecology', label: 'Obstetrics & Gynecology' },
  { value: 'general_surgery_laparoscopy', label: 'General Surgery & Laparoscopy' },
  { value: 'orthopedics_traumatology', label: 'Orthopedics & Traumatology' },
  { value: 'anesthesiology_perioperative', label: 'Anesthesiology & Perioperative' },
  { value: 'cardiology_cath_lab', label: 'Cardiology & Cath Lab' },
  { value: 'nephrology_dialysis', label: 'Nephrology & Dialysis' },
  { value: 'pulmonology_sleep', label: 'Pulmonology & Sleep' },
  { value: 'gastroenterology_liver', label: 'Gastroenterology & Liver' },
  { value: 'neurology_neurosurgery', label: 'Neurology & Neurosurgery' },
  { value: 'diabetology_endocrinology', label: 'Diabetology & Endocrinology' },
  { value: 'oncology', label: 'Oncology (Med/Surg/Rad)' },
  { value: 'psychiatry_mental_health', label: 'Psychiatry & Mental Health' },
] as const;

export type DoctorSpecialtyCode = (typeof DOCTOR_SPECIALTIES)[number]['value'];

export const SPECIALTY_CODES = DOCTOR_SPECIALTIES.map((s) => s.value);

export const specialtyLabel = (code?: string | null): string =>
  DOCTOR_SPECIALTIES.find((s) => s.value === code)?.label ?? code ?? '';
