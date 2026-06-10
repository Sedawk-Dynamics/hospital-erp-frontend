import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export type CdssSeverity = 'info' | 'minor' | 'moderate' | 'major' | 'contraindicated';
export type CdssWarningKind = 'allergy' | 'interaction' | 'dosage' | 'recall';

export interface CdssWarning {
  severity: CdssSeverity;
  kind: CdssWarningKind;
  drug?: string;
  pair?: [string, string];
  message: string;
  detail?: string;
  /** Blocker can be overridden with a documented reason (interactions only). */
  overridable?: boolean;
}

export interface ValidatePrescriptionResult {
  warnings: CdssWarning[];
  blockers: CdssWarning[];
  overridden: CdssWarning[];
}

export interface CdssRxItem {
  drugName: string;
  dosage?: string;
  frequency?: string;
  route?: string;
}

export function useValidatePrescription() {
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      items: CdssRxItem[];
      /** Persist major+ findings as dashboard alerts (sign-time call). */
      persist?: boolean;
      prescriptionId?: string;
      /** Clinical justification to override interaction blockers. */
      overrideReason?: string;
    }) => {
      const res = await apiPost<ValidatePrescriptionResult>('/cdss/validate-prescription', data);
      return res.data;
    },
  });
}

export function useValidatePrescriptionQuery(patientId: string | null, items: CdssRxItem[]) {
  const stableKey = items.map((i) => `${i.drugName}|${i.dosage ?? ''}|${i.frequency ?? ''}`).join('::');
  return useQuery({
    queryKey: ['cdss', 'validate', patientId, stableKey],
    queryFn: async () => {
      const res = await apiPost<ValidatePrescriptionResult>('/cdss/validate-prescription', {
        patientId,
        items,
      });
      return res.data;
    },
    enabled: !!patientId && items.length > 0,
    staleTime: 30 * 1000,
  });
}

// ============================================================
// ICD-based order suggestions
// ============================================================

export interface OrderSuggestionRule {
  labs: string[];
  imaging: string[];
  note: string;
  matchIcd?: string[];
  matchDiagnosis?: string[];
}

export interface OrderSuggestionsResult {
  matched: boolean;
  labs: string[];
  imaging: string[];
  notes: string[];
  rules: OrderSuggestionRule[];
}

export function useOrderSuggestions(icdCode?: string | null, diagnosisName?: string | null) {
  return useQuery({
    queryKey: ['cdss', 'order-suggestions', icdCode, diagnosisName],
    queryFn: async () => {
      const res = await apiGet<OrderSuggestionsResult>('/cdss/order-suggestions', {
        params: {
          icdCode: icdCode || undefined,
          diagnosisName: diagnosisName || undefined,
        },
      });
      return res.data;
    },
    enabled: !!(icdCode || diagnosisName),
  });
}

// ============================================================
// Alerts feed
// ============================================================

export type CdssAlertType = 'drug_interaction' | 'allergy' | 'dosage' | 'recall' | 'critical_value';
export type CdssAlertStatus = 'active' | 'acknowledged' | 'overridden';

export interface CdssAlert {
  id: string;
  patientId: string | null;
  alertType: CdssAlertType;
  severity: string;
  message: string;
  detail: string | null;
  drugName: string | null;
  parameterName: string | null;
  parameterValue: string | null;
  referenceType: string | null;
  referenceId: string | null;
  status: CdssAlertStatus;
  acknowledgedAt: string | null;
  acknowledgeNote: string | null;
  overrideReason: string | null;
  createdAt: string;
  patient?: { id: string; mrn: string; firstName: string; lastName: string } | null;
  acknowledgedBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface CdssAbnormalResult {
  id: string;
  parameterName: string;
  value: string | null;
  unit: string | null;
  normalRange: string | null;
  isAbnormal: boolean;
  enteredAt: string;
  patient?: { id: string; mrn: string; firstName: string; lastName: string };
  labOrder?: { id: string };
}

export interface CdssAlertsFeed {
  alerts: CdssAlert[];
  page: number;
  limit: number;
  total: number;
  abnormalResults: CdssAbnormalResult[];
}

export function useCdssAlerts(params?: {
  page?: number;
  limit?: number;
  type?: CdssAlertType | 'all';
  status?: CdssAlertStatus | 'all';
  patientId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: ['cdss', 'alerts', params],
    queryFn: async () => {
      const res = await apiGet<CdssAlertsFeed>('/cdss/alerts', { params });
      return res.data;
    },
  });
}

export interface CdssAlertsSummary {
  criticalToday: number;
  criticalWeek: number;
  activeTotal: number;
  byType: Partial<Record<CdssAlertType, number>>;
  unreadCritical: number;
}

export function useCdssAlertsSummary() {
  return useQuery({
    queryKey: ['cdss', 'alerts', 'summary'],
    queryFn: async () => {
      const res = await apiGet<CdssAlertsSummary>('/cdss/alerts/summary');
      return res.data;
    },
  });
}

// ============================================================
// Alert review workflow
// ============================================================

export function useAcknowledgeCdssAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ alertId, note }: { alertId: string; note?: string }) => {
      const res = await apiPatch<CdssAlert>(`/cdss/alerts/${alertId}/acknowledge`, { note });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cdss', 'alerts'] });
    },
  });
}

export function useOverrideCdssAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ alertId, reason }: { alertId: string; reason: string }) => {
      const res = await apiPatch<CdssAlert>(`/cdss/alerts/${alertId}/override`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cdss', 'alerts'] });
    },
  });
}
