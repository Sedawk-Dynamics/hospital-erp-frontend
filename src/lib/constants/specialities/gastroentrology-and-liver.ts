import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';

export const gastroenterologyLiver: SpecialtyCategories = {
  endoscopy_diagnostic: [
    {
      heading: 'Structured Video UGIE & Colonoscopy Diagnostic Suite (ISG / Sarin Classification)',
      inputs: [
        {
          key: 'laGerdGrade',
          label: 'Esophagus — Los Angeles GERD Classification',
          type: 'select',
          options: [
            'Normal GE Junction',
            'LA Grade A (≤5mm)',
            'Grade B (>5mm non-confluent)',
            'Grade C (<75% circumference)',
            'Grade D (≥75% circumference)',
          ],
        },
        {
          key: 'sarinVarices',
          label: 'Portal HTN — Sarin Classification of Varices',
          type: 'select',
          options: [
            'No Varices',
            'Grade I Small',
            'Grade II/III Large (Red Wale +)',
            'GOV1 (Lesser Curve)',
            'GOV2 (Fundal)',
            'IGV1 (Isolated Fundal)',
            'IGV2 (Ectopic Antral/Duodenal)',
          ],
        },
        {
          key: 'forrestStigmata',
          label: 'Stomach/Duodenum — Forrest Peptic Ulcer Stigmata',
          type: 'select',
          options: [
            'Ia Spurting',
            'Ib Oozing',
            'IIa Visible Vessel',
            'IIb Adherent Clot',
            'IIc Flat Pigmented Spot',
            'III Clean Base',
          ],
        },
        {
          key: 'rutResult',
          label: 'Antral Biopsy Rapid Urease Test (RUT)',
          type: 'select',
          options: ['POSITIVE at 15 min', 'NEGATIVE at 24h'],
        },
        { key: 'bbpsRight', label: 'BBPS Right Colon (0–3)', type: 'number', min: 0, max: 3 },
        { key: 'bbpsTransverse', label: 'BBPS Transverse (0–3)', type: 'number', min: 0, max: 3 },
        { key: 'bbpsLeft', label: 'BBPS Left Colon (0–3)', type: 'number', min: 0, max: 3 },
        { key: 'cecalIntubationWithdrawal', label: 'Cecal Intubation & Withdrawal', type: 'text' },
        {
          key: 'luminalImpressions',
          label: 'Additional Luminal/Colonic Diagnostic Impressions',
          type: 'text',
        },
        { key: 'bbpsTotal', label: 'BBPS total (/9)', type: 'number', auto: true },
      ],
    },
  ],

  therapeutic_endoscopy: [
    {
      heading: 'Upper GI Therapeutic Endoscopy Intervention Registry',
      inputs: [
        { key: 'evlBands', label: 'EVL — Bands Deployed (#)', type: 'number' },
        { key: 'evlVarixSites', label: 'EVL — Varix Columns / Sites', type: 'text' },
        {
          key: 'sclerosantAgent',
          label: 'Sclerotherapy / Glue — Agent',
          type: 'select',
          options: ['Cyanoacrylate Glue', '1% Polidocanol', 'STS', 'Adrenaline 1:10,000'],
        },
        { key: 'sclerosantVolume', label: 'Sclerotherapy / Glue — Volume Injected', type: 'number', unit: 'mL' },
        {
          key: 'hemoclipSystem',
          label: 'Hemoclips / OTSC — Mechanical/Topical System',
          type: 'select',
          options: ['TTS Hemoclip', 'OTSC', 'Hemospray TC-325'],
        },
        { key: 'hemoclipDetails', label: 'Hemoclips / OTSC — Clip Count & Ulcer Site', type: 'text' },
        {
          key: 'dilatorSystem',
          label: 'Stricture Dilatation — Dilator System',
          type: 'select',
          options: ['CRE Balloon', 'Savary-Gilliard Bougie', 'Pneumatic Achalasia Balloon'],
        },
        { key: 'dilatorMaxSize', label: 'Stricture Dilatation — Max Size (mm or Fr)', type: 'text' },
        { key: 'foreignBodyDesc', label: 'Foreign Body — Impaction Description', type: 'text' },
        {
          key: 'retrievalDevice',
          label: 'Foreign Body — Retrieval Device & Airway Protection',
          type: 'select',
          options: [
            'Rat-Tooth/Alligator Forceps',
            'Roth Net/Dormia Basket',
            'Snare + Protector Hood',
            'Overtube Assisted',
          ],
        },
      ],
    },
    {
      heading: 'Colonoscopic Polypectomy, EMR & Lower GI Hemostasis Log',
      inputs: [
        {
          key: 'polypectomyTechnique',
          label: 'Polypectomy / Resection Technique',
          type: 'buttons',
          options: ['Cold Snare', 'Hot Snare', 'EMR', 'Cold Biopsy Forceps'],
        },
        { key: 'polypDetails', label: 'Polyp Segment, Size (mm) & Paris Morphology', type: 'text' },
        {
          key: 'specimenRetrieval',
          label: 'Specimen Retrieval Status',
          type: 'select',
          options: [
            'En-bloc in Trap',
            'Piecemeal via Roth Net',
            'Resect & Discard',
            'Specimen Not Retrieved',
          ],
        },
        {
          key: 'lowerGiHemostasis',
          label: 'Lower GI Hemostasis / Coagulation Modality',
          type: 'select',
          options: ['APC', 'TTS Clipping', 'Endoloop + Clip', 'Bipolar Thermal'],
        },
        { key: 'coagulationSettings', label: 'Coagulation Settings & Target Lesion', type: 'text' },
      ],
    },
  ],

  hepatology: [
    {
      heading: 'INASL Chronic Liver Disease (CLD) Etiology Profiling & Antiviral Registry',
      inputs: [
        {
          key: 'cldEtiology',
          label: 'CLD Etiology',
          type: 'multiselect',
          options: [
            'Alcohol (ALD)',
            'NAFLD-MASLD',
            'Chronic HBV',
            'Chronic HCV',
            'AIH-PBC-PSC',
            'Wilson Disease',
          ],
        },
        // Relevant when HBV / HCV is selected above.
        {
          key: 'hbvAntiviralStatus',
          label: 'HBV Antiviral Therapy Status',
          type: 'select',
          options: ['TDF', 'TAF', 'Entecavir', 'Treatment-Naive'],
        },
        { key: 'hbvDnaViralLoad', label: 'HBV DNA Viral Load (IU/mL)', type: 'text' },
        {
          key: 'hcvDaaStatus',
          label: 'HCV DAA / SVR12 History',
          type: 'select',
          options: [
            'Sofosbuvir+Velpatasvir',
            'Sofosbuvir+Daclatasvir',
            'SVR12 Achieved',
            'Active Viremia',
          ],
        },
      ],
    },
    {
      heading: 'MELD-Na, Child-Turcotte-Pugh & FIB-4 Calculators',
      inputs: [
        { key: 'totalBilirubin', label: 'Total Bilirubin', type: 'number', unit: 'mg/dL' },
        { key: 'ptInr', label: 'PT-INR', type: 'number' },
        { key: 'creatinine', label: 'Creatinine', type: 'number', unit: 'mg/dL' },
        { key: 'serumNa', label: 'Serum Na', type: 'number', unit: 'mEq/L' },
        { key: 'serumAlbumin', label: 'Serum Albumin', type: 'number', unit: 'g/dL' },
        { key: 'ast', label: 'AST/SGOT', type: 'number', unit: 'U/L' },
        { key: 'alt', label: 'ALT/SGPT', type: 'number', unit: 'U/L' },
        { key: 'platelets', label: 'Platelets', type: 'number', unit: '×10⁹/L' },
        { key: 'meldNa', label: 'MELD-Na', type: 'number', auto: true },
        { key: 'ctpScore', label: 'CTP Score / Class', type: 'text', auto: true },
        { key: 'fib4', label: 'FIB-4', type: 'number', auto: true },
      ],
    },
    {
      heading: 'Acute-on-Chronic Liver Failure (ACLF) & Decompensation Triggers',
      inputs: [
        {
          key: 'ascitesGrade',
          label: 'Ascites Clinical Grade',
          type: 'select',
          options: ['Absent', 'Grade 1–2 Mild-Moderate', 'Grade 3 Large-Refractory'],
        },
        {
          key: 'hepaticEncephalopathy',
          label: 'Hepatic Encephalopathy (West Haven 0–IV)',
          type: 'select',
          options: ['Grade 0', 'Grade I', 'Grade II', 'Grade III', 'Grade IV'],
        },
        { key: 'asciticPmn', label: 'Ascitic Fluid PMN / Neutrophils', type: 'number', unit: '/mm³' },
        { key: 'saag', label: 'SAAG (Serum-Ascites Albumin Gradient)', type: 'number' },
        {
          key: 'aclfPrecipitant',
          label: 'ACLF Precipitating Insult',
          type: 'multiselect',
          options: [
            'Active Alcohol Binge',
            'Acute Variceal Hemorrhage',
            'Bacterial Sepsis-SBP',
            'Hepatotoxic Drug (ATT-DILI/CAM)',
            'Superadded HAV-HEV',
            'Portal Vein Thrombosis',
          ],
        },
      ],
    },
  ],


  gi_bleed: [
    {
      heading: 'Glasgow-Blatchford Score (Upper GI Bleed Triage)',
      inputs: [
        { key: 'gbsScore', label: 'GBS Score (0–23)', type: 'number', min: 0, max: 23 },
      ],
    },
    {
      heading: 'BISAP Early Acute Pancreatitis Severity',
      inputs: [
        { key: 'bisapBun', label: 'BUN >25 mg/dL', type: 'checkbox' },
        { key: 'bisapMentalStatus', label: 'Impaired Mental Status (GCS <15)', type: 'checkbox' },
        { key: 'bisapSirs', label: 'SIRS ≥2', type: 'checkbox' },
        { key: 'bisapAge', label: 'Age >60', type: 'checkbox' },
        { key: 'bisapPleuralEffusion', label: 'Pleural Effusion', type: 'checkbox' },
        { key: 'bisapTotal', label: 'BISAP Total (/5)', type: 'number', auto: true },
      ],
    },
    {
      heading: 'Vasoactive Splanchnic Infusion Timeline & Blood Bank Transfusion Traceability',
      inputs: [
        {
          key: 'vasoactiveInfusion',
          label: 'Vasoactive Splanchnic Infusion',
          type: 'select',
          options: ['Terlipressin IV', 'Octreotide IV', 'Somatostatin IV', 'None'],
        },
        { key: 'infusionStartTime', label: 'Infusion Start Time', type: 'datetime', nowButton: true },
        {
          key: 'ivPpiRegimen',
          label: 'IV Proton Pump Inhibitor Regimen',
          type: 'select',
          options: [
            'Pantoprazole 80mg+8mg/h',
            'Pantoprazole 40mg BD',
            'Esomeprazole 80mg+8mg/h',
          ],
        },
        { key: 'ivCeftriaxone', label: 'IV Ceftriaxone 1g Given', type: 'checkbox' },
        {
          key: 'transfusionLog',
          label: 'Transfusions',
          type: 'table',
          columns: [
            {
              key: 'bloodComponent',
              label: 'Blood Component',
              type: 'select',
              options: ['PRBC', 'FFP', 'Platelets RDP-SDP', 'Cryoprecipitate'],
            },
            { key: 'units', label: 'Units', type: 'number' },
            { key: 'bagBatch', label: 'Bag/Batch Number', type: 'text' },
            { key: 'startStop', label: 'Start–Stop Timestamps', type: 'text' },
          ],
        },
      ],
    },
  ],

 
  histopath_sedation: [
    {
      heading: 'Liver Biopsy Histological Scoring (NAFLD NAS & METAVIR)',
      inputs: [
        { key: 'steatosis', label: 'Steatosis (0–3)', type: 'select', options: ['0', '1', '2', '3'] },
        { key: 'lobularInflammation', label: 'Lobular Inflammation (0–3)', type: 'select', options: ['0', '1', '2', '3'] },
        { key: 'ballooning', label: 'Ballooning (0–2)', type: 'select', options: ['0', '1', '2'] },
        { key: 'metavirActivity', label: 'METAVIR Activity Grade', type: 'select', options: ['A0', 'A1', 'A2', 'A3'] },
        { key: 'metavirFibrosis', label: 'METAVIR / NASH-CRN Fibrosis Stage', type: 'select', options: ['F0', 'F1', 'F2', 'F3', 'F4'] },
        { key: 'nasScore', label: 'NAS (/8)', type: 'number', auto: true },
      ],
    },
    {
      heading: 'GI Mucosal Biopsy Site Mapping (Marsh Celiac, Updated Sydney & RUT)',
      inputs: [
        {
          key: 'marshOberhuber',
          label: 'Duodenal D2 Biopsy — Modified Marsh-Oberhuber',
          type: 'select',
          options: ['Marsh 0', 'Marsh 1', 'Marsh 2', 'Marsh 3a', 'Marsh 3b', 'Marsh 3c'],
        },
        {
          key: 'sydneyProtocol',
          label: 'Gastric Biopsy — Updated Sydney Protocol',
          type: 'select',
          options: [
            'Antral-Predominant Active H. pylori',
            'Chronic Active Pangastritis',
            'Corpus-Predominant Autoimmune',
            'Reactive-Chemical Gastropathy',
          ],
        },
        {
          key: 'atrophyRut',
          label: 'Atrophy / Intestinal Metaplasia & RUT',
          type: 'select',
          options: ['RUT POSITIVE', 'RUT NEGATIVE'],
        },
        { key: 'olgaMapping', label: 'OLGA / OLGIM Metaplasia & Bottle Jar Mapping', type: 'text' },
      ],
    },
    {
      heading: 'Sedation, Anesthesia & Endoscopy Procedural Safety Checklist (NABH Mandatory)',
      inputs: [
        {
          key: 'sedationModality',
          label: 'Sedation / Anesthesia Modality',
          type: 'buttons',
          options: [
            'Topical Pharyngeal Spray (Lidocaine)',
            'Moderate Sedation (Midazolam-Fentanyl)',
            'MAC-Propofol (Anesthetist)',
          ],
        },
        { key: 'baselineSpo2', label: 'Baseline SpO₂', type: 'number', unit: '%' },
        { key: 'lowestSpo2', label: 'Lowest SpO₂', type: 'number', unit: '%' },
        { key: 'intraOpHr', label: 'Intra-Op HR', type: 'number', unit: 'bpm' },
        { key: 'intraOpBp', label: 'Intra-Op BP', type: 'text', unit: 'mmHg' },
        { key: 'anesthetistDrugDose', label: 'Anesthetist & Drug Dose', type: 'text' },
        {
          key: 'adverseEvents',
          label: 'Adverse Events Log',
          type: 'multiselect',
          options: [
            'Hypoxia (SpO₂ <90%)',
            'Aspiration',
            'Mucosal Perforation',
            'Immediate Post-Procedure Bleeding',
          ],
        },
        { key: 'adverseNone', label: 'None (Uneventful)', type: 'checkbox' },
        // Shown when not uneventful (conditional logic to wire with value capture).
        { key: 'adverseNotes', label: 'Adverse Incident Notes', type: 'text' },
      ],
    },
  ],
};

export const gastroenterologyLiverLabels: SpecialtyCategoryLabels = {
  endoscopy_diagnostic: 'UGIE / Colonoscopy & Diagnostic Scores',
  therapeutic_endoscopy: 'Therapeutic Endoscopy & Intervention Log',
  hepatology: 'Hepatology: MELD-Na, Child-Pugh & CLD Etiology',
  gi_bleed: 'Acute GI Bleed & Resuscitation Suite',
  histopath_sedation: 'Histopathology, Biopsy Registry & Sedation Safety',
};



















































































