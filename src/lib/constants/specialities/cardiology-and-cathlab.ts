import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const cardiologyCathLab: SpecialtyCategories = {
  ecg_qtc: [
    {
      heading: '12-Lead ECG Quantitative Intervals & STEMI India Localization',
      inputs: [
        {
          key: 'rhythm',
          label: 'Underlying Rhythm',
          type: 'select',
          options: [
            'Normal Sinus Rhythm',
            'Sinus Tachycardia',
            'AF (Non-Valvular)',
            'AF (Rheumatic MS)',
            'Complete Heart Block (3° AVB)',
            'New LBBB (Sgarbossa)',
          ],
        },
        { key: 'ventricularRate', label: 'Ventricular Rate', type: 'number', unit: 'bpm' },
        { key: 'hsTroponinI', label: 'hs-Troponin I', type: 'number', unit: 'ng/L' },
        { key: 'prInterval', label: 'PR Interval (120–200)', type: 'number', unit: 'ms' },
        { key: 'qrsDuration', label: 'QRS Duration (<120)', type: 'number', unit: 'ms' },
        { key: 'qtUncorrected', label: 'Uncorrected QT', type: 'number', unit: 'ms' },
        { key: 'qrsAxis', label: 'QRS Frontal Axis', type: 'number', unit: '°' },
        {
          key: 'stCulpritTerritory',
          label: 'ST-T Segment Culprit Territory (STEMI India)',
          type: 'select',
          options: [
            'No Acute ST-Elevation',
            'Anterior Wall (V1–V4, LAD)',
            'Inferior Wall (II, III, aVF, RCA)',
            'High Lateral (I, aVL, V5–V6, LCx)',
            'Diffuse ST-Depression + aVR (Left Main/TVD)',
          ],
        },
        { key: 'qtcBazett', label: 'QTc Bazett', type: 'number', unit: 'ms', auto: true },
      ],
    },
  ],
  echo_doppler: [
    {
      heading: 'IAE Structured Transthoracic 2D Echo',
      inputs: [
        { key: 'lvef', label: 'Biplane LVEF', type: 'number', unit: '%' },
        { key: 'lvidd', label: 'LVIDd', type: 'number', unit: 'mm' },
        { key: 'lvids', label: 'LVIDs', type: 'number', unit: 'mm' },
        { key: 'laSize', label: 'LA Size', type: 'number', unit: 'mm' },
        { key: 'rvspPasp', label: 'RVSP / PASP', type: 'number', unit: 'mmHg' },
        { key: 'tapse', label: 'TAPSE', type: 'number', unit: 'mm' },
        {
          key: 'rwma',
          label: 'Regional Wall Motion Abnormality (RWMA)',
          type: 'textarea',
        },
        { key: 'aorticPericardiumIvc', label: 'Aortic Valve & Pericardium / IVC', type: 'text' },
        {
          key: 'lvDiastolicFunction',
          label: 'LV Diastolic Function & E/e′ Filling Pressure',
          type: 'text',
        },
        {
          key: 'valveMorphology',
          label: 'Mitral / Tricuspid / Rheumatic Valve Morphology',
          type: 'text',
        },
        { key: 'hfPhenotype', label: 'HF Phenotype (from LVEF)', type: 'text', auto: true },
      ],
    },
  ],
  cath_lab_registry: [
    {
      heading: 'Coronary Angiography (CAG) & NPPA Drug-Eluting Stent (DES) Log',
      inputs: [
        {
          key: 'arterialAccess',
          label: 'Arterial Access Route',
          type: 'select',
          options: ['Right Transradial (6Fr)', 'Distal Snuffbox Radial', 'Right Femoral (7Fr)'],
        },
        {
          key: 'contrastVolume',
          label: 'Iohexol / Iodixanol Contrast',
          type: 'number',
          unit: 'mL',
        },
        {
          key: 'baselineCreatinine',
          label: 'Baseline Serum Creatinine',
          type: 'number',
          unit: 'mg/dL',
        },
        { key: 'coronaryTreeSummary', label: 'Coronary Tree & Lesion Summary', type: 'text' },
        {
          key: 'stentLog',
          label: 'Stent Log',
          type: 'table',
          columns: [
            { key: 'targetVessel', label: 'Target Coronary Vessel', type: 'text' },
            { key: 'stentBrandPolymer', label: 'NPPA Stent Brand / Polymer', type: 'text' },
            { key: 'sizeDeployPressure', label: 'Size & Deployment Pressure', type: 'text' },
            { key: 'postPciTimi', label: 'Post-PCI Flow (TIMI)', type: 'text' },
          ],
        },
      ],
    },
  ],
  risk_calculators: [],
};

export const cardiologyCathLabLabels: SpecialtyCategoryLabels = {
  ecg_qtc: '12-Lead ECG & QTc Bazett',
  echo_doppler: 'Structured 2D Echo & Doppler',
  cath_lab_registry: 'Cath Lab CAG / DES Stent Registry',
  risk_calculators: 'NABH & IRDAI Risk Calculators',
};
