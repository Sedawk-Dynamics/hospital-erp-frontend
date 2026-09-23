import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'query_raised'
  | 'response_submitted'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'resubmitted'
  | 'settled'
  | 'partially_settled'
  | 'cancelled';

export type PreAuthStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'on_hold'
  | 'cancelled';

export type PolicyStatus = 'active' | 'expired' | 'cancelled';

export interface Insurer {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  /**
   * The payer's own GST registration.
   *
   * A payer with a GSTIN is a REGISTERED recipient, which is what turns a
   * hospital bill into a B2B tax invoice and, where they are registered in
   * another state, what makes the supply inter-state. Nothing could record it
   * until now, so report A-4 was structurally always empty.
   */
  gstin?: string | null;
  /** Always the first two digits of the GSTIN — derived, never typed. */
  stateCode?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface TpaProvider {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  /**
   * The payer's own GST registration.
   *
   * A payer with a GSTIN is a REGISTERED recipient, which is what turns a
   * hospital bill into a B2B tax invoice and, where they are registered in
   * another state, what makes the supply inter-state. Nothing could record it
   * until now, so report A-4 was structurally always empty.
   */
  gstin?: string | null;
  /** Always the first two digits of the GSTIN — derived, never typed. */
  stateCode?: string | null;
  isActive: boolean;
  createdAt: string;
}

export type CommunicationType = 'email' | 'phone' | 'portal' | 'letter';
export type CommunicationDirection = 'inbound' | 'outbound';

/**
 * One recorded interaction with a TPA or insurer.
 *
 * `tpa` is null when the policy behind the claim names no TPA — the common
 * case, where the hospital deals with the insurer directly. `isSystem` marks
 * the entries the claim and pre-auth lifecycles write themselves, as opposed
 * to the ones staff type after a call.
 */
export interface TpaCommunicationLog {
  id: string;
  claimId?: string | null;
  preAuthId?: string | null;
  tpaId?: string | null;
  communicationType?: CommunicationType | null;
  direction?: CommunicationDirection | null;
  subject?: string | null;
  content?: string | null;
  isSystem: boolean;
  createdAt: string;
  claim?: { id: string; claimNumber?: string | null; status: ClaimStatus } | null;
  preAuth?: { id: string; procedureDescription: string; status: PreAuthStatus } | null;
  tpa?: { id: string; name: string } | null;
  communicator?: { id: string; firstName: string; lastName?: string | null } | null;
}

export interface InsurancePolicy {
  id: string;
  patientId: string;
  insurerId: string;
  tpaId?: string | null;
  policyNumber: string;
  groupNumber?: string | null;
  planName?: string | null;
  coverageAmount?: number | null;
  coPayPercent: number;
  deductibleAmount: number;
  exclusions?: string | null;
  validFrom: string;
  validTo: string;
  status: PolicyStatus;
  createdAt: string;
  patient?: { id: string; firstName: string; lastName?: string | null };
  insurer?: { id: string; name: string };
  tpa?: { id: string; name: string } | null;
}

export type InsuranceMoney = number | string;

export interface InsuranceBillItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: InsuranceMoney;
  discountPercent: InsuranceMoney;
  discountAmount: InsuranceMoney;
  taxPercent: InsuranceMoney;
  taxAmount: InsuranceMoney;
  totalAmount: InsuranceMoney;
  hsnSacCode?: string | null;
  gstTreatment?: string | null;
  taxableValue: InsuranceMoney;
  cgstAmount: InsuranceMoney;
  sgstAmount: InsuranceMoney;
  igstAmount: InsuranceMoney;
  cessAmount: InsuranceMoney;
  isReimbursable?: boolean | null;
  tpaCategory?: string | null;
  createdAt: string;
}

export interface InsuranceBillPayment {
  id: string;
  paymentDate: string;
  amount: InsuranceMoney;
  paymentMethod: string;
  paymentSource?: string | null;
  paymentType: string;
  status: string;
  transactionId?: string | null;
  notes?: string | null;
}

export interface InsuranceClaimBill {
  id: string;
  billNumber: string;
  billDate?: string;
  status?: string;
  subtotal?: InsuranceMoney;
  discountAmount?: InsuranceMoney;
  taxAmount?: InsuranceMoney;
  totalAmount: InsuranceMoney;
  insuranceCoveredAmount?: InsuranceMoney;
  patientPayableAmount?: InsuranceMoney;
  amountPaid?: InsuranceMoney;
  balanceDue?: InsuranceMoney;
  taxableValue?: InsuranceMoney;
  cgstAmount?: InsuranceMoney;
  sgstAmount?: InsuranceMoney;
  igstAmount?: InsuranceMoney;
  cessAmount?: InsuranceMoney;
  roundOff?: InsuranceMoney;
  gstDocumentType?: string | null;
  invoiceNumber?: string | null;
  billOfSupplyNumber?: string | null;
  billItems?: InsuranceBillItem[];
  payments?: InsuranceBillPayment[];
}

export interface InsuranceClaim {
  id: string;
  tenantId: string;
  patientId: string;
  policyId?: string | null;
  insuranceCaseId?: string | null;
  preAuthId?: string | null;
  billId: string;
  claimNumber?: string | null;
  claimAmount: number;
  approvedAmount?: number | null;
  patientShare?: number | null;
  copayAmount?: number | null;
  deductibleAmount?: number | null;
  coveredAmount?: number | null;
  paidAmount: number;
  tdsReceivableAmount?: number | null;
  disallowedAmount?: number | null;
  writtenOffAmount?: number | null;
  delayLiabilityAmount?: number | null;
  outstandingAmount?: number | null;
  tier?: 'primary' | 'secondary' | 'supplementary';
  sequence?: number;
  settlementMode?: 'cashless' | 'reimbursement' | 'credit';
  submissionChannel?: 'portal' | 'email' | 'nhcx' | 'api' | 'manual' | null;
  payerClaimReference?: string | null;
  submissionReference?: string | null;
  nhcxTransactionId?: string | null;
  status: ClaimStatus;
  submissionDate: string;
  approvalDate?: string | null;
  settlementDate?: string | null;
  expiryDate?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  resubmissionCount: number;
  previousClaimId?: string | null;
  documentsUrl?: unknown;
  patient?: { id: string; firstName: string; lastName?: string | null };
  policy?: {
    id: string;
    policyNumber: string;
    insurer?: { id: string; name: string };
  } | null;
  insuranceCase?: {
    id: string;
    caseNumber: string;
    status: string;
    insurer?: { id: string; name: string } | null;
    tpa?: { id: string; name: string } | null;
    corporatePayer?: { id: string; name: string } | null;
    governmentSchemePayer?: { id: string; name: string } | null;
  } | null;
  bill?: InsuranceClaimBill;
  preAuth?: PreAuthRequest | null;
  documents?: Array<{ id: string; code?: string | null; name: string; category: string; fileUrl: string; version: number; status: string; rejectionReason?: string | null; createdAt: string }>;
  checklistItems?: Array<{ id: string; requirementCode: string; label: string; isRequired: boolean; isComplete: boolean; documentId?: string | null }>;
  queries?: Array<{ id: string; queryReference?: string | null; subject: string; queryText: string; status: string; raisedAt: string; responseDueAt: string; responseText?: string | null; respondedAt?: string | null; resolvedAt?: string | null }>;
  settlements?: Array<{ id: string; grossApprovedAmount: number; grossPaidAmount: number; tdsAmount: number; tdsSection?: string | null; tdsRate?: number | null; disallowedAmount: number; disallowanceReason?: string | null; netPaidAmount: number; paymentReference?: string | null; bankReference?: string | null; settlementDate: string; notes?: string | null }>;
  writeOffs?: Array<{ id: string; amount: number; reason: string; status: string; decisionNote?: string | null; createdAt: string }>;
  adjustments?: Array<{ id: string; adjustmentType: string; amount: number; reference?: string | null; reason: string; effectiveDate: string }>;
  auditEvents?: Array<{ id: string; eventType: string; fromStatus?: string | null; toStatus?: string | null; details?: unknown; occurredAt: string }>;
  previousClaim?: { id: string; claimNumber?: string | null; status: ClaimStatus } | null;
}

export interface PreAuthRequest {
  id: string;
  patientId: string;
  policyId?: string | null;
  insuranceCaseId?: string | null;
  admissionId?: string | null;
  visitId?: string | null;
  doctorId?: string | null;
  requestNumber?: string | null;
  requestType?: 'initial' | 'enhancement' | 'finalDischarge';
  parentRequestId?: string | null;
  diagnosisCode?: string | null;
  procedureCode?: string | null;
  procedureDescription: string;
  estimatedCost?: number | null;
  approvedAmount?: number | null;
  status: PreAuthStatus;
  approvalNumber?: string | null;
  submissionChannel?: 'portal' | 'email' | 'nhcx' | 'api' | 'manual' | null;
  submissionReference?: string | null;
  nhcxTransactionId?: string | null;
  submittedAt?: string | null;
  alertAt?: string | null;
  decisionDueAt?: string | null;
  decidedAt?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  holdReason?: string | null;
  notes?: string | null;
  createdAt: string;
  patient?: { id: string; firstName: string; lastName?: string | null };
  policy?: {
    id: string;
    policyNumber: string;
    insurer?: { id: string; name: string };
  } | null;
  insuranceCase?: { id: string; caseNumber: string; priority?: string } | null;
}

export interface DashboardData {
  claims: {
    pending: number;
    underReview: number;
    approved: number;
    partiallyApproved: number;
    rejected: number;
    settled: number;
    partiallySettled: number;
    totalThisMonth: number;
    approvalRate: number;
  };
  preAuth: { pending: number; onHold: number; approved: number };
  settlement: {
    totalClaimed: number;
    totalApprovedAmount: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  expiry: {
    policiesIn7Days: number;
    claimsIn7Days: number;
    preAuthsIn7Days: number;
  };
  recentClaims: InsuranceClaim[];
  recentPreAuths: PreAuthRequest[];
}

export interface ResponsibilitySplit {
  claimAmount: number;
  coPayPercent: number;
  deductibleAmount: number;
  coverageLimit: number;
  coveredAmount: number;
  copayAmount: number;
  patientResponsibility: number;
  insurancePortion: number;
}

// ============================================================
// Query keys
// ============================================================

export const insuranceKeys = {
  dashboard: ['insurance', 'dashboard'] as const,
  insurers: (params?: Record<string, unknown>) => ['insurance', 'insurers', params] as const,
  tpas: (params?: Record<string, unknown>) => ['insurance', 'tpas', params] as const,
  policies: (params?: Record<string, unknown>) => ['insurance', 'policies', params] as const,
  policy: (id: string) => ['insurance', 'policy', id] as const,
  policiesByPatient: (patientId: string) =>
    ['insurance', 'policies', 'by-patient', patientId] as const,
  claims: (params?: Record<string, unknown>) => ['insurance', 'claims', params] as const,
  claim: (id: string) => ['insurance', 'claim', id] as const,
  preAuths: (params?: Record<string, unknown>) => ['insurance', 'pre-auth', params] as const,
  preAuth: (id: string) => ['insurance', 'pre-auth', id] as const,
  reports: (kind: string, params?: Record<string, unknown>) =>
    ['insurance', 'reports', kind, params] as const,
  expiringClaims: (withinDays?: number) => ['insurance', 'claims', 'expiring', withinDays] as const,
  calc: (policyId?: string, billId?: string) => ['insurance', 'calc', policyId, billId] as const,
  tpaLogs: (params?: Record<string, unknown>) => ['insurance', 'tpa-logs', params] as const,
};

// ============================================================
// Dashboard
// ============================================================

export function useInsuranceDashboard() {
  return useQuery({
    queryKey: insuranceKeys.dashboard,
    queryFn: async () => {
      const res = await apiGet<DashboardData>('/insurance/dashboard');
      return res.data;
    },
  });
}

// ============================================================
// Insurers
// ============================================================

export function useInsurers(params?: { isActive?: boolean; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: insuranceKeys.insurers(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<Insurer[]>('/insurance/insurers', { params });
      return { data: res.data, meta: res.meta! };
    },
  });
}

export function useCreateInsurer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Insurer>) => {
      const res = await apiPost<Insurer>('/insurance/insurers', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'insurers'] }),
  });
}

export function useUpdateInsurer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Insurer> }) => {
      const res = await apiPut<Insurer>(`/insurance/insurers/${id}`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'insurers'] }),
  });
}

export function useDeleteInsurer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/insurance/insurers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'insurers'] }),
  });
}

// ============================================================
// TPA Providers
// ============================================================

export function useTpas(params?: { isActive?: boolean; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: insuranceKeys.tpas(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<TpaProvider[]>('/insurance/tpa', { params });
      return { data: res.data, meta: res.meta! };
    },
  });
}

export function useCreateTpa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<TpaProvider>) => {
      const res = await apiPost<TpaProvider>('/insurance/tpa', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'tpas'] }),
  });
}

export function useUpdateTpa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<TpaProvider> }) => {
      const res = await apiPut<TpaProvider>(`/insurance/tpa/${id}`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'tpas'] }),
  });
}

export function useDeleteTpa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/insurance/tpa/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'tpas'] }),
  });
}

// ============================================================
// Policies
// ============================================================

export function usePolicies(params?: {
  patientId?: string;
  insurerId?: string;
  tpaId?: string;
  status?: PolicyStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: insuranceKeys.policies(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<InsurancePolicy[]>('/insurance/policies', { params });
      return { data: res.data, meta: res.meta! };
    },
  });
}

export function usePolicy(id: string | undefined) {
  return useQuery({
    queryKey: insuranceKeys.policy(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const res = await apiGet<InsurancePolicy>(`/insurance/policies/${id}`);
      return res.data;
    },
  });
}

export function usePoliciesByPatient(patientId: string | undefined) {
  return useQuery({
    queryKey: insuranceKeys.policiesByPatient(patientId ?? ''),
    enabled: !!patientId,
    queryFn: async () => {
      const res = await apiGet<InsurancePolicy[]>(`/insurance/policies/by-patient/${patientId}`);
      return res.data;
    },
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<InsurancePolicy>) => {
      const res = await apiPost<InsurancePolicy>('/insurance/policies', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'policies'] }),
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<InsurancePolicy> }) => {
      const res = await apiPut<InsurancePolicy>(`/insurance/policies/${id}`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'policies'] }),
  });
}

export function useVerifyPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<{ isValid: boolean; status: PolicyStatus }>(
        `/insurance/policies/${id}/verify`,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance', 'policies'] }),
  });
}

// ============================================================
// Claims
// ============================================================

export function useClaims(params?: {
  patientId?: string;
  policyId?: string;
  insuranceCaseId?: string;
  status?: ClaimStatus;
  search?: string;
  fromDate?: string;
  toDate?: string;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: insuranceKeys.claims(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<InsuranceClaim[]>('/insurance/claims', { params });
      return { data: res.data, meta: res.meta! };
    },
  });
}

export function useClaim(id: string | undefined) {
  return useQuery({
    queryKey: insuranceKeys.claim(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const res = await apiGet<InsuranceClaim>(`/insurance/claims/${id}`);
      return res.data;
    },
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      policyId?: string;
      insuranceCaseId?: string;
      preAuthId?: string;
      patientId: string;
      billId: string;
      claimAmount: number;
      tier?: 'primary' | 'secondary' | 'supplementary';
      sequence?: number;
      settlementMode?: 'cashless' | 'reimbursement' | 'credit';
      submissionChannel?: 'portal' | 'email' | 'nhcx' | 'api' | 'manual';
      payerClaimReference?: string;
      submissionReference?: string;
      nhcxTransactionId?: string;
      notes?: string;
      expiryDays?: number;
      documentsUrl?: unknown;
    }) => {
      const res = await apiPost<InsuranceClaim>('/insurance/claims', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useUpdateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await apiPut<InsuranceClaim>(`/insurance/claims/${id}`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useSubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<InsuranceClaim>(`/insurance/claims/${id}/submit`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useApproveClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      approvedAmount,
      notes,
    }: { id: string; approvedAmount: number; notes?: string }) => {
      const res = await apiPatch<InsuranceClaim>(`/insurance/claims/${id}/approve`, {
        approvedAmount,
        notes,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function usePartialApproveClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      approvedAmount,
      rejectionReason,
      notes,
    }: {
      id: string;
      approvedAmount: number;
      rejectionReason?: string;
      notes?: string;
    }) => {
      const res = await apiPatch<InsuranceClaim>(`/insurance/claims/${id}/partial-approve`, {
        approvedAmount,
        rejectionReason,
        notes,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useRejectClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      rejectionReason,
      notes,
    }: { id: string; rejectionReason: string; notes?: string }) => {
      const res = await apiPatch<InsuranceClaim>(`/insurance/claims/${id}/reject`, {
        rejectionReason,
        notes,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useSettleClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      paidAmount,
      settlementDate,
      notes,
    }: {
      id: string;
      paidAmount: number;
      settlementDate?: string;
      notes?: string;
    }) => {
      const res = await apiPatch<InsuranceClaim>(`/insurance/claims/${id}/settle`, {
        paidAmount,
        settlementDate,
        notes,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useResubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        notes: string;
        claimAmount?: number;
        additionalDocumentsUrl?: unknown;
        expiryDays?: number;
      };
    }) => {
      const res = await apiPost<InsuranceClaim>(`/insurance/claims/${id}/resubmit`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useCancelClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiPatch<InsuranceClaim>(`/insurance/claims/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useExportClaim() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiGet<Record<string, unknown>>(`/insurance/claims/${id}/export`);
      return res.data;
    },
  });
}

export function useExpiringClaims(withinDays = 7) {
  return useQuery({
    queryKey: insuranceKeys.expiringClaims(withinDays),
    queryFn: async () => {
      const res = await apiGet<InsuranceClaim[]>('/insurance/claims/expiring', {
        params: { withinDays },
      });
      return res.data;
    },
  });
}

// ============================================================
// Pre-Authorization
// ============================================================

export function usePreAuths(params?: {
  patientId?: string;
  policyId?: string;
  status?: PreAuthStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: insuranceKeys.preAuths(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<PreAuthRequest[]>('/insurance/pre-auth', { params });
      return { data: res.data, meta: res.meta! };
    },
  });
}

export function usePreAuth(id: string | undefined) {
  return useQuery({
    queryKey: insuranceKeys.preAuth(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const res = await apiGet<PreAuthRequest>(`/insurance/pre-auth/${id}`);
      return res.data;
    },
  });
}

export function useCreatePreAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      patientId: string;
      policyId?: string;
      insuranceCaseId?: string;
      admissionId?: string;
      visitId?: string;
      doctorId?: string;
      procedureDescription: string;
      diagnosisCode?: string;
      procedureCode?: string;
      submissionChannel?: 'portal' | 'email' | 'nhcx' | 'api' | 'manual';
      submissionReference?: string;
      estimatedCost?: number;
      validFrom?: string;
      validTo?: string;
      notes?: string;
    }) => {
      const res = await apiPost<PreAuthRequest>('/insurance/pre-auth', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useApprovePreAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        approvalNumber?: string;
        approvedAmount?: number;
        validFrom?: string;
        validTo?: string;
        notes?: string;
      };
    }) => {
      const res = await apiPatch<PreAuthRequest>(`/insurance/pre-auth/${id}/approve`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useRejectPreAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await apiPatch<PreAuthRequest>(`/insurance/pre-auth/${id}/reject`, { notes });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useHoldPreAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiPatch<PreAuthRequest>(`/insurance/pre-auth/${id}/hold`, { reason });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useReleasePreAuthHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<PreAuthRequest>(`/insurance/pre-auth/${id}/release-hold`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

export function useCancelPreAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiPatch<PreAuthRequest>(`/insurance/pre-auth/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

// ============================================================
// TPA Logs
// ============================================================

// ============================================================
// Calc + Bill split
// ============================================================

export function useCalcResponsibility(policyId?: string, billId?: string) {
  return useQuery({
    queryKey: insuranceKeys.calc(policyId, billId),
    enabled: !!policyId && !!billId,
    queryFn: async () => {
      const res = await apiGet<{ split: ResponsibilitySplit; policy: unknown; bill: unknown }>(
        '/insurance/calc-responsibility',
        { params: { policyId, billId } },
      );
      return res.data;
    },
  });
}

export function useSplitBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      billId,
      policyId,
      claimAmount,
    }: { billId: string; policyId: string; claimAmount?: number }) => {
      const res = await apiPatch<{ billId: string; split: ResponsibilitySplit }>(
        `/insurance/bills/${billId}/split`,
        { policyId, claimAmount },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

// ============================================================
// TPA Communication Logs
// ============================================================

export function useTpaLogs(params?: {
  claimId?: string;
  preAuthId?: string;
  tpaId?: string;
  direction?: CommunicationDirection;
  communicationType?: CommunicationType;
  isSystem?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: insuranceKeys.tpaLogs(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<TpaCommunicationLog[]>('/insurance/tpa-logs', { params });
      return { data: res.data, meta: res.meta! };
    },
  });
}

export function useCreateTpaLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      claimId?: string;
      preAuthId?: string;
      tpaId?: string;
      communicationType: CommunicationType;
      direction: CommunicationDirection;
      subject: string;
      content?: string;
    }) => {
      const res = await apiPost<TpaCommunicationLog>('/insurance/tpa-logs', body);
      return res.data;
    },
    // The claim and pre-auth detail views carry the log alongside them, so the
    // whole insurance tree is refreshed rather than just the log list.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance'] }),
  });
}

// ============================================================
// Reports
// ============================================================

export interface ReportFilters {
  fromDate?: string;
  toDate?: string;
  insurerId?: string;
  tpaId?: string;
}

export function useClaimsSummaryReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: insuranceKeys.reports('claims-summary', filters as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<{
        total: { count: number; claimed: number; approved: number; paid: number; outstanding: number };
        byStatus: { status: ClaimStatus; count: number; claimed: number; approved: number; paid: number }[];
      }>('/insurance/reports/claims-summary', { params: filters });
      return res.data;
    },
  });
}

export function useApprovalRateReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: insuranceKeys.reports('approval-rate', filters as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<{
        overall: { total: number; approved: number; rejected: number; approvalRate: number; claimedAmount: number; approvedAmount: number };
        byInsurer: { insurerId: string; insurerName: string; total: number; approved: number; rejected: number; approvalRate: number; claimedAmount: number; approvedAmount: number }[];
      }>('/insurance/reports/approval-rate', { params: filters });
      return res.data;
    },
  });
}

export function useAgingReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: insuranceKeys.reports('aging', filters as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<{
        buckets: {
          range: string;
          count: number;
          amount: number;
          claims: {
            id: string;
            claimNumber: string | null;
            patient: { id: string; firstName: string; lastName?: string | null };
            insurer: { id: string; name: string };
            status: ClaimStatus;
            outstandingAmount: number;
            submissionDate: string;
          }[];
        }[];
      }>('/insurance/reports/aging', { params: filters });
      return res.data;
    },
  });
}

export function useOutstandingReport(filters?: ReportFilters) {
  return useQuery({
    queryKey: insuranceKeys.reports('outstanding', filters as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiGet<{
        totalOutstanding: number;
        count: number;
        claims: InsuranceClaim[];
      }>('/insurance/reports/outstanding', { params: filters });
      return res.data;
    },
  });
}
