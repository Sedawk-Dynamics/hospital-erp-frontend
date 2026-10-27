// Doctor specialties — the single source of truth for the specialty dropdown,
// calculator mapping and specialty-specific consultation fields.
// `value` MUST match the backend Prisma enum `DoctorSpecialty`.

export const DOCTOR_SPECIALTIES = [
  { value: 'general_internal_medicine', label: 'General / Internal Medicine' },
  { value: 'emergency_casualty', label: 'Emergency & Casualty' },
  { value: 'intensive_care_unit', label: 'Intensive Care Unit (ICU)' },
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
  { value: 'urology_andrology', label: 'Urology & Andrology' },
  { value: 'diabetology_endocrinology', label: 'Diabetology & Endocrinology' },
  { value: 'oncology', label: 'Oncology (Med/Surg/Rad)' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'ent_otolaryngology', label: 'ENT (Otolaryngology)' },
  { value: 'dermatology_cosmetology', label: 'Dermatology & Cosmetology' },
  { value: 'psychiatry_mental_health', label: 'Psychiatry & Mental Health' },
  { value: 'dental_surgery', label: 'Dental Surgery' },
  { value: 'ultrasound_diagnostic_radiology', label: 'Ultrasound & Diagnostic Radiology' },
] as const;

export type DoctorSpecialtyCode = (typeof DOCTOR_SPECIALTIES)[number]['value'];

export const SPECIALTY_CODES = DOCTOR_SPECIALTIES.map((s) => s.value);

export const specialtyLabel = (code?: string | null): string =>
  DOCTOR_SPECIALTIES.find((s) => s.value === code)?.label ?? code ?? '';
