import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const anesthesiologyPerioperative: SpecialtyCategories = {
  pac_preanesthesia: [
    {
      heading: 'Surgical Case & ASA Physical Status',
      inputs: [
        { key: 'proposedProcedure', label: 'Proposed Surgical Procedure', type: 'text' },
        {
          key: 'surgicalUrgency',
          label: 'Surgical Urgency',
          type: 'select',
          options: [
            'Elective',
            'Expedited <24h',
            'Emergency <6h',
            'Immediate-Stat <2h',
          ],
        },
        {
          key: 'asaStatus',
          label: 'ASA Physical Status',
          type: 'select',
          options: ['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V', 'ASA VI'],
        },
        { key: 'asaEmergencyModifier', label: '-E Emergency Modifier', type: 'checkbox' },
        {
          key: 'pacAssessmentMets',
          label: 'PAC Clinical Assessment & Functional Capacity (METs)',
          type: 'text',
        },
        {
          key: 'pacClearanceStatus',
          label: 'PAC Clearance Status',
          type: 'select',
          options: [
            'Fit for Planned Anesthesia',
            'Fit with High-Risk Consent',
            'Deferred-Optimize',
          ],
        },
        { key: 'htnControlled', label: 'HTN Controlled', type: 'checkbox' },
        { key: 'aceiArbHeldAm', label: 'ACEi/ARB Held AM', type: 'checkbox' },
        { key: 'dmControlled', label: 'DM Controlled', type: 'checkbox' },
        { key: 'sglt2iHeld48h', label: 'SGLT2i Held 48h', type: 'checkbox' },
        { key: 'antiplateletHoldDays', label: 'Antiplatelet Hold', type: 'number', unit: 'days' },
      ],
    },
    {
      heading: 'ISA Airway Assessment & LEMON Screen',
      inputs: [
        {
          key: 'mallampatiClass',
          label: 'Modified Mallampati Class',
          type: 'select',
          options: ['Class I', 'Class II', 'Class III', 'Class IV'],
        },
        { key: 'interIncisorGap', label: 'Inter-Incisor Gap / Mouth Opening', type: 'number', unit: 'cm' },
        { key: 'thyromentalDistance', label: 'Thyromental Distance', type: 'number', unit: 'cm' },
        { key: 'sternomentalDistance', label: 'Sternomental Distance', type: 'number', unit: 'cm' },
        {
          key: 'neckExtensionMobility',
          label: 'Neck Extension & Mobility',
          type: 'select',
          options: ['Normal >35°', 'Mild Limitation', 'Severe Restriction'],
        },
        {
          key: 'upperLipBiteTest',
          label: 'Upper Lip Bite Test (ULBT)',
          type: 'select',
          options: ['Class I', 'Class II', 'Class III'],
        },
        {
          key: 'dentitionOralCavity',
          label: 'Dentition & Oral Cavity',
          type: 'select',
          options: ['Intact', 'Loose Incisors', 'Removable Dentures', 'Edentulous'],
        },
        { key: 'summonDifficultAirwayCart', label: 'Summon Difficult Airway Cart', type: 'checkbox' },
      ],
    },
    {
      heading: 'ISA Fasting (NPO) Compliance',
      inputs: [
        { key: 'clearLiquidsFastingHours', label: 'Clear Liquids Fasting Duration', type: 'number', unit: 'hours' },
        { key: 'solidMealFastingHours', label: 'Solid / Indian Meal Fasting Duration', type: 'number', unit: 'hours' },
        { key: 'lastFoodIntake', label: 'Nature of Last Food Intake', type: 'text' },
        { key: 'npoComplianceBanner', label: 'NPO Compliance', type: 'text', auto: true },
      ],
    },
    {
      heading: 'Baseline Pre-Operative Investigations',
      inputs: [
        { key: 'hemoglobin', label: 'Hemoglobin', type: 'number', unit: 'g/dL' },
        { key: 'platelets', label: 'Platelets', type: 'number', unit: 'cells/mcL' },
        { key: 'ptInr', label: 'PT/INR', type: 'number', unit: 'ratio' },
        { key: 'sCreatinine', label: 'S. Creatinine', type: 'number', unit: 'mg/dL' },
        { key: 'crossmatchUnits', label: 'Crossmatch', type: 'number', unit: 'Units PRBC' },
        { key: 'preopEcgFindings', label: '12-Lead Pre-Operative ECG Findings', type: 'text' },
        { key: 'cxrFindings', label: 'Chest Radiograph (CXR PA) Findings', type: 'text' },
      ],
    },
  ],
  intraop_flowsheet: [],
  fluids_blood_dosing: [],
  pacu_aldrete: [],
  clinical_calculators: [],
};

export const anesthesiologyPerioperativeLabels: SpecialtyCategoryLabels = {
  pac_preanesthesia: 'Pre-Anesthesia Checkup (PAC)',
  intraop_flowsheet: 'Intraoperative Vitals & Anesthesia Flowsheet',
  fluids_blood_dosing: 'Fluids, Blood Management & Dosing Engine',
  pacu_aldrete: 'PACU & Aldrete Recovery',
  clinical_calculators: 'Departmental Clinical Calculators',
};
