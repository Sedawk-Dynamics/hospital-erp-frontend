
import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const psychiatryMentalHealth: SpecialtyCategories = {
  mse: [
    {
      heading: 'NIMHANS Structured Mental Status Examination (MSE)',
      inputs: [
        { key: 'generalAppearance', label: 'General Appearance, Attitude & Psychomotor Activity', type: 'textarea' },
        { key: 'speech', label: 'Speech (Rate, Tone, Volume, Reaction Time)', type: 'textarea' },
        { key: 'subjectiveMood', label: 'Subjective Mood (Verbatim)', type: 'textarea' },
        { key: 'objectiveAffect', label: 'Objective Affect (Range, Reactivity, Congruence)', type: 'textarea' },
        { key: 'thoughtStreamForm', label: 'Thought Stream & Form', type: 'textarea' },
        { key: 'thoughtContent', label: 'Thought Content (Ideas, Obsessions, Delusions)', type: 'textarea' },
        { key: 'perceptualPhenomena', label: 'Perceptual Phenomena (Hallucinations / Illusions)', type: 'textarea' },
        { key: 'higherMentalFunctions', label: 'Higher Mental Functions & MMSE', type: 'textarea' },
        { key: 'judgment', label: 'Personal, Social & Test Judgment', type: 'textarea' },
        {
          key: 'insightGrading',
          label: 'Insight Grading',
          type: 'select',
          options: [
            'Grade I — Complete Denial of Illness',
            'Grade II — Slight Awareness but Denying',
            'Grade III — Awareness but Blames Others',
            'Grade IV — Awareness due to Unknown Factors',
            'Grade V — Intellectual Insight',
            'Grade VI — True Emotional Insight',
          ],
        },
      ],
    },
  ],

  // 2. PHQ-9, GAD-7 & C-SSRS Suicide Gate
  screening_scores: [
    {
      heading: 'Patient Health Questionnaire (PHQ-9, 0–3 per item)',
      inputs: [
        { key: 'phqAnhedonia', label: 'Anhedonia (little interest/pleasure)', type: 'number', min: 0, max: 3 },
        { key: 'phqDepressed', label: 'Feeling down, depressed, hopeless', type: 'number', min: 0, max: 3 },
        { key: 'phqSleep', label: 'Sleep insomnia or hypersomnia', type: 'number', min: 0, max: 3 },
        { key: 'phqFatigue', label: 'Fatigue / loss of energy', type: 'number', min: 0, max: 3 },
        { key: 'phqAppetite', label: 'Poor appetite or overeating', type: 'number', min: 0, max: 3 },
        { key: 'phqGuilt', label: 'Guilt / feeling like a failure', type: 'number', min: 0, max: 3 },
        { key: 'phqConcentration', label: 'Poor concentration', type: 'number', min: 0, max: 3 },
        { key: 'phqPsychomotor', label: 'Psychomotor retardation / agitation', type: 'number', min: 0, max: 3 },
        { key: 'phqSelfHarm', label: 'Thoughts of self-harm / better off dead', type: 'number', min: 0, max: 3 },
        { key: 'phq9Total', label: 'PHQ-9 Total (/27)', type: 'number', auto: true },
        { key: 'phq9Severity', label: 'PHQ-9 Severity', type: 'text', auto: true },
      ],
    },
    {
      heading: 'GAD-7 & Columbia Suicide Severity (C-SSRS)',
      inputs: [
        { key: 'gad7Score', label: 'GAD-7 Generalized Anxiety Score (0–21)', type: 'number', min: 0, max: 21 },
        {
          key: 'cssrs',
          label: 'Columbia Suicide Severity Rating Scale (C-SSRS)',
          type: 'select',
          options: [
            'None (no ideation)',
            'Low (passive wish, no plan-intent)',
            'Moderate (ideation without intent)',
            'High Risk (active plan-intent — 1:1 precaution)',
          ],
        },
      ],
    },
  ],

  // 3. Statutory MHCA 2017 & Lithium/Clozapine TDM
  mhca_tdm: [
    {
      heading: 'Mental Healthcare Act (MHCA 2017) Statutory Registry',
      inputs: [
        { key: 'section4Capacity', label: 'Section 4 Mental Capacity Assessment', type: 'text' },
        { key: 'section5AdvanceDirective', label: 'Section 5 Advance Directive (e-Manas)', type: 'text' },
        { key: 'section14NominatedRep', label: 'Section 14 Nominated Representative (NR)', type: 'text' },
        {
          key: 'legalAdmissionCategory',
          label: 'Legal Admission Category',
          type: 'select',
          options: [
            'Outpatient Voluntary Consultation',
            'Section 86 — Independent Admission',
            'Section 89 — Supported Admission (Notify MHRB)',
          ],
        },
        {
          key: 'confidentialityShield',
          label: 'Enforce MHCA 2017 Section 23 Right to Confidentiality Shield',
          type: 'checkbox',
        },
      ],
    },
    {
      heading: 'Therapeutic Drug Monitoring (TDM)',
      inputs: [
        {
          key: 'lithiumTrough',
          label: '12h Trough Serum Lithium (0.6–1.0 mEq/L; Toxic >1.5)',
          type: 'number',
          unit: 'mEq/L',
        },
        {
          key: 'clozapineAnc',
          label: 'Clozapine Absolute Neutrophil Count (Stop if <1500/µL)',
          type: 'number',
          unit: '/µL',
        },
      ],
    },
  ],
};

export const psychiatryMentalHealthLabels: SpecialtyCategoryLabels = {
  mse: '10-Domain Mental Status Examination (MSE)',
  screening_scores: 'PHQ-9, GAD-7 & C-SSRS Suicide Gate',
  mhca_tdm: 'Statutory MHCA 2017 & Lithium/Clozapine TDM',
};
