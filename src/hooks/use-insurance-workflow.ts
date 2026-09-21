import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import type { InsuranceClaim, InsurancePolicy, PreAuthRequest } from '@/hooks/use-insurance';

export type PayerType = 'insurer' | 'tpa' | 'corporate' | 'governmentScheme';
export type InsuranceCaseType = 'insurance' | 'corporate' | 'governmentScheme';
export type InsuranceSettlementMode = 'cashless' | 'reimbursement' | 'credit';
export type InsuranceCaseStatus =
  | 'open'
  | 'eligibilityPending'
  | 'eligible'
  | 'preAuthPending'
  | 'authorized'
  | 'admitted'
  | 'treatment'
  | 'dischargeAuthorizationPending'
  | 'discharged'
  | 'claimSubmitted'
  | 'queryPending'
  | 'approved'
  | 'settled'
  | 'closed'
  | 'cancelled';
export type InsurancePriority = 'routine' | 'urgent' | 'critical' | 'deceased';
export type DocumentCategory =
  | 'identity'
  | 'eligibility'
  | 'clinical'
  | 'diagnostic'
  | 'billing'
  | 'authorization'
  | 'settlement'
  | 'correspondence'
  | 'other';

export interface CorporatePayer {
  id: string;
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  creditDays: number;
  isActive: boolean;
}

export interface GovernmentSchemePayer {
  id: string;
  name: string;
  schemeCode?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  portalUrl?: string | null;
  isActive: boolean;
}

export interface EligibilitySnapshot {
  id: string;
  policyId?: string | null;
  isEligible: boolean;
  coverageAvailable?: number | null;
  coPayPercent?: number | null;
  deductibleAmount?: number | null;
  roomRentLimit?: number | null;
  waitingPeriodMet?: boolean | null;
  exclusions?: unknown;
  source?: string | null;
  reference?: string | null;
  validUntil?: string | null;
  checkedAt: string;
}

export interface CasePolicy {
  id: string;
  sequence: number;
  allocatedAmount?: number | null;
  originalDocumentsHeld: boolean;
  deductionCertificateUrl?: string | null;
  policy: InsurancePolicy;
}

export interface InsuranceCase {
  id: string;
  caseNumber: string;
  patientId: string;
  admissionId?: string | null;
  visitId?: string | null;
  caseType: InsuranceCaseType;
  settlementMode: InsuranceSettlementMode;
  status: InsuranceCaseStatus;
  priority: InsurancePriority;
  emergency: boolean;
  deceasedProtocol: boolean;
  paymentResponsibleType: PayerType;
  paymentResponsibleId: string;
  claimAdministratorType?: PayerType | null;
  claimAdministratorId?: string | null;
  memberId?: string | null;
  employeeId?: string | null;
  abhaNumber?: string | null;
  emergencyIntimatedAt?: string | null;
  emergencyIntimationReference?: string | null;
  physicalReleaseAt?: string | null;
  releaseUndertaking?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    abhaNumber?: string | null;
    deceasedAt?: string | null;
  };
  admission?: { id: string; admissionDate: string; dischargeDate?: string | null; status: string; billingCategory?: string | null } | null;
  visit?: { id: string; visitType: string; visitDate: string; doctorId?: string | null } | null;
  insurer?: { id: string; name: string; gstin?: string | null } | null;
  tpa?: { id: string; name: string } | null;
  corporatePayer?: { id: string; name: string; gstin?: string | null } | null;
  governmentSchemePayer?: { id: string; name: string; schemeCode?: string | null } | null;
  policies: CasePolicy[];
  eligibilityChecks: EligibilitySnapshot[];
  preAuthRequests: PreAuthRequest[];
  claims: InsuranceClaim[];
}

export interface ClaimDocument {
  id: string;
  claimId: string;
  code?: string | null;
  name: string;
  category: DocumentCategory;
  fileUrl: string;
  mimeType?: string | null;
  fileHash?: string | null;
  version: number;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string | null;
  createdAt: string;
}

export interface ClaimChecklistItem {
  id: string;
  requirementCode: string;
  label: string;
  isRequired: boolean;
  isComplete: boolean;
  documentId?: string | null;
}

export interface ClaimQuery {
  id: string;
  queryReference?: string | null;
  subject: string;
  queryText: string;
  status: 'open' | 'responded' | 'resolved' | 'overdue';
  raisedAt: string;
  responseDueAt: string;
  responseText?: string | null;
  respondedAt?: string | null;
  resolvedAt?: string | null;
}

export interface ClaimSettlement {
  id: string;
  grossApprovedAmount: number;
  grossPaidAmount: number;
  tdsAmount: number;
  tdsSection?: string | null;
  tdsRate?: number | null;
  disallowedAmount: number;
  disallowanceReason?: string | null;
  netPaidAmount: number;
  paymentReference?: string | null;
  bankReference?: string | null;
  bankStatementDate?: string | null;
  tdsCertificateNumber?: string | null;
  tdsCertificateDate?: string | null;
  settlementDate: string;
  notes?: string | null;
}

export interface ClaimWriteOff {
  id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decisionNote?: string | null;
  createdAt: string;
}

export interface ClaimAdjustment {
  id: string;
  adjustmentType: 'supplementaryPayment' | 'creditNote' | 'debitNote';
  amount: number;
  reference?: string | null;
  reason: string;
  effectiveDate: string;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  details?: unknown;
  occurredAt: string;
}

export interface ClaimDossier {
  generatedAt: string;
  formatVersion: string;
  claim: InsuranceClaim & {
    documents: ClaimDocument[];
    queries: ClaimQuery[];
    settlements: ClaimSettlement[];
    writeOffs: ClaimWriteOff[];
    adjustments: ClaimAdjustment[];
    auditEvents: AuditEvent[];
  };
  checklist: { items: ClaimChecklistItem[]; complete: boolean; missing: string[] };
  financialSummary: {
    claimAmount: number;
    approvedAmount: number;
    grossPaidAmount: number;
    netBankReceipts: number;
    tdsReceivable: number;
    disallowed: number;
    writtenOff: number;
  };
}

export interface PayerContract {
  id: string;
  payerType: PayerType;
  payerId: string;
  name: string;
  contractNumber?: string | null;
  validFrom: string;
  validTo: string;
  submissionWindowDays: number;
  queryResponseHours: number;
  paymentDueDays: number;
  roomRentCap?: number | null;
  roomRentCapPercent?: number | null;
  terms?: unknown;
  isActive: boolean;
  serviceRates: Array<{ id: string; serviceCode: string; serviceName: string; agreedRate: number; effectiveFrom: string; effectiveTo?: string | null }>;
  packageRates: Array<{ id: string; packageCode: string; packageName: string; agreedAmount: number; effectiveFrom: string; effectiveTo?: string | null }>;
  documentRequirements: Array<{ id: string; code: string; name: string; category: DocumentCategory; isRequired: boolean; appliesTo?: InsuranceSettlementMode | null; sortOrder: number }>;
  nonPayableRules: Array<{ id: string; itemCode?: string | null; itemPattern?: string | null; reason: string; patientPayable: boolean; isActive: boolean }>;
}

export interface SlaQueueItem extends PreAuthRequest {
  breached: boolean;
  alert: boolean;
  remainingMinutes?: number | null;
}

export interface WorkflowAnalytics {
  cases: { total: number; open: number; cashless: number; reimbursement: number };
  sla: { preAuthDecisions: number; averageDecisionMinutes: number; breached: number; currentlyOverdue: number };
  claims: { total: number; deniedOrPartial: number; denialRate: number; queriesOpen: number };
  leakage: { patientShare: number; disallowed: number; tdsReceivable: number; insurerDelayLiability: number };
}

export interface ContractInput {
  payerType: PayerType;
  payerId: string;
  name: string;
  contractNumber?: string;
  validFrom: string;
  validTo: string;
  submissionWindowDays?: number;
  queryResponseHours?: number;
  paymentDueDays?: number;
  roomRentCap?: number;
  roomRentCapPercent?: number;
  terms?: unknown;
  isActive?: boolean;
  serviceRates?: Array<{ serviceTariffId?: string; serviceCode: string; serviceName: string; agreedRate: number; effectiveFrom: string; effectiveTo?: string }>;
  packageRates?: Array<{ packageCode: string; packageName: string; agreedAmount: number; inclusions?: unknown; exclusions?: unknown; effectiveFrom: string; effectiveTo?: string }>;
  documentRequirements?: Array<{ code: string; name: string; category: DocumentCategory; isRequired?: boolean; appliesTo?: InsuranceSettlementMode; sortOrder?: number }>;
  nonPayableRules?: Array<{ itemCode?: string; itemPattern?: string; reason: string; patientPayable?: boolean; isActive?: boolean }>;
}

const keys = {
  cases: (params?: Record<string, unknown>) => ['insurance', 'workflow', 'cases', params] as const,
  case: (id: string) => ['insurance', 'workflow', 'case', id] as const,
  sla: ['insurance', 'workflow', 'sla'] as const,
  analytics: (params?: Record<string, unknown>) => ['insurance', 'workflow', 'analytics', params] as const,
  payers: (kind: string, params?: Record<string, unknown>) => ['insurance', 'workflow', 'payers', kind, params] as const,
  contracts: (params?: Record<string, unknown>) => ['insurance', 'workflow', 'contracts', params] as const,
  contract: (id: string) => ['insurance', 'workflow', 'contract', id] as const,
  checklist: (claimId: string) => ['insurance', 'workflow', 'claim', claimId, 'checklist'] as const,
  dossier: (claimId: string) => ['insurance', 'workflow', 'claim', claimId, 'dossier'] as const,
};

function useRefreshInsurance() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['insurance'] });
}

export function useInsuranceCases(params?: { patientId?: string; admissionId?: string; caseType?: InsuranceCaseType; settlementMode?: InsuranceSettlementMode; status?: InsuranceCaseStatus; priority?: InsurancePriority; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: keys.cases(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<InsuranceCase[]>('/insurance/cases', { params });
      return { data: response.data, meta: response.meta! };
    },
  });
}

export function useInsuranceCase(id?: string) {
  return useQuery({
    queryKey: keys.case(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => (await apiGet<InsuranceCase>(`/insurance/cases/${id}`)).data,
  });
}

export function useCreateInsuranceCase() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async (body: {
      patientId: string;
      admissionId?: string;
      visitId?: string;
      caseType: InsuranceCaseType;
      settlementMode: InsuranceSettlementMode;
      insurerId?: string;
      tpaId?: string;
      corporatePayerId?: string;
      governmentSchemePayerId?: string;
      paymentResponsibleType: PayerType;
      paymentResponsibleId: string;
      claimAdministratorType?: PayerType;
      claimAdministratorId?: string;
      policyIds?: string[];
      memberId?: string;
      employeeId?: string;
      abhaNumber?: string;
      priority?: InsurancePriority;
      emergency?: boolean;
      notes?: string;
    }) => (await apiPost<InsuranceCase>('/insurance/cases', body)).data,
    onSuccess: refresh,
  });
}

export function useUpdateInsuranceCaseStatus() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: InsuranceCaseStatus; notes?: string }) =>
      (await apiPatch<InsuranceCase>(`/insurance/cases/${id}/status`, { status, notes })).data,
    onSuccess: refresh,
  });
}

export function useAddCasePolicy() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async ({ caseId, ...body }: { caseId: string; policyId: string; sequence: number; allocatedAmount?: number; originalDocumentsHeld?: boolean; deductionCertificateUrl?: string }) =>
      (await apiPost<CasePolicy>(`/insurance/cases/${caseId}/policies`, body)).data,
    onSuccess: refresh,
  });
}

export function useRecordEligibility() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async ({ caseId, ...body }: { caseId: string; policyId?: string; isEligible: boolean; coverageAvailable?: number; coPayPercent?: number; deductibleAmount?: number; roomRentLimit?: number; waitingPeriodMet?: boolean; exclusions?: string[]; source?: string; reference?: string; rawResponse?: unknown; validUntil?: string }) =>
      (await apiPost<EligibilitySnapshot>(`/insurance/cases/${caseId}/eligibility`, body)).data,
    onSuccess: refresh,
  });
}

export function useRecordEmergencyIntimation() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async ({ caseId, reference, notes }: { caseId: string; reference?: string; notes?: string }) =>
      (await apiPatch<InsuranceCase>(`/insurance/cases/${caseId}/emergency-intimation`, { reference, notes })).data,
    onSuccess: refresh,
  });
}

export function useRecordPhysicalRelease() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async ({ caseId, undertaking, deceased = false }: { caseId: string; undertaking: string; deceased?: boolean }) =>
      (await apiPatch<InsuranceCase>(`/insurance/cases/${caseId}/physical-release`, { undertaking, deceased })).data,
    onSuccess: refresh,
  });
}

export function useRequestFinalAuthorization() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async ({ caseId, ...body }: { caseId: string; claimId?: string; finalAmount: number; procedureDescription?: string; submissionChannel?: 'portal' | 'email' | 'nhcx' | 'api' | 'manual'; submissionReference?: string; notes?: string }) =>
      (await apiPost<PreAuthRequest>(`/insurance/cases/${caseId}/final-authorization`, body)).data,
    onSuccess: refresh,
  });
}

export function useCreateEnhancement() {
  const refresh = useRefreshInsurance();
  return useMutation({
    mutationFn: async ({ preAuthId, ...body }: { preAuthId: string; procedureDescription: string; estimatedCost: number; diagnosisCode?: string; procedureCode?: string; submissionChannel?: 'portal' | 'email' | 'nhcx' | 'api' | 'manual'; submissionReference?: string; notes?: string }) =>
      (await apiPost<PreAuthRequest>(`/insurance/pre-auth/${preAuthId}/enhancements`, body)).data,
    onSuccess: refresh,
  });
}

export function useSlaQueue() {
  return useQuery({ queryKey: keys.sla, refetchInterval: 60_000, queryFn: async () => (await apiGet<SlaQueueItem[]>('/insurance/sla-queue')).data });
}

export function useWorkflowAnalytics(params?: { fromDate?: string; toDate?: string; payerType?: PayerType; payerId?: string }) {
  return useQuery({ queryKey: keys.analytics(params as Record<string, unknown>), queryFn: async () => (await apiGet<WorkflowAnalytics>('/insurance/workflow-analytics', { params })).data });
}

export function useCorporatePayers(params?: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
  return useQuery({
    queryKey: keys.payers('corporate', params as Record<string, unknown>),
    queryFn: async () => { const response = await apiGet<CorporatePayer[]>('/insurance/corporate-payers', { params }); return { data: response.data, meta: response.meta! }; },
  });
}

export function useCreateCorporatePayer() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async (body: Omit<CorporatePayer, 'id' | 'isActive'> & { isActive?: boolean }) => (await apiPost<CorporatePayer>('/insurance/corporate-payers', body)).data, onSuccess: refresh });
}

export function useGovernmentSchemes(params?: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
  return useQuery({
    queryKey: keys.payers('government', params as Record<string, unknown>),
    queryFn: async () => { const response = await apiGet<GovernmentSchemePayer[]>('/insurance/government-schemes', { params }); return { data: response.data, meta: response.meta! }; },
  });
}

export function useCreateGovernmentScheme() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async (body: Omit<GovernmentSchemePayer, 'id' | 'isActive'> & { isActive?: boolean }) => (await apiPost<GovernmentSchemePayer>('/insurance/government-schemes', body)).data, onSuccess: refresh });
}

export function usePayerContracts(params?: { payerType?: PayerType; payerId?: string; activeOn?: string }) {
  return useQuery({ queryKey: keys.contracts(params as Record<string, unknown>), queryFn: async () => (await apiGet<PayerContract[]>('/insurance/contracts', { params })).data });
}

export function usePayerContract(id?: string) {
  return useQuery({ queryKey: keys.contract(id ?? ''), enabled: Boolean(id), queryFn: async () => (await apiGet<PayerContract>(`/insurance/contracts/${id}`)).data });
}

export function useCreatePayerContract() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async (body: ContractInput) => (await apiPost<PayerContract>('/insurance/contracts', body)).data, onSuccess: refresh });
}

export function useUpdatePayerContract() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ id, body }: { id: string; body: ContractInput }) => (await apiPut<PayerContract>(`/insurance/contracts/${id}`, body)).data, onSuccess: refresh });
}

export function useClaimChecklist(claimId?: string) {
  return useQuery({
    queryKey: keys.checklist(claimId ?? ''),
    enabled: Boolean(claimId),
    queryFn: async () => (await apiGet<{ items: ClaimChecklistItem[]; complete: boolean; missing: string[] }>(`/insurance/claims/${claimId}/checklist`)).data,
  });
}

export function useSyncClaimChecklist() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async (claimId: string) => (await apiPost<{ items: ClaimChecklistItem[]; complete: boolean; missing: string[] }>(`/insurance/claims/${claimId}/checklist/sync`)).data, onSuccess: refresh });
}

export function useAddClaimDocument() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ claimId, ...body }: { claimId: string; code?: string; name: string; category: DocumentCategory; fileUrl: string; mimeType?: string; fileHash?: string }) => (await apiPost<ClaimDocument>(`/insurance/claims/${claimId}/documents`, body)).data, onSuccess: refresh });
}

export function useVerifyClaimDocument() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ documentId, status, rejectionReason }: { documentId: string; status: 'verified' | 'rejected'; rejectionReason?: string }) => (await apiPatch<ClaimDocument>(`/insurance/claim-documents/${documentId}/verify`, { status, rejectionReason })).data, onSuccess: refresh });
}

export function useRaiseClaimQuery() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ claimId, ...body }: { claimId: string; queryReference?: string; subject: string; queryText: string; responseDueAt?: string; responseHours?: number }) => (await apiPost<ClaimQuery>(`/insurance/claims/${claimId}/queries`, body)).data, onSuccess: refresh });
}

export function useRespondClaimQuery() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ queryId, responseText }: { queryId: string; responseText: string }) => (await apiPatch<ClaimQuery>(`/insurance/claim-queries/${queryId}/respond`, { responseText })).data, onSuccess: refresh });
}

export function useResolveClaimQuery() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async (queryId: string) => (await apiPatch<ClaimQuery>(`/insurance/claim-queries/${queryId}/resolve`)).data, onSuccess: refresh });
}

export interface SettlementInput {
  grossApprovedAmount: number;
  grossPaidAmount: number;
  tdsAmount: number;
  tdsSection?: string;
  tdsRate?: number;
  disallowedAmount: number;
  disallowanceReason?: string;
  netPaidAmount: number;
  paymentReference?: string;
  bankReference?: string;
  bankStatementDate?: string;
  tdsCertificateNumber?: string;
  tdsCertificateDate?: string;
  settlementDate: string;
  notes?: string;
}

export function useRecordClaimSettlement() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ claimId, ...body }: { claimId: string } & SettlementInput) => (await apiPost<ClaimSettlement>(`/insurance/claims/${claimId}/settlements`, body)).data, onSuccess: refresh });
}

export function useRecordBulkSettlements() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async (settlements: Array<{ claimId: string } & SettlementInput>) => (await apiPost<ClaimSettlement[]>('/insurance/claims/settlements/bulk', { settlements })).data, onSuccess: refresh });
}

export function useRequestClaimWriteOff() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ claimId, amount, reason }: { claimId: string; amount: number; reason: string }) => (await apiPost<ClaimWriteOff>(`/insurance/claims/${claimId}/write-offs`, { amount, reason })).data, onSuccess: refresh });
}

export function useDecideClaimWriteOff() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ writeOffId, decision, decisionNote }: { writeOffId: string; decision: 'approved' | 'rejected'; decisionNote?: string }) => (await apiPatch<ClaimWriteOff>(`/insurance/claim-write-offs/${writeOffId}/decision`, { decision, decisionNote })).data, onSuccess: refresh });
}

export function useCreateClaimAdjustment() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async ({ claimId, ...body }: { claimId: string; adjustmentType: ClaimAdjustment['adjustmentType']; amount: number; reference?: string; reason: string; effectiveDate: string }) => (await apiPost<ClaimAdjustment>(`/insurance/claims/${claimId}/adjustments`, body)).data, onSuccess: refresh });
}

export function useClaimDossier(claimId?: string, enabled = false) {
  return useQuery({ queryKey: keys.dossier(claimId ?? ''), enabled: Boolean(claimId) && enabled, queryFn: async () => (await apiGet<ClaimDossier>(`/insurance/claims/${claimId}/dossier`)).data });
}

export async function downloadClaimDossier(claimId: string, claimNumber?: string | null) {
  const dossier = (await apiGet<ClaimDossier>(`/insurance/claims/${claimId}/dossier`)).data;
  const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${claimNumber ?? claimId}-dossier.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useQueueInsuranceExchange() {
  const refresh = useRefreshInsurance();
  return useMutation({ mutationFn: async (body: { claimId?: string; preAuthId?: string; channel: 'portal' | 'email' | 'nhcx' | 'api' | 'manual'; messageType: string; transactionId?: string; payload: unknown }) => (await apiPost('/insurance/exchanges', body)).data, onSuccess: refresh });
}

export function useBankMatches(bankReference?: string) {
  return useQuery({ queryKey: ['insurance', 'workflow', 'bank-match', bankReference], enabled: Boolean(bankReference && bankReference.length >= 3), queryFn: async () => (await apiGet<ClaimSettlement[]>('/insurance/claims/settlements/bank-match', { params: { bankReference } })).data });
}
