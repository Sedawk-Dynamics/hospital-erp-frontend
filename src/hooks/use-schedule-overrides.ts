import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

export interface OverrideShift {
  id?: string;
  startTime: string; // HH:MM or ISO
  endTime: string;
  slotDurationMinutes: number;
  maxPatients?: number | null;
}

export interface ScheduleOverride {
  id: string;
  doctorId: string;
  date: string;
  isDayOff: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  shifts: OverrideShift[];
}

export interface UpsertOverrideInput {
  date: string;
  isDayOff: boolean;
  note?: string;
  shifts: { startTime: string; endTime: string; slotDurationMinutes: number; maxPatients?: number }[];
}

export interface BulkOverrideInput {
  fromDate: string;
  toDate: string;
  daysOfWeek?: number[];
  isDayOff: boolean;
  note?: string;
  shifts: { startTime: string; endTime: string; slotDurationMinutes: number; maxPatients?: number }[];
  skipExisting?: boolean;
}

export const overrideKeys = {
  list: (doctorId: string, fromDate?: string, toDate?: string) =>
    ['schedule-overrides', doctorId, fromDate, toDate] as const,
};

export function useScheduleOverrides(
  doctorId: string | undefined,
  range: { fromDate?: string; toDate?: string },
) {
  return useQuery({
    queryKey: overrideKeys.list(doctorId ?? '', range.fromDate, range.toDate),
    queryFn: async () => {
      const res = await apiGet<ScheduleOverride[]>(
        `/appointments/doctors/${doctorId}/schedule-overrides`,
        { params: range },
      );
      return res.data ?? [];
    },
    enabled: !!doctorId,
  });
}

function invalidateScheduleCaches(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['schedule-overrides'] });
  qc.invalidateQueries({ queryKey: ['hospital', 'doctor-slots'] });
  qc.invalidateQueries({ queryKey: ['doctor-schedule'] });
  qc.invalidateQueries({ queryKey: ['hospital', 'doctors'] });
  qc.invalidateQueries({ queryKey: ['patient', 'slots'] });
  qc.invalidateQueries({ queryKey: ['patient', 'doctors'] });
}

export function useUpsertScheduleOverride(doctorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertOverrideInput) => {
      const res = await apiPost(`/appointments/doctors/${doctorId}/schedule-overrides`, input);
      return res.data;
    },
    onSuccess: () => invalidateScheduleCaches(qc),
  });
}

export function useBulkApplyOverrides(doctorId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkOverrideInput) => {
      const res = await apiPost(
        `/appointments/doctors/${doctorId}/schedule-overrides/bulk`,
        input,
      );
      return res.data;
    },
    onSuccess: () => invalidateScheduleCaches(qc),
  });
}

export function useDeleteScheduleOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (overrideId: string) => {
      const res = await apiDelete(`/appointments/doctors/schedule-overrides/${overrideId}`);
      return res.data;
    },
    onSuccess: () => invalidateScheduleCaches(qc),
  });
}
