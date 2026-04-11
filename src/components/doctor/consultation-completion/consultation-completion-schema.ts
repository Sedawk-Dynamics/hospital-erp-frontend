import { z } from 'zod';

// ── Timing & Meal helpers ──────────────────────────────────

export const TIMING_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;
export type TimingSlot = (typeof TIMING_SLOTS)[number];

export const MEAL_OPTIONS = ['Before Food', 'After Food', 'With Food'] as const;
export type MealRelation = (typeof MEAL_OPTIONS)[number];

export const DURATION_UNITS = ['days', 'weeks', 'months'] as const;

export const ROUTE_OPTIONS = [
  { value: 'oral', label: 'Oral' },
  { value: 'iv', label: 'IV' },
  { value: 'im', label: 'IM' },
  { value: 'topical', label: 'Topical' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'inhalation', label: 'Inhalation' },
  { value: 'other', label: 'Other' },
] as const;

// ── Zod schema ─────────────────────────────────────────────

const vitalsSchema = z.object({
  temperature: z.coerce.number().min(25, 'Min 25°C').max(50, 'Max 50°C').optional(),
  bloodPressureSystolic: z.coerce.number().int().min(0).max(400, 'Max 400').optional(),
  bloodPressureDiastolic: z.coerce.number().int().min(0).max(300, 'Max 300').optional(),
  pulseRate: z.coerce.number().int().min(0).max(300, 'Max 300 bpm').optional(),
  respiratoryRate: z.coerce.number().int().min(0).max(100, 'Max 100/min').optional(),
  oxygenSaturation: z.coerce.number().min(0).max(100, 'Max 100%').optional(),
  weightKg: z.coerce.number().min(0).max(700, 'Max 700 kg').optional(),
  heightCm: z.coerce.number().min(0).max(300, 'Max 300 cm').optional(),
  bloodSugar: z.coerce.number().min(0).max(2000, 'Max 2000').optional(),
});

const diagnosisRowSchema = z.object({
  icdCode: z.string().optional(),
  diagnosisName: z.string().min(1, 'Diagnosis name is required'),
  diagnosisType: z.enum(['primary', 'secondary', 'differential']),
});

const medicineSchema = z.object({
  drugId: z.string().optional(),
  drugName: z.string().min(1, 'Drug name is required'),
  genericName: z.string().optional(),
  dosage: z.string().min(1, 'Dosage is required'),
  timings: z.object({
    Morning: z.boolean(),
    Afternoon: z.boolean(),
    Evening: z.boolean(),
    Night: z.boolean(),
  }),
  mealRelation: z.enum(['Before Food', 'After Food', 'With Food']),
  durationValue: z.string().min(1, 'Duration is required'),
  durationUnit: z.enum(['days', 'weeks', 'months']),
  route: z.string().default('oral'),
  instructions: z.string().optional(),
  quantity: z.coerce.number().optional(),
  isPrn: z.boolean().default(false),
});

export const consultationCompletionSchema = z.object({
  // Step 1 — Examination
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  generalExamination: z.string().optional(),
  systemicExamination: z.string().optional(),
  vitals: vitalsSchema,
  diagnoses: z.array(diagnosisRowSchema).min(1, 'At least one diagnosis is required'),

  // Step 2 — Prescription (optional — doctor may not prescribe)
  medicines: z.array(medicineSchema),

  // Step 3 — Advice
  advice: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpNotes: z.string().optional(),
  referralNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export type ConsultationFormData = z.infer<typeof consultationCompletionSchema>;
export type MedicineFormData = z.infer<typeof medicineSchema>;
export type DiagnosisRow = z.infer<typeof diagnosisRowSchema>;

// ── Frequency encoding/decoding ────────────────────────────

/** Build a frequency string like "Morning, Evening - After Food" */
export function encodeFrequency(
  timings: Record<TimingSlot, boolean>,
  mealRelation: MealRelation,
  isPrn: boolean,
): string {
  if (isPrn) return 'As Needed (SOS)';
  const active = TIMING_SLOTS.filter((s) => timings[s]);
  if (active.length === 0) return mealRelation;
  return `${active.join(', ')} - ${mealRelation}`;
}

/** Parse "Morning, Evening - After Food" → structured data */
export function parseFrequencyToSchedule(frequency: string) {
  const result = {
    morning: false,
    afternoon: false,
    evening: false,
    night: false,
    mealRelation: '' as string,
    isPrn: false,
    raw: frequency,
  };

  if (!frequency) return result;

  if (frequency.toLowerCase().includes('as needed') || frequency.toLowerCase().includes('sos')) {
    result.isPrn = true;
    return result;
  }

  const parts = frequency.split(' - ');
  const timingPart = parts[0] || '';
  result.mealRelation = parts[1] || '';

  const timingLower = timingPart.toLowerCase();
  result.morning = timingLower.includes('morning');
  result.afternoon = timingLower.includes('afternoon');
  result.evening = timingLower.includes('evening');
  result.night = timingLower.includes('night');

  // If no timing was parsed, this might be a legacy format
  if (!result.morning && !result.afternoon && !result.evening && !result.night && !result.mealRelation) {
    return { ...result, raw: frequency };
  }

  return result;
}

/** Build duration string like "5 days" */
export function encodeDuration(value: string, unit: string): string {
  return `${value} ${unit}`;
}

// ── Default values ─────────────────────────────────────────

export const defaultMedicine: MedicineFormData = {
  drugId: '',
  drugName: '',
  genericName: '',
  dosage: '',
  timings: { Morning: false, Afternoon: false, Evening: false, Night: false },
  mealRelation: 'After Food',
  durationValue: '',
  durationUnit: 'days',
  route: 'oral',
  instructions: '',
  quantity: undefined,
  isPrn: false,
};

export const defaultFormValues: ConsultationFormData = {
  chiefComplaint: '',
  generalExamination: '',
  systemicExamination: '',
  vitals: {
    temperature: undefined,
    bloodPressureSystolic: undefined,
    bloodPressureDiastolic: undefined,
    pulseRate: undefined,
    respiratoryRate: undefined,
    oxygenSaturation: undefined,
    weightKg: undefined,
    heightCm: undefined,
    bloodSugar: undefined,
  },
  diagnoses: [{ icdCode: '', diagnosisName: '', diagnosisType: 'primary' }],
  medicines: [],
  advice: '',
  followUpDate: '',
  followUpNotes: '',
  referralNotes: '',
  additionalNotes: '',
};
