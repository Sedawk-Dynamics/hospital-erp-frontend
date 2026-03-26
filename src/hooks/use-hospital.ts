import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import type { Appointment, Patient, DoctorProfile, Bill, Payment, CollectionSummary, CreditSettlement } from '@/types';

// ============================================================
// Query Keys
// ============================================================

export const hospitalKeys = {
  opAppointments: (params?: Record<string, unknown>) =>
    ['hospital', 'op-appointments', params] as const,
  appointmentStats: (date?: string) =>
    ['hospital', 'appointment-stats', date] as const,
  doctors: ['hospital', 'doctors'] as const,
  patientSearch: (query: string) =>
    ['hospital', 'patient-search', query] as const,
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
      const response = await apiGet<DoctorProfile[]>('/users', {
        params: { role: 'doctor', limit: 100 },
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

// ============================================================
// Patient Mutations
// ============================================================

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; dateOfBirth: string; gender: string; phone: string; email?: string; bloodGroup?: string; address?: string; city?: string; state?: string; zipCode?: string }) => {
      const response = await apiPost<Patient>('/patients', data);
      return response.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'patient-search'] });
    },
  });
}

// ============================================================
// Billing Mutations
// ============================================================

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { patientId: string; appointmentId?: string; items: { description: string; category: string; quantity: number; unitPrice: number; discount?: number; tax?: number }[]; notes?: string }) => {
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
