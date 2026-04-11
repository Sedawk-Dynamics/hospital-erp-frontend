// ============================================================
// System Forms — shared TS types
// Fixed, developer-defined forms with immutable triggers.
// ============================================================

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'signature'
  | 'section_header';

export type FormFieldWidth = 'full' | 'half' | 'third';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  defaultValue?: unknown;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  width: FormFieldWidth;
}

export interface FormSchema {
  version: number;
  fields: FormField[];
}

export type FormCategory =
  | 'registration'
  | 'consent'
  | 'intake'
  | 'feedback'
  | 'checklist'
  | 'clinical'
  | 'discharge'
  | 'other';

export type FormTrigger =
  // Patient lifecycle
  | 'appointment_booking'
  | 'patient_registration'
  | 'visit_check_in'
  | 'pre_consultation'
  | 'admission'
  | 'pre_op'
  | 'post_op'
  | 'discharge'
  | 'feedback'
  // Clinical workflow
  | 'vital_signs_entry'
  | 'prescription_created'
  | 'prescription_dispensed'
  | 'lab_order_created'
  | 'lab_sample_collected'
  | 'lab_report_finalized'
  | 'imaging_request_created'
  | 'imaging_result_finalized'
  | 'progress_note_added'
  | 'nursing_note_added'
  | 'medication_administered'
  | 'patient_transfer'
  // Staff & HR
  | 'staff_check_in'
  | 'staff_check_out'
  | 'shift_handover'
  | 'leave_request'
  | 'performance_review'
  | 'employee_onboarding'
  | 'exit_interview'
  | 'training_completion'
  // Pharmacy
  | 'drug_stock_received'
  | 'drug_returned'
  | 'pharmacy_expiry_audit'
  // Lab
  | 'specimen_received'
  | 'lab_qc_check'
  // Blood bank
  | 'blood_donation_collected'
  | 'transfusion_initiated'
  | 'transfusion_reaction_reported'
  // Insurance & billing
  | 'insurance_claim_submitted'
  | 'pre_authorization_request'
  | 'payment_received'
  | 'refund_requested'
  // Operations & compliance
  | 'daily_safety_check'
  | 'incident_reported'
  | 'equipment_check'
  | 'inventory_audit'
  | 'maintenance_request'
  | 'compliance_audit'
  // Periodic
  | 'daily_review'
  | 'weekly_review'
  | 'monthly_review'
  // Manual
  | 'manual';

export type FormSubmissionStatus = 'draft' | 'submitted' | 'verified' | 'rejected';

/** Per-role setting: required | optional | view_only | hidden */
export type RoleSetting = 'required' | 'optional' | 'view_only' | 'hidden';

// ── Domain models ────────────────────────────────────────────

/** Developer-defined system form with a fixed trigger */
export interface SystemForm {
  id: string; // slug e.g. "patient_health_intake"
  name: string;
  description?: string | null;
  category: FormCategory;
  trigger: FormTrigger;
  schema: FormSchema;
  sortOrder: number;
  isActive: boolean;
  /** Subscription module this form belongs to: 'core', 'lab', 'blood_bank', 'ip_management', 'ot_management' */
  module: string;
  /** Roles relevant for this form — only these appear in the configure dialog. */
  applicableRoles: string[];
  /** Where this form appears in the workflow */
  appearsAt: string;
  /** Pages/views where submitted results are displayed */
  resultsVisibleAt: string[];
  defaultRoleSettings: Record<string, RoleSetting>;
  createdAt: string;
  updatedAt: string;
  /** Included when querying with tenant context */
  hospitalConfigs?: HospitalFormConfig[];
}

/** Per-hospital configuration for a system form */
export interface HospitalFormConfig {
  id: string;
  tenantId: string;
  formId: string;
  isEnabled: boolean;
  schemaOverride?: FormSchema | null;
  roleSettings: Record<string, RoleSetting>;
  createdAt: string;
  updatedAt: string;
}

/** Resolved form for a trigger — computed by backend */
export interface ResolvedForm {
  form: {
    id: string;
    name: string;
    description?: string | null;
    category: FormCategory;
    trigger: FormTrigger;
    sortOrder: number;
    isActive: boolean;
    defaultRoleSettings: Record<string, RoleSetting>;
    createdAt: string;
    updatedAt: string;
  };
  config?: HospitalFormConfig | null;
  effectiveSchema: FormSchema;
  roleSetting: RoleSetting;
  isRequired: boolean;
  canFill: boolean;
  canView: boolean;
}

export interface FormSubmission {
  id: string;
  tenantId: string;
  formId?: string | null;
  trigger?: FormTrigger | null;
  responses: Record<string, unknown>;
  status: FormSubmissionStatus;
  patientId?: string | null;
  appointmentId?: string | null;
  visitId?: string | null;
  admissionId?: string | null;
  submittedBy?: string | null;
  submittedAt: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  /** System form info */
  systemForm?: { id: string; name: string; category: FormCategory };
  /** @deprecated Legacy instance link — will be removed */
  instance?: { id: string; name: string; category: FormCategory };
  patient?: { id: string; mrn: string; firstName: string; lastName?: string | null };
  appointment?: {
    id: string;
    appointmentDate: string;
    startTime: string;
    status: string;
    reason?: string | null;
    doctor?: {
      id: string;
      user?: { firstName: string; lastName: string };
      specialization?: string | null;
    };
  } | null;
  visit?: {
    id: string;
    visitType: string;
    chiefComplaint?: string | null;
    visitDate: string;
  } | null;
  admission?: {
    id: string;
    admissionDate: string;
    dischargeDate?: string | null;
    status: string;
  } | null;
  submitter?: { id: string; firstName: string; lastName?: string | null };
  verifier?: { id: string; firstName: string; lastName?: string | null };
}

// ── UI Constants ─────────────────────────────────────────────

export const TRIGGER_LABELS: Record<FormTrigger, string> = {
  appointment_booking: 'Appointment Booking',
  patient_registration: 'Patient Registration',
  visit_check_in: 'Visit Check-in',
  pre_consultation: 'Pre-Consultation',
  admission: 'Admission',
  pre_op: 'Pre-Op',
  post_op: 'Post-Op',
  discharge: 'Discharge',
  feedback: 'Post-Visit Feedback',
  vital_signs_entry: 'Vital Signs Entry',
  prescription_created: 'Prescription Created',
  prescription_dispensed: 'Prescription Dispensed',
  lab_order_created: 'Lab Order Created',
  lab_sample_collected: 'Lab Sample Collected',
  lab_report_finalized: 'Lab Report Finalized',
  imaging_request_created: 'Imaging Request Created',
  imaging_result_finalized: 'Imaging Result Finalized',
  progress_note_added: 'Progress Note Added',
  nursing_note_added: 'Nursing Note Added',
  medication_administered: 'Medication Administered',
  patient_transfer: 'Patient Transfer',
  staff_check_in: 'Staff Check-in',
  staff_check_out: 'Staff Check-out',
  shift_handover: 'Shift Handover',
  leave_request: 'Leave Request',
  performance_review: 'Performance Review',
  employee_onboarding: 'Employee Onboarding',
  exit_interview: 'Exit Interview',
  training_completion: 'Training Completion',
  drug_stock_received: 'Drug Stock Received',
  drug_returned: 'Drug Returned',
  pharmacy_expiry_audit: 'Pharmacy Expiry Audit',
  specimen_received: 'Specimen Received',
  lab_qc_check: 'Lab QC Check',
  blood_donation_collected: 'Blood Donation Collected',
  transfusion_initiated: 'Transfusion Initiated',
  transfusion_reaction_reported: 'Transfusion Reaction Reported',
  insurance_claim_submitted: 'Insurance Claim Submitted',
  pre_authorization_request: 'Pre-Authorization Request',
  payment_received: 'Payment Received',
  refund_requested: 'Refund Requested',
  daily_safety_check: 'Daily Safety Check',
  incident_reported: 'Incident Reported',
  equipment_check: 'Equipment Check',
  inventory_audit: 'Inventory Audit',
  maintenance_request: 'Maintenance Request',
  compliance_audit: 'Compliance Audit',
  daily_review: 'Daily Review',
  weekly_review: 'Weekly Review',
  monthly_review: 'Monthly Review',
  manual: 'Manual / On-demand',
};

export interface RoleOption {
  slug: string;
  label: string;
  description: string;
  category: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { slug: 'admin', label: 'Admin', description: 'Hospital administrator', category: 'Core' },
  { slug: 'doctor', label: 'Doctor', description: 'Consulting physician (any specialization)', category: 'Core' },
  { slug: 'nurse', label: 'Nurse', description: 'Nursing staff', category: 'Core' },
  { slug: 'front_desk', label: 'Front Desk', description: 'Reception / OPD intake staff', category: 'Core' },
  { slug: 'patient', label: 'Patient', description: 'The patient themselves (via portal)', category: 'Core' },
  { slug: 'lab_technician', label: 'Lab Technician', description: 'Lab tech who runs samples & enters results', category: 'Lab' },
  { slug: 'lab_supervisor', label: 'Lab Supervisor', description: 'Lab manager who reviews & approves reports', category: 'Lab' },
  { slug: 'radiologist', label: 'Radiologist', description: 'Imaging specialist', category: 'Radiology' },
  { slug: 'pharmacist', label: 'Pharmacist', description: 'Pharmacy professional dispensing prescriptions', category: 'Pharmacy' },
  { slug: 'pharmacy_technician', label: 'Pharmacy Technician', description: 'Pharmacy support staff', category: 'Pharmacy' },
  { slug: 'pharmacy_admin', label: 'Pharmacy Admin', description: 'Pharmacy manager / full pharmacy control', category: 'Pharmacy' },
  { slug: 'billing_admin', label: 'Billing Admin', description: 'Billing manager', category: 'Finance' },
  { slug: 'cashier', label: 'Cashier', description: 'Counter payment collector', category: 'Finance' },
  { slug: 'insurance_staff', label: 'Insurance Staff', description: 'Insurance claim and policy management', category: 'Finance' },
  { slug: 'inventory_manager', label: 'Inventory Manager', description: 'Cross-module stock management', category: 'Operations' },
  { slug: 'blood_bank_staff', label: 'Blood Bank Staff', description: 'Blood inventory & transfusion management', category: 'Operations' },
  { slug: 'hr_staff', label: 'HR Staff', description: 'Human resources / employee records', category: 'Operations' },
  { slug: 'ot_technician', label: 'OT Technician', description: 'Operating theatre technician', category: 'Operations' },
  { slug: 'dietitian', label: 'Dietitian', description: 'Nutrition and dietary specialist', category: 'Operations' },
];

export const MODULE_LABELS: Record<string, string> = {
  appointments: 'Appointments',
  billing: 'Billing',
  lab: 'Laboratory',
  pharmacy: 'Pharmacy',
  inventory: 'Inventory',
  imaging: 'Radiology / Imaging',
  ip_management: 'In-Patient (IP)',
  ot_management: 'Operation Theatre (OT)',
  blood_bank: 'Blood Bank',
  insurance: 'Insurance & TPA',
  hr: 'HR & Payroll',
  compliance: 'Compliance & Audit',
  reports: 'Advanced Reports',
  multi_hospital: 'Multi-Hospital',
};

export const ROLE_SETTING_LABELS: Record<RoleSetting, string> = {
  required: 'Required',
  optional: 'Optional',
  view_only: 'View Only',
  hidden: 'Hidden',
};

export const CATEGORY_LABELS: Record<FormCategory, string> = {
  registration: 'Registration',
  consent: 'Consent',
  intake: 'Intake',
  feedback: 'Feedback',
  checklist: 'Checklist',
  clinical: 'Clinical',
  discharge: 'Discharge',
  other: 'Other',
};

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Text',
  textarea: 'Long Text',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  date: 'Date',
  time: 'Time',
  datetime: 'Date & Time',
  select: 'Dropdown',
  multi_select: 'Multi-Select',
  radio: 'Radio Buttons',
  checkbox: 'Checkbox',
  file: 'File Upload',
  signature: 'Signature',
  section_header: 'Section Header',
};
