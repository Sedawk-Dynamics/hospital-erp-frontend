import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

// ============================================================
// Counselling sessions & referrals (gap #200 / #298)
// ============================================================
// Counsellor Home reads ONLY these — it used to read OP visits, so a doctor's
// follow-up showed up as a counselling session.

export const COUNSELLING_SESSION_TYPES = [
  { value: 'pre_admission_financial', label: 'Pre-admission financial' },
  { value: 'package_insurance', label: 'Package / insurance' },
  { value: 'discharge', label: 'Discharge' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'other', label: 'Other' },
] as const;

export type CounsellingSessionType = (typeof COUNSELLING_SESSION_TYPES)[number]['value'];
export type CounsellingStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type CounsellingKind = 'session' | 'referral';

export function sessionTypeLabel(value: string | null | undefined): string {
  return COUNSELLING_SESSION_TYPES.find((t) => t.value === value)?.label ?? (value || '-');
}

interface Person {
  id: string;
  firstName: string;
  lastName?: string | null;
}

export interface CounsellingSession {
  id: string;
  kind: CounsellingKind;
  sessionType: CounsellingSessionType;
  scheduledAt: string;
  status: CounsellingStatus;
  notes?: string | null;
  referralSource?: string | null;
  cancelledReason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  patient?: Person & { mrn?: string | null; phone?: string | null };
  counsellor?: Person;
  createdBy?: Person;
  referredBy?: Person | null;
}

export interface CounsellingStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

export interface Counsellor extends Person {
  email?: string;
  isCounsellor: boolean;
}

/** The filter shared by the list AND the stats, so tiles and table agree. */
export interface CounsellingFilter {
  date?: string;
  fromDate?: string;
  toDate?: string;
  status?: CounsellingStatus;
  kind?: CounsellingKind;
  counsellorId?: string;
  search?: string;
}

export interface CreateCounsellingSessionInput {
  patientId: string;
  counsellorId: string;
  sessionType: CounsellingSessionType;
  scheduledAt: string;
  notes?: string;
  kind: CounsellingKind;
  referralSource?: string;
}

export const counsellingKeys = {
  all: ['counselling'] as const,
  sessions: () => [...counsellingKeys.all, 'sessions'] as const,
  list: (f: CounsellingFilter & { page: number; limit: number }) => [...counsellingKeys.sessions(), 'list', f] as const,
  stats: (f: CounsellingFilter) => [...counsellingKeys.sessions(), 'stats', f] as const,
  counsellors: () => [...counsellingKeys.all, 'counsellors'] as const,
};

/** Drop empty strings so the query string carries only real filters. */
function clean<T extends object>(f: T): Partial<T> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

export function useCounsellingSessions(filter: CounsellingFilter & { page: number; limit: number }) {
  const params = clean(filter);
  return useQuery({
    queryKey: counsellingKeys.list(params as CounsellingFilter & { page: number; limit: number }),
    queryFn: () => apiGet<CounsellingSession[]>('/counselling/sessions', { params }),
    placeholderData: keepPreviousData,
  });
}

export function useCounsellingStats(filter: CounsellingFilter) {
  const params = clean(filter);
  return useQuery({
    queryKey: counsellingKeys.stats(params),
    queryFn: async () => (await apiGet<CounsellingStats>('/counselling/sessions/stats', { params })).data,
  });
}

export function useCounsellors(enabled = true) {
  return useQuery({
    queryKey: counsellingKeys.counsellors(),
    queryFn: async () => (await apiGet<Counsellor[]>('/counselling/counsellors')).data,
    enabled,
  });
}

/** List and stats both live under `sessions`, so one invalidation moves both. */
function useInvalidateSessions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: counsellingKeys.sessions() });
}

export function useCreateCounsellingSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async (input: CreateCounsellingSessionInput) =>
      (await apiPost<CounsellingSession>('/counselling/sessions', input)).data,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCounsellingStatus() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status: Exclude<CounsellingStatus, 'pending'>; reason?: string }) =>
      (await apiPatch<CounsellingSession>(`/counselling/sessions/${id}/status`, body)).data,
    onSuccess: () => invalidate(),
  });
}
