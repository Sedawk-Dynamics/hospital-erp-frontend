import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';
import type { Appointment, Patient, DoctorProfile, QueueToken, Bill, Payment, CollectionSummary, CreditSettlement } from '@/types';

// ============================================================
// Query Keys
// ============================================================

export const hospitalKeys = {
  opAppointments: (params?: Record<string, unknown>) =>
    ['hospital', 'op-appointments', params] as const,
  appointmentStats: (date?: string) =>
    ['hospital', 'appointment-stats', date] as const,
  doctors: ['hospital', 'doctors'] as const,
  doctorSlots: (doctorId: string, date: string) =>
    ['hospital', 'doctor-slots', doctorId, date] as const,
  doctorQueue: (doctorId: string, date: string) =>
    ['hospital', 'doctor-queue', doctorId, date] as const,
  patientSearch: (query: string) =>
    ['hospital', 'patient-search', query] as const,
  patient: (id: string) =>
    ['hospital', 'patient', id] as const,
  patientDirectory: (params?: Record<string, unknown>) =>
    ['hospital', 'patient-directory', params] as const,
  bills: (params?: Record<string, unknown>) =>
    ['hospital', 'bills', params] as const,
  bill: (id: string) =>
    ['hospital', 'bill', id] as const,
  payments: (params?: Record<string, unknown>) =>
    ['hospital', 'payments', params] as const,
  collectionSummary: (params?: Record<string, unknown>) =>
    ['hospital', 'collection-summary', params] as const,
  creditSettlements: (params?: Record<string, unknown>) =>
    ['hospital', 'credit-settlements', params] as const,
  walkInAppointments: (params?: Record<string, unknown>) =>
    ['hospital', 'walkin-appointments', params] as const,
};

// ============================================================
// Types
// ============================================================

export interface AppointmentStats {
  all: number;
  booked: number;
  ipAppointments: number;
  arrived: number;
  withDoctor: number;
  completed: number;
  cancelled: number;
}

// ============================================================
// Query Hooks
// ============================================================

interface OPAppointmentsParams {
  page?: number;
  limit?: number;
  status?: string;
  doctorId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export function useOPAppointments(params?: OPAppointmentsParams) {
  return useQuery({
    queryKey: hospitalKeys.opAppointments(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Appointment[]>('/appointments', { params });
      return { data: response.data, meta: response.meta! };
    },
  });
}

export function useAppointmentStats(date?: string) {
  return useQuery({
    queryKey: hospitalKeys.appointmentStats(date),
    queryFn: async () => {
      // Try dedicated stats endpoint first, fall back to computing from list
      try {
        const response = await apiGet<AppointmentStats>('/appointments/stats', {
          params: { date },
        });
        return response.data ?? null;
      } catch {
        // Fallback: fetch all appointments for the date and compute stats
        // Paginate through all appointments (max 100 per page)
        let allAppointments: Appointment[] = [];
        let pg = 1;
        let more = true;
        while (more) {
          const resp = await apiGet<Appointment[]>('/appointments', {
            params: { date, limit: 100, page: pg },
          });
          allAppointments = allAppointments.concat(resp.data);
          const total = (resp.meta as any)?.total ?? 0;
          more = allAppointments.length < total;
          pg++;
        }
        const appointments = allAppointments;
        return {
          all: appointments.length,
          booked: appointments.filter((a) => a.status === 'booked' || a.status === 'confirmed').length,
          ipAppointments: 0,
          arrived: appointments.filter((a) => a.status === 'checked_in').length,
          withDoctor: appointments.filter((a) => a.status === 'in_consultation').length,
          completed: appointments.filter((a) => a.status === 'completed').length,
          cancelled: appointments.filter((a) => a.status === 'cancelled').length,
        };
      }
    },
  });
}

export function useDoctorsList() {
  return useQuery({
    queryKey: hospitalKeys.doctors,
    queryFn: async () => {
      const response = await apiGet<DoctorProfile[]>('/appointments/doctors', {
        params: { limit: 100 },
      });
      return response.data ?? null;
    },
  });
}

export function usePatientSearch(query: string) {
  return useQuery({
    queryKey: hospitalKeys.patientSearch(query),
    queryFn: async () => {
      const response = await apiGet<Patient[]>('/patients', {
        params: { search: query, limit: 20 },
      });
      return response.data ?? null;
    },
    enabled: query.length >= 2,
  });
}

// A person found anywhere on the ERP. `localPatientId` is set when they already
// have a record in THIS hospital; otherwise the row lives at `hospital` and a
// local record is provisioned on selection.
export interface GlobalPatientMatch {
  sourcePatientId: string;
  localPatientId: string | null;
  isLocal: boolean;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  mrn: string | null;
  hospital: string;
}

/** Cross-hospital patient search for the appointment / admit pickers. */
export function useGlobalPatientSearch(query: string) {
  return useQuery({
    queryKey: ['patients', 'global-search', query],
    queryFn: async () => {
      const response = await apiGet<GlobalPatientMatch[]>('/patients/global-search', {
        params: { search: query.trim() },
      });
      return response.data ?? [];
    },
    enabled: query.trim().length >= 2,
  });
}

/** Ensure a cross-hospital patient has a local record (new MRN); returns it. */
export function useProvisionLocalPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourcePatientId: string) => {
      const response = await apiPost<Patient>('/patients/provision-local', { sourcePatientId });
      return response.data;
    },
    // This mints a brand new patient row with a local MRN, so every list that
    // could show it is now out of date — including the global search the desk
    // just used to find the patient in the first place.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient-search'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient-directory'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

// ============================================================
// Slot & Queue Query Hooks
// ============================================================

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  /** True when this slot overlaps an approved partial-hours leave. */
  onLeave?: boolean;
}

export interface AvailableSlotsResponse {
  date: string;
  doctorId?: string;
  slots: AvailableSlot[];
  /** Populated when no slots are available (e.g. "Doctor is on leave on this date"). */
  message?: string;
}

export function useAvailableSlots(doctorId: string, date: string) {
  return useQuery({
    queryKey: hospitalKeys.doctorSlots(doctorId, date),
    queryFn: async () => {
      const response = await apiGet<AvailableSlotsResponse>(
        `/appointments/doctors/${doctorId}/slots`,
        { params: { date } }
      );
      return response.data ?? null;
    },
    enabled: !!doctorId && !!date,
  });
}

export interface QueueTokenResponse {
  id: string;
  tenantId: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  tokenNumber: string;
  queueDate: string;
  status: string;
  patient?: { id: string; mrn: string; firstName: string; lastName: string };
}

export function useDoctorQueue(doctorId: string, date: string) {
  return useQuery({
    queryKey: hospitalKeys.doctorQueue(doctorId, date),
    queryFn: async () => {
      const response = await apiGet<QueueTokenResponse[]>(
        `/appointments/queue/doctor/${doctorId}`,
        { params: { date } }
      );
      return response.data ?? [];
    },
    enabled: !!doctorId && !!date,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: hospitalKeys.patient(id),
    queryFn: async () => {
      const response = await apiGet<Patient>(`/patients/${id}`);
      return response.data ?? null;
    },
    enabled: !!id,
  });
}

// ============================================================
// Front Desk Patient Directory + Temporary (provisional) patients
// ============================================================

export type PatientCategory = 'all' | 'registered' | 'temporary';

export interface PatientDirectoryParams {
  category?: PatientCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PatientDirectoryResult {
  patients: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Paginated patient directory for the Front Desk, filterable by category tab. */
export function usePatientDirectory(params: PatientDirectoryParams) {
  return useQuery({
    queryKey: hospitalKeys.patientDirectory(params as Record<string, unknown>),
    queryFn: async (): Promise<PatientDirectoryResult> => {
      const response = await apiGet<Patient[]>('/patients', {
        params: {
          category: params.category && params.category !== 'all' ? params.category : undefined,
          search: params.search || undefined,
          page: params.page ?? 1,
          limit: params.limit ?? 20,
        },
      });
      return {
        patients: response.data ?? [],
        total: response.meta?.total ?? 0,
        page: response.meta?.page ?? 1,
        limit: response.meta?.limit ?? 20,
        totalPages: response.meta?.totalPages ?? 1,
      };
    },
  });
}

/** Whatever the front desk knows when a patient arrives — every field optional. */
export interface CreateTemporaryPatientPayload {
  firstName?: string;
  lastName?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  dateOfBirth?: string;
  age?: number;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
}

/** Real details when a temp patient is registered in place (first name required). */
export interface RegisterTemporaryPatientPayload {
  firstName: string;
  lastName?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

function invalidatePatientLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['hospital', 'patient-directory'] });
  queryClient.invalidateQueries({ queryKey: ['hospital', 'patient-search'] });
}

/** Create a temporary (provisional) patient — a normal row with a TEMP- MRN. */
export function useCreateTemporaryPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTemporaryPatientPayload) => {
      const response = await apiPost<Patient>('/patients/temporary', payload);
      return response.data;
    },
    onSuccess: () => invalidatePatientLists(queryClient),
  });
}

/** Register a temp patient in place: permanent MRN + real details, SAME row. */
export function useRegisterTemporaryPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RegisterTemporaryPatientPayload }) => {
      const response = await apiPost<Patient>(`/patients/${id}/register-in-place`, data);
      return response.data;
    },
    onSuccess: (_d, vars) => {
      invalidatePatientLists(queryClient);
      queryClient.invalidateQueries({ queryKey: hospitalKeys.patient(vars.id) });
    },
  });
}

/** Merge a temp patient into an existing registered patient (no duplicate row). */
export function useMergeTemporaryPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, targetPatientId }: { id: string; targetPatientId: string }) => {
      const response = await apiPost<{ target: Patient; moved: Record<string, number> }>(
        `/patients/${id}/merge`,
        { targetPatientId },
      );
      return response.data;
    },
    onSuccess: (_d, vars) => {
      invalidatePatientLists(queryClient);
      queryClient.invalidateQueries({ queryKey: hospitalKeys.patient(vars.id) });
      queryClient.invalidateQueries({ queryKey: hospitalKeys.patient(vars.targetPatientId) });
    },
  });
}

// ============================================================
// Billing Query Hooks
// ============================================================

interface BillsParams {
  page?: number;
  limit?: number;
  status?: string;
  patientId?: string;
  search?: string;
}

export function useBills(params?: BillsParams) {
  return useQuery({
    queryKey: hospitalKeys.bills(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params });
      return { data: response.data, meta: response.meta! };
    },
  });
}

export function useBill(id: string) {
  return useQuery({
    queryKey: hospitalKeys.bill(id),
    queryFn: async () => {
      const response = await apiGet<Bill>(`/billing/${id}`);
      return response.data ?? null;
    },
    enabled: !!id,
  });
}

interface PaymentsParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  method?: string;
}

export function usePayments(params?: PaymentsParams) {
  return useQuery({
    queryKey: hospitalKeys.payments(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Payment[]>('/billing/payments', { params });
      return { data: response.data, meta: response.meta! };
    },
  });
}

interface CollectionSummaryParams {
  startDate?: string;
  endDate?: string;
}

export function useCollectionSummary(params?: CollectionSummaryParams) {
  return useQuery({
    queryKey: hospitalKeys.collectionSummary(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<CollectionSummary>('/billing/collection-summary', { params });
      return response.data ?? null;
    },
  });
}

// An older read of the same endpoint lived here, typed as a bare array and
// dropping the stats block the endpoint actually returns.
// useCreditSettlementList below is the one the Receivables tab uses; this
// duplicate had no callers at all.

// ============================================================
// Appointment Mutations
// ============================================================

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { patientId: string; doctorId: string; appointmentDate: string; startTime: string; endTime?: string; type?: string; reason?: string; notes?: string }) => {
      const response = await apiPost<Appointment>('/appointments', data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiPatch<Appointment>(`/appointments/${id}/status`, { status });
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });
    },
  });
}

export interface FrontdeskBillCreation {
  billId: string;
  billNumber: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

/**
 * Staff-side: turns a `pending_payment` appointment into a booked one with a
 * pending front-desk Bill, so the cashier can collect on the spot. The
 * returned bill is then handed to the CollectFrontdeskPaymentDialog.
 */
export function useInitiateFrontdeskPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiPost<FrontdeskBillCreation>(
        `/appointments/${appointmentId}/frontdesk-payment`,
      );
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['front-desk'] });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiPatch<Appointment>(`/appointments/${id}/cancel`, { reason });
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['front-desk'] });
    },
  });
}

export function useGenerateQueueToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiPost<QueueTokenResponse>(`/appointments/${appointmentId}/queue`);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'doctor-queue'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        appointmentDate: string;
        startTime: string;
        endTime: string;
        doctorId?: string;
        reason?: string;
      };
    }) => {
      // In-place move — keeps the appointment id so the bill/token survive.
      const response = await apiPatch<Appointment>(`/appointments/${id}/reschedule`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['front-desk'] });
    },
  });
}

// ============================================================
// Patient Mutations
// ============================================================

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiPost<Patient>('/patients', data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient-search'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await apiPut<Patient>(`/patients/${id}`, data);
      return response.data ?? null;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient-search'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
    },
  });
}

export function useAddEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, data }: { patientId: string; data: { name: string; relationship: string; phone: string; email?: string; isPrimary?: boolean } }) => {
      const response = await apiPost(`/patients/${patientId}/emergency-contacts`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient'] });
    },
  });
}

export function useUploadPatientDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, data }: { patientId: string; data: { title: string; type: string; fileUrl: string; fileName: string; mimeType?: string } }) => {
      const response = await apiPost(`/patients/${patientId}/documents`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient'] });
    },
  });
}

// ============================================================
// Billing Mutations
// ============================================================

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { patientId: string; visitId?: string; admissionId?: string; appointmentId?: string; items?: { description: string; category: string; quantity: number; unitPrice: number; discount?: number; tax?: number }[]; notes?: string }) => {
      const response = await apiPost<Bill>('/billing', data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
    },
  });
}

export function useFinalizeBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<Bill>(`/billing/${id}/finalize`);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
    },
  });
}

/**
 * Undo an accidental finalize (pending → draft) so the counter can keep adding
 * items to the same bill. Server refuses once any payment/claim exists.
 */
export function useReopenBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<Bill>(`/billing/${id}/reopen`);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
    },
  });
}

export type FrontdeskPaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'debit_card'
  | 'upi'
  | 'net_banking'
  | 'cheque'
  | 'other';

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      billId: string;
      amount: number;
      paymentMethod: FrontdeskPaymentMethod;
      referenceNumber?: string;
      notes?: string;
    }) => {
      const payload = {
        ...data,
        paymentMethod: data.paymentMethod === 'net_banking' ? 'bank_transfer' : data.paymentMethod,
      };
      const response = await apiPost<Payment>('/billing/payments', payload);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'collection-summary'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
    },
  });
}

// ============================================================
// Week 12: Split payment, Advance, Reversal, Cancel, Refund, Receipts, Day-end
// ============================================================

export type BillingPaymentMethod = FrontdeskPaymentMethod | 'bank_transfer' | 'insurance' | 'wallet';

export interface SplitEntry {
  amount: number;
  paymentMethod: BillingPaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export function useCreateSplitPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { billId: string; splits: SplitEntry[] }) => {
      // Map front-end synonyms to backend enum values.
      const payload = {
        billId: data.billId,
        splits: data.splits.map((s) => ({
          ...s,
          paymentMethod: s.paymentMethod === 'net_banking' ? 'bank_transfer' : s.paymentMethod,
        })),
      };
      const r = await apiPost('/billing/payments/split', payload);
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'collection-summary'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'receipts'] });
    },
  });
}

export function useCreateAdvancePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      amount: number;
      paymentMethod: BillingPaymentMethod;
      referenceNumber?: string;
      notes?: string;
    }) => {
      const payload = {
        ...data,
        paymentMethod: data.paymentMethod === 'net_banking' ? 'bank_transfer' : data.paymentMethod,
      };
      const r = await apiPost('/billing/payments/advance', payload);
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'advance-balance'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'collection-summary'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'receipts'] });
    },
  });
}

export function useAdjustAdvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { patientId: string; billId: string; amount: number }) => {
      const r = await apiPost('/billing/payments/advance/adjust', data);
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'advance-balance'] });
    },
  });
}

export interface AdvanceBalance {
  totalAdvanceCollected: number;
  totalAdvanceAdjusted: number;
  balance: number;
  history: Array<{ id: string; amount: number; method: string; paymentDate: string; notes?: string | null }>;
}

export function useAdvanceBalance(patientId: string | null | undefined) {
  return useQuery({
    queryKey: ['hospital', 'advance-balance', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const r = await apiGet<AdvanceBalance>(`/billing/payments/advance/${patientId}`);
      return r.data ?? null;
    },
    enabled: !!patientId,
  });
}

export function useReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { paymentId: string; reason: string }) => {
      const r = await apiPost('/billing/reversals', data);
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'collection-summary'] });
    },
  });
}

export function useCancelBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, reason }: { billId: string; reason: string }) => {
      const r = await apiPatch(`/billing/${billId}/cancel`, { reason });
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
    },
  });
}

export interface RefundRow {
  id: string;
  amount: number | string;
  reason: string;
  status: 'requested' | 'approved' | 'processed' | 'rejected';
  createdAt: string;
  processedAt?: string | null;
  bill?: { id: string; billNumber: string };
  patient?: { id: string; firstName: string; lastName: string; mrn?: string };
  payment?: { id: string; paymentMethod: string; paymentDate: string };
  requester?: { firstName: string; lastName: string };
  approver?: { firstName: string; lastName: string };
}

export function useRefunds(params?: { status?: string; patientId?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hospital', 'refunds', params],
    queryFn: async () => {
      const r = await apiGet<RefundRow[]>('/billing/refunds', { params });
      return { data: r.data ?? [], meta: r.meta };
    },
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { paymentId: string; amount: number; reason: string }) => {
      const r = await apiPost('/billing/refunds', data);
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'refunds'] });
    },
  });
}

export function useApproveRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (refundId: string) => {
      const r = await apiPatch(`/billing/refunds/${refundId}/approve`);
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'refunds'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
    },
  });
}

export function useRejectRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ refundId, reason }: { refundId: string; reason: string }) => {
      const r = await apiPatch(`/billing/refunds/${refundId}/reject`, { reason });
      return r.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'refunds'] });
    },
  });
}

export interface ReceiptRow {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  amount: number | string;
  payment?: {
    id: string;
    paymentMethod: string;
    paymentType: string;
    status: string;
    bill?: { id: string; billNumber: string; totalAmount: number | string };
    patient?: { id: string; firstName: string; lastName: string; mrn?: string };
  };
}

export function useReceipts(params?: { patientId?: string; billId?: string; fromDate?: string; toDate?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['hospital', 'receipts', params],
    queryFn: async () => {
      const r = await apiGet<ReceiptRow[]>('/billing/receipts', { params });
      return { data: r.data ?? [], meta: r.meta };
    },
  });
}

export interface DayEndReport {
  date: string;
  /** Money taken in. Excludes refunds — those are money going the other way. */
  collected: number;
  /** Money handed back out of the drawer. */
  refunded: number;
  /** collected − refunded: what the counter should actually be holding. */
  netCollection: number;
  reversed: number;
  billed: number;
  byMethod: Record<string, number>;
  refundsByMethod: Record<string, number>;
  byType: Record<string, number>;
  /** Per-cashier tally — the unit a shift reconciles on when entry is manual. */
  byCashier: Array<{ userId: string; name: string; collected: number; refunded: number }>;
  byStatusBills: { generated: number; paid: number; pending: number; cancelled: number };
  payments: Array<{
    id: string;
    billNumber: string | null;
    patientName: string | null;
    amount: number;
    method: string;
    type: string;
    status: string;
    paymentDate: string;
    transactionId: string | null;
    cashier: string | null;
  }>;
}

export function useDayEnd(date?: string) {
  return useQuery({
    queryKey: ['hospital', 'day-end', date],
    queryFn: async () => {
      const r = await apiGet<DayEndReport>('/billing/day-end', { params: date ? { date } : {} });
      return r.data ?? null;
    },
  });
}

// ============================================================
// Cash drawer close
// ============================================================
// Only CASH is reconciled — card, UPI and bank transfers settle to the bank and
// never sit in a till, so counting them would guarantee a variance every day.

export interface DrawerStatus {
  date: string;
  cashierId: string;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  transactionCount: number;
  closure: {
    id: string;
    openingFloat: number;
    expectedCash: number;
    countedCash: number;
    variance: number;
    denominations: Record<string, number> | null;
    notes: string | null;
    closedAt: string;
    closedBy: string | null;
  } | null;
}

export function useDrawerStatus(date?: string, openingFloat?: number) {
  return useQuery({
    queryKey: ['hospital', 'drawer-status', date, openingFloat],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (date) params.date = date;
      if (openingFloat != null) params.openingFloat = openingFloat;
      const r = await apiGet<DrawerStatus>('/billing/drawer/status', { params });
      return r.data ?? null;
    },
  });
}

export function useCloseDrawer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      date?: string;
      openingFloat?: number;
      countedCash: number;
      denominations?: Record<string, number>;
      notes?: string;
    }) => (await apiPost('/billing/drawer/close', data)).data ?? null,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'drawer-status'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'drawer-closures'] });
    },
  });
}

export interface DrawerClosureRow {
  id: string;
  cashierId: string;
  cashierName: string;
  openingFloat: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  notes: string | null;
  closedAt: string;
  closedBy: string;
}

export function useDrawerClosures(date?: string) {
  return useQuery({
    queryKey: ['hospital', 'drawer-closures', date],
    queryFn: async () => {
      const r = await apiGet<{
        date: string;
        closures: DrawerClosureRow[];
        totals: { expectedCash: number; countedCash: number; variance: number };
      }>('/billing/drawer/closures', { params: date ? { date } : {} });
      return r.data ?? null;
    },
  });
}

export function useReopenDrawer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (closureId: string) =>
      (await apiDelete(`/billing/drawer/closures/${closureId}`)).data ?? null,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'drawer-status'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'drawer-closures'] });
    },
  });
}

/**
 * Open the patient's copy of an OP / counter bill.
 *
 * The PDF endpoint is auth-gated, so it cannot simply be window.open'd — fetch
 * it with the auth header, blob it, then hand it to the browser's own viewer so
 * the cashier can print or save from there.
 *
 * Unlike the receipt this needs no payment to exist: an unpaid or partly-paid
 * bill can still be handed over.
 */
export async function openBillDocumentPdf(billId: string): Promise<void> {
  const apiClientMod = await import('@/lib/api-client');
  const res = await apiClientMod.default.get(`/billing/${billId}/document/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Razorpay is reachable from the patient portal (paying for an appointment or a
// bill) and from the SaaS subscription checkout — the only two screens where the
// person paying is the one at the keyboard. Hospital, pharmacy and lab staff
// mark payments as received by hand, so the counter has no gateway hooks here.
// The dialog that used to sit in this file was never rendered on any screen.

// ============================================================
// Credit Settlement (Week 12 extension)
// ============================================================

export interface CreditSettlementRow {
  id: string;
  providerType: 'insurance' | 'corporate' | 'patient';
  providerName: string;
  providerContact?: string;
  totalAdmissions: number;
  claimAmount: number;
  receivedAmount: number;
  outstandingAmount: number;
  ageDays: number;
}

export interface CreditSettlementResponse {
  settlements: CreditSettlementRow[];
  total: number;
  page: number;
  limit: number;
  stats: {
    totalProviders: number;
    totalClaim: number;
    totalReceived: number;
    totalOutstanding: number;
  };
}

export function useCreditSettlementList(params?: {
  type?: 'insurance' | 'corporate' | 'patient';
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['hospital', 'credit-settlements', params],
    queryFn: async () => {
      const r = await apiGet<CreditSettlementResponse>('/billing/credit-settlements', { params });
      return r.data ?? null;
    },
  });
}

export function useCreditSettlementBills(providerId: string | null) {
  return useQuery({
    queryKey: ['hospital', 'credit-settlement-bills', providerId],
    queryFn: async () => {
      if (!providerId) return [];
      const r = await apiGet<Array<{
        id: string; billNumber: string;
        patient?: { id: string; firstName: string; lastName: string; mrn: string };
        totalAmount: number; amountPaid: number; balanceDue: number;
        createdAt: string; ageDays: number;
        insurer?: string | null; tpa?: string | null;
      }>>(`/billing/credit-settlements/${encodeURIComponent(providerId)}/bills`);
      return r.data ?? [];
    },
    enabled: !!providerId,
  });
}

// ============================================================
// Auto-pull charges + Bill-level discount
// ============================================================

export type ChargeSource = 'consultation' | 'lab' | 'pharmacy' | 'imaging' | 'room' | 'all';

export interface ChargeRow {
  source: 'consultation' | 'lab' | 'pharmacy' | 'imaging' | 'room';
  referenceType: string;
  referenceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  taxRate: number;
  category: string;
  occurredAt: string;
  status: string;
  alreadyBilled: boolean;
  billItemId?: string;
  billId?: string;
}

export interface ChargesResponse {
  charges: ChargeRow[];
  summary: {
    consultation: number;
    lab: number;
    pharmacy: number;
    imaging: number;
    room: number;
    grandTotal: number;
    count: number;
  };
}

export function usePatientCharges(params: { patientId: string; source?: ChargeSource; includeBilled?: boolean } | null) {
  return useQuery({
    queryKey: ['hospital', 'charges', params],
    queryFn: async () => {
      if (!params) return null;
      const q: Record<string, unknown> = { patientId: params.patientId };
      if (params.source) q.source = params.source;
      if (params.includeBilled) q.includeBilled = 'true';
      const response = await apiGet<ChargesResponse>('/billing/charges', { params: q });
      return response.data ?? null;
    },
    enabled: !!params?.patientId,
  });
}

export function usePullCharges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, charges }: { billId: string; charges: Array<Omit<ChargeRow, 'source' | 'occurredAt' | 'status' | 'alreadyBilled' | 'billItemId' | 'billId' | 'totalAmount'>> }) => {
      const response = await apiPost<{ added: number; billId: string }>(
        `/billing/${billId}/pull-charges`,
        { charges },
      );
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'charges'] });
    },
  });
}

export function useAddBillItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      data,
    }: {
      billId: string;
      data: { description: string; quantity: number; unitPrice: number; discount?: number; taxRate?: number; serviceTariffId?: string };
    }) => {
      const response = await apiPost(`/billing/${billId}/items`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
    },
  });
}

export function useUpdateBillItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      itemId,
      data,
    }: {
      billId: string;
      itemId: string;
      data: { description?: string; quantity?: number; unitPrice?: number; discount?: number; taxRate?: number };
    }) => {
      const response = await apiPatch(`/billing/${billId}/items/${itemId}`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
    },
  });
}

export function useRemoveBillItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, itemId }: { billId: string; itemId: string }) => {
      const response = await apiDelete(`/billing/${billId}/items/${itemId}`);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
    },
  });
}

export function useSetBillDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      data,
    }: {
      billId: string;
      data: { discountType: 'percentage' | 'fixed'; discountValue: number; reason?: string };
    }) => {
      const response = await apiPatch(`/billing/${billId}/discount`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bill'] });
    },
  });
}

export function useSettleCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await apiPost<CreditSettlement>(`/billing/credit-settlements/${id}/settle`, data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'credit-settlements'] });
    },
  });
}
