import { z } from 'zod/v4';

/** The four rapid-response protocol codes. */
export const FAST_TRACK_CODES = [
  'code_red_trauma',
  'code_stemi',
  'code_stroke',
  'code_sepsis',
] as const;

export type FastTrackCode = (typeof FAST_TRACK_CODES)[number];

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().min(0).optional(),
);

const efastSchema = z.object({
  ruq: z.string(),
  luq: z.string(),
  suprapubic: z.string(),
  pericardium: z.string(),
  thoracic: z.string(),
});

export const traumaSchema = z.object({
  code: z.literal('code_red_trauma'),
  prbcUnits: optionalNumber,
  ffpUnits: optionalNumber,
  plateletPacks: optionalNumber,
  txaGiven: z.boolean(),
  txaGivenAt: z.string().nullable(),
  efast: efastSchema,
});

export const stemiSchema = z.object({
  code: z.literal('code_stemi'),
  ecgTime: optionalNumber,
  balloonTime: optionalNumber,
  infarctTerritory: z.string().trim(),
  aspirinGiven: z.boolean(),
  ticagrelorGiven: z.boolean(),
  atorvastatinGiven: z.boolean(),
});

export const strokeSchema = z.object({
  code: z.literal('code_stroke'),
  ctTime: optionalNumber,
  lkwWindow: optionalNumber,
  nihssScore: optionalNumber,
  facialDroop: z.string().trim(),
  armDrift: z.string().trim(),
  speech: z.string().trim(),
  bloodGlucose: optionalNumber,
});

export const sepsisSchema = z.object({
  code: z.literal('code_sepsis'),
  serumLactate: optionalNumber,
  bloodCulturesDrawn: z.boolean(),
  antibioticsGiven: z.boolean(),
  crystalloidDone: z.boolean(),
});

export const fastTrackCodeSchema = z.discriminatedUnion('code', [
  traumaSchema,
  stemiSchema,
  strokeSchema,
  sepsisSchema,
]);

export type FastTrackCodeFormValues = z.infer<typeof fastTrackCodeSchema>;
