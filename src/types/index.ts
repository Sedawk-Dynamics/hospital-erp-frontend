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
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  avatar?: string;
  isActive: boolean;
  allergies?: PatientAllergy[];
  emergencyContacts?: PatientEmergencyContact[];
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
  status: 'booked' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  reason?: string;
  notes?: string;
  priority?: 'normal' | 'urgent' | 'emergency';
  queueTokens?: Array<{ id: string; tokenNumber: number; status: string }>;
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
  wardId: string;
  ward: { id: string; name: string };
  roomId?: string;
  room?: { id: string; roomNumber: string };
  floor?: string;
  block?: string;
  status: 'available' | 'occupied' | 'under_cleaning' | 'under_maintenance';
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
  ward: { id: string; name: string };
  block?: string;
  floor?: string;
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
}

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
