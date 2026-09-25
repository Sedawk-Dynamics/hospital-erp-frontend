// ============================================================
// Core Types for Hospital ERP
// ============================================================

// --- Pagination ---
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginationMeta;
}

// --- Auth ---
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  onboardingStatus?: 'needs_plan' | 'needs_hospital' | 'has_hospitals' | 'active';
}

export interface SwitchHospitalResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  tenant: Tenant;
}

export interface RegisterData {
  tenantSlug?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
  maxHospitals: number | null;
  features: Record<string, boolean> | null;
  isActive: boolean;
}

export interface OnboardingStatus {
  status: 'needs_plan' | 'needs_hospital' | 'has_hospitals';
  tenants?: { id: string; name: string; slug: string }[];
}

// --- Hospital Creation ---
export interface CreateHospitalData {
  name: string;
  slug?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  licenseNumber?: string;
}

export interface MyHospital {
  id: string;
  name: string;
  slug: string;
  hospitalCode: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  licenseNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userSubscription?: {
    id: string;
    status: string;
    plan?: { name: string };
  } | null;
}

// --- Tenant ---
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  hospitalCode?: string | null;
  logo?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Permission & Role ---
export interface Permission {
  id: string;
  name: string;
  slug: string;
  module: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  permissions: Permission[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- User ---
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  emailVerified?: boolean;
  role?: Partial<Role> & Pick<Role, 'id' | 'name'>;
  roles?: string[];
  tenant?: Partial<Tenant> & Pick<Tenant, 'id' | 'name'>;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- Patient ---
export interface PatientAllergy {
  id: string;
  patientId: string;
  allergen: string;
  reaction?: string;
  severity: 'mild' | 'moderate' | 'severe';
  notes?: string;
  createdAt: string;
}

export interface PatientEmergencyContact {
  id: string;
  patientId: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  maritalStatus?: string;
  email?: string;
  phone: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  postalCode?: string;
  country?: string;
  nationality?: string;
  occupation?: string;
  religion?: string;
  preferredLanguage?: string;
  nationalId?: string;
  abhaNumber?: string;
  referredBy?: string;
  notes?: string;
  photoUrl?: string;
  idProofType?: string;
  idProofNumber?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  avatar?: string;
  isActive: boolean;
  allergies?: PatientAllergy[];
  emergencyContacts?: PatientEmergencyContact[];
  documents?: Array<{ id: string; title: string; type: string; fileUrl: string; fileName: string; createdAt: string }>;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Doctor Profile ---
export interface DoctorProfile {
  id: string;
  userId: string;
  user: User;
  specialization: string;
  qualification: string;
  licenseNumber: string;
  consultationFee: number;
  availableDays: string[];
  availableSlots: { start: string; end: string }[];
  departmentId?: string;
  department?: { id: string; name: string };
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Appointment ---
export interface Appointment {
  id: string;
  patientId: string;
  patient: Patient;
  doctorId: string;
  doctor: DoctorProfile;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  type: 'consultation' | 'follow_up' | 'emergency' | 'procedure' | 'telemedicine';
  consultationType?: string;
  priority?: 'normal' | 'urgent' | 'emergency';
  appointmentType?: 'scheduled' | 'walk_in';
  status: 'pending_payment' | 'booked' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  reason?: string;
  notes?: string;
  queueTokens?: Array<{ id: string; tokenNumber: number; status: string }>;
  paymentInfo?: {
    billId: string;
    billNumber: string;
    billStatus: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: 'paid_online' | 'paid_at_frontdesk' | 'waived' | 'pay_at_frontdesk' | 'pending' | 'no_billing';
  } | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Visit ---
export interface Visit {
  id: string;
  patientId: string;
  patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone'>;
  doctorId: string;
  doctor: DoctorProfile;
  appointmentId?: string;
  visitType: 'op' | 'ip';
  visitDate: string;
  chiefComplaint?: string;
  status: 'active' | 'completed' | 'transferred' | 'discharged';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Admission ---
export interface Admission {
  id: string;
  visitId: string;
  patientId: string;
  patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone'>;
  doctorId: string;
  doctor: DoctorProfile;
  wardId: string;
  ward: { id: string; name: string };
  bedId: string;
  bed: { id: string; bedNumber: string };
  admissionDate: string;
  dischargeDate?: string;
  expectedDischargeDate?: string;
  admissionReason?: string;
  depositAmount: number;
  status: 'admitted' | 'discharged' | 'transferred' | 'absconded';
  admittedBy?: string;
  dischargedBy?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Queue Token ---
export interface QueueToken {
  id: string;
  tokenNumber: string;
  patientId: string;
  patient: Patient;
  departmentId: string;
  doctorId?: string;
  status: 'waiting' | 'serving' | 'completed' | 'skipped';
  priority: 'normal' | 'urgent' | 'emergency';
  createdAt: string;
  updatedAt: string;
}

// --- Lab Order ---
export interface LabTest {
  id: string;
  name: string;
  code?: string;
  category?: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patient: Patient;
  doctorId: string;
  doctor: DoctorProfile;
  tests: LabTest[];
  priority: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'pending' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled';
  isThirdParty?: boolean;
  thirdPartyLabName?: string;
  notes?: string;
  clinicalNotes?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Bed Status ---
export interface BedWithStatus {
  id: string;
  bedNumber: string;
  bedType?: 'standard' | 'electric' | 'icu' | 'pediatric' | 'bariatric';
  wardId: string;
  ward?: {
    id: string;
    name: string;
    floor?: { id: string; name: string; level: number } | null;
  };
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  currentPatientId?: string | null;
  currentPatient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
}

// --- Reservation ---
export interface Reservation {
  id: string;
  patientId: string;
  patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone'>;
  doctorId: string;
  doctor: DoctorProfile;
  wardId: string;
  ward: {
    id: string;
    name: string;
    floor?: { id: string; name: string; level: number } | null;
  };
  diagnosis?: string;
  speciality?: string;
  advanceAmount: number;
  status: 'reserved' | 'completed' | 'cancelled';
  reservedDate: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Estimation ---
export interface Estimation {
  id: string;
  patientId: string;
  patient: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone'>;
  doctorId: string;
  doctor: DoctorProfile;
  complaints?: string;
  estimationPeriodDays: number;
  totalEstimateAmount: number;
  items: { description: string; amount: number }[];
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Billing Transaction ---
export interface BillingTransaction {
  id: string;
  billId: string;
  bill: Bill;
  type: 'bill' | 'receipt' | 'credit' | 'refund' | 'advance' | 'expense';
  amount: number;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'insurance';
  transactionDate: string;
  notes?: string;
  tenantId: string;
  createdAt: string;
}

// --- Credit Settlement ---
export interface CreditSettlement {
  id: string;
  providerType: 'insurance' | 'corporate' | 'patient';
  providerName: string;
  totalAdmissions: number;
  claimAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Collection Summary ---
export interface CollectionMethodBreakdown {
  total: number;
  cash: number;
  card: number;
  upi: number;
  bankTransfer: number;
  cheque: number;
  insurance: number;
  other: number;
}

export interface CollectionSummary {
  totalCollection: number;
  cash: number;
  card: number;
  upi: number;
  bankTransfer: number;
  cheque: number;
  totalBill: number;
  totalPaid: number;
  totalCredit: number;
  netAdvanceAdjusted: number;
  bySource?: {
    online: CollectionMethodBreakdown;
    frontdesk: CollectionMethodBreakdown;
    unknown: CollectionMethodBreakdown;
  };
}

// --- Billing ---
export interface BillItem {
  id: string;
  billId: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount: number;
  tax: number;
  total: number;

  /**
   * The line's frozen GST position, decided by the determination engine when
   * the charge was priced — not by whoever was at the counter.
   *
   * Optional because a bill raised before any of this existed carries none,
   * and a screen that renders `undefined` as 0% would be claiming a position
   * nothing established.
   */
  hsnSacCode?: string | null;
  gstTreatment?: 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'zero_rated' | null;
  taxPercent?: number | string;
  taxableValue?: number | string;
  taxAmount?: number | string;
  cgstRate?: number | string;
  cgstAmount?: number | string;
  sgstRate?: number | string;
  sgstAmount?: number | string;
  igstRate?: number | string;
  igstAmount?: number | string;
  cessAmount?: number | string;
  /** Which rule decided it — 'hsn_master', 'room_rule', 'inpatient_composite'… */
  rateSource?: string | null;
  /** Plain words for why, straight from the engine. */
  taxReason?: string | null;
  /** Taxable, unapproved, no code behind it. Somebody typed this rate. */
  requiresTaxResolution?: boolean;
}

export interface Payment {
  id: string;
  billId: string;
  amount: number;
  method: 'cash' | 'card' | 'upi' | 'insurance' | 'bank_transfer';
  transactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  billId: string;
  paymentId: string;
  amount: number;
  issuedAt: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  patientId: string;
  patient: Patient;
  appointmentId?: string;
  items: BillItem[];
  payments: Payment[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'cancelled' | 'refunded';
  dueDate?: string;
  notes?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;

  /**
   * What this bill IS as a GST document, and the number it was issued under.
   *
   * Both are null until the bill is finalised: a draft is a basket, not a
   * document, and it has no name and no number to show.
   */
  gstDocumentType?: 'tax_invoice' | 'bill_of_supply' | 'invoice_cum_bill_of_supply' | null;
  invoiceNumber?: string | null;
  financialYear?: string | null;
  taxableValue?: number | string;
  cgstAmount?: number | string;
  sgstAmount?: number | string;
  igstAmount?: number | string;
  cessAmount?: number | string;
  roundOff?: number | string;
  supplierGstin?: string | null;
  recipientGstin?: string | null;
  placeOfSupplyStateCode?: string | null;
  isInterState?: boolean;
}

/** What a GST document is called on screen. The law's words, not ours. */
export const GST_DOCUMENT_LABELS: Record<string, string> = {
  tax_invoice: 'Tax Invoice',
  bill_of_supply: 'Bill of Supply',
  invoice_cum_bill_of_supply: 'Invoice-cum-Bill of Supply',
};

/** How a line's tax treatment reads to a person. */
export const GST_TREATMENT_LABELS: Record<string, string> = {
  taxable: 'Taxable',
  exempt: 'Exempt',
  nil_rated: 'Nil rated',
  non_gst: 'Non-GST',
  zero_rated: 'Zero rated',
};

// --- Patient Hospital Connections ---
export interface HospitalConnection {
  id: string;
  tenantId: string;
  status: 'pending' | 'approved' | 'rejected';
  patientId: string | null;
  requestMessage?: string;
  rejectionReason?: string;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    hospitalCode: string | null;
    logoUrl: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
  };
}

export interface LookupHospital {
  id: string;
  name: string;
  slug: string;
  hospitalCode: string | null;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  allowDirectPatientConnection: boolean;
  connectionStatus: 'none' | 'pending' | 'approved' | 'rejected';
}
