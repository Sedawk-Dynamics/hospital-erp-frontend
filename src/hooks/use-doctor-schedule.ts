import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface DoctorScheduleEntry {
  id?: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  slotDurationMinutes: number;
  maxPatients?: number;
  isActive: boolean;
}

export interface DoctorProfileWithSchedules {
  id: string;
  userId: string;
  specialization: string | null;
  qualifications: string | null;
  consultationFee: number | null;
  /**
   * Days after a paid consultation with this doctor in which a return visit
   * carries no consultation fee. Null / 0 = every visit is charged.
   */
  freeFollowUpDays?: number | null;
  experienceYears: number | null;
  isAvailable: boolean;
  user: { firstName: string; lastName: string; email?: string; phone?: string };
  department: { id: string; name: string } | null;
  schedules?: DoctorScheduleEntry[];
}

// ============================================================
// Query Keys
// ============================================================

export const scheduleKeys = {
  doctorProfile: (id: string) => ['doctor-schedule', 'profile', id] as const,
  doctorsList: ['doctor-schedule', 'doctors-list'] as const,
};

// ============================================================
// Hooks
// ============================================================

/** Fetch a doctor profile with schedules */
export function useDoctorProfileWithSchedules(doctorId: string) {
  return useQuery({
    queryKey: scheduleKeys.doctorProfile(doctorId),
    queryFn: async () => {
      const res = await apiGet<DoctorProfileWithSchedules>(`/appointments/doctors/${doctorId}`);
      return res.data ?? null;
    },
    enabled: !!doctorId,
  });
}

/** Update doctor profile (fee, specialization, etc.) */
export function useUpdateDoctorProfile(doctorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      consultationFee?: number;
      freeFollowUpDays?: number | null;
      specialization?: string;
      qualifications?: string;
      experienceYears?: number;
      bio?: string;
      isAvailable?: boolean;
    }) => {
      const res = await apiPatch(`/appointments/doctors/${doctorId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.doctorProfile(doctorId) });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'doctors'] });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'profile'] });
    },
  });
}

/** Update a doctor's weekly schedule (full replacement) */
export function useUpdateDoctorSchedule(doctorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedules: DoctorScheduleEntry[]) => {
      const res = await apiPut(`/appointments/doctors/${doctorId}/schedules`, { schedules });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.doctorProfile(doctorId) });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'doctors'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'doctor-slots'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['patient', 'slots'] });
      queryClient.invalidateQueries({ queryKey: ['patient', 'doctors'] });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'profile'] });
    },
  });
}
