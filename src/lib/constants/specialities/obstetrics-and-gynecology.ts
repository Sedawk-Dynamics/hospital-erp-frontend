import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const obstetricsGynecology: SpecialtyCategories = {
  anc_maternal_screening: [
    {
      heading: 'Obstetric Parity (GPLAE) & Naegele Dating',
      inputs: [
        { key: 'gravida', label: 'G (Gravida)', type: 'number' },
        { key: 'para', label: 'P (Para)', type: 'number' },
        { key: 'living', label: 'L (Living)', type: 'number' },
        { key: 'abortions', label: 'A (Abortions)', type: 'number' },
        { key: 'ectopic', label: 'E (Ectopic)', type: 'number' },
        { key: 'lmpDate', label: 'LMP Date', type: 'datetime' },
        { key: 'cycleLength', label: 'Cycle Length', type: 'number', unit: 'days' },
        { key: 'crlEddOverride', label: '1st Trimester CRL EDD Override', type: 'datetime' },
        { key: 'maternalAboRh', label: 'Maternal ABO / Rh Group', type: 'text' },
        { key: 'edd', label: 'EDD', type: 'datetime', auto: true },
        { key: 'pog', label: 'POG', type: 'text', auto: true },
        { key: 'trimester', label: 'Trimester', type: 'text', auto: true },
      ],
    },
    {
      heading: 'FOGSI / MoHFW Antenatal Risk & Metabolic Screening',
      inputs: [
        { key: 'maternalHb', label: 'Maternal Hb', type: 'number', unit: 'g/dL' },
        { key: 'dipsiGlucose', label: 'DIPSI 75g 2-Hr Glucose', type: 'number', unit: 'mg/dL' },
        { key: 'serumTsh', label: 'Serum TSH', type: 'number', unit: 'mIU/L' },
        { key: 'td1Date', label: 'Td-1 Vaccine Date', type: 'datetime' },
        { key: 'td2Date', label: 'Td-2 / Booster Date', type: 'datetime' },
        { key: 'anemiaInterpretation', label: 'Anemia Interpretation', type: 'text', auto: true },
        { key: 'gdmInterpretation', label: 'GDM Interpretation', type: 'text', auto: true },
      ],
    },
    {
      heading: 'Longitudinal Antenatal Visit Flowsheet',
      inputs: [
        {
          key: 'ancVisitLog',
          label: 'ANC Visit Log',
          type: 'table',
          columns: [
            { key: 'date', label: 'Date', type: 'datetime' },
            { key: 'pog', label: 'POG', type: 'text' },
            { key: 'weight', label: 'Wt (kg)', type: 'text' },
            { key: 'bp', label: 'BP', type: 'text' },
            { key: 'sfh', label: 'SFH (cm)', type: 'text' },
            { key: 'fhr', label: 'FHR (bpm)', type: 'text' },
            { key: 'urineAlbumin', label: 'Urine Albumin', type: 'text' },
            { key: 'hb', label: 'Hb (g/dL)', type: 'text' },
            { key: 'remarks', label: 'Remarks/Plan', type: 'text' },
          ],
        },
      ],
    },
  ],
  pmsma_hrp: [],
  labour_delivery_postpartum: [],
  gynecology_palm_coein: [
    {
      heading: 'Gynecology (PALM-COEIN)',
      inputs: [
        {
          key: 'figoAubEtiology',
          label: 'FIGO AUB Etiology (PALM-COEIN)',
          type: 'select',
          options: [
            'AUB-P',
            'AUB-A',
            'AUB-L',
            'AUB-M',
            'AUB-C',
            'AUB-O',
            'AUB-E',
            'AUB-I',
          ],
        },
        {
          key: 'cervicalScreening',
          label: 'Cervical Screening (VIA/Pap/HPV DNA)',
          type: 'select',
          options: [
            'NILM-VIA Negative',
            'VIA Positive',
            'ASC-US-LSIL',
            'HSIL-Suspicious',
          ],
        },
        { key: 'pelvicUltrasound', label: 'Pelvic Ultrasound (TAS/TVS) Summary', type: 'textarea' },
      ],
    },
  ],
  form_f_pcpndt: [],
};

export const obstetricsGynecologyLabels: SpecialtyCategoryLabels = {
  anc_maternal_screening: 'ANC & Maternal Screening',
  pmsma_hrp: 'PMSMA High-Risk Pregnancy (HRP)',
  labour_delivery_postpartum: 'Labour, Delivery & Postpartum',
  gynecology_palm_coein: 'Gynecology (PALM-COEIN)',
  form_f_pcpndt: 'Form F (PC-PNDT Validation)',
};








































































