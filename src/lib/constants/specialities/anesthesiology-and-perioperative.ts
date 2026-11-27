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
  intraop_flowsheet: [
    {
      heading: 'Technique & Ventilator Workstation',
      inputs: [
        {
          key: 'anesthesiaModality',
          label: 'Anesthesia Modality',
          type: 'select',
          options: ['GA', 'Spinal', 'Epidural', 'CSE', 'PNB', 'MAC'],
        },
        {
          key: 'airwayDevice',
          label: 'Airway Device',
          type: 'select',
          options: [
            'Oral Cuffed ETT',
            'Nasal ETT',
            'LMA Supreme',
            'LMA ProSeal',
            'Tracheostomy',
          ],
        },
        { key: 'airwayEttSizing', label: 'Airway / ETT Sizing', type: 'text' },
        { key: 'depthAtIncisors', label: 'Depth at Incisors', type: 'number', unit: 'cm' },
        {
          key: 'volatileAgent',
          label: 'Volatile Inhalation Agent',
          type: 'select',
          options: ['Sevoflurane', 'Isoflurane', 'Desflurane'],
        },
        { key: 'bisEntropyScore', label: 'BIS / Entropy Score', type: 'number' },
        { key: 'laryngoscopeBlade', label: 'Laryngoscope Blade / Aid', type: 'text' },
        { key: 'neuraxialDrugDose', label: 'Neuraxial / Regional Drug & Dose', type: 'text' },
        { key: 'spinalInterspaceNeedle', label: 'Spinal / Epidural Interspace & Needle', type: 'text' },
        { key: 'targetSensoryBlock', label: 'Target Sensory Block Level', type: 'text' },
      ],
    },
    {
      heading: 'Ventilator Ribbon',
      inputs: [
        {
          key: 'ventMode',
          label: 'Vent Mode',
          type: 'select',
          options: ['VCV', 'PCV', 'PSV'],
        },
        { key: 'tidalVolume', label: 'Tidal Vol', type: 'number', unit: 'mL' },
        { key: 'respRate', label: 'Resp Rate', type: 'number', unit: '/min' },
        { key: 'peep', label: 'PEEP', type: 'number', unit: 'cmH₂O' },
        { key: 'fio2', label: 'FiO₂', type: 'number', unit: '%' },
        { key: 'macValue', label: 'MAC Value', type: 'number' },
      ],
    },
  ],
  fluids_blood_dosing: [
    {
      heading: 'Weight-Based Dosing Engine',
      inputs: [
        { key: 'dosingWeight', label: 'Dosing Weight', type: 'number', unit: 'kg' },
        { key: 'propofolDose', label: 'Propofol (2 mg/kg)', type: 'number', unit: 'mg', auto: true },
        { key: 'atracuriumDose', label: 'Atracurium (0.5 mg/kg)', type: 'number', unit: 'mg', auto: true },
        { key: 'neostigmineDose', label: 'Neostigmine (0.05 mg/kg)', type: 'number', unit: 'mg', auto: true },
        { key: 'glycopyrrolateDose', label: 'Glycopyrrolate (0.01 mg/kg)', type: 'number', unit: 'mg', auto: true },
        { key: 'intralipidBolus', label: 'Intralipid 20% Rescue Bolus (1.5 mL/kg)', type: 'number', unit: 'mL', auto: true },
        {
          key: 'otVasopressor',
          label: 'OT Vasopressor Choice',
          type: 'select',
          options: [
            'Mephentermine',
            'Ephedrine',
            'Noradrenaline infusion',
            'Phenylephrine',
          ],
        },
      ],
    },
    {
      heading: 'Holliday-Segar 4-2-1 Fluid Protocol',
      inputs: [
        { key: 'thirdSpaceLossFactor', label: '3rd-Space Surgical Loss Factor', type: 'number', unit: 'mL/kg/h' },
        { key: 'hourlyMaintenance', label: 'Hourly Maintenance', type: 'number', unit: 'mL/h', auto: true },
        { key: 'npoFastingDeficit', label: 'NPO Fasting Deficit', type: 'number', unit: 'mL', auto: true },
        { key: 'surgicalTissueLoss', label: 'Surgical Tissue Loss', type: 'number', unit: 'mL/h', auto: true },
        { key: 'firstHourTarget', label: '1st-Hour Intraoperative Target', type: 'number', unit: 'mL', auto: true },
      ],
    },
    {
      heading: 'Maximum Allowable Blood Loss (ABL)',
      inputs: [
        { key: 'targetHct', label: 'Minimum Acceptable Target Hct', type: 'number', unit: '%' },
        { key: 'estimatedBloodVolume', label: 'Estimated Blood Volume (EBV)', type: 'number', unit: 'mL', auto: true },
        { key: 'baselineTargetHct', label: 'Baseline → Target Hct', type: 'text', auto: true },
        { key: 'maxAllowableBloodLoss', label: 'Maximum Allowable Blood Loss', type: 'number', unit: 'mL', auto: true },
      ],
    },
  ],
  pacu_aldrete: [
    {
      heading: 'Modified Aldrete Recovery Scoring',
      inputs: [
        { key: 'aldreteMotor', label: 'Motor Activity', type: 'select', options: ['0', '1', '2'] },
        { key: 'aldreteRespiration', label: 'Respiration', type: 'select', options: ['0', '1', '2'] },
        { key: 'aldreteCirculation', label: 'Circulation (BP)', type: 'select', options: ['0', '1', '2'] },
        { key: 'aldreteConsciousness', label: 'Consciousness', type: 'select', options: ['0', '1', '2'] },
        { key: 'aldreteOxygenSat', label: 'O₂ Saturation', type: 'select', options: ['0', '1', '2'] },
        { key: 'aldreteTotal', label: 'Total Aldrete Score', type: 'number', unit: '/10', auto: true },
        { key: 'dischargeReadiness', label: 'Discharge Readiness', type: 'text', auto: true },
      ],
    },
    {
      heading: 'Post-Op Handover & Pain Assessment',
      inputs: [
        { key: 'postOpPainVas', label: 'Post-Op Pain Score (VAS)', type: 'number', min: 0, max: 10 },
        {
          key: 'apfelScore',
          label: 'Apfel Score for PONV Risk',
          type: 'select',
          options: ['Low 0–1', 'Moderate 2', 'High 3–4'],
        },
        { key: 'dischargeDestination', label: 'Discharge Destination', type: 'text' },
        { key: 'consultantHandoverSignoff', label: 'Consultant Anaesthesiologist Handover Sign-off', type: 'text' },
      ],
    },
  ],
  clinical_calculators: [],
};

export const anesthesiologyPerioperativeLabels: SpecialtyCategoryLabels = {
  pac_preanesthesia: 'Pre-Anesthesia Checkup (PAC)',
  intraop_flowsheet: 'Intraoperative Vitals & Anesthesia Flowsheet',
  fluids_blood_dosing: 'Fluids, Blood Management & Dosing Engine',
  pacu_aldrete: 'PACU & Aldrete Recovery',
  clinical_calculators: 'Departmental Clinical Calculators',
};
