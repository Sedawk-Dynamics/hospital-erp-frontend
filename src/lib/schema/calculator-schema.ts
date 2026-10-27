import { z } from 'zod/v4';


export const CALCULATOR_DEPARTMENTS = [
  'all',
  'cardiology',
  'nephrology',
  'neurology',
  'pediatrics',
  'general_medicine',
  'orthopedics',
  'gynecology',
] as const;

export const BAND_COLORS = ['emerald', 'amber', 'rose', 'sky', 'gray'] as const;

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().optional(),
);

export const calculatorVariableSchema = z.object({
  variableId: z
    .string()
    .trim()
    .min(1, 'Variable ID is required')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Use letters, numbers and underscore; must start with a letter'),
  name: z.string().trim().min(1, 'Name is required'),
  unit: z.string().trim().optional(),
  min: optionalNumber,
  max: optionalNumber,
  step: optionalNumber,
  defaultValue: optionalNumber,
});

export const calculatorBandSchema = z.object({
  min: optionalNumber,
  max: optionalNumber,
  label: z.string().trim().min(1, 'Label is required'),
  color: z.enum(BAND_COLORS),
  recommendation: z.string().trim().optional(),
});

export const calculatorBasicInfoSchema = z.object({
  name: z.string().trim().min(1, 'Calculator name is required'),
  department: z.enum(CALCULATOR_DEPARTMENTS).default('all'),
  description: z.string().trim().optional(),
  resultUnit: z.string().trim().optional(),
  resultDecimals: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 2 : Number(v)),
    z.number().int().min(0).max(6),
  ),
});

export const calculatorExpressionSchema = z.object({
  expression: z.string().trim().min(1, 'Expression is required'),
});

export const calculatorSchema = z.object({
  ...calculatorBasicInfoSchema.shape,
  ...calculatorExpressionSchema.shape,
  variables: z.array(calculatorVariableSchema).min(1, 'Add at least one variable'),
  bands: z.array(calculatorBandSchema).default([]),
});


export type CalculatorBasicInfo = z.infer<typeof calculatorBasicInfoSchema>;
export type CalculatorVariable = z.infer<typeof calculatorVariableSchema>;
export type CalculatorBand = z.infer<typeof calculatorBandSchema>;
export type CalculatorExpression = z.infer<typeof calculatorExpressionSchema>;
export type CalculatorFormValues = z.infer<typeof calculatorSchema>;
