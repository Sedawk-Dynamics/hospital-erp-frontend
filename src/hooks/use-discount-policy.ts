import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// Margin-based system-wide discount — hooks (separate module)
// ============================================================
// Reads/writes the per-tenant margin→max-discount policy. The POS uses
// `useEffectiveDiscountPolicy` + `capForMargin` to cap each line locally; the
// settings page uses the config + rules CRUD hooks.

export type DiscountMode = 'cap' | 'suggest';

export interface MarginDiscountConfig {
  enabled: boolean;
  mode: DiscountMode;
}

export interface MarginDiscountRule {
  id: string;
  label: string;
  minMarginPercent: number;
  maxMarginPercent: number | null;
  maxDiscountPercent: number;
  isActive: boolean;
  sortOrder: number;
}

export interface EffectiveDiscountPolicy {
  enabled: boolean;
  mode: DiscountMode;
  rules: MarginDiscountRule[];
}

export interface DiscountRuleInput {
  label: string;
  minMarginPercent: number;
  maxMarginPercent?: number | null;
  maxDiscountPercent: number;
  isActive?: boolean;
  sortOrder?: number;
}

const KEY = ['discount-policy'] as const;

export function useDiscountConfig() {
  return useQuery({
    queryKey: [...KEY, 'config'],
    queryFn: async () => (await apiGet<MarginDiscountConfig>('/discount-policy/config')).data,
  });
}

export function useUpdateDiscountConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MarginDiscountConfig>) =>
      (await apiPut<MarginDiscountConfig>('/discount-policy/config', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDiscountRules() {
  return useQuery({
    queryKey: [...KEY, 'rules'],
    queryFn: async () => (await apiGet<MarginDiscountRule[]>('/discount-policy/rules')).data,
  });
}

export function useCreateDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: DiscountRuleInput) =>
      (await apiPost<MarginDiscountRule>('/discount-policy/rules', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: DiscountRuleInput & { id: string }) =>
      (await apiPut<MarginDiscountRule>(`/discount-policy/rules/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiDelete<{ id: string; deleted: boolean }>(`/discount-policy/rules/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// The on/off switch + mode + active bands the POS needs to cap lines locally.
export function useEffectiveDiscountPolicy() {
  return useQuery({
    queryKey: [...KEY, 'effective'],
    queryFn: async () => (await apiGet<EffectiveDiscountPolicy>('/discount-policy/effective')).data,
    staleTime: 60_000,
  });
}

/**
 * The max discount % allowed for a given margin %, or null when no active band
 * contains it. Mirrors the backend `pickRule`: first active band (already
 * ordered by the API) whose inclusive [min, max] contains the margin wins.
 */
export function capForMargin(rules: MarginDiscountRule[], marginPercent: number): number | null {
  for (const r of rules) {
    if (!r.isActive) continue;
    const aboveMin = marginPercent >= r.minMarginPercent;
    const belowMax = r.maxMarginPercent == null || marginPercent <= r.maxMarginPercent;
    if (aboveMin && belowMax) return r.maxDiscountPercent;
  }
  return null;
}
