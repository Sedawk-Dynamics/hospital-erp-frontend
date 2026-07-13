import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiPatch } from '@/lib/api';

// Shared types + mutations for the unified IP billing section.

export interface IpClaim {
  id: string;
  claimNumber: string | null;
  status: string;
  claimAmount: number | string;
  approvedAmount: number | string | null;
  coveredAmount: number | string | null;
  patientShare: number | string | null;
  paidAmount: number | string | null;
  outstandingAmount: number | string | null;
  policy?: { policyNumber?: string; insurer?: { name: string } | null; tpa?: { name: string } | null } | null;
}

export interface IpBill {
  id: string;
  billNumber: string;
  status: string;
  admissionId: string | null;
  totalAmount: number | string;
  insuranceCoveredAmount: number | string;
  patientPayableAmount: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  discountAmount?: number | string;
  patient?: { id: string; mrn: string | null; firstName: string; lastName: string } | null;
  admission?: {
    id: string; billingCategory: string | null; status: string;
    ward?: { name: string } | null; bed?: { bedNumber: string } | null;
  } | null;
  insuranceClaims?: IpClaim[];
}

function useIpBillingInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['hospital', 'ip-bills'] });
    qc.invalidateQueries({ queryKey: ['ip-ledger'] });
    qc.invalidateQueries({ queryKey: ['ip-ledger-activity'] });
  };
}

export function useConsolidateIpBill() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (admissionId: string) => (await apiPost(`/billing/admissions/${admissionId}/consolidate`, {})).data,
    onSuccess: invalidate,
  });
}

export function useTransferToTpa() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (admissionId: string) =>
      (await apiPost<{ policy?: { tpa?: { name: string } | null; insurer?: { name: string } | null } }>(`/billing/admissions/${admissionId}/transfer-to-tpa`, {})).data,
    onSuccess: invalidate,
  });
}

export function useRecordTpaSettlement() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (v: { admissionId: string; paidAmount: number; notes?: string }) =>
      (await apiPost(`/billing/admissions/${v.admissionId}/tpa-settlement`, { paidAmount: v.paidAmount, notes: v.notes })).data,
    onSuccess: invalidate,
  });
}

export function useSetBillDiscount() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (v: { billId: string; discountType: 'percentage' | 'fixed'; discountValue: number; reason?: string }) =>
      (await apiPatch(`/billing/${v.billId}/discount`, { discountType: v.discountType, discountValue: v.discountValue, reason: v.reason })).data,
    onSuccess: invalidate,
  });
}
