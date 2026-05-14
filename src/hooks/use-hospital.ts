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

interface CreditSettlementsParams {
  type?: string;
  status?: string;
}

export function useCreditSettlements(params?: CreditSettlementsParams) {
  return useQuery({
    queryKey: hospitalKeys.creditSettlements(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<CreditSettlement[]>('/billing/credit-settlements', { params });
      return { data: response.data, meta: response.meta! };
    },
  });
}

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
    mutationFn: async ({ id, data }: { id: string; data: { appointmentDate: string; startTime: string; endTime: string } }) => {
      const response = await apiPatch<Appointment>(`/appointments/${id}/status`, {
        status: 'booked',
        ...data,
      });
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });
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

export function useCollectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { billId: string; amount: number; method: string; transactionId?: string; notes?: string }) => {
      const response = await apiPost<Payment>('/billing/payments', data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'collection-summary'] });
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
