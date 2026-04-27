import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiPatch } from '@/lib/api';
import type { ShiftType } from './use-nurse-assignments';

export type DutyRosterStatus = 'scheduled' | 'published' | 'completed' | 'swapped' | 'cancelled';

export interface DutyRoster {
  id: string;
  staffId: string;
  departmentId: string;
  wardId: string | null;
  role: string | null;
  shiftDate: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  status: DutyRosterStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  staff?: {
    id: string;
    user?: { firstName: string; lastName: string | null };
  };
  department?: { id: string; name: string };
  ward?: { id: string; name: string } | null;
}

export interface ListRostersQuery {
  staffId?: string;
  departmentId?: string;
  wardId?: string;
  role?: string;
  shiftType?: ShiftType;
  status?: DutyRosterStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateRosterInput {
  staffId: string;
  departmentId: string;
  wardId?: string;
  role?: string;
  shiftDate: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
}

export function useDutyRosters(query: ListRostersQuery = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();

  return useQuery({
    queryKey: ['duty-rosters', query],
    queryFn: async () => {
      const res = await apiGet<{ items: DutyRoster[]; total: number }>(
        `/hr/rosters${qs ? `?${qs}` : ''}`,
      );
      return res.data;
    },
  });
}

export function useCreateDutyRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRosterInput) => {
      const res = await apiPost<DutyRoster>('/hr/rosters', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duty-rosters'] });
    },
  });
}

export function useCreateDutyRostersBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: CreateRosterInput[]) => {
      const res = await apiPost<{
        created: DutyRoster[];
        skipped: Array<{ index: number; reason: string }>;
      }>('/hr/rosters/bulk', { entries });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duty-rosters'] });
    },
  });
}

export function useUpdateDutyRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateRosterInput> & { status?: DutyRosterStatus }) => {
      const res = await apiPut<DutyRoster>(`/hr/rosters/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duty-rosters'] });
    },
  });
}

export function usePublishDutyRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<DutyRoster>(`/hr/rosters/${id}/publish`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duty-rosters'] });
    },
  });
}
