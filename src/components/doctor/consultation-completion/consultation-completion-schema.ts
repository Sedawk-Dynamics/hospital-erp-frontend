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

// FOLLOW_UP_PRESETS moved to `@/lib/follow-up`, alongside the interval-to-date
// arithmetic it is always used with. Two screens ask for a follow-up interval
// and they must offer the same choices.

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
// Note: vitals are not part of this form's payload. The Examination step shows
// the latest reading and offers inline capture via <RecordVitalsDialog/>, which
// posts to /clinical/vitals directly.

// A row may be left entirely blank (the form seeds one empty row); rows are
// filtered out on submit. Only a row that carries an ICD code must be named.
const diagnosisRowSchema = z
  .object({
    icdCode: z.string().optional(),
    snomedCode: z.string().optional(),
    diagnosisName: z.string().optional(),
    diagnosisType: z.enum(['primary', 'secondary', 'differential']),
  })
  .refine((d) => !d.icdCode?.trim() || !!d.diagnosisName?.trim(), {
    message: 'Name the diagnosis you picked an ICD code for',
    path: ['diagnosisName'],
  });

const medicineSchema = z.object({
  drugId: z.string().optional(),
  drugName: z.string().min(1, 'Drug name is required'),
  genericName: z.string().optional(),
  dosageForm: z.string().optional(),       // tablet, capsule, syrup, etc.
  strength: z.string().optional(),          // 500mg, 75mg/ml, etc.
  dose: z.string().optional(),              // legacy descriptive label, e.g. "1 Tablet"
  // Per-intake dose multiplier — how many units the patient takes each occasion.
  // Defaults to 1; multiplied into the auto Qty (freq × duration × dose). Kept
  // lenient (no positive() guard) so a transient 0/blank never blocks the form
  // submit trigger — the submit builder and calc sanitise ≤ 0 back to 1.
  doseQuantity: z.coerce.number().default(1).catch(1),
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

// ── Consultation Summary section keys ─────────────────────
//
// The consultation form lets the doctor pin individual SOAP sections so they
// flow into the Consultation Summary that the patient eventually sees. The
// section keys reuse the existing `DischargeSection` Prisma enum (which now
// also carries the OP-flow values) so we don't fork persistence.
export const CONSULTATION_PIN_SECTIONS = [
  'chief_complaint',
  'examination',
  'investigation',
  'diagnosis',
  'impression',
  'advice',
  'follow_up',
] as const;
export type ConsultationPinSection = (typeof CONSULTATION_PIN_SECTIONS)[number];

export const CONSULTATION_PIN_SECTION_LABELS: Record<ConsultationPinSection, string> = {
  chief_complaint: 'Chief Complaints',
  examination: 'Examination Findings',
  investigation: 'Investigations Summary',
  diagnosis: 'Diagnosis',
  impression: 'Impression',
  advice: 'Notes / Advice',
  follow_up: 'Follow-up',
};

const dischargePinSchema = z.object({
  dischargeSection: z.enum([
    'diagnosis',
    'hospital_course',
    'procedure',
    'medication',
    'follow_up',
    'advice',
    'general',
    'chief_complaint',
    'examination',
    'investigation',
    'impression',
  ]),
  content: z.string().min(1),
});

export const consultationCompletionSchema = z.object({
  // Step 1 — Examination
  // Chief complaint and diagnosis are NOT mandatory: a follow-up visit often
  // has neither a new complaint nor a new diagnosis, and requiring them left
  // the doctor unable to close the session at all. Blank diagnosis rows are
  // dropped before submit (see use-consultation-completion).
  chiefComplaint: z.string().optional(),
  generalExamination: z.string().optional(),
  systemicExamination: z.string().optional(),
  diagnoses: z.array(diagnosisRowSchema),

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
  // Notable labs / imaging already done by the patient — flows into
  // objective.investigations on the SOAP payload and into the Consultation
  // Summary when the doctor pins this section.
  investigationsSummary: z.string().optional(),
  // Set of section keys the doctor has pinned. The pins[] array is composed
  // from these on submit, picking up the latest section text. Stored in the
  // form draft so toggle state survives back-navigation / reload.
  pinnedSections: z.array(z.enum(CONSULTATION_PIN_SECTIONS)).default([]),
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

/**
 * Short per-intake unit label for the Dose field, derived from the dosage form.
 * Tablets/capsules count in pieces; liquids in ml; etc. Falls back to "unit".
 */
const DOSE_UNIT_LABELS: Record<string, string> = {
  tablet: 'tab',
  capsule: 'cap',
  syrup: 'ml',
  suspension: 'ml',
  solution: 'ml',
  drops: 'drop',
  injection: 'ml',
  inhaler: 'puff',
  cream: 'app',
  ointment: 'app',
  gel: 'app',
  powder: 'sachet',
};
export function getDoseUnitLabel(dosageForm?: string): string {
  if (!dosageForm) return 'unit';
  return DOSE_UNIT_LABELS[dosageForm.toLowerCase()] || 'unit';
}

// ── Default values ─────────────────────────────────────────

export const defaultMedicine: MedicineFormData = {
  drugId: '',
  drugName: '',
  genericName: '',
  dosageForm: '',
  strength: '',
  dose: '',
  doseQuantity: 1,
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
  diagnoses: [{ icdCode: '', snomedCode: '', diagnosisName: '', diagnosisType: 'primary' }],
  medicines: [],
  advice: '',
  followUpDate: '',
  followUpDuration: '',
  followUpDurationUnit: 'days',
  followUpNotes: '',
  referralNotes: '',
  physicalObservations: [],
  impression: '',
  investigationsSummary: '',
  pinnedSections: [],
  pins: [],
};
