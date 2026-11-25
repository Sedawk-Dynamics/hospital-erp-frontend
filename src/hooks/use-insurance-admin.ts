import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

// ============================================================
// Gap 293 — merging duplicate insurers / TPAs
// ============================================================

export type MergeablePayerKind = 'insurer' | 'tpa';

export interface PayerMergeCounts {
  policies: number;
  cases: number;
  contracts: number;
  contractsDeactivated: number;
  communicationLogs: number;
  claims: number;
  preAuths: number;
  settlements: number;
}

export interface PayerMergePreview {
  kind: MergeablePayerKind;
  duplicate: { id: string; name: string; gstin?: string | null; isActive: boolean };
  keep: { id: string; name: string; gstin?: string | null };
  counts: PayerMergeCounts;
  contractCollisions: Array<{ id: string; name: string; contractNumber?: string | null }>;
}

export interface PayerMergeResult {
  kind: MergeablePayerKind;
  duplicate: { id: string; name: string; mergedIntoId: string };
  kept: { id: string; name: string };
  moved: PayerMergeCounts;
}

const basePath = (kind: MergeablePayerKind) => (kind === 'insurer' ? '/insurance/insurers' : '/insurance/tpa');

/** Hospital Admin (or super admin) — the only roles the backend lets merge. */
export function useIsHospitalAdmin() {
  const user = useAuthStore((s) => s.user);
  const slug = (user?.role?.slug ?? user?.role?.name ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  return slug === 'admin' || slug === 'super_admin' || Boolean(user?.roles?.some((r) => r === 'admin' || r === 'super_admin'));
}

export function usePayerMergePreview(kind: MergeablePayerKind, duplicateId?: string, keepId?: string) {
  return useQuery({
    queryKey: ['insurance', 'merge-preview', kind, duplicateId, keepId] as const,
    enabled: Boolean(duplicateId && keepId),
    queryFn: async () =>
      (await apiGet<PayerMergePreview>(`${basePath(kind)}/${duplicateId}/merge-preview`, { params: { keepId } })).data,
  });
}

export function useMergePayer(kind: MergeablePayerKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ duplicateId, keepId }: { duplicateId: string; keepId: string }) =>
      (await apiPost<PayerMergeResult>(`${basePath(kind)}/${duplicateId}/merge`, { keepId })).data,
    // Policies, cases, claims and contracts all now point elsewhere.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

// ============================================================
// Gap 294 — SLA escalation settings and stale-request closure
// ============================================================

export type EscalationRequestType = 'preauth' | 'final_discharge' | 'claim_query';

export interface EscalationSetting {
  requestType: EscalationRequestType;
  label: string;
  escalateAfterHours: number;
  targetRole: string;
  isDefault: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface EscalationSettingsResponse {
  settings: EscalationSetting[];
  roles: Array<{ name: string; description?: string | null }>;
  maxHours: number;
}

const escalationKey = ['insurance', 'sla-escalation-settings'] as const;

export function useEscalationSettings() {
  return useQuery({
    queryKey: escalationKey,
    queryFn: async () => (await apiGet<EscalationSettingsResponse>('/insurance/sla-escalation-settings')).data,
  });
}

export function useUpdateEscalationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Array<Pick<EscalationSetting, 'requestType' | 'escalateAfterHours' | 'targetRole'>>) =>
      (await apiPut<EscalationSettingsResponse>('/insurance/sla-escalation-settings', { settings })).data,
    onSuccess: (data) => {
      qc.setQueryData(escalationKey, data);
      qc.invalidateQueries({ queryKey: ['insurance', 'workflow', 'sla'] });
    },
  });
}

export const MIN_CLOSE_REASON_LENGTH = 10;

export function useCloseStalePreAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await apiPatch(`/insurance/pre-auth/${id}/close-stale`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

/** Gap 294 (retest): close a stale payer query on a claim — reason required. */
export function useCloseStaleClaimQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await apiPatch(`/insurance/claim-queries/${id}/close-stale`, { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

/** "billing_admin" → "Billing admin". */
export function roleLabel(role: string) {
  const text = role.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
