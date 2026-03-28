import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import type { Patient, Appointment, DoctorProfile } from '@/types';

// ============================================================
// Types
// ============================================================

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
  // Frontend convenience fields (parsed from content)
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  // Backend fields
  pinToDischargeSummary?: boolean;
  status?: 'active' | 'finalized';
  isAutoFilled?: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface LabOrder {
  id: string;
  orderNumber?: string;
  patientId: string;
  patient?: Pick<Patient, 'id' | 'mrn' | 'firstName' | 'lastName'>;
  doctorId: string;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  tests?: { id: string; name: string; code?: string; category?: string }[];
  priority?: string;
  status: string;
  notes?: string;
  clinicalNotes?: string;
  createdAt: string;
  updatedAt: string;
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
  patients: {
    all: ['doctor', 'patients'] as const,
    search: (query: string) => ['doctor', 'patients', 'search', query] as const,
    detail: (id: string) => ['doctor', 'patients', 'detail', id] as const,
  },
  otRequests: {
    all: ['doctor', 'ot-requests'] as const,
    list: (params?: Record<string, unknown>) => ['doctor', 'ot-requests', 'list', params] as const,
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

      // Track unique patient IDs to compute categories
      const patientVisitTypes = new Map<string, string>();
      for (const a of appointments) {
        if (a.patientId && !patientVisitTypes.has(a.patientId)) {
          patientVisitTypes.set(a.patientId, a.type || 'consultation');
        }
      }

      let newPatients = 0;
      let reviewPatients = 0;
      let oldPatients = 0;
      for (const [, type] of patientVisitTypes) {
        if (type === 'follow_up') reviewPatients++;
        else if (type === 'consultation') newPatients++;
        else oldPatients++;
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

export function useCreateProgressNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId: string;
      noteType?: string;
      content: string;
      pinToDischargeSummary?: boolean;
    }) => {
      const response = await apiPost<ProgressNote>('/progress-notes', {
        patientId: data.patientId,
        visitId: data.visitId,
        noteType: data.noteType,
        content: data.content,
        pinToDischargeSummary: data.pinToDischargeSummary ?? false,
      });
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

export function useRecordVitals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      visitId: string;
      temperature?: number;
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      weight?: number;
      height?: number;
      bloodSugar?: number;
      notes?: string;
    }) => {
      // Map frontend field names to backend field names
      const response = await apiPost<Vital>('/clinical/vitals', {
        patientId: data.patientId,
        visitId: data.visitId,
        temperature: data.temperature,
        bloodPressureSystolic: data.bloodPressureSystolic,
        bloodPressureDiastolic: data.bloodPressureDiastolic,
        pulseRate: data.heartRate,
        respiratoryRate: data.respiratoryRate,
        oxygenSaturation: data.oxygenSaturation,
        weightKg: data.weight,
        heightCm: data.height,
        bloodSugar: data.bloodSugar,
        notes: data.notes,
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.vitals.patient(variables.patientId) });
    },
  });
}

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
      tests: { testId: string; name?: string }[];
      priority?: string;
      notes?: string;
      clinicalNotes?: string;
    }) => {
      const response = await apiPost<LabOrder>('/lab/orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorKeys.labOrders.all });
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
