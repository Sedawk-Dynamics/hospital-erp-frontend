import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

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
}

export interface ValidatePrescriptionResult {
  warnings: CdssWarning[];
  blockers: CdssWarning[];
}

export interface CdssRxItem {
  drugName: string;
  dosage?: string;
  frequency?: string;
  route?: string;
}

export function useValidatePrescription() {
  return useMutation({
    mutationFn: async (data: { patientId: string; items: CdssRxItem[] }) => {
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

export interface CdssAlert {
  id: string;
  userId: string;
  title: string;
  message: string;
  notificationType: string;
  channel: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string };
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

export function useCdssAlertsSummary() {
  return useQuery({
    queryKey: ['cdss', 'alerts', 'summary'],
    queryFn: async () => {
      const res = await apiGet<{
        criticalToday: number;
        criticalWeek: number;
        unreadCritical: number;
      }>('/cdss/alerts/summary');
      return res.data;
    },
  });
}
