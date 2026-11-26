// Shared types + static config for the calculator builder wizard.
// The dialog owns all state; step components receive it via props.

import {
  type CalculatorBasicInfo,
  type CalculatorBand,
  type CalculatorVariable,
} from '@/lib/schema/calculator-schema';

// ── Basic details ────────────────────────────────────────────────────────
export type FieldType = 'text' | 'textarea' | 'number' | 'select';

export interface FieldDef {
  key: keyof CalculatorBasicInfo;
  label: string;
  type: FieldType;
  placeholder?: string;
  span?: string;
  options?: { value: string; label: string }[];
  min?: string;
  max?: string;
}

export const BASIC_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Calculator name *', type: 'text', placeholder: 'e.g. "BMI Calculator"', span: 'sm:col-span-2' },
  { key: 'resultUnit', label: 'Result unit', type: 'text', placeholder: 'e.g. "kg/m²", "points"', span: 'sm:col-span-1' },
  { key: 'resultDecimals', label: 'Result decimals', type: 'number', min: '0', max: '6', span: 'sm:col-span-1' },
  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What does this calculator do?', span: 'sm:col-span-4' },
];

// ── Variables: the inputs this calculator asks the user for ────────────────
export interface Variable {
  variableId: string;
  name: string; 
  unit: string;
  min: string;
  max: string;
  step: string;
  defaultValue: string;
}

export const EMPTY_VARIABLE: Variable = {
  variableId: '',
  name: '',
  unit: '',
  min: '',
  max: '',
  step: '',
  defaultValue: '',
};

export const VAR_FIELDS: {
  key: keyof CalculatorVariable;
  label: string;
  type: 'text' | 'number';
  placeholder?: string;
  span: string;
}[] = [
  { key: 'variableId', label: 'Variable ID', type: 'text', placeholder: 'e.g. wt', span: 'sm:col-span-2' },
  { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Weight', span: 'sm:col-span-2' },
  { key: 'unit', label: 'Unit', type: 'text', placeholder: 'e.g. kg', span: 'sm:col-span-2' },
  { key: 'min', label: 'Min', type: 'number', span: 'sm:col-span-1' },
  { key: 'max', label: 'Max', type: 'number', span: 'sm:col-span-1' },
  { key: 'defaultValue', label: 'Default', type: 'number', span: 'sm:col-span-1' },
];

// ── Interpretation bands: how to read the result across ranges ─────────────
export interface Band {
  min: string;
  max: string;
  label: string; // e.g. "Normal", "High Risk"
  color: string; // emerald / amber / rose …
  recommendation: string; // clinical advice shown for that band
}

export const EMPTY_BAND: Band = {
  min: '',
  max: '',
  label: '',
  color: 'emerald',
  recommendation: '',
};

export const BAND_COLORS = [
  { value: 'emerald', label: 'Emerald (good)' },
  { value: 'amber', label: 'Amber (caution)' },
  { value: 'rose', label: 'Rose (high risk)' },
  { value: 'sky', label: 'Sky (info)' },
  { value: 'gray', label: 'Gray (neutral)' },
];

export const BAND_FIELDS: {
  key: keyof CalculatorBand;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  span: string;
  options?: { value: string; label: string }[];
}[] = [
  { key: 'min', label: 'Min', type: 'number', span: 'sm:col-span-1' },
  { key: 'max', label: 'Max', type: 'number', span: 'sm:col-span-1' },
  { key: 'label', label: 'Label', type: 'text', placeholder: 'e.g. Normal', span: 'sm:col-span-2' },
  { key: 'color', label: 'Color', type: 'select', options: BAND_COLORS, span: 'sm:col-span-2' },
  { key: 'recommendation', label: 'Recommendation', type: 'text', placeholder: 'Clinical advice for this band', span: 'sm:col-span-3' },
];
