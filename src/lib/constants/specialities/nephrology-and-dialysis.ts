import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const nephrologyDialysis: SpecialtyCategories = {

  hd_run_sheet: [
    {
      heading: 'PMNDP / ISN Maintenance Hemodialysis Weight Sheet & spKt/V Adequacy',
      inputs: [
        { key: 'targetDryWeight', label: 'Target Dry Weight', type: 'number', unit: 'kg' },
        { key: 'preHdWeight', label: 'Pre-HD Weight', type: 'number', unit: 'kg' },
        { key: 'postHdWeight', label: 'Post-HD Weight', type: 'number', unit: 'kg' },
        { key: 'sessionTime', label: 'Session Time', type: 'number', unit: 'hours' },
        { key: 'prescribedQb', label: 'Prescribed Qb', type: 'number', unit: 'mL/min' },
        { key: 'prescribedQd', label: 'Prescribed Qd', type: 'number', unit: 'mL/min' },
        { key: 'preHdBun', label: 'Pre-HD BUN', type: 'number', unit: 'mg/dL' },
        { key: 'postHdBun', label: 'Post-HD BUN', type: 'number', unit: 'mg/dL' },
        { key: 'spKtV', label: 'spKt/V', type: 'number', auto: true },
        { key: 'urrPercent', label: 'URR', type: 'number', unit: '%', auto: true },
        { key: 'weightDelta', label: 'Wt Delta', type: 'number', unit: 'kg', auto: true },
      ],
    },
    {
      heading: 'Dialyzer Specifications, Reprocessing Registry & Dialysate Bath Composition',
      inputs: [
        {
          key: 'dialyzerPreset',
          label: 'Dialyzer Brand / Membrane Preset',
          type: 'select',
          options: [
            'Fresenius F60X/FX60 (Polysulfone High-Flux)',
            'Fresenius F8HPS (Polysulfone Low-Flux)',
            'Nipro Elisio-15H (Polynephron High-Flux)',
            'Baxter Revaclear 300/400',
            'Toray Filtryzer BK (PMMA)',
          ],
        },
        { key: 'customDialyzer', label: 'Custom Dialyzer Model / Lot No.', type: 'text' },
        { key: 'dialyzerReuseCounter', label: 'Dialyzer Reuse Counter (0 = single-use)', type: 'number' },
        {
          key: 'reprocessingAgent',
          label: 'Reprocessing Disinfectant Agent',
          type: 'select',
          options: [
            'Peracetic Acid + H₂O₂ (Renalin)',
            'Formaldehyde (4% Sterilant)',
            'Heat + Citric Acid',
            'Single-Use Discard (Mandatory Viral+)',
          ],
        },
        {
          key: 'tcvVerified',
          label: 'Sterilization Potency & TCV (≥80% Fiber Bundle Volume) Indicator Verified',
          type: 'checkbox',
        },
        {
          key: 'residueStripNegative',
          label: 'Post-Rinse Peracetic/Formaldehyde Residue Strip Test NEGATIVE (<1 ppm)',
          type: 'checkbox',
        },
        { key: 'dialysateNa', label: 'Dialysate Na⁺', type: 'number', unit: 'mEq/L' },
        { key: 'dialysateK', label: 'Dialysate K⁺', type: 'number', unit: 'mEq/L' },
        { key: 'dialysateCa', label: 'Dialysate Ca²⁺', type: 'number', unit: 'mmol/L' },
        { key: 'dialysateHco3', label: 'Dialysate HCO₃⁻', type: 'number', unit: 'mEq/L' },
      ],
    },
    {
      heading: 'Post-Dialysis Evaluation, Blood Reinfusion & Disposition Summary',
      inputs: [
        { key: 'bloodReturnNsVolume', label: 'Blood Return NS Volume', type: 'number', unit: 'mL' },
        { key: 'targetedUfGoal', label: 'Targeted UF Goal', type: 'number', unit: 'mL' },
        { key: 'actualUfAchieved', label: 'Actual UF Achieved', type: 'number', unit: 'mL' },
        { key: 'hemostasisDuration', label: 'Hemostasis Duration', type: 'number', unit: 'min' },
        {
          key: 'hemostasisTechnique',
          label: 'Hemostasis Technique',
          type: 'select',
          options: [
            'Two-Finger Manual Gloved Compression',
            'Hemostatic Pad',
            'Vascular Closure Strap',
            'Catheter Heparin',
            'Citrate Lumen Lock',
          ],
        },
        {
          key: 'postHdDressingCondition',
          label: 'Post-HD Access Dressing Condition',
          type: 'select',
          options: [
            'Clean, Dry & Intact — Thrill Preserved',
            'Sterile Chlorhexidine / Tegaderm Intact',
            'Mild Oozing — Pressure Dressing Reinforced',
            'Prolonged Bleeding / Hematoma — Physician Alerted',
          ],
        },
        { key: 'postHdBp', label: 'Post-HD Standing BP', type: 'text', unit: 'mmHg' },
        {
          key: 'postHdDisposition',
          label: 'Post-HD Clinical Condition & Disposition',
          type: 'buttons',
          options: [
            'Stable — Cleared for Discharge',
            'Extended Observation in Recovery Bay',
            'Escalate to Ward / ICU',
          ],
        },
      ],
    },
  ],


  pre_dialysis: [
    {
      heading: 'Pre-Dialysis Safety Screening & Vascular Access Physical Check',
      inputs: [
        {
          key: 'preDialysisSymptoms',
          label: 'Pre-Dialysis Symptom Checklist',
          type: 'multiselect',
          options: [
            'Chest pain',
            'Shortness of breath',
            'Muscle cramps',
            'Nausea-Vomiting',
            'Fever',
            'Headache',
          ],
        },
        { key: 'nilAcuteSymptoms', label: 'Nil Acute Symptoms (Cleared)', type: 'checkbox' },
        {
          key: 'vascularAccessType',
          label: 'Vascular Access Assessment Type',
          type: 'buttons',
          options: [
            'AV Fistula',
            'AV Graft',
            'Tunneled Cuffed Catheter',
            'Non-Tunneled Jugular-Femoral Catheter',
          ],
        },
        // --- If AVF / AVG selected ---
        {
          key: 'avAnatomicalLocation',
          label: 'Anatomical Location & Skin',
          type: 'text',
          visibleWhen: { field: 'vascularAccessType', equals: ['AV Fistula', 'AV Graft'] },
        },
        {
          key: 'thrillCharacter',
          label: 'Palpable Thrill Character',
          type: 'select',
          options: [
            'Continuous / Palpable (Normal)',
            'Weak',
            'Systolic-Only (Stenosis Watch)',
            'Hyperdynamic / Water-Hammer (Outflow Stenosis)',
            'Absent (Thrombosis Alert — Do Not Cannulate)',
          ],
          visibleWhen: { field: 'vascularAccessType', equals: ['AV Fistula', 'AV Graft'] },
        },
        {
          key: 'bruitQuality',
          label: 'Auscultatory Bruit Quality',
          type: 'select',
          options: [
            'Soft / Continuous Systolic-Diastolic',
            'High-Pitched Whistling',
            'Systolic-Only',
            'Diminished',
            'Absent',
          ],
          visibleWhen: { field: 'vascularAccessType', equals: ['AV Fistula', 'AV Graft'] },
        },
        // --- If Catheter selected ---
        {
          key: 'catheterVeinSide',
          label: 'Catheter Insertion Vein & Side',
          type: 'text',
          visibleWhen: {
            field: 'vascularAccessType',
            equals: ['Tunneled Cuffed Catheter', 'Non-Tunneled Jugular-Femoral Catheter'],
          },
        },
        {
          key: 'catheterExitSite',
          label: 'Catheter Exit Site & Tunnel Inspection',
          type: 'select',
          options: [
            'Clean, dry, no erythema/pus',
            'Mild crusting — aseptic chlorhexidine scrub done',
            'Signs of infection/oozing (CRBSI Protocol)',
          ],
          visibleWhen: {
            field: 'vascularAccessType',
            equals: ['Tunneled Cuffed Catheter', 'Non-Tunneled Jugular-Femoral Catheter'],
          },
        },
        {
          key: 'lumenPatency',
          label: 'Lumen Aspiration & Patency',
          type: 'select',
          options: [
            'Heparin lock aspirated — brisk bidirectional flow',
            'Positional arterial draw / line reversal needed',
            'Thrombosed / Urokinase dwell required',
          ],
          visibleWhen: {
            field: 'vascularAccessType',
            equals: ['Tunneled Cuffed Catheter', 'Non-Tunneled Jugular-Femoral Catheter'],
          },
        },
      ],
    },
    {
      heading: 'Pre-Dialysis Standing Vital Signs',
      inputs: [
        { key: 'preHdBp', label: 'Pre-HD BP', type: 'text', unit: 'mmHg' },
        { key: 'preHdHeartRate', label: 'Heart Rate', type: 'number', unit: 'bpm' },
        { key: 'preHdSpo2', label: 'SpO₂', type: 'number', unit: '%' },
        { key: 'preHdTemperature', label: 'Pre-HD Temperature', type: 'text', unit: '°C / °F' },
      ],
    },
  ],

  
  intradialytic: [
    {
      heading: 'Extracorporeal Anticoagulation / Heparin Administration Log',
      inputs: [
        {
          key: 'anticoagRegimen',
          label: 'Anticoagulant Regimen',
          type: 'select',
          options: [
            'Unfractionated Heparin (UFH)',
            'Low Molecular Weight Heparin (LMWH)',
            'Heparin-Free (q30m 0.9% NS Flush)',
          ],
        },
        { key: 'initialBolusDose', label: 'Initial Bolus Dose (IU or mg)', type: 'text' },
        { key: 'maintenanceRate', label: 'Maintenance Infusion Rate', type: 'text' },
        { key: 'heparinStopLeadTime', label: 'Heparin Stop Lead-Time', type: 'number', unit: 'min' },
      ],
    },
    {
      heading: 'Hourly / Half-Hourly Intradialytic Vitals & Machine Parameters Grid',
      inputs: [
        {
          key: 'intradialyticGrid',
          label: 'Monitoring Rows',
          type: 'table',
          columns: [
            { key: 'time', label: 'Time (HH:MM)', type: 'text' },
            { key: 'bp', label: 'BP (mmHg)', type: 'text' },
            { key: 'pulse', label: 'Pulse (bpm)', type: 'number' },
            { key: 'qb', label: 'Qb (mL/min)', type: 'number' },
            { key: 'qd', label: 'Qd (mL/min)', type: 'number' },
            { key: 'venousP', label: 'Venous P (mmHg)', type: 'number' },
            { key: 'tmp', label: 'TMP (mmHg)', type: 'number' },
            { key: 'ufRate', label: 'UF Rate (mL/h)', type: 'number' },
          ],
        },
      ],
    },
    {
      heading: 'Intradialytic Complication Triage & Emergency Circuit Interventions',
      inputs: [
        {
          key: 'complicationLog',
          label: 'Incidents',
          type: 'table',
          columns: [
            {
              key: 'adverseEvent',
              label: 'Adverse Intradialytic Event',
              type: 'select',
              options: [
                'Hypotension (Intradialytic IDH)',
                'Muscle Cramps',
                'Anaphylaxis',
                'Dialyzer Reaction (STOP CIRCUIT)',
                'Pyrogenic',
                'Chills & Rigors',
              ],
            },
            {
              key: 'responseStatus',
              label: 'Response / Run Status',
              type: 'select',
              options: [
                'Stabilized — Dialysis Continued',
                'HD Terminated Early — Blood Returned',
                'Circuit Stopped Without Blood Return — Escalated to ICU/ER',
              ],
            },
            { key: 'interventionNote', label: 'Intervention Dose / Clinical Note', type: 'text' },
            // Preset list changes per event. TODO: per-event intervention options.
            { key: 'interventionChecklist', label: 'Intervention checklist', type: 'multiselect', options: [] },
          ],
        },
      ],
    },
  ],

  kdigo_aki: [
    {
      heading: 'KDIGO 2024 CKD Prognosis Matrix (eGFR × UACR)',
      inputs: [
        { key: 'serumCreatinine', label: 'Serum Creatinine', type: 'number', unit: 'mg/dL' },
        { key: 'spotUrineAcr', label: 'Spot Urine ACR', type: 'number', unit: 'mg/g' },
        { key: 'kdigoStage', label: 'Stage (G1–G5 × A1–A3)', type: 'text', auto: true },
      ],
    },
    {
      heading: 'Fractional Excretion of Sodium (FENa%) — AKI Etiology',
      inputs: [
        { key: 'urineNa', label: 'Urine Na', type: 'number', unit: 'mEq/L' },
        { key: 'serumNa', label: 'Serum Na', type: 'number', unit: 'mEq/L' },
        { key: 'urineCr', label: 'Urine Cr', type: 'number', unit: 'mg/dL' },
        { key: 'fenaPercent', label: 'FENa% (pre-renal / ATN)', type: 'text', auto: true },
      ],
    },
  ],

  av_fistula: [
    {
      heading: 'Longitudinal AV Fistula Surveillance & Mandatory Viral Serology Isolation Registry',
      inputs: [
        {
          key: 'permanentAccessSubtype',
          label: 'Permanent Vascular Access Subtype',
          type: 'select',
          options: [
            'Left Radiocephalic Native AVF (Brescia-Cimino)',
            'Left Brachiocephalic Native AVF',
            'Brachiobasilic Transposed AVF',
            'PTFE Arteriovenous Graft (AVG)',
            'Right IJV Tunneled Cuffed Permcath',
          ],
        },
        { key: 'accessMaturation', label: 'Access Maturation', type: 'number', unit: 'weeks' },
        { key: 'cannulationTechnique', label: 'Cannulation Technique & Gauge', type: 'text' },
        { key: 'lastViralScreeningDate', label: 'Last Viral Screening Date', type: 'datetime' },
        {
          key: 'hbsAg',
          label: 'HBsAg (Hepatitis B)',
          type: 'select',
          options: ['Non-Reactive', 'Reactive (Dedicated HBV Machine & Single-Use)'],
        },
        {
          key: 'antiHcv',
          label: 'Anti-HCV / HCV RNA',
          type: 'select',
          options: ['Non-Reactive', 'Reactive (Dedicated HCV Machine)'],
        },
        {
          key: 'hivScreening',
          label: 'HIV I & II Screening',
          type: 'select',
          options: ['Non-Reactive', 'Reactive (Dedicated Machine & Single-Use)'],
        },
        {
          key: 'bayMachineAllocation',
          label: 'Dialysis Bay / Machine Allocation',
          type: 'select',
          options: [
            'Seronegative General HD Bay',
            'Dedicated HBsAg+ Isolation Room',
            'Dedicated HCV+ Segregated Bay',
            'Dedicated HIV+ Isolation Machine',
            'Sero-Indeterminate Quarantine Bay',
            'ICU-CRRT-SLED Dedicated Machine',
            'Bedside-Ward Portable',
            'Pediatric Dialysis Station',
            'VIP Private Suite',
          ],
        },
      ],
    },
    {
      heading: 'CKD Mineral Bone Disorder (iPTH, Ca, PO₄) & Renal Anemia Target Dashboard',
      inputs: [
        { key: 'hb', label: 'Hb', type: 'number', unit: 'g/dL' },
        { key: 'ferritin', label: 'Ferritin', type: 'number', unit: 'ng/mL' },
        { key: 'tsat', label: 'TSAT', type: 'number', unit: '%' },
        { key: 'calcium', label: 'Calcium', type: 'number', unit: 'mg/dL' },
        { key: 'phosphate', label: 'PO₄', type: 'number', unit: 'mg/dL' },
        { key: 'intactPth', label: 'Intact PTH', type: 'number', unit: 'pg/mL' },
        { key: 'hco3', label: 'HCO₃', type: 'number', unit: 'mEq/L' },
        { key: 'caPo4Product', label: 'Ca×PO₄ Product', type: 'number', auto: true },
      ],
    },
  ],
};

export const nephrologyDialysisLabels: SpecialtyCategoryLabels = {
  hd_run_sheet: 'Hemodialysis Run Sheet & spKt/V Adequacy',
  pre_dialysis: 'Pre-Dialysis Assessment & Access Check',
  intradialytic: 'Intradialytic Monitoring & Complications',
  kdigo_aki: 'KDIGO eGFR, UACR & FENa% AKI',
  av_fistula: 'AV Fistula, Viral Serology & CKD-MBD',
};










































































