import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const generalSurgeryLaparoscopy: SpecialtyCategories = {
  preop_risk_pac: [
    {
      heading: 'ASA Physical Status & Universal VTE Risk Stratification',
      inputs: [
        {
          key: 'asaStatus',
          label: 'ASA Physical Status Classification',
          type: 'select',
          options: [
            'ASA I (Normal healthy)',
            'ASA II (Mild systemic disease)',
            'ASA III (Severe, functional limitation)',
            'ASA IV (Constant threat to life)',
            'ASA V (Moribund)',
            'ASA VI (Brain-dead donor)',
          ],
        },
        { key: 'asaEmergencyModifier', label: 'Emergency (E) Modifier', type: 'checkbox' },
        {
          key: 'vteRiskModel',
          label: 'VTE Risk Model',
          type: 'select',
          options: ['Caprini Score', 'Padua Score'],
        },
        {
          key: 'vteRiskTier',
          label: 'VTE Risk Tier',
          type: 'select',
          options: ['Low', 'Moderate', 'High', 'Highest'],
        },
        { key: 'vtePointScore', label: 'Model Point Score', type: 'number' },
        { key: 'dvtProphylaxisOrder', label: 'DVT / VTE Prophylaxis Order', type: 'text' },
      ],
    },
    {
      heading: 'Pre-Anesthetic Check (PAC) Clearance & Consent Verification',
      inputs: [
        {
          key: 'pacClearanceStatus',
          label: 'PAC Clearance Status',
          type: 'select',
          options: ['Cleared', 'High-Risk Clearance', 'Pending Investigation'],
        },
        { key: 'pacAnesthesiologist', label: 'PAC Anesthesiologist', type: 'text' },
        {
          key: 'mallampatiClass',
          label: 'Mallampati Airway Class',
          type: 'select',
          options: ['Class I', 'Class II', 'Class III', 'Class IV (Difficult Airway)'],
        },
        { key: 'pacDoctorNotes', label: 'PAC Doctor Notes', type: 'textarea' },
        {
          key: 'surgicalConsentVerified',
          label: 'Informed Surgical & Anesthesia Consent Verified',
          type: 'checkbox',
        },
        {
          key: 'highRiskConsentConfirmed',
          label: 'High-Risk Consent Confirmation',
          type: 'checkbox',
        },
        { key: 'consentWitness', label: 'Witness Name & ID', type: 'text' },
        {
          key: 'consentTimestamp',
          label: 'Digital Consent Timestamp',
          type: 'datetime',
          nowButton: true,
        },
      ],
    },
  ],
  intraop_who: [
    {
      heading: 'Surgical Approach & Access Technique',
      inputs: [
        {
          key: 'approach',
          label: 'Approach',
          type: 'select',
          options: ['Open', 'Laparoscopic', 'Robotic', 'Converted to Open'],
        },
        {
          key: 'conversionReason',
          label: 'Reason for Conversion',
          type: 'select',
          options: ['Adhesions', 'Bleeding', 'Anatomy', 'Technical'],
          visibleWhen: { field: 'approach', equals: 'Converted to Open' },
        },
        {
          key: 'conversionDetails',
          label: 'Conversion Details',
          type: 'text',
          visibleWhen: { field: 'approach', equals: 'Converted to Open' },
        },
      ],
    },
    {
      heading: 'Minimal Access / Pneumoperitoneum Telemetry (if Laparoscopic/Robotic)',
      inputs: [
        {
          key: 'peritonealAccess',
          label: 'Primary Peritoneal Access Method',
          type: 'select',
          options: ['Veress Needle', 'Hasson Open', 'Optical Trocar'],
        },
        {
          key: 'insufflationPressure',
          label: 'Insufflation Pressure',
          type: 'number',
          unit: 'mmHg',
        },
        { key: 'co2Volume', label: 'Total CO₂ Volume Used', type: 'number', unit: 'L' },
        { key: 'cvsCalot', label: 'CVS — Calot triangle cleared', type: 'checkbox' },
        {
          key: 'cvsLowerThird',
          label: 'CVS — Lower ⅓ GB separated from cystic plate',
          type: 'checkbox',
        },
        {
          key: 'cvsTwoStructures',
          label: 'CVS — 2 and only 2 structures confirmed',
          type: 'checkbox',
        },
      ],
    },
    {
      heading: 'Abdominal Port Mapping',
      inputs: [
        {
          key: 'portMapping',
          label: 'Trocar Ports',
          type: 'table',
          columns: [
            {
              key: 'portSize',
              label: 'Port Size',
              type: 'select',
              options: ['3mm', '5mm', '10mm', '12mm', 'Hand-port'],
            },
            {
              key: 'portRole',
              label: 'Port Role',
              type: 'select',
              options: [
                'Camera Port',
                'Working Port',
                'Retractor-Assistant',
                'Specimen Extraction',
              ],
            },
            {
              key: 'fasciaClosed',
              label: 'Fascia closed (≥10mm)',
              type: 'select',
              options: ['Yes', 'No', 'N/A'],
            },
          ],
        },
      ],
    },
    {
      heading: 'Surgical Safety Checklist (WHO Standard)',
      inputs: [
        { key: 'whoSignIn', label: 'Sign In (Pre-Induction)', type: 'checkbox' },
        { key: 'whoTimeOut', label: 'Time Out (Pre-Incision)', type: 'checkbox' },
        { key: 'whoSignOut', label: 'Sign Out (Pre-Closure)', type: 'checkbox' },
      ],
    },
    {
      heading: 'Intra-Operative Events & Hemodynamics',
      inputs: [
        { key: 'intraopEbl', label: 'Estimated Blood Loss', type: 'number', unit: 'mL' },
        {
          key: 'crystalloidsColloids',
          label: 'Total Crystalloids / Colloids',
          type: 'number',
          unit: 'mL',
        },
        { key: 'urineOutput', label: 'Urine Output', type: 'number', unit: 'mL' },
        {
          key: 'operativeEvents',
          label: 'Operative Findings & Hemodynamic/Surgical Events',
          type: 'textarea',
        },
        {
          key: 'netFluidBalance',
          label: 'Net Fluid Balance',
          type: 'number',
          unit: 'mL',
          auto: true,
        },
      ],
    },
    {
      heading: 'Intraoperative Findings & Procedure Log',
      inputs: [
        { key: 'preOpDiagnosis', label: 'Pre-Operative Diagnosis', type: 'text' },
        {
          key: 'postOpDiagnosis',
          label: 'Post-Operative Diagnosis (Deviations/Confirmed)',
          type: 'text',
        },
        {
          key: 'operativeFindingsDetail',
          label: 'Detailed Operative Findings & Anatomical Description',
          type: 'textarea',
        },
        { key: 'procedureEbl', label: 'Estimated Blood Loss (EBL)', type: 'number', unit: 'mL' },
        {
          key: 'intraopComplications',
          label: 'Intraoperative Complications',
          type: 'select',
          options: [
            'None',
            'Hemorrhage',
            'Serosal Tear',
            'Visceral Injury',
            'Vascular Injury',
            'Other',
          ],
        },
        {
          key: 'complicationNotes',
          label: 'Complication & Corrective Action Notes',
          type: 'text',
          visibleWhen: {
            field: 'intraopComplications',
            equals: ['Hemorrhage', 'Serosal Tear', 'Visceral Injury', 'Vascular Injury', 'Other'],
          },
        },
      ],
    },
  ],
  implants_postop: [
    {
      heading: 'Consumables, Implants & Specimen Tracking (NABH & Billing)',
      inputs: [
        {
          key: 'consumablesImplants',
          label: 'Consumables / Implants',
          type: 'table',
          columns: [
            {
              key: 'itemType',
              label: 'Item Type',
              type: 'select',
              options: ['Mesh', 'Surgical Clip', 'Stapler', 'Suture', 'Other Consumable'],
            },
            { key: 'sizeBrandDesc', label: 'Size / Brand / Description', type: 'text' },
            { key: 'serialBatchNo', label: 'Serial / Batch No.', type: 'text' },
          ],
        },
      ],
    },
    {
      heading: 'Immediate Post-Operative Plan & Ward Recovery Orders',
      inputs: [
        { key: 'woundDrainCare', label: 'Wound & Drain Care Instructions', type: 'textarea' },
        {
          key: 'postOpMedsAnalgesia',
          label: 'Post-Op Medications & Analgesia Bundle',
          type: 'textarea',
        },
        { key: 'dietProgression', label: 'Diet Progression Timeline', type: 'textarea' },
      ],
    },
  ],
};

export const generalSurgeryLaparoscopyLabels: SpecialtyCategoryLabels = {
  preop_risk_pac: 'Pre-Op Risk & PAC Clearance',
  intraop_who: 'Intra-Op Execution & WHO Checklist',
  implants_postop: 'Implants, Operative Note & Post-Op Orders',
};
