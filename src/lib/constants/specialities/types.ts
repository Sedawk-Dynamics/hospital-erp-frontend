export type FieldType =
  | 'text' // single-line free text
  | 'textarea' // multi-line notes
  | 'number' // numeric input (optional `unit`)
  | 'datetime' // date + time (optional `nowButton`)
  | 'select' // dropdown (one of `options`)
  | 'multiselect' // checkboxes (many of `options`)
  | 'buttons' // segmented single-choice (one of `options`)
  | 'checkbox' // boolean; may reveal nested `fields` when checked
  | 'table' // grid of `columns`; `rows` = fixed rows, else user adds rows
  | 'skeleton'; // interactive skeleton diagram — place marker(s) on bones

export interface SpecialtyField {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  nowButton?: boolean;
  placeholder?: string;
  fields?: SpecialtyField[];
  auto?: boolean;
  min?: number;
  max?: number;
  dependsOn?: string;
  optionsByParent?: Record<string, string[]>;
  visibleWhen?: { field: string; equals: string | string[] };
  columns?: SpecialtyField[];
  rows?: string[];
}

export interface SpecialtyGroup {
  heading?: string;
  inputs: SpecialtyField[];
}

export type SpecialtyCategories = Record<string, SpecialtyGroup[]>;

export type SpecialtyCategoryLabels = Record<string, string>;
