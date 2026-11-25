import { z } from 'zod/v4';

/** Empty string / null → undefined, else coerced to a non-negative number. */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().optional(),
);

const yesNo = z.enum(['yes', 'no']).optional();

// 1. Fluid Balance -----------------------------------------------------------
export const URINE_CHARACTERS = ['clear_amber', 'hazy_cloudy', 'hematuria', 'concentrated_dark'] as const;

export const fluidBalanceSchema = z.object({
  hour: z.string().min(1, 'Hour is required'),
  ivCrystMl: optionalNumber,
  bloodProdMl: optionalNumber,
  carrierMedMl: optionalNumber,
  enteralMl: optionalNumber,
  foleyUrineMl: optionalNumber,
  drainsIcdMl: optionalNumber,
  urineCharacter: z.enum(URINE_CHARACTERS).optional(),
});
export type FluidBalanceValues = z.infer<typeof fluidBalanceSchema>;

// 2. ABG + Ventilator --------------------------------------------------------
export const VENT_MODES = ['PRVC', 'VCV', 'PCV', 'PSV', 'NIV-BiPAP', 'HFNC'] as const;

export const abgVentSchema = z.object({
  ph: optionalNumber,
  paO2Mmhg: optionalNumber,
  paCo2Mmhg: optionalNumber,
  hco3Meql: optionalNumber,
  baseExcessMeql: optionalNumber,
  lactateMmoll: optionalNumber,
  fio2Pct: optionalNumber,
  sodiumMeql: optionalNumber,
  chlorideMeql: optionalNumber,
  mode: z.enum(VENT_MODES).optional(),
  tidalVolumeMl: optionalNumber,
  peepCmh2o: optionalNumber,
  pipCmh2o: optionalNumber,
  pplatCmh2o: optionalNumber,
  breathingRatePerMin: optionalNumber,
  ettCuffCmh2o: optionalNumber,
});
export type AbgVentValues = z.infer<typeof abgVentSchema>;

// 3. FAST-HUG + Sepsis -------------------------------------------------------
export const fastHugSepsisSchema = z.object({
  feeding: z.string().trim().optional(),
  analgesia: z.string().trim().optional(),
  sedation: z.string().trim().optional(),
  thromboprophylaxis: z.string().trim().optional(),
  headOfBed: z.string().trim().optional(),
  ulcerProphylaxis: z.string().trim().optional(),
  glucoseControl: z.string().trim().optional(),
  bowelCare: z.string().trim().optional(),
  bloodCulturesDone: yesNo,
  bloodCulturesTime: z.string().optional(),
  antibioticsGiven: yesNo,
  antibioticName: z.string().trim().optional(),
  lactateDone: yesNo,
  lactateMmoll: optionalNumber,
  fluidBolusGiven: yesNo,
  bolusVolumeMl: optionalNumber,
  vasopressorsStarted: yesNo,
  mapTargetReached: yesNo,
});
export type FastHugSepsisValues = z.infer<typeof fastHugSepsisSchema>;

// 4. Invasive Lines ----------------------------------------------------------
export const INVASIVE_LINE_STATUSES = ['active', 'removed'] as const;

export const invasiveLineSchema = z.object({
  deviceType: z.string().trim().min(1, 'Device type is required'),
  status: z.enum(INVASIVE_LINE_STATUSES).optional(),
  bodySite: z.string().trim().optional(),
  details: z.string().trim().optional(),
  insertedAt: z.string().optional(),
  insertedBy: z.string().trim().optional(),
  dressingDue: z.string().optional(),
});
export type InvasiveLineValues = z.infer<typeof invasiveLineSchema>;

// 5. Infusion Pumps ----------------------------------------------------------
export const infusionPumpSchema = z.object({
  noradSyringeMg: optionalNumber,
  noradDoseMcgKgMin: optionalNumber,
});
export type InfusionPumpValues = z.infer<typeof infusionPumpSchema>;

// 6. Severity Scores ---------------------------------------------------------
export const SOFA_KEYS = ['respiration', 'coagulation', 'liver', 'cardiovascular', 'cns', 'renal'] as const;

export const severityScoreSchema = z.object({
  sofaRespiration: optionalNumber,
  sofaCoagulation: optionalNumber,
  sofaLiver: optionalNumber,
  sofaCardiovascular: optionalNumber,
  sofaCns: optionalNumber,
  sofaRenal: optionalNumber,
  sofaTotal: optionalNumber,
  apacheScore: optionalNumber,
});
export type SeverityScoreValues = z.infer<typeof severityScoreSchema>;
