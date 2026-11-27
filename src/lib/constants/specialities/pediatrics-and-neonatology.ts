import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const pediatricsNeonatology: SpecialtyCategories = {
  dosing_fluids: [
    {
      heading: 'Live IAP Weight-Calibrated Liquid Formulary',
      inputs: [
        { key: 'dosingWeight', label: 'Dosing Weight', type: 'number', unit: 'kg' },
        {
          key: 'formulary',
          label: 'Formulary',
          type: 'table',
          columns: [
            { key: 'medicineName', label: 'Medicine Name', type: 'text' },
            { key: 'genericMolecule', label: 'Generic Molecule / Salt', type: 'text' },
            { key: 'form', label: 'Form', type: 'select', options: ['Syrup', 'Drops'] },
            { key: 'concentrationMg', label: 'Concentration', type: 'number', unit: 'mg' },
            { key: 'concentrationMl', label: 'per Vehicle', type: 'number', unit: 'mL' },
            { key: 'targetMgKgDose', label: 'Target mg/kg/dose', type: 'number', unit: 'mg/kg' },
            {
              key: 'schedule',
              label: 'Schedule/Frequency',
              type: 'select',
              options: ['OD', '1-0-1 BD', '1-1-1 TDS', 'QID q6h', 'SOS'],
            },
            { key: 'doses24h', label: 'Doses/24h', type: 'number' },
            {
              key: 'timing',
              label: 'Timing',
              type: 'select',
              options: ['After Food', 'Before Food', 'With Food'],
            },
            { key: 'durationDays', label: 'Duration', type: 'number', unit: 'days' },
            { key: 'maxMgKgDay', label: 'Max mg/kg/day Cap', type: 'number', unit: 'mg/kg' },
            { key: 'singleDoseMg', label: 'Single Dose', type: 'number', unit: 'mg', auto: true },
            { key: 'mlPerDose', label: 'mL/dose', type: 'number', unit: 'mL', auto: true },
            { key: 'total24h', label: '24h Total', type: 'number', unit: 'mg', auto: true },
            { key: 'capCheck', label: 'Cap Check', type: 'text', auto: true },
          ],
        },
        { key: 'toRx', label: 'To Rx', type: 'skeleton' },
        { key: 'pushAll', label: 'Push All', type: 'skeleton' },
      ],
    },
    {
      heading: 'Holliday-Segar 4-2-1 & IMNCI Rehydration',
      inputs: [
        {
          key: 'imnciPlan',
          label: 'IMNCI Plan',
          type: 'select',
          options: ['Plan A', 'Plan B', 'Plan C'],
        },
        { key: 'maintenanceRate', label: 'Maintenance Rate', type: 'number', unit: 'mL/hr', auto: true },
        { key: 'volume24h', label: '24h Volume', type: 'number', unit: 'mL', auto: true },
        { key: 'planBOrs4h', label: 'Plan B ORS 4h Volume', type: 'number', unit: 'mL', auto: true },
        { key: 'planCIvBolus', label: 'Plan C IV Bolus Volume', type: 'number', unit: 'mL', auto: true },
      ],
    },
  ],
  growth_charts: [],
  nicu_apgar_bilirubin_gir: [
    {
      heading: 'NNF Delivery Room APGAR',
      inputs: [
        { key: 'apgarHeartRate', label: 'Heart Rate', type: 'select', options: ['0', '1', '2'] },
        { key: 'apgarRespiratory', label: 'Respiratory Effort', type: 'select', options: ['0', '1', '2'] },
        { key: 'apgarMuscleTone', label: 'Muscle Tone', type: 'select', options: ['0', '1', '2'] },
        { key: 'apgarGrimace', label: 'Grimace/Reflex', type: 'select', options: ['0', '1', '2'] },
        { key: 'apgarAppearance', label: 'Appearance', type: 'select', options: ['0', '1', '2'] },
        { key: 'apgarTotal', label: 'Total APGAR Score', type: 'number', unit: '/10', auto: true },
      ],
    },
    {
      heading: 'NNF / AAP Neonatal Jaundice Screen',
      inputs: [
        { key: 'postnatalAgeHours', label: 'Postnatal Age (Hours of Life)', type: 'number', unit: 'h' },
        { key: 'totalSerumBilirubin', label: 'Total Serum Bilirubin', type: 'number', unit: 'mg/dL' },
        { key: 'phototherapyThreshold', label: 'Phototherapy Threshold', type: 'text', auto: true },
      ],
    },
    {
      heading: 'NICU Glucose Infusion Rate (GIR)',
      inputs: [
        { key: 'dextroseConcentration', label: 'IV Dextrose Concentration', type: 'number', unit: '%' },
        { key: 'dailyFluidQuota', label: 'Daily Fluid Quota', type: 'number', unit: 'mL/kg/day' },
        { key: 'girRate', label: 'GIR', type: 'number', unit: 'mg/kg/min', auto: true },
      ],
    },
  ],
  immunization_registry: [
    {
      heading: 'U-WIN / IAP Immunization Registry',
      inputs: [
        {
          key: 'vaccineSchedule',
          label: 'Vaccine Schedule',
          type: 'table',
          columns: [
            { key: 'ageMilestone', label: 'Age Milestone', type: 'text' },
            { key: 'vaccines', label: 'Vaccines (UIP / IAP Schedule)', type: 'text' },
            { key: 'routeSite', label: 'Route & Site', type: 'text' },
            { key: 'coldChainBatch', label: 'Cold-Chain Batch', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['DUE', 'GIVEN'] },
          ],
        },
      ],
    },
  ],
};

export const pediatricsNeonatologyLabels: SpecialtyCategoryLabels = {
  dosing_fluids: 'Dosing & Fluids',
  growth_charts: 'IAP/WHO Growth Charts',
  nicu_apgar_bilirubin_gir: 'NICU (APGAR, Bilirubin & GIR)',
  immunization_registry: 'U-WIN / IAP Immunization Registry',
};









































































