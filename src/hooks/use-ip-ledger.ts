import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

// IP running ledger — the admission's live itemized charges (posted + pending
// auto-charges), with running totals, deposit, and the reimbursable/patient split.

export interface LedgerLine {
  id: string;
  billId: string | null;
  billNumber: string | null;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  isReimbursable: boolean | null;
  isAutoPulled: boolean;
  status: 'posted' | 'pending';
  at: string;
}

export interface AdmissionLedger {
  admissionId: string;
  patientId: string;
  billingCategory: string;
  lines: LedgerLine[];
  categoryTotals: Array<{ category: string; posted: number; pending: number; total: number }>;
  bills: Array<{ id: string; billNumber: string; status: string; totalAmount: number; amountPaid: number; balanceDue: number }>;
  totals: {
    posted: number;
    pending: number;
    grandTotal: number;
    paid: number;
    cashPaid: number;
    insuranceCovered: number;
    deposit: number;
    depositApplied: number;
    depositRefunded: number;
    depositAvailable: number;
    balanceAfterDeposit: number;
    refundable: number;
    reimbursable: number;
    nonReimbursable: number;
  };
}

export const ipLedgerKeys = {
  detail: (admissionId: string) => ['ip-ledger', admissionId] as const,
  activity: (admissionId: string) => ['ip-ledger-activity', admissionId] as const,
};

export function useAdmissionLedger(admissionId: string | null) {
  return useQuery({
    queryKey: ipLedgerKeys.detail(admissionId ?? ''),
    queryFn: async () => (await apiGet<AdmissionLedger>(`/billing/admissions/${admissionId}/ledger`)).data,
    enabled: !!admissionId,
  });
}

export interface AddIpChargeInput {
  category: string;
  description: string;
  quantity?: number;
  unitPrice: number;
  taxRate?: number;
  serviceTariffId?: string;
  notes?: string;
}

export function useAddIpCharge(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddIpChargeInput) =>
      (await apiPost(`/billing/admissions/${admissionId}/charges`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipLedgerKeys.detail(admissionId) });
      qc.invalidateQueries({ queryKey: ipLedgerKeys.activity(admissionId) });
    },
  });
}

// Remove a manually-posted ledger charge (care team / billing — gated server-side).
export function useRemoveIpCharge(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) =>
      (await apiDelete(`/billing/admissions/${admissionId}/charges/${itemId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipLedgerKeys.detail(admissionId) });
      qc.invalidateQueries({ queryKey: ipLedgerKeys.activity(admissionId) });
    },
  });
}

// --- Doctor visit: one press = 1 visit. The fee is the doctor's admin-set
// consultationFee (resolved server-side), not entered here. ---

export interface RecordDoctorVisitInput {
  review?: string;
}

export interface RecordDoctorVisitResult {
  billId: string;
  fee: number;
}

export function useRecordDoctorVisit(admissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecordDoctorVisitInput = {}) =>
      (await apiPost<RecordDoctorVisitResult>(`/billing/admissions/${admissionId}/doctor-visit`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ipLedgerKeys.detail(admissionId) });
      qc.invalidateQueries({ queryKey: ipLedgerKeys.activity(admissionId) });
    },
  });
}

// --- Activity log: the full admit -> discharge timeline for this admission ---

export type ActivityEventType =
  | 'admission' | 'nurse_assignment' | 'vitals' | 'doctor_visit' | 'progress_note'
  | 'charge' | 'payment' | 'lab_order' | 'imaging_request' | 'prescription' | 'discharge';

export interface ActivityEvent {
  at: string;
  type: ActivityEventType;
  title: string;
  detail?: string;
  actor?: string;
  amount?: number;
  status?: string;
  meta?: Record<string, string>;
}

export interface AdmissionActivity {
  admissionId: string;
  status: string;
  discharged: boolean;
  admittedAt: string | null;
  dischargedAt: string | null;
  count: number;
  events: ActivityEvent[];
}

export function useAdmissionActivity(admissionId: string | null) {
  return useQuery({
    queryKey: ipLedgerKeys.activity(admissionId ?? ''),
    queryFn: async () => (await apiGet<AdmissionActivity>(`/billing/admissions/${admissionId}/activity`)).data,
    enabled: !!admissionId,
  });
}
