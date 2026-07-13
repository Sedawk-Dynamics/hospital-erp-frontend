import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

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

// Deposit position for an admission (on file / applied / refunded + the
// deposit-adjusted patient balance and how much is now refundable).
export interface IpDeposit {
  onFile: number;
  applied: number;
  refunded: number;
  available: number;
  refundable: number;
  balanceAfterDeposit: number;
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
    depositAmount?: number | string | null;
    admissionDate?: string | null; dischargeDate?: string | null;
    ward?: { name: string } | null; bed?: { bedNumber: string } | null;
  } | null;
  insuranceClaims?: IpClaim[];
  deposit?: IpDeposit;
}

// The IP billing worklist: one row per admission, from the moment of admission.
export function useIpAdmissions(search?: string) {
  return useQuery({
    queryKey: ['hospital', 'ip-bills', search ?? ''],
    queryFn: async () =>
      (await apiGet<IpBill[]>('/billing/ip-admissions', {
        params: { limit: 100, includeDischarged: true, ...(search ? { search } : {}) },
      })).data,
  });
}

// Cut the deposit from the running IP bill.
export function useApplyDeposit() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (v: { admissionId: string; amount?: number }) =>
      (await apiPost(`/billing/admissions/${v.admissionId}/apply-deposit`, v.amount != null ? { amount: v.amount } : {})).data,
    onSuccess: invalidate,
  });
}

// Return the unused deposit to the patient.
export function useRefundDeposit() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (v: { admissionId: string; amount?: number; reason?: string }) =>
      (await apiPost(`/billing/admissions/${v.admissionId}/refund-deposit`, {
        ...(v.amount != null ? { amount: v.amount } : {}),
        ...(v.reason ? { reason: v.reason } : {}),
      })).data,
    onSuccess: invalidate,
  });
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

export interface TransferToTpaInput {
  admissionId: string;
  policyId?: string;
  newPolicy?: {
    insurerName: string;
    tpaName?: string;
    policyNumber?: string;
    coverageAmount?: number;
    coPayPercent?: number;
    deductibleAmount?: number;
  };
}
export function useTransferToTpa() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (v: TransferToTpaInput) =>
      (await apiPost<{ policy?: { tpa?: { name: string } | null; insurer?: { name: string } | null } }>(
        `/billing/admissions/${v.admissionId}/transfer-to-tpa`,
        { policyId: v.policyId, newPolicy: v.newPolicy },
      )).data,
    onSuccess: invalidate,
  });
}

// A patient's existing insurance policies (to pick from at transfer time).
export interface PatientPolicy {
  id: string;
  policyNumber: string;
  status: string;
  validFrom?: string;
  validTo?: string;
  insurer?: { name: string } | null;
  tpa?: { name: string } | null;
}
export function usePatientPolicies(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-policies', patientId],
    queryFn: async () => (await apiGet<PatientPolicy[]>(`/insurance/policies/by-patient/${patientId}`)).data,
    enabled: !!patientId,
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

// Line-level insurance split: mark a bill line insurance-eligible / patient-only.
export function useSetBillItemReimbursable() {
  const invalidate = useIpBillingInvalidate();
  return useMutation({
    mutationFn: async (v: { itemId: string; isReimbursable: boolean | null }) =>
      (await apiPatch(`/billing/bill-items/${v.itemId}/reimbursable`, { isReimbursable: v.isReimbursable })).data,
    onSuccess: invalidate,
  });
}

// Payment history (installments) for a bill.
export interface BillPayment {
  id: string;
  amount: number | string;
  paymentDate: string;
  paymentMethod: string;
  status: string;
}
export function useBillPayments(billId: string | null) {
  return useQuery({
    queryKey: ['bill-payments', billId],
    queryFn: async () => (await apiGet<BillPayment[]>('/payments', { params: { billId, limit: 50 } })).data,
    enabled: !!billId,
  });
}
