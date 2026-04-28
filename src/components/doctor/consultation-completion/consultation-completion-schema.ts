import { z } from 'zod';

// ── Frequency options (eka-care style: M-A-N notation) ────
export const FREQUENCY_OPTIONS = [
  'SOS',
  'Stat',
  '0-0-1',
  '0-1-0',
  '1-0-0',
  '0-1-1',
  '1-0-1',
  '1-1-0',
  '1-1-1',
  '1/2-0-1/2',
  '1/2-1/2-0',
  '0-0-2',
  '0-2-0',
  '2-0-0',
  '0-2-2',
  '2-0-2',
  '2-2-0',
  '2-2-2',
] as const;

// ── Timing / meal relation options ────────────────────────
export const TIMING_OPTIONS = [
  'After Meal',
  'Before Meal',
  'With Meal',
  'Empty Stomach',
  'Before Breakfast',
  'After Breakfast',
  'Before Lunch',
  'After Lunch',
  'Before Dinner',
  'After Dinner',
  'At Bedtime',
] as const;

/** Quick-select presets for follow-up duration */
export const FOLLOW_UP_PRESETS = [
  { label: '3 Days', value: 3, unit: 'days' },
  { label: '5 Days', value: 5, unit: 'days' },
  { label: '1 Week', value: 1, unit: 'weeks' },
  { label: '2 Weeks', value: 2, unit: 'weeks' },
  { label: '1 Month', value: 1, unit: 'months' },
  { label: '3 Months', value: 3, unit: 'months' },
  { label: '6 Months', value: 6, unit: 'months' },
] as const;

// Legacy exports kept for backward-compat with MedicineCard display
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

// ── Dosage form labels for badge display ──────────────────
export const DOSAGE_FORM_LABELS: Record<string, string> = {
  tablet: 'Tab',
  capsule: 'Cap',
  syrup: 'Syr',
  injection: 'Inj',
  cream: 'Crm',
  drops: 'Drp',
  inhaler: 'Inh',
  ointment: 'Oint',
  gel: 'Gel',
  powder: 'Pwd',
  suspension: 'Susp',
  solution: 'Sol',
};

// ── Zod schema ─────────────────────────────────────────────
//
// Note: a `vitals` schema once lived here so doctors could record vital signs
// inline during a consultation. Vitals are now nursing-owned — only nurses
// (and the supervisory nurse roles) can write — so the field is removed from
// the form. The Examination step renders the latest nurse-recorded reading
// read-only via `useLatestVitals`.

const diagnosisRowSchema = z.object({
  icdCode: z.string().optional(),
  diagnosisName: z.string().min(1, 'Diagnosis name is required'),
  diagnosisType: z.enum(['primary', 'secondary', 'differential']),
});

const medicineSchema = z.object({
  drugId: z.string().optional(),
  drugName: z.string().min(1, 'Drug name is required'),
  genericName: z.string().optional(),
  dosageForm: z.string().optional(),       // tablet, capsule, syrup, etc.
  strength: z.string().optional(),          // 500mg, 75mg/ml, etc.
  dose: z.string().optional(),              // e.g. "1 Tablet", "5 ml"
  frequency: z.string().optional(),         // e.g. "1-0-1", "SOS", "Stat"
  timing: z.string().optional(),            // e.g. "After Meal", "Before Meal"
  durationValue: z.string().optional(),
  durationUnit: z.enum(['days', 'weeks', 'months']).default('days'),
  route: z.string().default('oral'),
  instructions: z.string().optional(),
  quantity: z.coerce.number().optional(),
  // Legacy fields kept for backward compat during transition
  dosage: z.string().optional(),
  timings: z.object({
    Morning: z.boolean(),
    Afternoon: z.boolean(),
    Evening: z.boolean(),
    Night: z.boolean(),
  }).optional(),
  mealRelation: z.enum(['Before Food', 'After Food', 'With Food']).optional(),
  isPrn: z.boolean().default(false),
});

// ── Progress Note SOAP extras ─────────────────────────────
// Physical observation finding — either a catalog pick (bound by
// catalogId) or a free-text entry. Matches the PhysicalObservationsPicker
// shape used across the consultation page and any standalone views.
const physicalObservationEntrySchema = z.object({
  source: z.enum(['catalog', 'free_text']),
  catalogId: z.string().optional(),
  value: z.string().min(1),
  system: z.string().optional(),
});

const dischargePinSchema = z.object({
  dischargeSection: z.enum([
    'diagnosis',
    'hospital_course',
    'procedure',
    'medication',
    'follow_up',
    'advice',
    'general',
  ]),
  content: z.string().min(1),
});

export const consultationCompletionSchema = z.object({
  // Step 1 — Examination
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  generalExamination: z.string().optional(),
  systemicExamination: z.string().optional(),
  // Vitals are recorded by the nursing team and only displayed read-only on
  // this step — they are not part of the consultation form payload.
  diagnoses: z.array(diagnosisRowSchema).min(1, 'At least one diagnosis is required'),

  // Step 2 — Prescription (optional — doctor may not prescribe)
  medicines: z.array(medicineSchema),

  // Step 3 — Advice
  advice: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpDuration: z.string().optional(),
  followUpDurationUnit: z.string().optional(),
  followUpNotes: z.string().optional(),
  referralNotes: z.string().optional(),

  // Progress Note SOAP extras (persisted into the ProgressNote's SOAP
  // JSON columns + pins table by use-consultation-completion.ts)
  physicalObservations: z.array(physicalObservationEntrySchema).default([]),
  impression: z.string().optional(),
  pins: z.array(dischargePinSchema).default([]),
});

export type ConsultationFormData = z.infer<typeof consultationCompletionSchema>;
export type MedicineFormData = z.infer<typeof medicineSchema>;
export type DiagnosisRow = z.infer<typeof diagnosisRowSchema>;

// ── Frequency encoding/decoding ────────────────────────────

/** Build a frequency string for the API: "1-0-1 - After Meal" */
export function encodeFrequency(
  frequency: string | undefined,
  timing: string | undefined,
  isPrn?: boolean,
): string {
  if (isPrn || frequency === 'SOS') return 'As Needed (SOS)';
  if (frequency === 'Stat') return 'Stat';
  if (!frequency) return timing || '';
  return timing ? `${frequency} - ${timing}` : frequency;
}

/**
 * Legacy overload: accepts old timings object for backward compat.
 * Kept so use-consultation-completion.ts doesn't break during transition.
 */
export function encodeFrequencyLegacy(
  timings: Record<TimingSlot, boolean>,
  mealRelation: MealRelation,
  isPrn: boolean,
): string {
  if (isPrn) return 'As Needed (SOS)';
  const active = TIMING_SLOTS.filter((s) => timings[s]);
  if (active.length === 0) return mealRelation;
  return `${active.join(', ')} - ${mealRelation}`;
}

/** Parse "1-0-1 - After Meal" or legacy format → structured data */
export function parseFrequencyToSchedule(frequency: string) {
  const result = {
    morning: false,
    afternoon: false,
    evening: false,
    night: false,
    mealRelation: '' as string,
    isPrn: false,
    raw: frequency,
    // New-style parsed fields
    frequencyCode: '' as string,
    timingLabel: '' as string,
  };

  if (!frequency) return result;

  if (frequency.toLowerCase().includes('as needed') || frequency.toLowerCase().includes('sos')) {
    result.isPrn = true;
    result.frequencyCode = 'SOS';
    return result;
  }

  if (frequency.toLowerCase() === 'stat') {
    result.frequencyCode = 'Stat';
    return result;
  }

  const parts = frequency.split(' - ');
  const freqPart = parts[0] || '';
  const timingPart = parts[1] || '';

  result.frequencyCode = freqPart;
  result.timingLabel = timingPart;
  result.mealRelation = timingPart;

  // Parse M-A-N notation (e.g. "1-0-1") into booleans
  const freqMatch = freqPart.match(/^(\d+(?:\/\d+)?)-(\d+(?:\/\d+)?)-(\d+(?:\/\d+)?)$/);
  if (freqMatch) {
    result.morning = freqMatch[1] !== '0';
    result.afternoon = freqMatch[2] !== '0';
    result.night = freqMatch[3] !== '0';
  } else {
    // Legacy format: "Morning, Evening"
    const timingLower = freqPart.toLowerCase();
    result.morning = timingLower.includes('morning');
    result.afternoon = timingLower.includes('afternoon');
    result.evening = timingLower.includes('evening');
    result.night = timingLower.includes('night');
  }

  return result;
}

/** Build duration string like "5 days" */
export function encodeDuration(value: string, unit: string): string {
  return `${value} ${unit}`;
}

/** Get dose form label for badge (e.g. "tablet" → "Tab") */
export function getDosageFormBadge(dosageForm?: string): string {
  if (!dosageForm) return '';
  return DOSAGE_FORM_LABELS[dosageForm.toLowerCase()] || dosageForm;
}

// ── Default values ─────────────────────────────────────────

export const defaultMedicine: MedicineFormData = {
  drugId: '',
  drugName: '',
  genericName: '',
  dosageForm: '',
  strength: '',
  dose: '',
  frequency: '',
  timing: '',
  durationValue: '',
  durationUnit: 'days',
  route: 'oral',
  instructions: '',
  quantity: undefined,
  dosage: '',
  timings: { Morning: false, Afternoon: false, Evening: false, Night: false },
  mealRelation: 'After Food',
  isPrn: false,
};

export const defaultFormValues: ConsultationFormData = {
  chiefComplaint: '',
  generalExamination: '',
  systemicExamination: '',
  diagnoses: [{ icdCode: '', diagnosisName: '', diagnosisType: 'primary' }],
  medicines: [],
  advice: '',
  followUpDate: '',
  followUpDuration: '',
  followUpDurationUnit: 'days',
  followUpNotes: '',
  referralNotes: '',
  physicalObservations: [],
  impression: '',
  pins: [],
};
