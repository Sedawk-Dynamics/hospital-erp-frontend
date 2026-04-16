import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

export type DoctorLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type DoctorLeaveType = 'vacation' | 'sick' | 'casual' | 'maternity' | 'paternity' | 'unpaid' | 'other';
export type DoctorLeaveDayType = 'full_day' | 'half_day_morning' | 'half_day_afternoon' | 'custom_hours';

export interface DoctorLeave {
  id: string;
  doctorId: string;
  leaveDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  leaveType: DoctorLeaveType;
  status: DoctorLeaveStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  approver?: { id: string; firstName: string; lastName: string } | null;
  doctor?: {
    id: string;
    user: { firstName: string; lastName: string };
    department: { id: string; name: string } | null;
  };
}

export interface ApplyLeaveInput {
  startDate: string;
  endDate: string;
  reason: string;
  leaveType: DoctorLeaveType;
  dayType: DoctorLeaveDayType;
  /** HH:MM, required when dayType === 'custom_hours'. */
  startTime?: string;
  /** HH:MM, required when dayType === 'custom_hours'. */
  endTime?: string;
}

export const doctorLeaveKeys = {
  byDoctor: (doctorId: string, filters?: { status?: string; fromDate?: string; toDate?: string }) =>
    ['doctor-leaves', 'by-doctor', doctorId, filters] as const,
  all: (filters?: Record<string, unknown>) => ['doctor-leaves', 'all', filters] as const,
};

/** Fetch leaves for a specific doctor. */
export function useDoctorLeaves(
  doctorId: string | undefined,
  filters?: { status?: DoctorLeaveStatus; fromDate?: string; toDate?: string },
) {
  return useQuery({
    queryKey: doctorLeaveKeys.byDoctor(doctorId ?? '', filters),
    queryFn: async () => {
      const res = await apiGet<DoctorLeave[]>(`/appointments/doctors/${doctorId}/leaves`, {
        params: filters,
      });
      return res.data ?? [];
    },
    enabled: !!doctorId,
  });
}

/** Doctor applies for leave. */
export function useApplyDoctorLeave(doctorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApplyLeaveInput) => {
      const res = await apiPost(`/appointments/doctors/${doctorId}/leaves`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-leaves'] });
    },
  });
}

/** Doctor/HR cancels a leave. */
export function useCancelDoctorLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leaveId: string) => {
      const res = await apiPatch(`/appointments/doctor-leaves/${leaveId}/cancel`, {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-leaves'] });
    },
  });
}

/** HR/admin: list all doctor leave requests. */
export function useAllDoctorLeaves(filters?: {
  status?: DoctorLeaveStatus;
  doctorId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: doctorLeaveKeys.all(filters),
    queryFn: async () => {
      const res = await apiGet<DoctorLeave[]>('/appointments/doctor-leaves', {
        params: filters,
      });
      return { data: res.data ?? [], meta: res.meta };
    },
  });
}

/** HR/admin approves a leave. */
export function useApproveDoctorLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leaveId: string) => {
      const res = await apiPatch(`/appointments/doctor-leaves/${leaveId}/approve`, {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-leaves'] });
    },
  });
}

/** HR/admin rejects a leave. */
export function useRejectDoctorLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leaveId, reason }: { leaveId: string; reason?: string }) => {
      const res = await apiPatch(`/appointments/doctor-leaves/${leaveId}/reject`, { reason });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-leaves'] });
    },
  });
}
