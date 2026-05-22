// Curated catalog of common lab-test units, grouped so the unit picker can
// show them in sensible buckets. Hospital admins / super-admins can either
// pick from this list or type a custom value — the field stays free-text
// at the schema level (max 50 chars), this just makes 95% of cases a
// two-click action instead of typing.
//
// Keep entries ordered by frequency-of-use within each group so the most
// common picks bubble to the top.

export interface LabUnitOption {
  value: string;
  label: string;
}

export interface LabUnitGroup {
  group: string;
  units: LabUnitOption[];
}

export const LAB_UNIT_GROUPS: LabUnitGroup[] = [
  {
    group: 'Concentration (mass)',
    units: [
      { value: 'mg/dL', label: 'mg/dL' },
      { value: 'g/dL', label: 'g/dL' },
      { value: 'µg/dL', label: 'µg/dL (microgram per dL)' },
      { value: 'ng/dL', label: 'ng/dL (nanogram per dL)' },
      { value: 'mg/L', label: 'mg/L' },
      { value: 'g/L', label: 'g/L' },
      { value: 'µg/L', label: 'µg/L' },
      { value: 'ng/mL', label: 'ng/mL' },
      { value: 'pg/mL', label: 'pg/mL' },
      { value: 'mg%', label: 'mg% (mg per 100 mL)' },
    ],
  },
  {
    group: 'Concentration (molar)',
    units: [
      { value: 'mmol/L', label: 'mmol/L' },
      { value: 'µmol/L', label: 'µmol/L' },
      { value: 'nmol/L', label: 'nmol/L' },
      { value: 'pmol/L', label: 'pmol/L' },
      { value: 'mEq/L', label: 'mEq/L' },
    ],
  },
  {
    group: 'Hematology counts',
    units: [
      { value: '10^3/µL', label: '10³/µL (thousand per µL)' },
      { value: '10^6/µL', label: '10⁶/µL (million per µL)' },
      { value: '10^9/L', label: '10⁹/L' },
      { value: '10^12/L', label: '10¹²/L' },
      { value: 'cells/µL', label: 'cells/µL' },
      { value: 'cells/HPF', label: 'cells/HPF (per high-power field)' },
      { value: 'cells/LPF', label: 'cells/LPF (per low-power field)' },
      { value: '/cumm', label: '/cumm (per cubic mm)' },
    ],
  },
  {
    group: 'RBC indices',
    units: [
      { value: 'fL', label: 'fL (femtolitre — MCV)' },
      { value: 'pg', label: 'pg (picogram — MCH)' },
    ],
  },
  {
    group: 'Percentages & ratios',
    units: [
      { value: '%', label: '%' },
      { value: 'ratio', label: 'ratio' },
      { value: 'index', label: 'index' },
    ],
  },
  {
    group: 'Enzymes & activity',
    units: [
      { value: 'U/L', label: 'U/L (units per litre)' },
      { value: 'IU/L', label: 'IU/L (international units per litre)' },
      { value: 'IU/mL', label: 'IU/mL' },
      { value: 'mIU/L', label: 'mIU/L' },
      { value: 'µIU/mL', label: 'µIU/mL' },
      { value: 'kU/L', label: 'kU/L' },
    ],
  },
  {
    group: 'Coagulation & rates',
    units: [
      { value: 'seconds', label: 'seconds (PT, APTT, BT, CT)' },
      { value: 'mm/hr', label: 'mm/hr (ESR)' },
      { value: 'ng/mL FEU', label: 'ng/mL FEU (D-Dimer)' },
      { value: 'µg/mL FEU', label: 'µg/mL FEU' },
    ],
  },
  {
    group: 'Renal / eGFR',
    units: [
      { value: 'mL/min', label: 'mL/min' },
      { value: 'mL/min/1.73m²', label: 'mL/min/1.73m² (eGFR)' },
    ],
  },
  {
    group: 'Specific gravity & pH',
    units: [
      { value: 'SG', label: 'specific gravity' },
      { value: 'pH', label: 'pH' },
    ],
  },
  {
    group: 'Pressure / gas',
    units: [
      { value: 'mmHg', label: 'mmHg' },
      { value: 'kPa', label: 'kPa' },
    ],
  },
  {
    group: 'Volume',
    units: [
      { value: 'mL', label: 'mL' },
      { value: 'L', label: 'L' },
      { value: 'mL/24h', label: 'mL/24h' },
    ],
  },
  {
    group: 'Titres / serology',
    units: [
      { value: 'titre', label: 'titre (e.g. 1:80)' },
      { value: 'COI', label: 'COI (cut-off index)' },
      { value: 'S/CO', label: 'S/CO (signal-to-cutoff)' },
      { value: 'AU/mL', label: 'AU/mL (arbitrary units)' },
    ],
  },
];

// Flat list of all units, useful for quick lookups and the "find or add"
// behaviour of the unit picker.
export const LAB_UNIT_VALUES: string[] = LAB_UNIT_GROUPS.flatMap((g) =>
  g.units.map((u) => u.value),
);

// Default unit hint shown in the picker placeholder. We *do not* default-
// fill the field for parameters — most parameters have no unit, and a
// default would create misleading reports.
export const DEFAULT_UNIT_PLACEHOLDER = 'mg/dL';
