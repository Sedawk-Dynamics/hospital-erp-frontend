import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import type { PdfTemplate } from '@/hooks/use-hospital-branding';

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
  /**
   * What the counter can collect against THIS bill right now. `balanceDue` is
   * the whole stay summed over every bill on the admission, which is not the
   * same number whenever a pharmacy or counter bill sits alongside the IP one —
   * paying the stay total against a single bill is refused by the server.
   */
  payableNow?: number | string;
  discountAmount?: number | string;
  patient?: { id: string; mrn: string | null; firstName: string; lastName: string } | null;
  admission?: {
    id: string; billingCategory: string | null; status: string;
    depositAmount?: number | string | null;
    admissionDate?: string | null; dischargeDate?: string | null;
    ward?: { name: string } | null; bed?: { bedNumber: string } | null;
    /** Care type — ip | emergency | daycare. All three share this worklist. */
    admissionType?: 'ip' | 'emergency' | 'daycare';
    /**
     * The doctor has published the discharge summary but the patient is still
     * admitted — this row is waiting on the counter to clear the bill and
     * complete the discharge.
     */
    dischargeReady?: boolean;
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

/**
 * Complete the discharge once the final bill is settled. The doctor's published
 * discharge summary only marks the patient ready; this is the counter action
 * that actually closes the admission and frees the bed. The server re-checks
 * both gates (published summary + zero balance), so a stale UI can't slip a
 * patient out with money outstanding.
 *
 * `force` is the LAMA / transfer-out / death override and requires a reason.
 */
export function useClearAndDischarge() {
  const invalidate = useIpBillingInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { admissionId: string; force?: boolean; reason?: string }) =>
      (await apiPatch(`/clinical/admissions/${v.admissionId}/discharge`, {
        dischargeDate: new Date().toISOString(),
        ...(v.force ? { force: true, reason: v.reason } : {}),
      })).data,
    onSuccess: () => {
      invalidate();
      // The bed, the IP worklists and the admission detail all change state.
      qc.invalidateQueries({ queryKey: ['hospital'] });
      qc.invalidateQueries({ queryKey: ['clinical'] });
      qc.invalidateQueries({ queryKey: ['doctor', 'admissions'] });
      qc.invalidateQueries({ queryKey: ['nurse'] });
    },
  });
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
    queryFn: async () =>
      // `/billing/payments`, not `/payments` — there has never been a payments
      // router at the root, so this 404'd every time an IP bill was opened and
      // the instalment list silently rendered empty. A bill paid in three
      // instalments looked unpaid on the one screen that shows the stay's
      // pharmacy, room and procedure charges together.
      (await apiGet<BillPayment[]>('/billing/payments', { params: { billId, limit: 50 } })).data,
    enabled: !!billId,
  });
}

// ============================================================
// Printable bill for an IP / Emergency / Day Care stay
// ============================================================
// Read-only and available at any time: interim while the patient is admitted,
// final once discharged, and reprintable forever afterwards.

/** The subset of the hospital branding the printed bill renders. */
export interface HospitalBrandingLike {
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  showLogo: boolean;
  headerStyle: 'centered' | 'left';
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  website: string | null;
  registrationNo: string | null;
  gstin: string | null;
  accreditation: string | null;
  footerText: string | null;
  accentColor: string;
  show: Record<string, boolean>;
}

export interface BillDocumentLine {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: string;
  at: string;
  /**
   * The line's frozen tax position, as the server resolved it. Null on a
   * pending charge, which has not been priced onto a bill and so has no
   * position yet — the print view shows that as blank, never as exempt.
   */
  hsnSac: string | null;
  gstTreatment: string | null;
  /** 'Exempt' / 'Nil rated' / 'Taxable' — worded server-side, one map. */
  treatmentLabel: string | null;
  taxRatePercent: number;
  taxableValue: number;
  taxAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessAmount: number;
}

/** One rate's worth of the bill — the rate-wise summary Rule 46 asks for. */
export interface BillTaxSummaryRow {
  label: string;
  treatment: string;
  ratePercent: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  taxAmount: number;
}

/**
 * What makes this a GST document rather than "a bill".
 *
 * Every layout switch is decided on the SERVER and read here as a boolean.
 * The PDF and this view have to reach the same answer about whether a document
 * carries tax columns, and a rule implemented twice is a rule that drifts.
 */
export interface BillDocumentGst {
  registered: boolean;
  documentType: string | null;
  documentLabel: string | null;
  invoiceNumbers: string[];
  financialYear: string | null;
  supplierGstin: string | null;
  supplierStateCode: string | null;
  supplierStateName: string | null;
  recipientGstin: string | null;
  placeOfSupplyStateCode: string | null;
  placeOfSupplyStateName: string | null;
  isInterState: boolean;
  hasTax: boolean;
  hasClassifiedLines: boolean;
  taxSummary: BillTaxSummaryRow[];
  notes: string[];
  totals: {
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    taxAmount: number;
  };
  /** Section 10.1 item 8 — the total tax written out. */
  taxAmountInWords: string;
  /** Rule 46's copy marking, for the title band. */
  copyMarking: string | null;
}

export interface AdmissionBillDocument {
  /**
   * Letterhead, served WITH the document. GET /hospital-branding is admin-only,
   * so fetching it client-side left every doctor / nurse / front-desk user with
   * a blank letterhead on the printed bill.
   */
  hospital: HospitalBrandingLike | null;
  /**
   * The `ip_bill` template from the PDF Builder, resolved server-side and
   * carried with the document. The print view renders from this so the bill on
   * screen and the bill from the PDF button are one definition, two renderers.
   * `GET /hospital-branding/templates` is admin-only, hence riding along.
   */
  template: PdfTemplate | null;
  admissionId: string;
  admissionType: 'ip' | 'emergency' | 'daycare';
  admissionTypeLabel: string;
  isPaid: boolean;
  isDischarged: boolean;
  documentTitle: string;
  patient: {
    id: string;
    name: string;
    mrn: string | null;
    age: string | null;
    gender: string | null;
    phone: string | null;
    address: string | null;
    bloodGroup: string | null;
  };
  admission: {
    ipNumber: string | null;
    admittedOn: string;
    dischargedOn: string | null;
    lengthOfStayDays: number;
    ward: string | null;
    bed: string | null;
    doctor: string | null;
    billingCategory: string;
    reason: string | null;
  };
  bills: Array<{
    billNumber: string;
    status: string;
    totalAmount: number;
    invoiceNumber: string | null;
    gstDocumentType: string | null;
  }>;
  gst: BillDocumentGst;
  groups: Array<{ category: string; label: string; lines: BillDocumentLine[]; total: number }>;
  payments: Array<{
    date: string;
    amount: number;
    method: string;
    type: string;
    reference: string | null;
    receiptNumber: string | null;
  }>;
  totals: {
    grossCharges: number;
    posted: number;
    pending: number;
    discount: number;
    tax: number;
    insuranceCovered: number;
    deposit: number;
    depositApplied: number;
    depositRefunded: number;
    paid: number;
    cashPaid: number;
    /** Section 6.9 — what the grand total was rounded by, 0 when it was not. */
    roundOff: number;
    netPayable: number;
    balanceDue: number;
    refundable: number;
  };
  generatedAt: string;
}

export function useAdmissionBillDocument(admissionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['admission-bill-document', admissionId],
    queryFn: async () =>
      (await apiGet<AdmissionBillDocument>(`/billing/admissions/${admissionId}/bill-document`)).data,
    enabled: !!admissionId && enabled,
    // The bill must reflect charges posted a moment ago, never a cached copy.
    staleTime: 0,
  });
}

/** Open the branded PDF in a new tab (auth-gated, so it goes through the client). */
export async function openAdmissionBillPdf(admissionId: string): Promise<void> {
  const apiClientMod = await import('@/lib/api-client');
  const res = await apiClientMod.default.get(`/billing/admissions/${admissionId}/bill-document/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
