import type { DoctorSpecialtyCode } from './doctor-specialties';
export type SpecialtyFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select';

export interface SpecialtyField {
  id: string;
  label: string;
  type: SpecialtyFieldType;
  section?: string;
  unit?: string;
  options?: { value: string; label: string }[];
  points?: number;
  placeholder?: string;
}

export const SPECIALTY_FIELDS: Partial<Record<DoctorSpecialtyCode, SpecialtyField[]>> = {
  general_surgery_laparoscopy: [
    { id: 'who_identity_confirmed', label: 'Identity confirmed', type: 'boolean', section: 'WHO Checklist — Sign In (Pre-Induction)' },
    { id: 'who_site_marked', label: 'Site marked', type: 'boolean', section: 'WHO Checklist — Sign In (Pre-Induction)' },
    { id: 'who_anesthesia_machine_checked', label: 'Anesthesia machine checked', type: 'boolean', section: 'WHO Checklist — Sign In (Pre-Induction)' },
    { id: 'who_pulse_oximeter', label: 'Pulse oximeter functioning', type: 'boolean', section: 'WHO Checklist — Sign In (Pre-Induction)' },
    { id: 'who_allergy_checked', label: 'Known allergy checked', type: 'boolean', section: 'WHO Checklist — Sign In (Pre-Induction)' },
    { id: 'who_difficult_airway', label: 'Difficult airway risk assessed', type: 'boolean', section: 'WHO Checklist — Sign In (Pre-Induction)' },
    { id: 'who_blood_loss_risk', label: 'Risk of blood loss assessed', type: 'boolean', section: 'WHO Checklist — Sign In (Pre-Induction)' },

    { id: 'who_team_introduced', label: 'Team introduced', type: 'boolean', section: 'WHO Checklist — Time Out (Pre-Incision)' },
    { id: 'who_team_confirm_patient', label: 'Surgeon/nurse/anesthetist confirm patient', type: 'boolean', section: 'WHO Checklist — Time Out (Pre-Incision)' },
    { id: 'who_critical_steps', label: 'Critical steps reviewed', type: 'boolean', section: 'WHO Checklist — Time Out (Pre-Incision)' },
    { id: 'who_antibiotic_prophylaxis', label: 'Antibiotic prophylaxis given within 60 min', type: 'boolean', section: 'WHO Checklist — Time Out (Pre-Incision)' },
    { id: 'who_imaging_displayed', label: 'Essential imaging displayed', type: 'boolean', section: 'WHO Checklist — Time Out (Pre-Incision)' },
    { id: 'who_sterility_confirmed', label: 'Sterility indicators confirmed', type: 'boolean', section: 'WHO Checklist — Time Out (Pre-Incision)' },

    { id: 'who_instrument_count', label: 'Instrument count correct', type: 'boolean', section: 'WHO Checklist — Sign Out (Pre-Closure)' },
    { id: 'who_sponge_needle_count', label: 'Sponge and needle count correct', type: 'boolean', section: 'WHO Checklist — Sign Out (Pre-Closure)' },
    { id: 'who_specimen_labeled', label: 'Specimen labeled correctly', type: 'boolean', section: 'WHO Checklist — Sign Out (Pre-Closure)' },
    { id: 'who_equipment_problems', label: 'Equipment problems identified', type: 'boolean', section: 'WHO Checklist — Sign Out (Pre-Closure)' },
    { id: 'who_postop_concerns', label: 'Post-op recovery concerns reviewed', type: 'boolean', section: 'WHO Checklist — Sign Out (Pre-Closure)' },

    { id: 'caprini_major_surgery', label: 'Major surgery open/lap > 45 min', type: 'boolean', section: 'Caprini VTE Risk', points: 2 },
    { id: 'caprini_swollen_legs', label: 'Swollen legs / varicose veins', type: 'boolean', section: 'Caprini VTE Risk', points: 1 },
    { id: 'caprini_prior_dvt_pe', label: 'Prior DVT / PE', type: 'boolean', section: 'Caprini VTE Risk', points: 3 },

    { id: 'mabl_weight', label: 'Weight', type: 'number', section: 'Max Allowable Blood Loss', unit: 'kg' },
    { id: 'mabl_initial_hct', label: 'Initial Hct', type: 'number', section: 'Max Allowable Blood Loss', unit: '%' },
    { id: 'mabl_target_hct', label: 'Target Hct', type: 'number', section: 'Max Allowable Blood Loss', unit: '%' },

    {
      id: 'asa_classification',
      label: 'Patient Classification',
      type: 'select',
      section: 'ASA Physical Status',
      options: [
        { value: 'asa_1', label: 'ASA I' },
        { value: 'asa_2', label: 'ASA II' },
        { value: 'asa_3', label: 'ASA III' },
        { value: 'asa_4', label: 'ASA IV' },
        { value: 'asa_5', label: 'ASA V' },
      ],
    },

    { id: 'op_procedure_name', label: 'Procedure Name', type: 'text', section: 'Operative Note & Implants Registry' },
    { id: 'op_primary_surgeon', label: 'Primary Surgeon', type: 'text', section: 'Operative Note & Implants Registry' },
    { id: 'op_intraop_findings', label: 'Intra-Operative Findings', type: 'textarea', section: 'Operative Note & Implants Registry' },
    { id: 'op_implants_consumables', label: 'Implants / Consumables Deployed', type: 'textarea', section: 'Operative Note & Implants Registry' },
  ],
};
