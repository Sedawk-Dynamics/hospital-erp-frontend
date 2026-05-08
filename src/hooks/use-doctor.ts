import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';
import type { Patient, Appointment, DoctorProfile } from '@/types';

// ============================================================
// Types
// ============================================================

// Structured SOAP payload shape — matches the `subjective/objective/
// assessment/plan` JSON columns written by the backend. Each section
// carries an array of typed entries the form understands.
export interface SoapSectionPayload {
  entries?: Array<{
    source?: 'catalog' | 'free_text';
    catalogId?: string;
    value: string;
    /** System/category — only populated for physical observations */
    system?: string;
  }>;
  free?: string;
}

export interface ProgressNoteAmendmentEntry {
  id: string;
  noteId: string;
  editorId: string;
  editor?: { id: string; firstName: string; lastName?: string };
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ProgressNotePinEntry {
  id: string;
  dischargeSection:
    | 'diagnosis'
    | 'hospital_course'
    | 'procedure'
    | 'medication'
    | 'follow_up'
    | 'advice'
    | 'general'
    | 'chief_complaint'
    | 'examination'
    | 'investigation'
    | 'impression';
  content: string;
  createdAt: string;
}

export interface ProgressNote {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  doctorId: string;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  visitId?: string;
  admissionId?: string;
  noteType?: string;
  content?: string;
  impressions?: string | null;
  discussions?: string | null;
  conclusions?: string | null;
  // Structured SOAP JSON (backend columns)
  subjective?: SoapSectionPayload | null;
  objective?: SoapSectionPayload | null;
  assessment?: SoapSectionPayload | null;
  plan?: SoapSectionPayload | null;
  // Backend fields
  pinToDischargeSummary?: boolean;
  status?: 'active' | 'finalized' | 'archived';
  isAutoFilled?: boolean;
  // Signature / lock
  signedAt?: string | null;
  signedById?: string | null;
  signer?: { id: string; firstName: string; lastName?: string } | null;
  lockedAt?: string | null;
  // Relations
  pins?: ProgressNotePinEntry[];
  amendments?: ProgressNoteAmendmentEntry[];
  _count?: { amendments?: number };
  createdAt: string;
  updatedAt: string;
}

export interface PhysicalObservationCatalogEntry {
  id: string;
  tenantId: string | null;
  system:
    | 'general'
    | 'cardiovascular'
    | 'respiratory'
    | 'gastrointestinal'
    | 'neurological'
    | 'musculoskeletal'
    | 'skin'
    | 'ent'
    | 'eye'
    | 'genitourinary'
    | 'psychiatric'
    | 'other';
  name: string;
  description?: string | null;
  isGlobal: boolean;
  isActive: boolean;
}

export interface Prescription {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  doctorId: string;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  visitId?: string;
  items: PrescriptionItem[];
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionItem {
  id?: string;
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions?: string;
  quantity?: number;
}

export interface Vital {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  visitId?: string;
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  // Backend field: pulseRate — aliased as heartRate for frontend convenience
  pulseRate?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  // Backend fields: weightKg, heightCm
  weightKg?: number;
  heightCm?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bloodSugar?: number;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Diagnosis {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  doctorId?: string;
  visitId?: string;
  // Backend fields
  icdCode?: string;
  diagnosisName?: string;
  diagnosisType?: 'primary' | 'secondary' | 'differential';
  // Frontend aliases
  code?: string;
  description?: string;
  type?: 'primary' | 'secondary' | 'differential';
  status?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabOrderItem {
  id: string;
  testId: string;
  status?: string;
  test?: { id: string; testName: string; testCode?: string };
}

export interface LabOrder {
  id: string;
  orderNumber?: string;
  patientId: string;
  visitId?: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  doctorId?: string;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  orderedBy?: string;
  orderer?: { id: string; firstName: string; lastName: string };
  labOrderItems?: LabOrderItem[];
  urgency?: 'routine' | 'urgent' | 'stat';
  isThirdParty?: boolean;
  thirdPartyLabName?: string;
  status: string;
  notes?: string;
  clinicalNotes?: string;
  createdAt: string;
  updatedAt: string;
  // Legacy/denormalized fields surfaced by some list endpoints or consumers.
  tests?: { id: string; name: string; code?: string; category?: string }[];
  priority?: string;
}

export interface NutritionPlan {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  dietType: string;
  specialInstructions?: string;
  startDate: string;
  endDate?: string;
  meals?: MealPlan[];
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlan {
  day: number;
  morning: MealSlot;
  afternoon: MealSlot;
  night: MealSlot;
}

export interface MealSlot {
  time?: string;
  items: MealItem[];
}

export interface MealItem {
  name: string;
  quantity: number;
  unit: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================
// Query Keys
// ============================================================

export const doctorKeys = {
  all: ['doctor'] as const,
  appointments: {
    all: ['doctor', 'appointments'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'appointments', 'list', params] as const,
    detail: (id: string) => ['doctor', 'appointments', 'detail', id] as const,
  },
  admissions: {
    all: ['doctor', 'admissions'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'admissions', 'list', params] as const,
  },
  progressNotes: {
    all: ['doctor', 'progress-notes'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'progress-notes', 'list', params] as const,
  },
  prescriptions: {
    all: ['doctor', 'prescriptions'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'prescriptions', 'list', params] as const,
    detail: (id: string) => ['doctor', 'prescriptions', 'detail', id] as const,
  },
  vitals: {
    all: ['doctor', 'vitals'] as const,
    patient: (patientId: string) => ['doctor', 'vitals', patientId] as const,
  },
  diagnoses: {
    all: ['doctor', 'diagnoses'] as const,
    patient: (patientId: string) => ['doctor', 'diagnoses', patientId] as const,
  },
  labOrders: {
    all: ['doctor', 'lab-orders'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'lab-orders', 'list', params] as const,
  },
  imagingRequests: {
    all: ['doctor', 'imaging-requests'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'imaging-requests', 'list', params] as const,
  },
  patients: {
    all: ['doctor', 'patients'] as const,
    search: (query: string) => ['doctor', 'patients', 'search', query] as const,
    detail: (id: string) => ['doctor', 'patients', 'detail', id] as const,
  },
  otRequests: {
    all: ['doctor', 'ot-requests'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'ot-requests', 'list', params] as const,
  },
  dischargeSummary: {
    all: ['doctor', 'discharge-summary'] as const,
    byAdmission: (admissionId: string) => ['doctor', 'discharge-summary', 'admission', admissionId] as const,
    detail: (id: string) => ['doctor', 'discharge-summary', 'detail', id] as const,
  },
  formulary: {
    search: (query: string) => ['doctor', 'formulary', 'search', query] as const,
  },
  tickets: {
    all: ['doctor', 'tickets'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'tickets', 'list', params] as const,
  },
  profile: ['doctor', 'profile'] as const,
};

// ============================================================
// Appointment Hooks
// ============================================================

interface DoctorAppointmentsParams {
  page?: number;
  limit?: number;
  status?: string;
  doctorId?: string;
  doctorUserId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  type?: 'consultation' | 'follow_up' | 'emergency' | 'procedure' | 'telemedicine';
}

export function useDoctorAppointments(params?: DoctorAppointmentsParams) {
  return useQuery({
    queryKey: doctorKeys.appointments.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Appointment[]>('/appointments', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export interface DoctorAppointmentStats {
  all: number;
  booked: number;
  ipAppointments: number;
  arrived: number;
  withDoctor: number;
  completed: number;
  cancelled: number;
  newPatients: number;
  reviewPatients: number;
  oldPatients: number;
}

export function useDoctorAppointmentStats(doctorUserId?: string, date?: string) {
  return useQuery({
    queryKey: ['doctor', 'appointment-stats', doctorUserId, date],
    queryFn: async () => {
      // Fetch all appointments for the doctor on this date (max 100 per page, paginate if needed)
      let allAppointments: Appointment[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const response = await apiGet<Appointment[]>('/appointments', {
          params: { doctorUserId, date, limit: 100, page },
        });
        const batch = response.data;
        allAppointments = allAppointments.concat(batch);
        const total = (response.meta as any)?.total ?? 0;
        hasMore = allAppointments.length < total;
        page++;
      }
      const appointments = allAppointments;

      // Track unique patients and categorize using visitType + patient.isNew
      const seen = new Set<string>();
      let newPatients = 0;
      let reviewPatients = 0;
      let oldPatients = 0;
      for (const a of appointments) {
        if (!a.patientId || seen.has(a.patientId)) continue;
        seen.add(a.patientId);
        const visitType = (a as any).visitType as string | undefined;
        const isNew = (a as any).patient?.isNew as boolean | undefined;
        if (visitType === 'revisit') {
          reviewPatients++;
        } else if (isNew === true) {
          newPatients++;
        } else {
          oldPatients++;
        }
      }

      return {
        all: appointments.length,
        booked: appointments.filter((a) => a.status === 'booked' || a.status === 'confirmed').length,
        ipAppointments: 0,
        arrived: appointments.filter((a) => a.status === 'checked_in').length,
        withDoctor: appointments.filter((a) => a.status === 'in_consultation').length,
        completed: appointments.filter((a) => a.status === 'completed').length,
        cancelled: appointments.filter((a) => a.status === 'cancelled').length,
        newPatients,
        reviewPatients,
        oldPatients,
      } as DoctorAppointmentStats;
    },
    enabled: !!doctorUserId,
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiPatch<Appointment>(`/appointments/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.appointments.all });
    },
  });
}

// ============================================================
// Admission Hooks (Doctor's IP Patients)
// ============================================================

interface DoctorAdmissionsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  doctorId?: string;
  wardId?: string;
  date?: string;
}

export function useDoctorAdmissions(params?: DoctorAdmissionsParams) {
  return useQuery({
    queryKey: doctorKeys.admissions.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet('/clinical/admissions', { params });
      return {
        data: (response.data || []) as Array<{
          id: string;
          patientId: string;
          patient?: { id: string; firstName: string; lastName: string; uhid?: string; gender?: string; dateOfBirth?: string; phone?: string; mrn?: string };
          admissionDate: string;
          dischargeDate?: string;
          wardId?: string;
          ward?: { id: string; name: string };
          bedId?: string;
          bed?: { id: string; bedNumber: string };
          doctorId?: string;
          doctor?: { id: string; user?: { firstName: string; lastName: string } };
          admissionType?: string;
          diagnosis?: string;
          procedure?: string;
          status: string;
          notes?: string;
          ipNumber?: string;
          complaints?: string;
          medicoLegal?: string;
          tag?: string;
          createdAt: string;
          updatedAt: string;
        }>,
        meta: response.meta as PaginationMeta,
      };
    },
  });
}

export function useDischargePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes, dischargeDate }: { id: string; notes?: string; dischargeDate?: string }) => {
      const response = await apiPatch(`/clinical/admissions/${id}/discharge`, {
        notes,
        dischargeDate: dischargeDate || new Date().toISOString(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.admissions.all });
    },
  });
}

// ============================================================
// Progress Notes Hooks
// ============================================================

interface ProgressNotesParams {
  page?: number;
  limit?: number;
  patientId?: string;
  visitId?: string;
  admissionId?: string;
  doctorId?: string;
  search?: string;
}

export function useProgressNotes(params?: ProgressNotesParams) {
  return useQuery({
    queryKey: doctorKeys.progressNotes.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<ProgressNote[]>('/progress-notes', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export interface CreateProgressNoteInput {
  patientId: string;
  visitId: string;
  admissionId?: string | null;
  noteType?: string;
  content: string;
  impressions?: string | null;
  discussions?: string | null;
  conclusions?: string | null;
  subjective?: SoapSectionPayload | null;
  objective?: SoapSectionPayload | null;
  assessment?: SoapSectionPayload | null;
  plan?: SoapSectionPayload | null;
  pinToDischargeSummary?: boolean;
  pins?: Array<{ dischargeSection: ProgressNotePinEntry['dischargeSection']; content: string }>;
}

export interface UpdateProgressNoteInput extends Partial<CreateProgressNoteInput> {
  amendmentReason?: string;
}

export function useCreateProgressNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProgressNoteInput) => {
      const response = await apiPost<ProgressNote>('/progress-notes', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.progressNotes.all });
    },
  });
}

export function useUpdateProgressNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProgressNoteInput }) => {
      const response = await apiPut<ProgressNote>(`/progress-notes/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.progressNotes.all });
    },
  });
}

export function useSignProgressNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<ProgressNote>(`/progress-notes/${id}/sign`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.progressNotes.all });
    },
  });
}

export function useProgressNoteAmendments(noteId: string | null | undefined) {
  return useQuery({
    queryKey: ['doctor', 'progress-notes', 'amendments', noteId],
    queryFn: async () => {
      const response = await apiGet<ProgressNoteAmendmentEntry[]>(
        `/progress-notes/${noteId}/amendments`,
      );
      return response.data ?? [];
    },
    enabled: !!noteId,
  });
}

export interface SmartSuggestionsInput {
  chiefComplaints?: string;
  presentIllness?: string;
  vitalsSummary?: string;
  physicalObservations?: Array<{ value: string; system?: string }>;
  investigations?: string;
  diagnosis?: string;
  certainty?: 'provisional' | 'confirmed';
  medications?: string;
  advice?: string;
  patientAge?: number | null;
  patientSex?: string | null;
  knownAllergies?: string[];
}

export function useSmartSuggestions() {
  return useMutation({
    mutationFn: async (input: SmartSuggestionsInput) => {
      const response = await apiPost<{ suggestions: string[]; model: string }>(
        '/progress-notes/ai/suggest',
        input,
      );
      return response.data;
    },
  });
}

export function usePhysicalObservationCatalog(params?: {
  system?: PhysicalObservationCatalogEntry['system'];
  search?: string;
}) {
  return useQuery({
    queryKey: ['doctor', 'physical-observation-catalog', params],
    queryFn: async () => {
      const response = await apiGet<PhysicalObservationCatalogEntry[]>(
        '/progress-notes/physical-observations',
        { params },
      );
      return response.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// Prescription Hooks
// ============================================================

interface PrescriptionParams {
  page?: number;
  limit?: number;
  patientId?: string;
  doctorId?: string;
  search?: string;
}

export function usePrescriptions(params?: PrescriptionParams) {
  return useQuery({
    queryKey: doctorKeys.prescriptions.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Prescription[]>('/prescriptions', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      doctorId: string;
      visitId: string;
      prescriptionType?: 'op' | 'ip';
      items: PrescriptionItem[];
      notes?: string;
    }) => {
      const response = await apiPost<Prescription>('/prescriptions', {
        patientId: data.patientId,
        doctorId: data.doctorId,
        visitId: data.visitId,
        prescriptionType: data.prescriptionType ?? 'op',
        notes: data.notes,
        items: data.items.map((item) => ({
          drugName: item.drugName,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route ?? 'oral',
          instructions: item.instructions,
          quantity: item.quantity,
        })),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.prescriptions.all });
    },
  });
}

// ============================================================
// Vitals Hooks
// ============================================================

export function usePatientVitals(patientId: string) {
  return useQuery({
    queryKey: doctorKeys.vitals.patient(patientId),
    queryFn: async () => {
      const response = await apiGet<Vital[]>(`/clinical/vitals/${patientId}`);
      return response.data;
    },
    enabled: !!patientId,
  });
}

// `useRecordVitals` was intentionally removed: vitals are nursing-owned and
// the backend rejects writes from the doctor role. Doctor pages should read
// vitals via `usePatientVitals` / `useLatestVitals` and surface them as
// read-only. If a doctor needs a reading captured they ask the assigned nurse.

// ============================================================
// Diagnosis Hooks
// ============================================================

export function usePatientDiagnoses(patientId: string) {
  return useQuery({
    queryKey: doctorKeys.diagnoses.patient(patientId),
    queryFn: async () => {
      const response = await apiGet<Diagnosis[]>(`/clinical/diagnoses/${patientId}`);
      return response.data;
    },
    enabled: !!patientId,
  });
}

export function useAddDiagnosis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId: string;
      code?: string;
      description: string;
      type?: 'primary' | 'secondary' | 'differential';
      notes?: string;
    }) => {
      // Map frontend field names to backend field names
      const response = await apiPost<Diagnosis>('/clinical/diagnoses', {
        patientId: data.patientId,
        visitId: data.visitId,
        icdCode: data.code,
        diagnosisName: data.description,
        diagnosisType: data.type ?? 'primary',
        notes: data.notes,
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.diagnoses.patient(variables.patientId) });
    },
  });
}

// ============================================================
// Lab Order Hooks
// ============================================================

interface LabOrderParams {
  page?: number;
  limit?: number;
  doctorId?: string;
  patientId?: string;
  status?: string;
  search?: string;
}

export function useLabOrders(params?: LabOrderParams) {
  return useQuery({
    queryKey: doctorKeys.labOrders.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<LabOrder[]>('/lab/orders', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateLabOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId: string;
      items: { testId: string }[];
      urgency?: 'routine' | 'urgent' | 'stat';
      notes?: string;
      isThirdParty?: boolean;
      thirdPartyLabName?: string;
    }) => {
      const response = await apiPost<LabOrder>('/lab/orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.labOrders.all });
    },
  });
}

export function useCancelLabOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiPatch<LabOrder>(`/lab/orders/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.labOrders.all });
    },
  });
}

export function useCancelImagingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const response = await apiPatch<ImagingRequest>(`/imaging/requests/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.imagingRequests.all });
    },
  });
}

// ============================================================
// Patient Hooks
// ============================================================

export function usePatientSearch(query: string) {
  return useQuery({
    queryKey: doctorKeys.patients.search(query),
    queryFn: async () => {
      const response = await apiGet<Patient[]>('/patients/search', {
        params: { search: query, limit: 20 },
      });
      return response.data;
    },
    enabled: query.length >= 2,
  });
}

export function usePatientDetail(id: string) {
  return useQuery({
    queryKey: doctorKeys.patients.detail(id),
    queryFn: async () => {
      const response = await apiGet<Patient>(`/patients/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// ============================================================
// OT Request Hooks (Doctor-specific)
// ============================================================

export interface DoctorOTRequest {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  surgeryName: string;
  surgeryType?: string;
  speciality?: string;
  otName?: string;
  surgeonId?: string;
  surgeon?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  anaesthetistId?: string;
  anaesthetist?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  status: string;
  priority?: string;
  estimatedDuration?: number;
  preOpDiagnosis?: string;
  notes?: string;
  billingAmount?: number;
  billingStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface OTRequestParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  date?: string;
  surgeonId?: string;
}

export function useDoctorOTRequests(params?: OTRequestParams) {
  return useQuery({
    queryKey: doctorKeys.otRequests.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<DoctorOTRequest[]>('/compliance/ot-requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateOTRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      surgeryName: string;
      surgeryType?: string;
      speciality?: string;
      surgeonId?: string;
      anaesthetistId?: string;
      scheduledDate?: string;
      scheduledStartTime?: string;
      scheduledEndTime?: string;
      estimatedDuration?: number;
      priority?: string;
      preOpDiagnosis?: string;
      notes?: string;
    }) => {
      const response = await apiPost<DoctorOTRequest>('/compliance/ot-requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.otRequests.all });
    },
  });
}

// ============================================================
// Doctor Profile Hook
// ============================================================

export function useDoctorProfile() {
  return useQuery({
    queryKey: doctorKeys.profile,
    queryFn: async () => {
      const response = await apiGet<DoctorProfile>('/auth/me/doctor-profile');
      return response.data;
    },
  });
}

// ============================================================
// MRD Hooks
// ============================================================

export interface MRDDocument {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone'>;
  requestedTo: string;
  requestedBy?: string;
  locationFrom?: string;
  wardRoom?: string;
  status: 'Initiated' | 'In Progress' | 'Completed' | 'Rejected';
  direction: 'inbound' | 'outbound';
  createdAt: string;
  updatedAt: string;
}

interface MRDParams {
  page?: number;
  limit?: number;
  direction?: string;
  search?: string;
  status?: string;
}

export function useMRDDocuments(params?: MRDParams) {
  return useQuery({
    queryKey: ['doctor', 'mrd', params],
    queryFn: async () => {
      try {
        const response = await apiGet<MRDDocument[]>('/mrd/documents', { params });
        return { data: response.data, meta: response.meta as PaginationMeta };
      } catch {
        // MRD endpoint may not be available yet, return empty
        return {
          data: [] as MRDDocument[],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        };
      }
    },
  });
}

export function useCreateMRDRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      locationFrom: string;
      wardRoom: string;
      doctorId?: string;
    }) => {
      const response = await apiPost<MRDDocument>('/mrd/documents', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', 'mrd'] });
    },
  });
}

// ============================================================
// Formulary Search & Allergy Check Hooks
// ============================================================

export interface FormularyDrug {
  id: string;
  drugName: string;
  genericName?: string;
  dosageForm?: string;
  strength?: string;
  manufacturer?: string;
  price?: number;
}

export function useFormularySearch(search: string) {
  return useQuery({
    queryKey: doctorKeys.formulary.search(search),
    queryFn: async () => {
      const response = await apiGet<FormularyDrug[]>('/prescriptions/formulary-search', {
        params: { search },
      });
      return response.data;
    },
    enabled: search.length >= 2,
  });
}

export interface AllergyCheckResult {
  hasAllergy: boolean;
  matchedAllergies: Array<{
    id: string;
    allergen: string;
    reaction?: string;
    severity: string;
  }>;
  drug?: {
    drugName: string;
    genericName?: string;
    contraindications?: string;
  };
}

export function useAllergyCheck(patientId: string, drugName: string) {
  return useQuery({
    queryKey: ['doctor', 'allergy-check', patientId, drugName],
    queryFn: async () => {
      const response = await apiGet<AllergyCheckResult>('/prescriptions/allergy-check', {
        params: { patientId, drugName },
      });
      return response.data;
    },
    enabled: !!patientId && !!drugName && drugName.length >= 2,
  });
}

// ============================================================
// Prescription Detail Hook
// ============================================================

export function usePrescriptionDetail(id: string) {
  return useQuery({
    queryKey: doctorKeys.prescriptions.detail(id),
    queryFn: async () => {
      const response = await apiGet<Prescription>(`/prescriptions/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; notes?: string }) => {
      const response = await apiPut<Prescription>(`/prescriptions/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.prescriptions.all });
    },
  });
}

export function useUpdatePrescriptionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      prescriptionId,
      itemId,
      ...data
    }: {
      prescriptionId: string;
      itemId: string;
      drugName?: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      route?: string;
      instructions?: string;
      quantity?: number;
      isPrn?: boolean;
    }) => {
      const response = await apiPut<PrescriptionItem>(
        `/prescriptions/${prescriptionId}/items/${itemId}`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.prescriptions.all });
    },
  });
}

export function useAddPrescriptionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      prescriptionId,
      ...data
    }: {
      prescriptionId: string;
      drugId?: string;
      drugName: string;
      dosage: string;
      frequency: string;
      duration?: string;
      route?: string;
      instructions?: string;
      quantity?: number;
      isPrn?: boolean;
    }) => {
      const response = await apiPost<PrescriptionItem>(
        `/prescriptions/${prescriptionId}/items`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.prescriptions.all });
    },
  });
}

export function useRemovePrescriptionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ prescriptionId, itemId }: { prescriptionId: string; itemId: string }) => {
      const response = await apiDelete<{ id: string; deleted: boolean }>(
        `/prescriptions/${prescriptionId}/items/${itemId}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.prescriptions.all });
    },
  });
}

export function useCancelPrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<Prescription>(`/prescriptions/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.prescriptions.all });
    },
  });
}

// ============================================================
// Imaging Request Hooks
// ============================================================

export interface ImagingRequest {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  visitId?: string;
  orderedBy?: string;
  orderedByUser?: { id: string; firstName: string; lastName: string };
  imagingType: string;
  bodyPart?: string;
  clinicalIndication?: string;
  urgency?: string;
  status: string;
  notes?: string;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface ImagingRequestParams {
  page?: number;
  limit?: number;
  patientId?: string;
  status?: string;
  search?: string;
}

export function useImagingRequests(params?: ImagingRequestParams) {
  return useQuery({
    queryKey: doctorKeys.imagingRequests.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<ImagingRequest[]>('/imaging/requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateImagingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId: string;
      imagingType: string;
      bodyPart?: string;
      clinicalIndication?: string;
      urgency?: string;
      notes?: string;
    }) => {
      const response = await apiPost<ImagingRequest>('/imaging/requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.imagingRequests.all });
    },
  });
}

// ============================================================
// Discharge Summary Hooks
// ============================================================

export interface DischargeSummary {
  id: string;
  admissionId: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  admissionDate?: string;
  dischargeDate?: string;
  diagnosesSummary?: string;
  proceduresSummary?: string;
  labResultsSummary?: string;
  medicationReconciliation?: string;
  dischargeInstructions?: string;
  followUpDate?: string;
  followUpInstructions?: string;
  status: 'draft' | 'finalized' | 'published';
  signedBy?: string;
  signedAt?: string;
  eSignatureUrl?: string;
  pdfUrl?: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName' | 'phone' | 'gender' | 'dateOfBirth'>;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
    specialization?: string;
    department?: { name: string };
  };
  admission?: {
    id: string;
    admissionDate: string;
    dischargeDate?: string;
    admissionReason?: string;
    ward?: { name: string };
    bed?: { bedNumber: string };
  };
  signer?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export function useGenerateDischargeSummary(admissionId: string) {
  return useQuery({
    queryKey: doctorKeys.dischargeSummary.byAdmission(admissionId),
    queryFn: async () => {
      const response = await apiGet<DischargeSummary>('/mrd/discharge-summary/generate', {
        params: { admissionId },
      });
      return response.data;
    },
    enabled: !!admissionId,
  });
}

export function useDischargeSummaryDetail(id: string) {
  return useQuery({
    queryKey: doctorKeys.dischargeSummary.detail(id),
    queryFn: async () => {
      const response = await apiGet<DischargeSummary>(`/mrd/discharge-summary/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdateDischargeSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      diagnosesSummary?: string;
      proceduresSummary?: string;
      labResultsSummary?: string;
      medicationReconciliation?: string;
      dischargeInstructions?: string;
      followUpDate?: string;
      followUpInstructions?: string;
    }) => {
      const response = await apiPatch<DischargeSummary>(`/mrd/discharge-summary/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.dischargeSummary.all });
    },
  });
}

export function useSignDischargeSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | { id: string; signatureName?: string }) => {
      const id = typeof input === 'string' ? input : input.id;
      const signatureName = typeof input === 'string' ? undefined : input.signatureName;
      const response = await apiPost<DischargeSummary>(
        `/mrd/discharge-summary/${id}/sign`,
        signatureName ? { signatureName } : undefined,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.dischargeSummary.all });
    },
  });
}

export function usePublishDischargeSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPost<DischargeSummary>(`/mrd/discharge-summary/${id}/publish`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.dischargeSummary.all });
    },
  });
}

// ============================================================
// Patient Transfer Hooks (doctor-to-doctor)
// ============================================================

export interface PatientTransfer {
  id: string;
  patientId: string;
  visitId: string;
  transferType: 'doctor_to_doctor' | 'ward_to_ward' | 'bed_to_bed';
  fromDoctorId?: string;
  toDoctorId?: string;
  reason?: string;
  status: 'requested' | 'approved' | 'completed' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export function useCreateDoctorTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId: string;
      fromDoctorId: string;
      toDoctorId: string;
      reason?: string;
    }) => {
      const response = await apiPost<PatientTransfer>('/clinical/transfers', {
        patientId: data.patientId,
        visitId: data.visitId,
        transferType: 'doctor_to_doctor',
        fromDoctorId: data.fromDoctorId,
        toDoctorId: data.toDoctorId,
        reason: data.reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', 'transfers'] });
    },
  });
}

// ============================================================
// Clinical OT Request Hooks (new endpoints)
// ============================================================

export interface ClinicalOTRequest {
  id: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  visitId: string;
  doctorId: string;
  doctor?: { id: string; user?: { firstName: string; lastName: string } };
  procedureName: string;
  procedureDetails?: string;
  urgency: 'elective' | 'urgent' | 'emergency';
  preferredDate?: string;
  preferredTime?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  requiredEquipment?: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useClinicalOTRequests(params?: { page?: number; limit?: number; status?: string; doctorId?: string }) {
  return useQuery({
    queryKey: ['doctor', 'clinical-ot-requests', params],
    queryFn: async () => {
      const response = await apiGet<ClinicalOTRequest[]>('/clinical/ot-requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateClinicalOTRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId: string;
      doctorId: string;
      procedureName: string;
      procedureDetails?: string;
      urgency?: string;
      preferredDate?: string;
      preferredTime?: string;
      durationMinutes?: number;
      requiredEquipment?: string[];
    }) => {
      const response = await apiPost<ClinicalOTRequest>('/clinical/ot-requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', 'clinical-ot-requests'] });
    },
  });
}

// ============================================================
// Ticket Hooks
// ============================================================

export interface Ticket {
  id: string;
  ticketNumber: string;
  raisedBy: string;
  raiser?: { id: string; firstName: string; lastName: string };
  assignedTo?: string;
  assignee?: { id: string; firstName: string; lastName: string };
  ticketType: string;
  subject: string;
  description?: string;
  priority: string;
  status: string;
  patientId?: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  departmentId?: string;
  department?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export function useTickets(params?: { page?: number; limit?: number; status?: string; ticketType?: string }) {
  return useQuery({
    queryKey: doctorKeys.tickets.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Ticket[]>('/communication/tickets', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      ticketType: string;
      subject: string;
      description?: string;
      priority?: string;
      patientId?: string;
      departmentId?: string;
      assignedTo?: string;
    }) => {
      const response = await apiPost<Ticket>('/communication/tickets', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.tickets.all });
    },
  });
}

// ============================================================
// Unlocked Progress Notes
// ============================================================

export interface UnlockedProgressNote {
  id: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  noteType?: string | null;
  content?: string | null;
  status: string;
  unlockedUntil: string;
  updatedAt: string;
  createdAt: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  doctor?: { id: string; user?: { firstName: string; lastName: string } };
  visit?: { id: string; visitType: string; visitDate: string };
}

export function useUnlockedProgressNotes(mine: boolean = true) {
  return useQuery({
    queryKey: ['doctor', 'progress-notes', 'unlocked', { mine }],
    queryFn: async () => {
      const response = await apiGet<UnlockedProgressNote[]>('/progress-notes/unlocked', {
        params: { mine: mine ? 'true' : undefined },
      });
      return response.data ?? [];
    },
    refetchOnWindowFocus: true,
  });
}

export function useUnlockProgressNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hours }: { id: string; hours?: number }) => {
      const response = await apiPost<{ note: UnlockedProgressNote; unlockedUntil: string }>(
        `/progress-notes/${id}/unlock`,
        hours ? { hours } : undefined,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', 'progress-notes'] });
    },
  });
}

export function useRelockProgressNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPost(`/progress-notes/${id}/relock`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', 'progress-notes'] });
    },
  });
}

// ============================================================
// Inbound Doctor Requests (assigned tickets + inbound transfers)
// ============================================================

export function useInboundTransfers(toDoctorId?: string, status: string = 'requested') {
  return useQuery({
    queryKey: ['doctor', 'transfers', 'inbound', { toDoctorId, status }],
    queryFn: async () => {
      const response = await apiGet<PatientTransfer[]>('/clinical/transfers', {
        params: {
          toDoctorId,
          status,
          transferType: 'doctor_to_doctor',
          limit: 50,
        },
      });
      return { data: response.data ?? [], meta: response.meta as PaginationMeta };
    },
    enabled: !!toDoctorId,
  });
}

export function useApproveTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes?: string }) => {
      const response = await apiPatch<PatientTransfer>(`/clinical/transfers/${id}/approve`, {
        status,
        notes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', 'transfers'] });
    },
  });
}

export function useAssignedTickets(assignedTo?: string, status?: string) {
  return useQuery({
    queryKey: ['doctor', 'tickets', 'assigned', { assignedTo, status }],
    queryFn: async () => {
      const response = await apiGet<Ticket[]>('/communication/tickets', {
        params: { assignedTo, status, limit: 50 },
      });
      return { data: response.data ?? [], meta: response.meta as PaginationMeta };
    },
    enabled: !!assignedTo,
  });
}
