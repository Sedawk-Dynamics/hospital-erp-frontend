import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

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
    deposit: number;
    balanceAfterDeposit: number;
    reimbursable: number;
    nonReimbursable: number;
  };
}

export const ipLedgerKeys = {
  detail: (admissionId: string) => ['ip-ledger', admissionId] as const,
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
    },
  });
}
