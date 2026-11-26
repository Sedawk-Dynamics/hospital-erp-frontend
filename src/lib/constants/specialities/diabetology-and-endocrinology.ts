import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const diabetologyEndocrinology: SpecialtyCategories = {
  smbg_cgm_tir: [],
  insulin_engine: [
    {
      heading: 'RSSDI/ESI Weight-Based Insulin Engine',
      inputs: [
        { key: 'pullVitalsWeight', label: 'Pull Vitals Weight', type: 'skeleton', auto: true },
        {
          key: 'insulinRegimen',
          label: 'Insulin Regimen Architecture',
          type: 'select',
          options: [
            'Full Basal-Bolus 50/50',
            'Basal-Plus',
            'Basal-Only Initiation',
            'Premix Biphasic 30/70',
          ],
        },
        { key: 'bodyWeight', label: 'Body Weight', type: 'number', unit: 'kg' },
        {
          key: 'insulinSensitivity',
          label: 'Sensitivity (0.2–0.7)',
          type: 'number',
          unit: 'U/kg/day',
        },
        {
          key: 'isfRule',
          label: '500-Rule ICR · ISF Rule',
          type: 'select',
          options: ['1800 Rule', '1500 Rule'],
        },
        { key: 'tdd', label: 'Total Daily Dose (TDD)', type: 'number', unit: 'U', auto: true },
        { key: 'basalDose', label: 'Basal Dose', type: 'number', unit: 'U', auto: true },
        { key: 'prandialSplit', label: 'Prandial Split', type: 'text', auto: true },
        { key: 'icr', label: 'ICR (Insulin:Carb Ratio)', type: 'text', auto: true },
        { key: 'correctionFactor', label: 'Correction Factor', type: 'text', auto: true },
      ],
    },
    {
      heading: 'Mealtime Rapid-Acting Bolus Simulator',
      inputs: [
        { key: 'mealCarbs', label: 'Planned Meal Carbs', type: 'number', unit: 'g' },
        { key: 'preMealBg', label: 'Pre-Meal BG', type: 'number', unit: 'mg/dL' },
        { key: 'targetBg', label: 'Target BG', type: 'number', unit: 'mg/dL' },
        {
          key: 'suggestedBolus',
          label: 'Suggested Bolus (nutritional + correction)',
          type: 'number',
          unit: 'U',
          auto: true,
        },
      ],
    },
  ],
  diabetic_foot_neuropathy: [],
  thyroid_lipid_metabolic: [
    {
      heading: 'Thyroid Axis & Autoimmune Screening',
      inputs: [
        {
          key: 'thyroidContext',
          label: 'Thyroid Context',
          type: 'select',
          options: [
            'Non-Pregnant Adult',
            '1st Trimester',
            '2nd-3rd Trimester',
            'T1DM Autoimmune Screen',
          ],
        },
        { key: 'tsh', label: 'TSH', type: 'number', unit: 'mIU/L' },
        { key: 'freeT3', label: 'Free T3', type: 'number', unit: 'pg/mL' },
        { key: 'freeT4', label: 'Free T4', type: 'number', unit: 'ng/dL' },
        { key: 'antiTpo', label: 'Anti-TPO', type: 'number', unit: 'IU/mL' },
      ],
    },
    {
      heading: 'HOMA-IR, HOMA-β & eAG',
      inputs: [
        { key: 'fastingGlucose', label: 'Fasting Glucose', type: 'number', unit: 'mg/dL' },
        { key: 'fastingInsulin', label: 'Fasting Insulin', type: 'number', unit: 'µIU/mL' },
        { key: 'hba1c', label: 'HbA1c', type: 'number', unit: '%' },
        { key: 'homaIr', label: 'HOMA-IR', type: 'number', auto: true },
        { key: 'homaBeta', label: 'HOMA-β', type: 'number', auto: true },
        { key: 'eag', label: 'eAG', type: 'number', unit: 'mg/dL', auto: true },
        { key: 'measuredNa', label: 'Measured Na⁺', type: 'number', unit: 'mEq/L' },
        { key: 'acuteRbs', label: 'Acute RBS', type: 'number', unit: 'mg/dL' },
        {
          key: 'katzCorrectedNa',
          label: 'Katz Corrected Na',
          type: 'number',
          unit: 'mEq/L',
          auto: true,
        },
      ],
    },
    {
      heading: 'Comprehensive Lipid Metabolism (LAI South Asian)',
      inputs: [
        {
          key: 'computeFriedewaldLdl',
          label: 'Compute Friedewald LDL',
          type: 'skeleton',
          auto: true,
        },
        {
          key: 'laiAscvdRisk',
          label: 'LAI ASCVD Risk Stratification',
          type: 'select',
          options: ['High', 'Very High', 'Extreme Risk'],
        },
        { key: 'totalChol', label: 'Total Chol', type: 'number', unit: 'mg/dL' },
        { key: 'triglycerides', label: 'Triglycerides', type: 'number', unit: 'mg/dL' },
        { key: 'hdlC', label: 'HDL-C', type: 'number', unit: 'mg/dL' },
        { key: 'ldlC', label: 'LDL-C', type: 'number', unit: 'mg/dL' },
        { key: 'nonHdlC', label: 'Non-HDL-C', type: 'number', unit: 'mg/dL', auto: true },
        { key: 'tgHdlRatio', label: 'TG/HDL Ratio', type: 'number', auto: true },
      ],
    },
    {
      heading: 'Bone Mineral, 25-OH Vitamin D & Intact PTH',
      inputs: [
        { key: 'serumCalcium', label: 'Serum Calcium', type: 'number', unit: 'mg/dL' },
        { key: 'serumAlbumin', label: 'Serum Albumin', type: 'number', unit: 'g/dL' },
        { key: 'phosphorus', label: 'Phosphorus', type: 'number', unit: 'mg/dL' },
        { key: 'alkPhosphatase', label: 'Alk Phosphatase', type: 'number', unit: 'U/L' },
        { key: 'vitaminD25', label: '25-OH Vitamin D', type: 'number', unit: 'ng/mL' },
        { key: 'intactPth', label: 'Intact PTH', type: 'number', unit: 'pg/mL' },
        { key: 'correctedCa', label: 'Corrected Ca', type: 'number', unit: 'mg/dL', auto: true },
      ],
    },
  ],
  complication_screening: [
    {
      heading: 'Diabetic Kidney Disease (DKD) — UACR & eGFR Trajectory',
      inputs: [
        {
          key: 'computeCkdEpiEgfr',
          label: 'Compute 2021 CKD-EPI eGFR',
          type: 'skeleton',
          auto: true,
        },
        { key: 'plotEgfr', label: 'Plot Current eGFR on Graph', type: 'skeleton', auto: true },
        { key: 'spotUacr', label: 'Spot UACR', type: 'number', unit: 'mg/g' },
        { key: 'dkdCreatinine', label: 'Serum Creatinine', type: 'number', unit: 'mg/dL' },
        { key: 'egfr', label: 'eGFR', type: 'number', unit: 'mL/min/1.73m²' },
        { key: 'serumPotassium', label: 'Serum K⁺', type: 'number', unit: 'mEq/L' },
        { key: 'dkdStage', label: 'DKD Stage (A1–A3 / G1–G5)', type: 'text', auto: true },
        {
          key: 'kdigoPillars',
          label: 'KDIGO Renoprotective Pillars',
          type: 'multiselect',
          options: ['ACEi/ARB', 'SGLT2i', 'Finerenone nsMRA'],
        },
        {
          key: 'egfrTrajectory',
          label: 'eGFR Trajectory',
          type: 'table',
          columns: [
            { key: 'visitDate', label: 'Visit Date', type: 'datetime' },
            { key: 'egfrPoint', label: 'eGFR', type: 'number' },
            { key: 'uacrPoint', label: 'UACR', type: 'number' },
          ],
        },
      ],
    },
    {
      heading: 'Diabetic Retinopathy (ETDRS) & Macular Edema',
      inputs: [
        {
          key: 'odFundus',
          label: 'Right Eye (OD) Fundus Status',
          type: 'select',
          options: ['No DR', 'Mild', 'Moderate', 'Severe NPDR', 'PDR'],
        },
        {
          key: 'osFundus',
          label: 'Left Eye (OS) Fundus Status',
          type: 'select',
          options: ['No DR', 'Mild', 'Moderate', 'Severe NPDR', 'PDR'],
        },
        {
          key: 'dme',
          label: 'Diabetic Macular Edema (DME)',
          type: 'select',
          options: ['Absent', 'Non-Center-Involving', 'Center-Involving CI-DME'],
        },
        { key: 'lastDilatedExam', label: 'Last Dilated Exam Date', type: 'datetime' },
        {
          key: 'fundusModality',
          label: 'Fundus Screening Modality',
          type: 'select',
          options: ['Dilated Indirect', 'Non-Mydriatic Camera', 'SD-OCT + FFA'],
        },
        {
          key: 'priorRetinalIntervention',
          label: 'Prior Retinal Intervention',
          type: 'select',
          options: ['Treatment-Naive', 'PRP Laser', 'Anti-VEGF', 'Vitrectomy'],
        },
      ],
    },
    {
      heading: 'Peripheral & Autonomic Neuropathy Quick Screen',
      inputs: [
        { key: 'monofilamentRight', label: '10g Monofilament Right (/10)', type: 'number' },
        { key: 'monofilamentLeft', label: '10g Monofilament Left (/10)', type: 'number' },
        {
          key: 'tuningForkRight',
          label: '128 Hz Tuning Fork Right',
          type: 'select',
          options: ['Intact', 'Diminished', 'Absent'],
        },
        {
          key: 'tuningForkLeft',
          label: '128 Hz Tuning Fork Left',
          type: 'select',
          options: ['Intact', 'Diminished', 'Absent'],
        },
        { key: 'supineSystolicBp', label: 'Supine Systolic BP', type: 'number', unit: 'mmHg' },
        {
          key: 'standingSystolicBp',
          label: 'Standing 3m Systolic BP',
          type: 'number',
          unit: 'mmHg',
        },
        {
          key: 'orthostaticDrop',
          label: 'Orthostatic Drop',
          type: 'number',
          unit: 'mmHg',
          auto: true,
        },
      ],
    },
  ],
};

export const diabetologyEndocrinologyLabels: SpecialtyCategoryLabels = {
  smbg_cgm_tir: 'SMBG & CGM Time-in-Range AGP',
  insulin_engine: 'Basal-Bolus TDD, ICR/ISF & Insulin Engine',
  diabetic_foot_neuropathy: 'RSSDI Diabetic Foot, VPT, ABI & Neuropathy',
  thyroid_lipid_metabolic: 'Thyroid Axis, Lipid Panel, HOMA-IR & eAG',
  complication_screening: 'Complication Screening: DKD (UACR) & Retinopathy',
};
