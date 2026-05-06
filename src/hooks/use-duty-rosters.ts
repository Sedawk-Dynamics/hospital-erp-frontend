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
    user?: { id: string; firstName: string; lastName: string | null };
  };
  department?: { id: string; name: string };
  ward?: { id: string; name: string } | null;
}

export interface ListRostersQuery {
  staffId?: string;
  // Resolved server-side to the user's StaffProfile; lets a nurse fetch their
  // own roster without first looking up the staffId.
  userId?: string;
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
  // Either staffId (HR profile id) or userId (the backend will find or create
  // a StaffProfile for the user, picking a sensible default department).
  staffId?: string;
  userId?: string;
  departmentId?: string;
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
      const res = await apiGet<DutyRoster[]>(`/hr/rosters${qs ? `?${qs}` : ''}`);
      return {
        items: (res.data ?? []) as DutyRoster[],
        total: res.meta?.total ?? 0,
      };
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

// ── Live coverage helpers ────────────────────────────────

export interface ActiveRosterResponse {
  at: string;
  entries: DutyRoster[];
  byShiftType: Partial<Record<ShiftType, number>>;
  // When the request specified userId, this is *that user's* active row,
  // or null if they're off duty at `at`.
  mine: DutyRoster | null;
}

/**
 * Who's on duty right now per the published roster. Pass `userId` to find
 * out if the logged-in nurse is currently in a rostered shift (so the
 * dashboard can surface the rostered start/end instead of guessing from
 * the wall clock).
 *
 * Caller-controlled refresh: defaults to a 60s interval so dashboards
 * roll over correctly across shift changes.
 */
export function useActiveRoster(
  query: { at?: string; wardId?: string; role?: string; userId?: string } = {},
  options: { refetchIntervalMs?: number } = {},
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return useQuery({
    queryKey: ['duty-rosters', 'active', query],
    queryFn: async () => {
      const res = await apiGet<ActiveRosterResponse>(
        `/hr/rosters/active${qs ? `?${qs}` : ''}`,
      );
      return res.data;
    },
    refetchInterval: options.refetchIntervalMs ?? 60_000,
  });
}

export interface CoverageRow {
  shiftDate: string;
  shiftType: ShiftType;
  rostered: number;
}

export interface CoverageResponse {
  fromDate: string;
  toDate: string;
  coverage: CoverageRow[];
}

export function useRosterCoverage(query: {
  fromDate: string;
  toDate: string;
  wardId?: string;
  role?: string;
}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  return useQuery({
    queryKey: ['duty-rosters', 'coverage', query],
    queryFn: async () => {
      const res = await apiGet<CoverageResponse>(
        `/hr/rosters/coverage?${search.toString()}`,
      );
      return res.data;
    },
    enabled: Boolean(query.fromDate && query.toDate),
  });
}
