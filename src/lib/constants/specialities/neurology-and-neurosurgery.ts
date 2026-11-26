import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const neurologyNeurosurgery: SpecialtyCategories = {
  code_stroke: [
    {
      heading: 'Hyperacute Code Stroke Clock & IV Thrombolysis (≤4.5h)',
      inputs: [
        { key: 'lastKnownWell', label: 'Last Known Well (ago)', type: 'number', unit: 'h' },
        { key: 'doorToNcct', label: 'Door-to-NCCT', type: 'number', unit: 'mins' },
        { key: 'doorToNeedle', label: 'Door-to-Needle', type: 'number', unit: 'mins' },
        { key: 'ncctAspects', label: 'NCCT ASPECTS (0–10)', type: 'number', min: 0, max: 10 },
        { key: 'patientWeight', label: 'Patient Weight', type: 'number', unit: 'kg' },
        { key: 'preLysisSbp', label: 'Pre-Lysis SBP', type: 'number', unit: 'mmHg' },
        { key: 'preLysisDbp', label: 'Pre-Lysis DBP', type: 'number', unit: 'mmHg' },
        { key: 'ichExcluded', label: 'ICH Excluded on NCCT', type: 'checkbox' },
        {
          key: 'tenecteplaseDose',
          label: 'Tenecteplase (0.25 mg/kg)',
          type: 'number',
          unit: 'mg',
          auto: true,
        },
        {
          key: 'alteplaseDose',
          label: 'Alteplase (0.9 mg/kg)',
          type: 'number',
          unit: 'mg',
          auto: true,
        },
        {
          key: 'windowEligibility',
          label: 'Window Eligibility',
          type: 'skeleton',
          auto: true,
        },
      ],
    },
    {
      heading: 'Extended-Window Perfusion Imaging & Mechanical Thrombectomy (EVT ≤24h)',
      inputs: [
        {
          key: 'lvoSite',
          label: 'Large Vessel Occlusion (LVO) Site',
          type: 'select',
          options: ['No LVO', 'ICA Terminus', 'M1', 'M2', 'Basilar', 'Vertebral'],
        },
        {
          key: 'occlusionLaterality',
          label: 'Occlusion Laterality',
          type: 'select',
          options: ['Right', 'Left', 'Midline-Bilateral'],
        },
        { key: 'coreInfarct', label: 'Core Infarct CBF <30%', type: 'number', unit: 'mL' },
        { key: 'penumbraTmax', label: 'Tmax >6s Penumbra', type: 'number', unit: 'mL' },
        { key: 'rapidMismatchRatio', label: 'RAPID Mismatch Ratio', type: 'number', auto: true },
        {
          key: 'evtDeviceStrategy',
          label: 'EVT Thrombectomy Device/Strategy',
          type: 'select',
          options: [
            'Stent Retriever',
            'Direct Aspiration ADAPT',
            'Combined Solumbra',
            'Rescue Angioplasty-Stent',
          ],
        },
        { key: 'doorToGroin', label: 'Door-to-Groin Puncture', type: 'number', unit: 'mins' },
        { key: 'thrombectomyPasses', label: 'Thrombectomy Passes (#)', type: 'number' },
        {
          key: 'mticiGrade',
          label: 'Final Reperfusion Grade (mTICI)',
          type: 'select',
          options: ['mTICI 3', 'mTICI 2c', 'mTICI 2b', 'mTICI 2a', 'mTICI 1', 'mTICI 0'],
        },
      ],
    },
  ],
  stroke_scores: [
    {
      heading: 'Glasgow Coma Scale (GCS 3–15)',
      inputs: [
        {
          key: 'gcsEye',
          label: 'Eye Opening',
          type: 'select',
          options: ['E4', 'E3', 'E2', 'E1'],
        },
        {
          key: 'gcsVerbal',
          label: 'Verbal Response',
          type: 'select',
          options: ['V5', 'V4', 'V3', 'V2', 'V1'],
        },
        {
          key: 'gcsMotor',
          label: 'Best Motor Response',
          type: 'select',
          options: ['M6', 'M5', 'M4', 'M3', 'M2', 'M1'],
        },
        { key: 'gcsIntubated', label: 'Intubated / Tracheostomy (V1T)', type: 'checkbox' },
        { key: 'gcsTotal', label: 'Total GCS', type: 'number', auto: true },
      ],
    },
    {
      heading: 'NIH Stroke Scale (NIHSS 0–42)',
      inputs: [
        { key: 'nihss1a', label: '1a. Consciousness', type: 'number', min: 0, max: 3 },
        { key: 'nihss1b', label: '1b. Month/Age Qs', type: 'number', min: 0, max: 2 },
        { key: 'nihss1c', label: '1c. Commands', type: 'number', min: 0, max: 2 },
        { key: 'nihss2', label: '2. Horizontal Gaze', type: 'number', min: 0, max: 2 },
        { key: 'nihss3', label: '3. Visual Fields', type: 'number', min: 0, max: 3 },
        { key: 'nihss4', label: '4. Facial Palsy', type: 'number', min: 0, max: 3 },
        { key: 'nihss5a', label: '5a. Right Arm Drift', type: 'number', min: 0, max: 4 },
        { key: 'nihss5b', label: '5b. Left Arm Drift', type: 'number', min: 0, max: 4 },
        { key: 'nihss6a', label: '6a. Right Leg Drift', type: 'number', min: 0, max: 4 },
        { key: 'nihss6b', label: '6b. Left Leg Drift', type: 'number', min: 0, max: 4 },
        { key: 'nihss7', label: '7. Limb Ataxia', type: 'number', min: 0, max: 2 },
        { key: 'nihss8', label: '8. Pinprick Sensory', type: 'number', min: 0, max: 2 },
        { key: 'nihss9', label: '9. Best Language', type: 'number', min: 0, max: 3 },
        { key: 'nihss10', label: '10. Dysarthria', type: 'number', min: 0, max: 2 },
        { key: 'nihss11', label: '11. Extinction/Neglect', type: 'number', min: 0, max: 2 },
        { key: 'nihssTotal', label: 'NIHSS Total', type: 'number', auto: true },
      ],
    },
    {
      heading: 'Modified Rankin Scale (mRS 0–6)',
      inputs: [
        {
          key: 'mrsGrade',
          label: 'Functional Disability Grade',
          type: 'select',
          options: ['mRS 0', 'mRS 1', 'mRS 2', 'mRS 3', 'mRS 4', 'mRS 5', 'mRS 6'],
        },
      ],
    },
    {
      heading: 'ABCD² Score for TIA (0–7)',
      inputs: [
        { key: 'abcdAge', label: 'Age ≥60y (+1)', type: 'checkbox' },
        { key: 'abcdBp', label: 'BP ≥140/90 (+1)', type: 'checkbox' },
        { key: 'abcdDiabetes', label: 'Diabetes (+1)', type: 'checkbox' },
        {
          key: 'abcdClinical',
          label: 'Clinical Features',
          type: 'select',
          options: ['Other 0', 'Speech disturbance +1', 'Unilateral weakness +2'],
        },
        {
          key: 'abcdDuration',
          label: 'Duration',
          type: 'select',
          options: ['<10 min 0', '10–59 min +1', '≥60 min +2'],
        },
        { key: 'abcdTotal', label: 'ABCD² Total', type: 'number', auto: true },
      ],
    },
  ],
  motor_cranial_sensory: [
    {
      heading: 'Bilateral MRC (0–5) Motor Matrix',
      inputs: [
        { key: 'markAll5Normal', label: 'Mark All 5/5 Normal', type: 'skeleton', auto: true },
        {
          key: 'myotomeMatrix',
          label: 'Myotomes',
          type: 'table',
          columns: [
            { key: 'myotome', label: 'Myotome / Muscle Action', type: 'text' },
            {
              key: 'rightLimb',
              label: 'Right Limb',
              type: 'select',
              options: ['5', '4+', '4', '4−', '3', '2', '1', '0'],
            },
            {
              key: 'leftLimb',
              label: 'Left Limb',
              type: 'select',
              options: ['5', '4+', '4', '4−', '3', '2', '1', '0'],
            },
          ],
        },
        {
          key: 'muscleTone',
          label: 'Muscle Tone (Ashworth/Rigidity)',
          type: 'select',
          options: [
            'Normal',
            'Spastic Hypertonia',
            'Lead-Pipe-Cogwheel',
            'Flaccid Hypotonia',
          ],
        },
        {
          key: 'plantarDtr',
          label: 'Plantar (Babinski) & Deep Tendon Reflexes',
          type: 'text',
        },
      ],
    },
    {
      heading: 'Pupils, Brainstem Reflexes & Cranial Nerve (I–XII) Grid',
      inputs: [
        {
          key: 'markCnIntact',
          label: 'Mark CN I–XII Grossly Intact',
          type: 'skeleton',
          auto: true,
        },
        { key: 'rightPupilSize', label: 'Right Pupil', type: 'number', unit: 'mm' },
        {
          key: 'rightPupilReactivity',
          label: 'Right Reactivity',
          type: 'select',
          options: ['Brisk', 'Sluggish', 'Fixed'],
        },
        { key: 'leftPupilSize', label: 'Left Pupil', type: 'number', unit: 'mm' },
        {
          key: 'leftPupilReactivity',
          label: 'Left Reactivity',
          type: 'select',
          options: ['Brisk', 'Sluggish', 'Fixed'],
        },
        {
          key: 'cornealReflex',
          label: 'Corneal Reflex',
          type: 'select',
          options: ['Present Bilaterally', 'Absent Unilaterally', 'Absent Bilaterally'],
        },
        {
          key: 'gagCoughReflex',
          label: 'Gag / Cough Reflex',
          type: 'select',
          options: ['Intact', 'Impaired', 'Absent'],
        },
        {
          key: 'cnOlfactory',
          label: 'CN I (Olfactory)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnOptic',
          label: 'CN II (Optic)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnOculomotor',
          label: 'CN III-IV-VI (Ocular Motor)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnTrigeminal',
          label: 'CN V (Trigeminal)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnFacial',
          label: 'CN VII (Facial)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnVestibulocochlear',
          label: 'CN VIII (Vestibulocochlear)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnGlossoVagus',
          label: 'CN IX-X (Glosso/Vagus)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnAccessory',
          label: 'CN XI (Accessory)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'cnHypoglossal',
          label: 'CN XII (Hypoglossal)',
          type: 'select',
          options: ['Intact', 'Deficit'],
        },
        {
          key: 'focalCnDeficitNotes',
          label: 'Focal Cranial Nerve Deficit Localization Notes',
          type: 'text',
        },
        {
          key: 'sensoryCerebellarGait',
          label: 'Sensory (Spinothalamic/Dorsal Column/Cord Level) & Cerebellar Gait',
          type: 'text',
        },
      ],
    },
  ],
  epilepsy_eeg: [
    {
      heading: 'Status Epilepticus Weight-Based ASM Loading Calculator',
      inputs: [
        { key: 'seWeight', label: 'Patient Weight', type: 'number', unit: 'kg' },
        {
          key: 'doseLorazepam',
          label: 'Lorazepam (0.1 mg/kg)',
          type: 'number',
          unit: 'mg',
          auto: true,
        },
        {
          key: 'doseLevetiracetam',
          label: 'Levetiracetam (60 mg/kg)',
          type: 'number',
          unit: 'mg',
          auto: true,
        },
        {
          key: 'dosePhenytoin',
          label: 'Phenytoin/Fosphenytoin (20 mg/kg)',
          type: 'number',
          unit: 'mg',
          auto: true,
        },
        {
          key: 'doseValproate',
          label: 'Sodium Valproate (40 mg/kg)',
          type: 'number',
          unit: 'mg',
          auto: true,
        },
      ],
    },
    {
      heading: 'ILAE Semiology, cEEG & NCC/Tuberculoma Workup',
      inputs: [
        {
          key: 'ilaeSemiology',
          label: 'ILAE 2017 Seizure Semiology',
          type: 'select',
          options: [
            'Focal Impaired Awareness',
            'Focal→Bilateral TC',
            'GTCS',
            'Status Epilepticus',
            'JME',
          ],
        },
        {
          key: 'ceegStatus',
          label: 'Continuous EEG (cEEG) Monitoring Status',
          type: 'select',
          options: [
            'Routine 30-min',
            'cEEG Active No NCSz',
            'NCSE Detected',
            'Burst-Suppression',
          ],
        },
        { key: 'maintenanceAsm', label: 'Maintenance ASM Regimen', type: 'text' },
        {
          key: 'asmDrugLevel',
          label: 'ASM Therapeutic Drug Level (mcg/mL)',
          type: 'text',
        },
        {
          key: 'eegBackgroundReport',
          label: 'EEG Background & Epileptiform Discharge Report',
          type: 'text',
        },
        {
          key: 'mriEpilepsyFindings',
          label: '3T MRI Epilepsy / CISS Ring-Lesion Findings',
          type: 'text',
        },
      ],
    },
  ],
  neuro_icu_icp: [
    {
      heading: 'ICP & Cerebral Perfusion Pressure (CPP = MAP − ICP) Monitor',
      inputs: [
        { key: 'transducerIcp', label: 'Transducer ICP', type: 'number', unit: 'mmHg' },
        { key: 'arterialSbp', label: 'Arterial SBP', type: 'number', unit: 'mmHg' },
        { key: 'arterialDbp', label: 'Arterial DBP', type: 'number', unit: 'mmHg' },
        { key: 'map', label: 'MAP (auto from SBP/DBP if blank)', type: 'number', unit: 'mmHg' },
        { key: 'cpp', label: 'Calculated CPP', type: 'number', unit: 'mmHg', auto: true },
        {
          key: 'evdCatheterSite',
          label: 'EVD / Lumbar Drain Catheter Site',
          type: 'select',
          options: [
            "Right Frontal Kocher's EVD",
            "Left Frontal Kocher's EVD",
            'Intraparenchymal Bolt',
            'Lumbar CSF Drain L3–L4',
          ],
        },
        {
          key: 'chamberLevelTragus',
          label: 'Chamber Level Above Tragus (cmH₂O)',
          type: 'text',
        },
        {
          key: 'stopcockDrainStatus',
          label: 'Stopcock / Drain Status',
          type: 'select',
          options: [
            'Open Continuous',
            'Clamped-ICP Transduction',
            'Clamped-Weaning Trial',
          ],
        },
        {
          key: 'icpTierIntervention',
          label: 'Hyperosmolar / ICP Tier Intervention',
          type: 'select',
          options: [
            'None-HOB 30°',
            '3% Hypertonic Saline',
            '20% Mannitol',
            'Decompressive Craniectomy',
          ],
        },
      ],
    },
    {
      heading: 'Hourly EVD / Lumbar CSF Drainage Flowsheet',
      inputs: [
        {
          key: 'csfFlowsheet',
          label: 'CSF Drainage Log',
          type: 'table',
          columns: [
            { key: 'timestamp', label: 'Timestamp', type: 'datetime' },
            { key: 'hourlyCsfVolume', label: 'Hourly CSF Volume (mL)', type: 'number' },
            {
              key: 'csfAppearance',
              label: 'CSF Gross Appearance',
              type: 'select',
              options: [
                'Clear-Colorless',
                'Xanthochromic',
                'Blood-Tinged',
                'Turbid-Cloudy',
              ],
            },
            { key: 'rowIcp', label: 'ICP', type: 'number' },
            { key: 'rowCpp', label: 'CPP', type: 'number' },
          ],
        },
      ],
    },
  ],
};

export const neurologyNeurosurgeryLabels: SpecialtyCategoryLabels = {
  code_stroke: 'Code Stroke Clock & Tenecteplase/EVT',
  stroke_scores: 'Interactive NIHSS, GCS, mRS & ABCD²',
  motor_cranial_sensory: 'MRC Motor, Cranial Nerves & Sensory Exam',
  epilepsy_eeg: 'Epilepsy, Seizure Semiology & EEG Suite',
  neuro_icu_icp: 'Neuro-ICU, ICP Monitoring & EVD Surgical Log',
};
