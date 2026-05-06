import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'general';
export type NurseAssignmentStatus = 'active' | 'ended' | 'handed_over' | 'cancelled';

export interface NurseAssignment {
  id: string;
  admissionId: string;
  nurseId: string;
  wardId: string;
  bedId: string | null;
  shiftDate: string;
  shiftType: ShiftType;
  assignedById: string;
  assignedAt: string;
  status: NurseAssignmentStatus;
  handedOverToId: string | null;
  handedOverAt: string | null;
  handoverNoteId: string | null;
  endedAt: string | null;
  endedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  nurse?: { id: string; firstName: string; lastName: string | null; email: string };
  assigner?: { id: string; firstName: string; lastName: string | null };
  handedOverTo?: { id: string; firstName: string; lastName: string | null } | null;
  ward?: { id: string; name: string };
  bed?: { id: string; bedNumber: string } | null;
  admission?: {
    id: string;
    status: string;
    bedId: string;
    wardId: string;
    patient: { id: string; mrn: string; firstName: string; lastName: string | null };
  };
}

export interface ListNurseAssignmentsQuery {
  wardId?: string;
  admissionId?: string;
  nurseId?: string;
  shiftDate?: string;
  shiftType?: ShiftType;
  status?: NurseAssignmentStatus;
  page?: number;
  limit?: number;
}

export interface CreateNurseAssignmentInput {
  admissionId: string;
  nurseId: string;
  shiftDate: string;
  shiftType: ShiftType;
  bedId?: string;
  notes?: string;
}

export interface HandoverInput {
  toNurseId: string;
  toShiftType: ShiftType;
  toShiftDate?: string;
  handoverNoteId?: string;
  notes?: string;
}

export interface BulkHandoverInput {
  wardId: string;
  shiftDate: string;
  fromShiftType: ShiftType;
  toShiftType: ShiftType;
  toShiftDate?: string;
  handoverNoteId?: string;
  mapping: Array<{ fromNurseId: string; toNurseId: string }>;
}

// ============================================================
// Hooks
// ============================================================

export function useNurseAssignments(query: ListNurseAssignmentsQuery = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();

  return useQuery({
    queryKey: ['nurse-assignments', query],
    queryFn: async () => {
      const res = await apiGet<NurseAssignment[]>(
        `/clinical/nurse-assignments${qs ? `?${qs}` : ''}`,
      );
      return {
        items: (res.data ?? []) as NurseAssignment[],
        total: res.meta?.total ?? 0,
        page: res.meta?.page ?? 1,
        limit: res.meta?.limit ?? 0,
      };
    },
  });
}

export function useNurseAssignment(id: string | undefined) {
  return useQuery({
    queryKey: ['nurse-assignments', id],
    queryFn: async () => {
      const res = await apiGet<NurseAssignment>(`/clinical/nurse-assignments/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateNurseAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNurseAssignmentInput) => {
      const res = await apiPost<NurseAssignment>('/clinical/nurse-assignments', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse-assignments'] });
    },
  });
}

export function useEndNurseAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiPost<NurseAssignment>(`/clinical/nurse-assignments/${id}/end`, {
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse-assignments'] });
    },
  });
}

export function useUpdateNurseAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; nurseId?: string; bedId?: string | null; notes?: string }) => {
      const res = await apiPatch<NurseAssignment>(`/clinical/nurse-assignments/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse-assignments'] });
    },
  });
}

export function useHandoverNurseAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & HandoverInput) => {
      const res = await apiPost<{
        handedOver: NurseAssignment;
        current: NurseAssignment;
      }>(`/clinical/nurse-assignments/${id}/handover`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse-assignments'] });
    },
  });
}

// ── Handover feed (per-nurse incoming/outgoing) ──────────

export interface HandoverFeedAdmissionPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string | null;
}

export interface HandoverFeedItemBase {
  sourceAssignmentId: string;
  handedOverAt: string | null;
  ward: { id: string; name: string } | null;
  bed: { id: string; bedNumber: string } | null;
  admission: {
    id: string;
    status: string;
    bedId: string;
    wardId: string;
    patient: HandoverFeedAdmissionPatient;
  } | null;
  note: {
    id: string;
    content: string;
    shiftDate: string;
    shiftType: string;
  } | null;
}

export interface HandoverFeedIncoming extends HandoverFeedItemBase {
  fromShiftDate: string;
  fromShiftType: ShiftType;
  fromNurse: { id: string; firstName: string; lastName: string | null; email?: string };
  successor: {
    id: string;
    shiftDate: string;
    shiftType: ShiftType;
    assignedAt: string;
    ward: { id: string; name: string } | null;
    bed: { id: string; bedNumber: string } | null;
  } | null;
}

export interface HandoverFeedOutgoing extends HandoverFeedItemBase {
  shiftDate: string;
  shiftType: ShiftType;
  toNurse: { id: string; firstName: string; lastName: string | null } | null;
}

export interface HandoverFeedResponse {
  nurseId: string;
  incoming: HandoverFeedIncoming[];
  outgoing: HandoverFeedOutgoing[];
  counts: { incoming: number; outgoing: number };
}

/**
 * "What did nurse_admin set up for me?" — incoming patients to receive,
 * outgoing patients I just handed off. Defaults to the current user; admin
 * tooling can pass `userId` to look at any nurse's feed.
 */
export function useHandoverFeed(query: {
  shiftDate?: string;
  shiftType?: ShiftType;
  lookbackHours?: number;
  userId?: string;
} = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return useQuery({
    queryKey: ['nurse-assignments', 'handover-feed', query],
    queryFn: async () => {
      const res = await apiGet<HandoverFeedResponse>(
        `/clinical/nurse-assignments/handover-feed${qs ? `?${qs}` : ''}`,
      );
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

export function useBulkHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkHandoverInput) => {
      const res = await apiPost<{
        transferred: Array<{ prev: string; next: string }>;
        unassigned: Array<{ assignmentId: string; reason: string }>;
      }>('/clinical/nurse-assignments/bulk-handover', input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse-assignments'] });
    },
  });
}
