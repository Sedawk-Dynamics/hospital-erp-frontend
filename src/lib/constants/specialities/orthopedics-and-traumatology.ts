import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

const MECHANISM_OPTIONS = [
  'High-Velocity RTA',
  'Fall from Height',
  'Industrial/Agri Crush',
  'Pedestrian Hit',
  'Sports/Twisting',
  'Low-Energy Fragility Fall',
];

export const orthopedicsTraumatology: SpecialtyCategories = {
  // 1. Pre-Hospital, Golden Hour & ATLS
  pre_hospital: [
    {
      heading: 'Mechanism & Golden Hour',
      inputs: [
        { key: 'timeOfInjury', label: 'Time of Injury', type: 'datetime' },
        { key: 'edPresentationTime', label: 'ED Presentation Time', type: 'datetime', nowButton: true },
        { key: 'primaryMechanism', label: 'Primary Mechanism', type: 'multiselect', options: MECHANISM_OPTIONS },
        {
          key: 'preHospitalContext',
          label: 'Pre-hospital context (helmet, ambulance, MLC)',
          type: 'text',
        },
      ],
    },
    {
      heading: 'ATLS Primary Survey',
      inputs: [
        {
          key: 'airway',
          label: 'A – Airway',
          type: 'select',
          options: [
            'Patent & Vocalizing',
            'Maintained with OPA-NPA + Suction',
            'Definitive Airway (ETT or Tracheostomy)',
          ],
        },
        {
          key: 'cSpine',
          label: 'C-Spine',
          type: 'select',
          options: [
            'Hard Collar + Blocks',
            'Clinically Cleared',
            'Radiologically Cleared',
            'Unstable – Log-Roll',
          ],
        },
        {
          key: 'breathing',
          label: 'B – Breathing',
          type: 'select',
          options: [
            'Bilateral equal air entry SpO2 ≥ 95%',
            'Supplemental O2',
            'ICD in-situ',
            'Mechanical Ventilation',
          ],
        },
        {
          key: 'circulation',
          label: 'C – Circulation',
          type: 'select',
          options: [
            'Stable (Class I)',
            'Tachycardic (Class II)',
            'Hypotensive Shock (Class III–IV)',
          ],
        },
        { key: 'gcsFastTxaNotes', label: 'GCS / FAST / TXA notes', type: 'text' },
      ],
    },
    {
      heading: 'ER Stabilization Checklist',
      inputs: [
        {
          key: 'pelvicBinder',
          label: 'Pelvic Binder',
          type: 'checkbox',
          fields: [
            { key: 'pelvicBinderTime', label: 'Time', type: 'datetime', nowButton: true },
            { key: 'pelvicBinderNotes', label: 'Notes', type: 'text' },
          ],
        },
        {
          key: 'hemorrhageControl',
          label: 'Hemorrhage Control',
          type: 'checkbox',
          fields: [
            {
              key: 'hemorrhageMethod',
              label: 'Method',
              type: 'select',
              options: ['Direct Pressure', 'CAT-Pneumatic Tourniquet'],
            },
            { key: 'hemorrhageTime', label: 'Time', type: 'datetime', nowButton: true },
          ],
        },
        {
          key: 'erSplintingTraction',
          label: 'ER Splinting / Traction',
          type: 'checkbox',
          fields: [
            { key: 'erSplintingType', label: 'Type', type: 'text' },
            { key: 'erSplintingTime', label: 'Time', type: 'datetime', nowButton: true },
          ],
        },
      ],
    },
  ],

  // 2. Injury Details, AO/OTA Map & Ganga
  injury_details: [
    {
      heading: 'Comprehensive Injury Details & Characteristics Module',
      inputs: [
        { key: 'laterality', label: 'Exact Laterality', type: 'buttons', options: ['Left', 'Right', 'Bilateral'] },
        {
          key: 'anatomicalRegion',
          label: 'Anatomical Region',
          type: 'select',
          options: ['Upper Extremity', 'Lower Extremity', 'Pelvis & Acetabulum', 'Axial (Spine / Thorax)'],
        },
        { key: 'aoOtaCode', label: 'AO/OTA Code', type: 'text' },
        {
          key: 'specificBone',
          label: 'Specific Bone',
          type: 'select',
          dependsOn: 'anatomicalRegion',
          optionsByParent: {
            // TODO: fill bone options per region
            'Upper Extremity': [],
            'Lower Extremity': [],
            'Pelvis & Acetabulum': [],
            'Axial (Spine / Thorax)': [],
          },
        },
        {
          key: 'segmentZone',
          label: 'Segment / Anatomical Zone',
          type: 'select',
          options: [
            'Proximal',
            'Diaphyseal (Shaft)',
            'Distal',
            'Intra-articular (Epiphyseal)',
            'Malleolar',
            'Apophyseal',
          ],
        },
        // TODO: fill fracture pattern options
        { key: 'fracturePattern', label: 'Fracture Pattern', type: 'multiselect', options: [] },
        { key: 'displacement', label: 'Displacement', type: 'select', options: ['Undisplaced', 'Displaced'] },
        { key: 'angulation', label: 'Angulation', type: 'number', unit: '°' },
        { key: 'shortening', label: 'Shortening', type: 'number', unit: 'cm' },
        {
          key: 'articularCongruity',
          label: 'Articular Congruity',
          type: 'select',
          options: ['Step-Off Absent (<2mm)', 'Step-Off Present (≥2mm)'],
        },
        { key: 'articularStepOff', label: 'Articular Step-Off', type: 'number', unit: 'mm' },
      ],
    },
    {
      heading: 'Chronology, Acuity & Soft-Tissue Integrity',
      inputs: [
        // TODO: fill injury-acuity options
        { key: 'injuryAcuity', label: 'Injury Acuity', type: 'select', options: [] },
        {
          key: 'skinIntegrity',
          label: 'Skin Integrity',
          type: 'select',
          options: ['Closed Fracture', 'Open Fracture'],
        },
        {
          key: 'tscherneGrade',
          label: 'Tscherne grade',
          type: 'select',
          options: [], // TODO: Tscherne grades
          visibleWhen: { field: 'skinIntegrity', equals: 'Closed Fracture' },
        },
        {
          key: 'gustiloGrade',
          label: 'Gustilo grade',
          type: 'select',
          options: [], // TODO: Gustilo grades
          visibleWhen: { field: 'skinIntegrity', equals: 'Open Fracture' },
        },
      ],
    },
    {
      heading: 'Ganga Hospital Open Injury Score (GHOISS)',
      inputs: [
        { key: 'ghoissCoveringSkin', label: 'Covering Skin', type: 'number' },
        { key: 'ghoissSkeletalStructures', label: 'Skeletal Structures', type: 'number' },
        { key: 'ghoissMusculotendinous', label: 'Musculotendinous', type: 'number' },
        { key: 'ghoissComorbidFactors', label: 'Comorbid Factors', type: 'number' },
        { key: 'ghoissTotal', label: 'Total', type: 'number', auto: true },
      ],
    },
    {
      heading: 'Associated Ligament, Tendon & Neurovascular Linkage',
      inputs: [
        // TODO: fill associated soft-tissue options
        { key: 'associatedSoftTissue', label: 'Associated Soft Tissue', type: 'multiselect', options: [] },
        { key: 'pathologyNotes', label: 'Pathology notes', type: 'text' },
        {
          key: 'nvDeficitLink',
          label: 'NV Deficit link',
          type: 'select',
          options: [
            'No Acute Neurovascular Deficit',
            'Acute Peripheral Nerve Palsy',
            'Acute Arterial Injury–Ischemic Limb',
            'Suspected Acute Compartment Syndrome',
          ],
        },
      ],
    },
  ],

  distal_nv: [
    {
      heading: "Structured 5 P's Compartment & Extremity Viability Tracker",
      inputs: [
        {
          key: 'pPain',
          label: 'Pain (Passive Stretch) — Mark (+)',
          type: 'checkbox',
          fields: [{ key: 'pPainDetail', label: 'Detail', type: 'text' }],
        },
        {
          key: 'pPallor',
          label: 'Pallor (Skin Color) — Mark (+)',
          type: 'checkbox',
          fields: [
            {
              key: 'pPallorGrade',
              label: 'Skin Color',
              type: 'select',
              options: ['Pink & Warm', 'Pale', 'Pallor (+)', 'Mottled-Dusky', 'Cyanotic-Cold'],
            },
          ],
        },
        {
          key: 'pPulselessness',
          label: 'Pulselessness (Doppler vs. Palpable) — Mark (+)',
          type: 'checkbox',
          fields: [
            {
              key: 'pPulseGrade',
              label: 'Pulse',
              type: 'select',
              options: ['Palpable (+2)', 'Diminished (+1)', 'Impalpable-Doppler audible', 'Absent on both (0)'],
            },
          ],
        },
        {
          key: 'pParesthesia',
          label: 'Paresthesia (Nerve Compression) — Mark (+)',
          type: 'checkbox',
          fields: [{ key: 'pParesthesiaDetail', label: 'Detail', type: 'text' }],
        },
        {
          key: 'pParalysis',
          label: 'Paralysis (Motor Integrity) — Mark (+)',
          type: 'checkbox',
          fields: [
            {
              key: 'pParalysisGrade',
              label: 'Motor',
              type: 'select',
              options: ['Intact (MRC 5/5)', 'Weakness (MRC 2–4/5)', 'Paralysis (MRC 0–1/5)'],
            },
          ],
        },
      ],
    },
    {
      heading: 'Vessel-Specific Pulses, CRT & Manometry',
      inputs: [
        {
          key: 'examinedLimb',
          label: 'Examined limb',
          type: 'buttons',
          options: ['Right Lower Limb', 'Left Lower Limb', 'Right Upper Limb', 'Left Upper Limb'],
        },
        {
          key: 'dorsalisPedisRadial',
          label: 'Dorsalis Pedis / Radial',
          type: 'select',
          options: ['Normal (+2)', 'Diminished (+1)', 'Doppler Only', 'Absent (0)'],
        },
        {
          key: 'posteriorTibialUlnar',
          label: 'Posterior Tibial / Ulnar',
          type: 'select',
          options: ['Normal (+2)', 'Diminished (+1)', 'Doppler Only', 'Absent (0)'],
        },
        { key: 'capillaryRefill', label: 'Capillary Refill', type: 'buttons', options: ['<2s', '2–3s', '>3s'] },
        { key: 'crtSec', label: 'CRT', type: 'number', unit: 'sec' },
        { key: 'diastolicBp', label: 'Diastolic BP', type: 'number', unit: 'mmHg' },
        { key: 'compartmentPressure', label: 'Compartment P.', type: 'number', unit: 'mmHg' },
        { key: 'deltaP', label: 'Delta-P', type: 'number', unit: 'mmHg', auto: true },
        { key: 'vesselNotes', label: 'Notes', type: 'text' },
      ],
    },
    {
      heading: 'Serial Extremity Viability & Vascular Re-Evaluation Log (q2–4h)',
      inputs: [
        {
          key: 'serialViabilityLog',
          label: 'Snapshots',
          type: 'table',
          columns: [
            { key: 'timestamp', label: 'Time', type: 'datetime', nowButton: true },
            { key: 'interval', label: 'Interval', type: 'text' },
            { key: 'pulseStatus', label: 'Pulse Status', type: 'text' },
            { key: 'skinCrt', label: 'Skin / CRT', type: 'text' },
            { key: 'passiveStretchPain', label: 'Passive Stretch Pain', type: 'text' },
            { key: 'sensoryMotor', label: 'Sensory / Motor', type: 'text' },
            { key: 'examinerAction', label: 'Examiner Action', type: 'text' },
          ],
        },
      ],
    },
    {
      heading: 'Limb-Specific Peripheral Motor & Sensory Nerve Check',
      inputs: [
        {
          key: 'nerveCheck',
          label: 'Nerve Check',
          type: 'table',
          rows: ['Deep Peroneal', 'Tibial', 'Median/AIN', 'Radial/PIN', 'Ulnar'],
          columns: [
            { key: 'status', label: 'Status', type: 'text' },
            { key: 'notes', label: 'Notes', type: 'text' },
          ],
        },
        {
          key: 'lachmanTest',
          label: 'Lachman Test (ACL)',
          type: 'select',
          options: ['Negative', 'Grade I+', 'Grade II+', 'Grade III+'],
        },
        {
          key: 'mcMurrayTest',
          label: 'McMurray Meniscal Test',
          type: 'select',
          options: ['Negative', 'Positive Medial', 'Positive Lateral'],
        },
        { key: 'slrDegrees', label: 'Passive Straight Leg Raise (SLR)', type: 'number', unit: '°' },
        {
          key: 'hawkinsKennedy',
          label: 'Hawkins-Kennedy Impingement',
          type: 'select',
          options: ['Negative', 'Positive'], // TODO: confirm positive grades
        },
      ],
    },
  ],

  traction_dvt: [
    {
      heading: 'Deep Vein Thrombosis (DVT) Risk Stratification & Prophylaxis Protocol',
      inputs: [
        { key: 'dvtScoreModel', label: 'Score model', type: 'buttons', options: ['Caprini Score', 'Padua Score'] },
        // Options depend on the chosen score model (each carries points). TODO: fill risk-factor lists.
        { key: 'dvtRiskFactors', label: 'Applicable Patient & Orthopedic Risk Factors', type: 'multiselect', options: [] },
        { key: 'dvtManualOverride', label: 'Manual Override (score)', type: 'number' },
        { key: 'dvtStratification', label: 'Risk Tier / Recommendation', type: 'text', auto: true },
        {
          key: 'mechanicalProphylaxis',
          label: 'Mechanical Prophylaxis Bundle',
          type: 'multiselect',
          options: [
            'Intermittent Pneumatic Compression (IPC / SCD)',
            'Graduated Compression Stockings (TED)',
            'Hourly Active Ankle Pumps & Foot Elevation',
          ],
        },
        {
          key: 'pharmacoProphylaxis',
          label: 'Pharmacological Prophylaxis Agent (LMWH / DOAC)',
          type: 'select',
          options: [
            'Mechanical Only',
            'Enoxaparin 40mg SC OD',
            'Fondaparinux 2.5mg SC OD',
            'Rivaroxaban 10mg OD',
            'Apixaban 2.5mg BD',
            'Aspirin 150mg OD',
          ],
        },
      ],
    },
    {
      heading: 'Traction, Splintage & Definitive Pre-Op Stabilization',
      inputs: [
        { key: 'appliedIst', label: 'Applied IST', type: 'datetime', nowButton: true },
        {
          key: 'stabilizationMode',
          label: 'Stabilization mode',
          type: 'buttons',
          options: [
            'Bohler-Braun Splint',
            'Skin Traction',
            'Skeletal Traction',
            'POP Slab-Cast',
            'External Fixator',
          ],
        },
        { key: 'tractionWeight', label: 'Traction Weight', type: 'number', unit: 'kg' },
        { key: 'pinInsertionLocus', label: 'Pin Insertion Locus / Slab Configuration', type: 'text' },
        {
          key: 'pinSiteCastStatus',
          label: 'Pin-Site / Cast Skin Status',
          type: 'select',
          options: [
            'Clean & Dry (Grade 0)',
            'Mild Erythema (Grade 1)',
            'Tenderness & Discharge (Grade 2)',
            'Pin Loosening-Deep Infection (Grade 4+)',
            'Intact Skin Under POP-Skin Traction',
          ],
        },
        { key: 'castBivalved', label: 'Circumferential Cast Bivalved / Split', type: 'checkbox' },
        { key: 'postSplintNvVerified', label: 'Post-Splint / Traction Distal NV Verified', type: 'checkbox' },
        { key: 'tractionNotes', label: 'Notes', type: 'text' },
      ],
    },
    {
      heading: 'Pre-Op Orthopedic Readiness & PAC Clearance',
      inputs: [
        {
          key: 'pacStatus',
          label: 'Pre-Anesthetic Check (PAC) Status',
          type: 'buttons',
          options: ['Cleared', 'High-Risk Clearance', 'Pending Optimization'],
        },
        {
          key: 'tetanusProphylaxis',
          label: 'Tetanus Prophylaxis (Open / RTA Contamination)',
          type: 'select',
          options: [
            'Td/TT 0.5mL IM',
            'Td + Human TIG 250–500 IU',
            'Immunized Within Last 5 Years',
          ],
        },
        {
          key: 'tourniquetCArmPlan',
          label: 'Tourniquet Cuff Pressure & C-Arm / Templating Plan',
          type: 'textarea',
        },
      ],
    },
  ],

  implants: [
    {
      heading: 'Implant & Hardware Inventory Tracking (NABH / IJR / CDSCO Materiovigilance)',
      inputs: [
        {
          key: 'implantLog',
          label: 'Hardware Items',
          type: 'table',
          columns: [
            // button-select in spec; dropdown in table. TODO: implant category list
            { key: 'implantCategory', label: 'Category', type: 'select', options: [] },
            { key: 'implantName', label: 'Implant / Hardware Name', type: 'text' },
            { key: 'manufacturer', label: 'Manufacturer / Brand', type: 'text' },
            { key: 'lotUdi', label: 'Lot No. / UDI', type: 'text', placeholder: 'Scan or enter UDI' },
            { key: 'sizeSpec', label: 'Size / Length / Diameter', type: 'text' },
            {
              key: 'side',
              label: 'Side',
              type: 'select',
              options: ['Right', 'Left', 'Bilateral', 'Axial', 'Pelvis'],
            },
            { key: 'fixationSite', label: 'Anatomical Fixation Site', type: 'text' },
          ],
        },
      ],
    },
    {
      heading: 'Billing',
      inputs: [
        { key: 'icd10Code', label: 'ICD-10 Code', type: 'text' },
        { key: 'tpaPackage', label: 'TPA / PM-JAY Package', type: 'text' },
        {
          key: 'implantStickersVerified',
          label: 'Physical Peel-Off Implant Stickers Verified for TPA Invoice',
          type: 'checkbox',
        },
      ],
    },
  ],

  rom_scores: [
    {
      heading: 'Biomechanical Goniometry — Active vs. Passive Range of Motion (Pre-Op & Post-Op)',
      inputs: [
        {
          key: 'romLog',
          label: 'Joint Motions',
          type: 'table',
          columns: [
            { key: 'jointMotionPlane', label: 'Joint & Motion Plane', type: 'text' },
            { key: 'side', label: 'Side', type: 'select', options: ['Right', 'Left', 'Bilateral'] },
            { key: 'preOpActive', label: 'Pre-Op Active', type: 'number', unit: '°' },
            { key: 'preOpPassive', label: 'Pre-Op Passive', type: 'number', unit: '°' },
            { key: 'postOpActive', label: 'Post-Op Active', type: 'number', unit: '°' },
            { key: 'postOpPassive', label: 'Post-Op Passive', type: 'number', unit: '°' },
            { key: 'activeGain', label: 'Active Gain (Δ)', type: 'number', unit: '°', auto: true },
          ],
        },
      ],
    },
    {
      heading: 'Limb Length Discrepancy (LLD) & Axis / Alignment Mapping',
      inputs: [
        { key: 'trueRight', label: 'True Right (ASIS–MM)', type: 'number', unit: 'cm' },
        { key: 'trueLeft', label: 'True Left (ASIS–MM)', type: 'number', unit: 'cm' },
        { key: 'trueLld', label: 'True LLD (editable override)', type: 'number', unit: 'cm', auto: true },
        { key: 'apparentRight', label: 'Apparent Right (Umb–MM)', type: 'number', unit: 'cm' },
        { key: 'apparentLeft', label: 'Apparent Left (Umb–MM)', type: 'number', unit: 'cm' },
        { key: 'apparentLld', label: 'Apparent LLD (editable override)', type: 'number', unit: 'cm', auto: true },
        {
          key: 'shortenedSide',
          label: 'Shortened side',
          type: 'buttons',
          options: ['Right Limb Short', 'Left Limb Short', 'Equal Limb Length'],
        },
        {
          key: 'axisDeformityPattern',
          label: 'Axis / Deformity Pattern',
          type: 'select',
          options: ['Neutral', 'Varus', 'Valgus', 'Procurvatum', 'Recurvatum', 'Rotational Malalignment'],
        },
        { key: 'varusValgusAngle', label: 'Varus / Valgus Angle', type: 'number', unit: '°' },
        { key: 'sagittalTorsion', label: 'Sagittal / Torsion', type: 'number', unit: '°' },
        {
          key: 'weightBearingRegimen',
          label: 'Weight-Bearing Regimen',
          type: 'select',
          options: [
            'NWB 6 Weeks',
            'Toe-Touch (TTWB)',
            'Partial (50% PWB)',
            'Full as Tolerated (FWBAT)',
          ],
        },
        { key: 'mechanicalAxisNotes', label: 'Mechanical Axis / Alignment Notes', type: 'text' },
      ],
    },
    {
      heading: 'Functional Score — HSS Knee',
      inputs: [
        { key: 'hssPain', label: 'Pain (/30)', type: 'number', min: 0, max: 30 },
        { key: 'hssFunction', label: 'Function (/22)', type: 'number', min: 0, max: 22 },
        { key: 'hssRom', label: 'ROM (/18)', type: 'number', min: 0, max: 18 },
        { key: 'hssMuscleStrength', label: 'Muscle Strength (/10)', type: 'number', min: 0, max: 10 },
        { key: 'hssFlexionDeformity', label: 'Flexion Deformity (/10)', type: 'number', min: 0, max: 10 },
        { key: 'hssInstability', label: 'Instability (/10)', type: 'number', min: 0, max: 10 },
        { key: 'hssDeductions', label: 'Deductions', type: 'number' },
        { key: 'hssTotal', label: 'Total (/100)', type: 'number', auto: true },
      ],
    },
    {
      heading: 'Functional Score — KOOS',
      inputs: [
        { key: 'koosPain', label: 'Pain', type: 'number', min: 0, max: 100 },
        { key: 'koosSymptoms', label: 'Symptoms', type: 'number', min: 0, max: 100 },
        { key: 'koosAdl', label: 'ADL', type: 'number', min: 0, max: 100 },
        { key: 'koosSportRec', label: 'Sport / Rec', type: 'number', min: 0, max: 100 },
        { key: 'koosQol', label: 'QoL', type: 'number', min: 0, max: 100 },
        { key: 'koosMean', label: 'Mean', type: 'number', auto: true },
      ],
    },
    {
      heading: 'Functional Score — HHS Hip',
      inputs: [
        { key: 'hhsPain', label: 'Pain (/44)', type: 'number', min: 0, max: 44 },
        { key: 'hhsGaitFunction', label: 'Gait-Function (/47)', type: 'number', min: 0, max: 47 },
        { key: 'hhsDeformityRom', label: 'Deformity-ROM (/9)', type: 'number', min: 0, max: 9 },
        { key: 'hhsTotal', label: 'Total', type: 'number', auto: true },
      ],
    },
  ],
};

export const orthopedicsTraumatologyLabels: SpecialtyCategoryLabels = {
  pre_hospital: 'Pre-Hospital, Golden Hour & ATLS',
  injury_details: 'Injury Details, AO/OTA Map & Ganga',
  distal_nv: "Distal NV, 5 P's & Serial Viability",
  traction_dvt: 'Traction, DVT Score & Pre-Op',
  implants: 'Implants, Hardware & Prosthesis Log',
  rom_scores: 'Goniometric ROM & Functional Scores (HSS/KOOS)',
};




