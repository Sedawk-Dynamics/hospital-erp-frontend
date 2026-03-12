import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Patient, Appointment, Bill } from '@/types';

// ============================================================
// Dashboard Stats Types
// ============================================================

export interface DashboardStats {
  patientStats: {
    total: number;
    todayNew: number;
    inpatient: number;
    outpatient: number;
  };
  appointmentStats: {
    todayTotal: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
  billingStats: {
    todayRevenue: number;
    pendingBills: number;
    totalRevenue: number;
  };
  bedStats: {
    total: number;
    occupied: number;
    available: number;
  };
  staffStats: {
    totalDoctors: number;
    totalNurses: number;
    totalStaff: number;
  };
}

// ============================================================
// Query Key Factories
// ============================================================

export const queryKeys = {
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
  },
  patients: {
    all: ['patients'] as const,
    list: (params?: Record<string, unknown>) => ['patients', 'list', params] as const,
    detail: (id: string) => ['patients', 'detail', id] as const,
  },
  appointments: {
    all: ['appointments'] as const,
    list: (params?: Record<string, unknown>) => ['appointments', 'list', params] as const,
    detail: (id: string) => ['appointments', 'detail', id] as const,
  },
  billing: {
    all: ['billing'] as const,
    list: (params?: Record<string, unknown>) => ['billing', 'list', params] as const,
    detail: (id: string) => ['billing', 'detail', id] as const,
  },
} as const;

// ============================================================
// Dashboard Hooks
// ============================================================

export function useDashboardStats(
  options?: Omit<UseQueryOptions<DashboardStats, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<DashboardStats, Error>({
    queryKey: queryKeys.dashboard.stats,
    queryFn: async () => {
      const response = await apiGet<DashboardStats>('/dashboard/stats');
      return response.data;
    },
    ...options,
  });
}

// ============================================================
// Patient Hooks
// ============================================================

interface PatientsParams {
  page?: number;
  limit?: number;
  search?: string;
  gender?: string;
  isActive?: boolean;
}

export function usePatients(
  params?: PatientsParams,
  options?: Omit<UseQueryOptions<{ data: Patient[]; meta: { page: number; limit: number; total: number; totalPages: number } }, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.patients.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Patient[]>('/patients', { params });
      return { data: response.data, meta: response.meta! };
    },
    ...options,
  });
}

// ============================================================
// Appointment Hooks
// ============================================================

interface AppointmentsParams {
  page?: number;
  limit?: number;
  status?: string;
  doctorId?: string;
  patientId?: string;
  date?: string;
}

export function useAppointments(
  params?: AppointmentsParams,
  options?: Omit<UseQueryOptions<{ data: Appointment[]; meta: { page: number; limit: number; total: number; totalPages: number } }, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.appointments.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Appointment[]>('/appointments', { params });
      return { data: response.data, meta: response.meta! };
    },
    ...options,
  });
}

// ============================================================
// Billing Hooks
// ============================================================

interface BillsParams {
  page?: number;
  limit?: number;
  status?: string;
  patientId?: string;
}

export function useBills(
  params?: BillsParams,
  options?: Omit<UseQueryOptions<{ data: Bill[]; meta: { page: number; limit: number; total: number; totalPages: number } }, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.billing.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params });
      return { data: response.data, meta: response.meta! };
    },
    ...options,
  });
}
