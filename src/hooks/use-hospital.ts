import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Appointment, Patient, DoctorProfile } from '@/types';

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
// Hooks
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
        return response.data;
      } catch {
        // Fallback: fetch all appointments for the date and compute stats
        const response = await apiGet<Appointment[]>('/appointments', {
          params: { date, limit: 1000 },
        });
        const appointments = response.data;
        return {
          all: appointments.length,
          booked: appointments.filter((a) => a.status === 'scheduled').length,
          ipAppointments: 0,
          arrived: appointments.filter((a) => a.status === 'checked_in').length,
          withDoctor: appointments.filter((a) => a.status === 'in_progress').length,
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
      return response.data;
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
      return response.data;
    },
    enabled: query.length >= 2,
  });
}
