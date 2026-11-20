import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

// ============================================================
// The GST reports.
//
// One hook shape for all of them, because they share everything that matters
// on the client: a period, a gate (`billing:approve`), and a payload the screen
// renders without reshaping. The FIGURES are assembled on the server and are
// never recomputed here — a total the browser worked out for itself is a second
// opinion, and a return that carries two opinions is a return nobody can file.
//
// Group A is what the accountant files from, B is what the hospital claims
// back, C is how it keeps itself out of trouble during the month.
// ============================================================

export interface GstPeriod {
  from: string | null;
  to: string | null;
}

export interface TaxTotals {
  count: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface SalesLine {
  billId: string;
  billNumber: string;
  invoiceNumber: string | null;
  documentType: string | null;
  billDate: string;
  billStatus: string;
  financialYear: string | null;
  patientId: string | null;
  patientName: string | null;
  mrn: string | null;
  patientType: 'ip' | 'op';
  recipientGstin: string | null;
  placeOfSupplyStateCode: string | null;
  isInterState: boolean;
  itemId: string;
  description: string;
  department: string;
  hsnSac: string | null;
  gstTreatment: string | null;
  treatmentLabel: string | null;
  rateSource: string | null;
  requiresTaxResolution: boolean;
  raisedBy: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRatePercent: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  taxAmount: number;
  totalAmount: number;
  /** Billed at a rate the law did not recognise on the bill's own date. */
  illegalRate: boolean;
}

/** One rung of the input-tax-credit ladder, with where its figure came from. */
export interface ItcLadderRung {
  key: string;
  label: string;
  amount: number | null;
  source: string;
}

export interface GstReportQuery {
  from?: string;
  to?: string;
  department?: string;
  documentType?: string;
  treatment?: string;
  customerType?: 'b2b' | 'b2c';
  sixDigit?: boolean;
  financialYear?: string;
}

/**
 * Every report is read the same way, so they share one key shape — which also
 * means the period cache-busts all of them together and two reports on screen
 * can never be showing different months.
 */
function useReport<T>(name: string, path: string, query: GstReportQuery, enabled = true) {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params[k] = typeof v === 'boolean' ? String(v) : String(v);
  }
  return useQuery({
    queryKey: ['gst-report', name, params],
    queryFn: async () => (await apiGet<T>(path, { params })).data,
    enabled,
  });
}

// ── Group A — filing ───────────────────────────────────────────────────────

/**
 * Total turnover, the taxable part and the exempt part — three figures, each
 * under its own name (gap item 278).
 */
export interface TurnoverSummary {
  lines: number;
  totalTurnover: number;
  taxableValue: number;
  exemptNilNonGst: number;
  unclassifiedValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  taxAmount: number;
  invoiceValue: number;
}

export const useSalesRegister = (q: GstReportQuery, on = true) =>
  useReport<{ period: GstPeriod; rows: SalesLine[]; summary?: TurnoverSummary }>(
    'sales-register', '/gst/reports/sales-register', q, on,
  );

export interface RateSummaryRow extends TaxTotals {
  treatment: string;
  label: string;
  ratePercent: number;
}
export const useRateSummary = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    byRate: RateSummaryRow[];
    byDepartment: Array<TaxTotals & { department: string; byRate: RateSummaryRow[] }>;
    totals: TaxTotals;
    turnover?: TurnoverSummary;
    /** Rates in the period the law did not recognise. Filing gets rejected. */
    illegalRates: {
      lines: number;
      taxableValue: number;
      taxAmount: number;
      rates: number[];
      bills: string[];
    };
  }>('rate-summary', '/gst/reports/rate-summary', q, on);

export const useHsnSummary = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    reportingDigits: number;
    byCode: Array<TaxTotals & { hsnSac: string; description: string; ratePercent: number; quantity: number }>;
    totals: TaxTotals;
    unclassified: TaxTotals;
  }>('hsn-summary', '/gst/reports/hsn-summary', q, on);

export const useB2bRegister = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    invoices: Array<TaxTotals & {
      billId: string; billNumber: string; invoiceNumber: string | null;
      documentType: string | null; billDate: string; recipientGstin: string | null;
      placeOfSupplyStateCode: string | null; isInterState: boolean; patientName: string | null;
    }>;
    totals: TaxTotals;
    taxableTotals?: TaxTotals;
    exemptTotals?: TaxTotals;
    turnover?: TurnoverSummary;
  }>('b2b-register', '/gst/reports/b2b-register', q, on);

export const useB2cSummary = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    largeInterState: Array<TaxTotals & {
      billId: string; billNumber: string; invoiceNumber: string | null;
      billDate: string; placeOfSupplyStateCode: string | null; patientName: string | null;
    }>;
    summary: Array<TaxTotals & {
      placeOfSupplyStateCode: string | null; ratePercent: number; isInterState: boolean;
      treatment?: string; treatmentLabel?: string;
    }>;
    threshold: number;
    totals: TaxTotals;
    taxableTotals?: TaxTotals;
    exemptTotals?: TaxTotals;
    turnover?: TurnoverSummary;
  }>('b2c-summary', '/gst/reports/b2c-summary', q, on);

export interface CreditNoteRow {
  id: string;
  creditNoteNumber: string;
  issueDate: string;
  financialYear: string | null;
  reason: string;
  reasonNote: string | null;
  againstInvoiceNumber: string | null;
  againstBillNumber: string | null;
  againstBillDate: string | null;
  patientName: string | null;
  mrn: string | null;
  recipientGstin: string | null;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  totalAmount: number;
  issuedBy: string | null;
  withinTimeLimit: boolean;
  reportable: boolean;
  noteType?: string;
  /** False for the cancellation of a voided sale already gone from A-1. */
  originalInRegister?: boolean;
}
export const useCreditNoteRegister = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    rows: CreditNoteRow[];
    summary: {
      count: number; taxableValue: number; cgstAmount: number; sgstAmount: number;
      igstAmount: number; taxAmount: number; totalAmount: number;
      b2b: { count: number; taxableValue: number; taxAmount: number };
      b2c: { count: number; taxableValue: number; taxAmount: number };
      outsideTimeLimit: number;
      notReportable: number;
      originalNotInRegister?: number;
    };
  }>('credit-notes', '/gst/reports/credit-notes', q, on);

export const useExemptTurnover = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    taxable: TaxTotals; exempt: TaxTotals; nilRated: TaxTotals;
    nonGst: TaxTotals; zeroRated: TaxTotals; unclassified: TaxTotals;
    exemptTurnover: number;
    totalTurnover: number;
    exemptRatio: number;
    byDepartment: Array<{ department: string; exempt: number; taxable: number }>;
  }>('exempt-turnover', '/gst/reports/exempt-turnover', q, on);

export const useGstr1 = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    tables: {
      b2b: TaxTotals;
      b2c: TaxTotals;
      exemptTurnover: { exempt: number; nilRated: number; nonGst: number; total: number; notesNetted?: number };
      creditNotes: {
        count: number; taxableValue: number; taxAmount: number; notReportable: number; outsideTimeLimit: number;
        excluded?: NoteExclusions;
      };
      advances: {
        received: { count: number; amount: number; taxableValue: number; taxAmount: number };
        adjusted: { count: number; amount: number };
      };
      hsn: Array<{ hsnSac: string; ratePercent: number; quantity: number; taxableValue: number; taxAmount: number }>;
      hsnUnclassified: TaxTotals;
    };
    reconciliation: {
      taxable: { taxableValue: number; taxAmount: number; agrees: boolean };
      register: { taxableValue: number; taxAmount: number; agrees: boolean };
      unclassifiedLines: number;
      /** GSTR-1 (4 + 5/7 + 9B) against GSTR-3B 3.1(a) — gap item 274. */
      gstr3b?: {
        gstr1TaxableValue: number; gstr1TaxAmount: number;
        gstr3bTaxableValue: number; gstr3bTaxAmount: number;
        taxableValue: number; taxAmount: number; agrees: boolean;
      };
    };
    creditNotesApplied?: AppliedNote[];
  }>('gstr1', '/gst/reports/gstr1', q, on);

export interface NoteExclusions {
  total: number;
  outsideTimeLimit: number;
  originalNotInRegister: number;
}

/** A credit/debit note netted into a return, for drill-down from its total. */
export interface AppliedNote {
  id: string;
  creditNoteNumber: string;
  noteType: string;
  issueDate: string;
  againstInvoiceNumber: string | null;
  patientName: string | null;
  taxableValue: number;
  taxAmount: number;
  totalAmount?: number;
  taxableSide?: number;
  exemptValue?: number;
}

export const useGstr3b = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    outwardTaxable: { taxableValue: number; cgstAmount: number; sgstAmount: number; igstAmount: number; taxAmount: number };
    outwardExempt: number;
    outwardNonGst: number;
    inputTaxCredit: { available: number; reversed: number; net: number };
    netTaxPayable: number;
    creditCarriedForward: number;
    creditNotesExcluded: number;
    /** Only this count is a section 34 warning (gap item 275). */
    creditNotesOutsideTimeLimit?: number;
    creditNotesOriginalNotInRegister?: number;
    creditNotesApplied?: AppliedNote[];
    payableByHead?: { igst: number; cgst: number; sgst: number };
  }>('gstr3b', '/gst/reports/gstr3b', q, on);

export const useGstr1Json = (q: GstReportQuery, on = true) =>
  useReport<{ json: Record<string, unknown>; warnings: string[] }>(
    'gstr1-json', '/gst/reports/gstr1/json', q, on,
  );

export const useAdvancesReport = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    rows: Array<{
      advanceId: string; voucherNumber: string | null; date: string;
      patientName: string | null; mrn: string | null; source: string;
      amount: number; gstTreatment: string | null; taxRatePercent: number;
      taxableValue: number; taxAmount: number;
      adjusted: number; refunded: number; balance: number; unclassified: boolean;
    }>;
    summary: {
      count: number; amountReceived: number; amountAdjusted: number;
      amountRefunded: number; balanceOutstanding: number;
      taxDueOnAdvances: { count: number; amount: number; taxableValue: number; taxAmount: number };
      adjustedAgainstInvoices: { count: number; amount: number };
      unclassifiedCount: number;
    };
  }>('advances', '/gst/reports/advances', q, on);

// ── Group B — purchases and input tax credit ───────────────────────────────

export const usePurchaseRegister = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    rows: Array<{
      batchId: string; supplierName: string | null; supplierGstin: string | null;
      invoiceNumber: string | null; invoiceDate: string | null; drugName: string;
      hsnCode: string | null; batchNumber: string; quantity: number; freeQuantity: number;
      taxableValue: number; gstRatePercent: number | null; taxAmount: number; landingTotal: number;
      /** Gap 271: the split as stored on the stock-in (CGST + SGST, or IGST). */
      cgstAmount: number; sgstAmount: number; igstAmount: number;
      itcEligibility?: string; itcBlockedReason?: string | null;
    }>;
  }>('purchase-register', '/gst/reports/purchase-register', q, on);

/** CGST / SGST / IGST, kept apart because the credit ledgers are (gap 271). */
export type TaxHeads = { cgstAmount: number; sgstAmount: number; igstAmount: number };

export const useItcSummary = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    byRate: Array<{ ratePercent: number | null; count: number; taxableValue: number; taxAmount: number; landingTotal: number } & TaxHeads>;
    bySupplier: Array<{ supplierId: string | null; supplierName: string | null; supplierGstin: string | null; count: number; taxableValue: number; taxAmount: number; landingTotal: number } & TaxHeads>;
    totals: {
      count: number; taxableValue: number; taxAmount: number; landingTotal: number;
      cgstAmount: number; sgstAmount: number; igstAmount: number;
    };
    /**
     * Gross → ineligible → reversal → eligible → claimed, each with its source.
     * The report used to stop at gross, which for a hospital is the rung that
     * flatters it: most of that credit is reversed again under Rule 42.
     */
    ladder: ItcLadderRung[];
    withoutRate: number;
    ineligibleCount: number;
    partlyEligibleCount: number;
    coverage: string;
  }>('itc-summary', '/gst/reports/itc-summary', q, on);

export const useItcReversal = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    working: Array<{ step: string; label: string; amount: number; source: string }>;
    exemptRatioPercent: number;
    creditAvailable: number;
    totalInputTax?: number;
    blockedCredit?: { total: number; purchases: number; fromSuppliersWithoutGstin: number };
    reversal: { total: number; d1: number; d2: number };
    netCreditAvailable: number;
    notes: string[];
  }>('itc-reversal', '/gst/reports/itc-reversal', q, on);

export const useSupplierGstinExceptions = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    suppliers: Array<{
      supplierId: string | null; supplierName: string | null; supplierGstin: string | null;
      problem: string; taxAtRisk: number; purchaseValue: number; batches: number;
    }>;
    totals: { suppliers: number; batches: number; taxAtRisk: number };
    coverage: string;
  }>('supplier-gstin-exceptions', '/gst/reports/supplier-gstin-exceptions', q, on);

export const usePurchaseReturns = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    returns: Array<{
      returnId: string; date: string; supplierName: string | null; drugName: string;
      batchNumber: string | null; quantity: number; reason: string | null;
      supplierCreditNoteNumber: string | null; supplierCreditAmount: number | null;
      purchaseInvoiceNumber: string | null;
      taxableValue: number; gstRatePercent: number | null; taxToReverse: number;
      /** Gap 273: the purchase-tax split stored on the return. */
      cgstAmount: number; sgstAmount: number; igstAmount: number;
    }>;
    /** Gap 273: damaged / expired pharmacy stock written off, with the credit to reverse. */
    pharmacyWriteOffs?: Array<{
      writeOffId: string; date: string; writeOffType: string; drugName: string;
      batchNumber: string | null; quantity: number; reason: string | null;
      purchaseInvoiceNumber: string | null; taxableValue: number; gstRatePercent: number | null;
      cgstAmount: number; sgstAmount: number; igstAmount: number; taxToReverse: number;
    }>;
    /** Expired pharmacy batches still on the shelf. */
    expiredPharmacyBatches?: Array<{
      batchId: string; date: string | null; drugName: string; supplierName: string | null;
      batchNumber: string | null; expiryDate: string | null; quantity: number;
      purchaseInvoiceNumber: string | null; taxableValue: number; gstRatePercent: number | null;
      cgstAmount: number; sgstAmount: number; igstAmount: number; taxToReverse: number;
    }>;
    expiryWriteOffs: Array<{
      transactionId: string; date: string; itemName: string; supplierName: string | null;
      batchNumber: string | null; expiryDate: string | null; quantity: number; value: number;
    }>;
    totals: {
      returns: number; returnedValue: number; taxToReverse: number;
      withoutSupplierCreditNote: number; expiryWriteOffs: number; expiredValue: number;
      returnCgst?: number; returnSgst?: number; returnIgst?: number;
      expiredPharmacyBatches?: number; expiredPharmacyValue?: number; expiredPharmacyTaxToReverse?: number;
      pharmacyWriteOffs?: number; pharmacyWriteOffValue?: number; pharmacyWriteOffTaxToReverse?: number;
      pharmacyWriteOffCgst?: number; pharmacyWriteOffSgst?: number; pharmacyWriteOffIgst?: number;
      /** Returns + pharmacy write-offs + expired pharmacy stock (gap 273). */
      totalTaxToReverse?: number;
    };
    notes: string[];
  }>('purchase-returns', '/gst/reports/purchase-returns', q, on);

// ── C-6 — the filed period archive ────────────────────────────────────────
//
// Filing is a write, so this one has a mutation beside its queries. It is the
// accountant's act of saying "this is what went in", not a report.

export interface FiledPeriod {
  id: string;
  returnPeriod: string;
  financialYear: string;
  periodFrom: string;
  periodTo: string;
  filedAt: string;
  filedBy: string | null;
  /**
   * When the period was LOCKED, which is a separate act from filing.
   *
   * Filing archives the figures; locking shuts the doors on every bill dated
   * inside the period. Null means open, which is what every period archived
   * before the lock existed still is.
   */
  lockedAt: string | null;
  lockedBy: string | null;
  /** 'filed_locked' or 'filed_open' (re-opened). Filing locks — gap item 281. */
  status?: 'filed_locked' | 'filed_open';
  note: string | null;
  outwardTaxableValue?: number;
  outwardTax: number;
  netTaxPayable: number;
  exemptTurnover: number;
  reconciled: boolean;
  /** Gap 281: snapshots kept (the original is 1), reopens, and the last reopen's reason. */
  versions?: number;
  reopenCount?: number;
  lastReopenReason?: string | null;
  history?: FiledPeriodEvent[];
}

/**
 * Gap 281: one entry in a filed period's trail — the original filing
 * (version 1), a reopen with its reason, a correction (version 2, 3 …) or a
 * re-lock. The original snapshot is never replaced.
 */
export interface FiledPeriodEvent {
  id: string;
  action: 'filed' | 'unlocked' | 'refiled' | 'locked' | string;
  version: number | null;
  reason: string | null;
  at: string;
  by: string | null;
  figures: FiledHeadline | null;
}

/** Roles that may reopen or correct a filed period — mirrors the backend (gap 281). */
export const GST_AMENDMENT_ROLES = ['super_admin', 'admin', 'billing_admin'] as const;
export const canAmendFiledPeriod = (roles: readonly string[] | null | undefined) =>
  (roles ?? []).some((r) => (GST_AMENDMENT_ROLES as readonly string[]).includes(r));

export const filedPeriodsKey = ['gst-report', 'filed-periods'] as const;

export function useFiledPeriods() {
  return useQuery({
    queryKey: filedPeriodsKey,
    queryFn: async () =>
      (await apiGet<{ periods: FiledPeriod[] }>('/gst/reports/filed-periods')).data,
  });
}

/**
 * The snapshot's own shape, as far as this screen reads it.
 *
 * Deliberately partial: a snapshot taken a year ago was written by the code of
 * a year ago, and every field is optional because an older copy may simply not
 * have one. Reading it defensively is the only way an archive stays readable.
 */
export interface FiledSnapshot {
  capturedAt?: string;
  gstr3b?: {
    outwardTaxable?: { taxableValue?: number; taxAmount?: number };
    outwardExempt?: number;
    outwardNonGst?: number;
    inputTaxCredit?: { available?: number; reversed?: number; net?: number };
    netTaxPayable?: number;
  };
  exemptTurnover?: { exemptTurnover?: number; totalTurnover?: number; exemptRatio?: number };
}

export interface FiledPeriodDetail {
  id: string;
  returnPeriod: string;
  periodFrom: string;
  periodTo: string;
  filedAt: string;
  filedBy: string | null;
  note: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  status?: 'filed_locked' | 'filed_open';
  filed?: FiledHeadline;
  snapshot: FiledSnapshot;
  drift: { outwardTaxAsFiled: number; outwardTaxNow: number; difference: number; moved: boolean };
  notes: string[];
  /** Gap 281: every snapshot and every reopen / correction, oldest first. */
  history?: FiledPeriodEvent[];
  versions?: number;
  latestCorrection?: { version: number; at: string; reason: string | null; figures: FiledHeadline } | null;
}

/** The headline "as filed" figures — the same ones C-6 and A-13 show. */
export interface FiledHeadline {
  outwardTaxableValue: number;
  outwardTax: number;
  netTaxPayable: number;
  exemptTurnover: number;
  reconciled: boolean;
  capturedAt: string | null;
}

export function useFiledPeriod(id: string | null) {
  return useQuery({
    queryKey: [...filedPeriodsKey, id],
    queryFn: async () => (await apiGet<FiledPeriodDetail>(`/gst/reports/filed-periods/${id}`)).data,
    enabled: !!id,
  });
}

export function useFilePeriod() {
  const qc = useQueryClient();
  return useMutation({
    // Gap 281: `reason` is required when the period was filed before — the
    // server stores the correction as a new version and keeps the original.
    mutationFn: async (body: { from: string; to: string; note?: string | null; sixDigit?: boolean; reason?: string | null }) =>
      (await apiPost<{ id: string; returnPeriod: string; status?: string; version?: number; correction?: boolean }>(
        '/gst/reports/filed-periods', body,
      )).data,
    // A-13 reads the same snapshot, so it refreshes too.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gst-report'] }),
  });
}

// ── B-5 — the GSTR-2B reconciliation ──────────────────────────────────────

export interface ReconRow {
  supplierGstin: string | null;
  supplierName: string | null;
  invoiceNumber: string;
  portalInvoiceNumber?: string;
  invoiceDate: string | null;
  lines?: number;
  booksTaxableValue?: number;
  booksTaxAmount?: number;
  portalTaxableValue?: number;
  portalTaxAmount?: number;
  taxableValue?: number;
  taxAmount?: number;
  taxableDifference?: number;
  taxDifference?: number;
  itcAvailable?: boolean;
  itcBlockedReason?: string | null;
  supplierFiledOn?: string | null;
}

export const useGstr2bReconciliation = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    returnPeriod: string;
    statement: {
      id: string; gstin: string | null; generatedAt: string | null; fileName: string | null;
      importedAt: string; importedBy: string | null; invoiceCount: number;
    } | null;
    matched: ReconRow[];
    mismatched: ReconRow[];
    inPortalOnly: ReconRow[];
    inBooksOnly: ReconRow[];
    supplierNotes: Array<{
      supplierGstin: string; supplierName: string | null; documentType: string;
      documentNumber: string; documentDate: string | null; taxableValue: number; taxAmount: number;
    }>;
    unmatchable: Array<{
      batchId: string; supplierName: string | null; supplierGstin: string | null;
      invoiceNumber: string | null; drugName: string; taxAmount: number; problem: string;
    }>;
    totals: {
      matched: { count: number; taxAmount: number };
      mismatched: { count: number; taxAmount: number };
      inPortalOnly: { count: number; taxAmount: number };
      inBooksOnly: { count: number; taxAmount: number };
      unmatchable: { count: number; taxAmount: number };
      supplierNotes: { count: number; taxAmount: number };
      creditAtRisk: number;
      claimable: number;
    };
    notes: string[];
  }>('gstr2b-reconciliation', '/gst/reports/gstr2b-reconciliation', q, on);

export const gstr2bImportsKey = ['gst-report', 'gstr2b-imports'] as const;

export function useGstr2bImports() {
  return useQuery({
    queryKey: gstr2bImportsKey,
    queryFn: async () =>
      (
        await apiGet<{
          imports: Array<{
            id: string; returnPeriod: string; gstin: string | null; generatedAt: string | null;
            fileName: string | null; importedAt: string; importedBy: string | null;
            invoiceCount: number; taxTotal: number;
          }>;
        }>('/gst/reports/gstr2b-imports')
      ).data,
  });
}

export function useImportGstr2b() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { file: unknown; fileName?: string | null }) =>
      (
        await apiPost<{ returnPeriod: string; documents: number; taxTotal: number; warnings: string[] }>(
          '/gst/reports/gstr2b-imports',
          body,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gstr2bImportsKey });
      // The reconciliation is the whole reason for importing, so it must not
      // keep showing the answer from before the statement arrived.
      qc.invalidateQueries({ queryKey: ['gst-report', 'gstr2b-reconciliation'] });
    },
  });
}

// ── Group C — operational and control ──────────────────────────────────────

export const useDailyCollection = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    byDay: Array<{ day: string; collected: number; taxCollected: number; count: number }>;
    byMethod: Array<{ method: string; collected: number; taxCollected: number; count: number }>;
    /** Every tender, card = credit + debit card (gap item 280). */
    byMode?: Array<{ mode: string; collected: number; taxCollected: number; count: number }>;
    byCounter: Array<{ counter: string; collected: number; taxCollected: number; count: number }>;
    byCashier: Array<{ cashier: string; collected: number; taxCollected: number; count: number }>;
    totals: { count: number; collected: number; taxCollected: number };
    note: string;
  }>('daily-collection', '/gst/reports/daily-collection', q, on);

export const useRevenueMix = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    byMonth: Array<{ month: string; taxable: number; exempt: number; unclassified: number; total: number; taxableSharePercent: number }>;
    totals: TaxTotals;
  }>('revenue-mix', '/gst/reports/revenue-mix', q, on);

export interface UnmappedBucket {
  totals: TaxTotals;
  items: Array<{ description: string; department: string; lines: number; value: number; rates: number[] }>;
}
export const useUnmappedItems = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    withoutTreatment: UnmappedBucket;
    withoutCode: UnmappedBucket;
    typedRate: UnmappedBucket & {
      lines: Array<{
        billNumber: string; invoiceNumber: string | null; billDate: string;
        description: string; department: string; ratePercent: number;
        taxAmount: number; rateSource: string | null;
      }>;
    };
    totals: { linesChecked: number; exceptions: number };
  }>('unmapped-items', '/gst/reports/unmapped-items', q, on);

export const useRateOverrides = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    rows: Array<{
      billDate: string; document: string; billNumber: string;
      patientName: string | null; department: string; description: string;
      ratePercent: number; taxAmount: number; totalAmount: number;
      rateSource: string | null; raisedBy: string | null;
    }>;
    byPerson: Array<{ person: string; lines: number; taxCharged: number; value: number }>;
    itemChanges?: ItemRateChange[];
    itemVsMaster?: ItemVsMaster[];
    billedVsItem?: Array<{
      billNumber: string; invoiceNumber: string | null; billDate: string; description: string;
      itemType: string; itemId: string; billedRate: number; itemRate: number;
      billedTreatment: string | null; itemTreatment: string | null; taxAmount: number;
      rateSource: string | null; raisedBy: string | null;
    }>;
    totals: {
      linesChecked: number; overrides: number; taxCharged: number; value: number;
      itemChanges?: number; itemVsMaster?: number; billedVsItem?: number;
    };
    notes: string[];
  }>('rate-overrides', '/gst/reports/rate-overrides', q, on);

/** One logged change to an item's GST rate, HSN/SAC or treatment (gap item 279). */
export interface ItemRateChange {
  id: string; changedAt: string; changedBy: string | null;
  itemType: string; itemId: string; itemName: string | null;
  previousRate: number | null; newRate: number | null;
  previousCode: string | null; newCode: string | null;
  previousTreatment: string | null; newTreatment: string | null;
  action: string; reason: string | null;
}

export interface ItemVsMaster {
  itemType: string; itemId: string; itemName: string; code: string | null; masterCode: string;
  itemRate: number; masterRate: number; itemTreatment: string | null; masterTreatment: string | null;
  approved: boolean;
}

type LineCounts = { count: number; taxCharged: number; value: number };
type OutOfStep = Array<{ billNumber: string | null; billDate: string | null; description: string; ratePercent: number; taxAmount: number }>;

export const useSeriesContinuity = (q: GstReportQuery, on = true) =>
  useReport<{
    financialYear: string | null;
    series: Array<{
      documentType: string; financialYear: string; prefix: string;
      counter: number; firstIssued: number | null; lastIssued: number | null;
      issuedCount: number; missing: number[]; duplicated: number[]; burned: number;
      cancelled: Array<{ number: string; date: string; reason: string | null }>;
      continuous: boolean;
    }>;
    totals: { series: number; withGaps: number; withDuplicates: number; burned: number };
  }>('series-continuity', '/gst/reports/series-continuity', q, on);

export const useDepartmentGst = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    departments: Array<TaxTotals & { department: string; taxableTurnover: number; exemptTurnover: number }>;
    totals: TaxTotals;
  }>('department-gst', '/gst/reports/department-gst', q, on);

export const useRateChangeImpact = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    changes: Array<{
      id: string; changedAt: string; changedBy: string | null;
      codeType: string; code: string; description: string | null; action: string;
      previousRate: number | null; newRate: number | null;
      previousTreatment: string | null; newTreatment: string | null;
      linesBefore: { count: number; taxCharged: number; value: number };
      linesAfter: { count: number; taxCharged: number; value: number };
      outOfStep: Array<{
        billNumber: string | null; billDate: string | null;
        description: string; ratePercent: number; taxAmount: number;
      }>;
    }>;
    itemChanges?: Array<ItemRateChange & { linesBefore: LineCounts; linesAfter: LineCounts; outOfStep: OutOfStep }>;
    itemVsMaster?: ItemVsMaster[];
    totals: { changes: number; linesAffected: number; outOfStep: number; itemChanges?: number; itemVsMaster?: number };
    notes: string[];
  }>('rate-changes', '/gst/reports/rate-changes', q, on);

export interface CancelledInvoiceRow {
  billId: string; billNumber: string; invoiceNumber: string | null;
  billDate: string; cancelledAt: string; cancelledBy: string | null;
  reason: string | null; patientName: string | null; mrn: string | null;
  totalAmount: number; taxAmount: number;
  taxableValue: number; cgstAmount: number; sgstAmount: number; igstAmount: number;
  /** Gap 268: 'credit_note' when the voided bill was zeroed and the note holds the value. */
  valueSource?: 'bill' | 'credit_note';
  creditNotes: Array<{ creditNoteNumber: string; noteType?: string; taxableValue?: number; taxAmount: number; totalAmount: number }>;
  unreversed: boolean;
}

export const useCancelledInvoices = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    rows: CancelledInvoiceRow[];
    totals: { count: number; taxableValue: number; taxAmount: number; totalAmount: number; unreversed: number };
  }>('cancelled-invoices', '/gst/reports/cancelled-invoices', q, on);

// ── The annual return ──────────────────────────────────────────────────────

export interface Gstr9TableRow {
  ref: string;
  label: string;
  taxableValue?: number;
  amount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  source: string;
}

/**
 * GSTR-9 — the annual return, folded from the same monthly reports so it cannot
 * disagree with the twelve returns it summarises.
 */
export const useGstr9 = (financialYear: string | undefined, on = true) =>
  useReport<{
    financialYear: string;
    period: GstPeriod;
    tables: {
      table4: { label: string; rows: Gstr9TableRow[] };
      table5: { label: string; rows: Gstr9TableRow[]; total: number };
      table6: { label: string; rows: Gstr9TableRow[]; ladder: ItcLadderRung[] };
      table7: { label: string; rows: Gstr9TableRow[]; total: number };
      table9: { label: string; taxPayable: TaxTotals; taxPaid: null; note: string };
      table17: { label: string; rows: Array<Record<string, unknown>>; unclassified: TaxTotals; reportingDigits: number };
    };
    turnover: {
      grossOutward: number; taxableTurnover: number; exemptTurnover: number;
      totalTurnover: number; exemptRatioPercent: number;
    };
    documents: { invoices: number; lines: number; creditNotes: number; purchases: number; creditNotesExcluded?: number };
    /** Table 4 against the monthly returns, head by head (gap item 312). */
    monthlyCheck?: {
      label: string;
      annual: Record<'taxableValue' | 'cgstAmount' | 'sgstAmount' | 'igstAmount', number>;
      sumOfMonths: Record<'taxableValue' | 'cgstAmount' | 'sgstAmount' | 'igstAmount', number>;
      difference: Record<'taxableValue' | 'cgstAmount' | 'sgstAmount' | 'igstAmount', number>;
      agrees: boolean;
      months: Array<{ month: string; taxableValue: number; cgstAmount: number; sgstAmount: number; igstAmount: number; taxAmount: number }>;
      filed: { months: number; taxableValue?: number; cgstAmount?: number; sgstAmount?: number; igstAmount?: number };
      cgstSgstGap: number;
    };
    rateWise: RateSummaryRow[];
    reconciliation: {
      registerTaxableValue: number; registerTaxAmount: number; partsTaxableValue: number; agrees: boolean;
      /** 4I/4J/5H/5I, reported beside the gross check rather than inside it (gap 277). */
      notesTaxableValue?: number;
    };
    /** Table 5 (net of 5H/5I) against the months' 3.1(c) + 3.1(e) (gap 277). */
    table5Check?: {
      label: string; annual: number; sumOfMonths: number; difference: number; agrees: boolean;
      months: Array<{ month: string; taxableValue: number }>;
    };
    notes: string[];
  }>('gstr9', '/gst/reports/gstr9', { financialYear }, on);

/** GSTR-9C — the books side of the reconciliation, for the accountant. */
export const useGstr9c = (
  q: { financialYear?: string; auditedTurnover?: number },
  on = true,
) =>
  useReport<{
    financialYear: string;
    period: GstPeriod;
    turnover: {
      auditedTurnover: number | null;
      auditedTurnoverSource: string;
      declaredTurnover: number;
      declaredTurnoverSource: string;
      adjustments: Array<{ label: string; amount: number; source: string }>;
      unreconciledDifference: number | null;
    };
    taxableTurnover: Record<string, number>;
    inputTaxCredit: {
      perBooks: number; perBooksSource: string;
      ladder: ItcLadderRung[];
      claimedInReturns: null; claimedInReturnsSource: string;
    };
    unreconciled: string[];
    lines: number;
    notes: string[];
  }>('gstr9c', '/gst/reports/gstr9c', q as GstReportQuery, on);

/** C-1 — what the hospital BILLED, which is not what it collected. */
export const useDailyLiability = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    byDay: Array<{ day: string; taxableValue: number; exemptValue: number; taxAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number; lines: number; bills: number }>;
    byDepartment: Array<{ department: string; taxableValue: number; exemptValue: number; taxAmount: number; lines: number; bills: number }>;
    byRaisedBy: Array<{ raisedBy: string; taxableValue: number; exemptValue: number; taxAmount: number; lines: number; bills: number }>;
    totals: {
      bills: number; lines: number; taxableValue: number; exemptValue: number;
      cgstAmount: number; sgstAmount: number; igstAmount: number; taxAmount: number;
    };
    /** Gross, credit notes and net per rate; net = GSTR-3B 3.1(a) (gap item 276). */
    byRate?: Array<{ ratePercent: number; gross: LiabilityHeads; creditNotes: LiabilityHeads; net: LiabilityHeads }>;
    liability?: {
      gross: LiabilityHeads; creditNotes: LiabilityHeads; net: LiabilityHeads;
      gstr3bOutwardTax: number; agreesWithGstr3b: boolean; notesApplied: number;
      notesExcluded: NoteExclusions;
    };
    note: string;
  }>('daily-liability', '/gst/reports/daily-liability', q, on);

export interface LiabilityHeads {
  taxableValue: number; cgstAmount: number; sgstAmount: number; igstAmount: number; taxAmount: number;
}

/** Lock a filed period, or open it again. */
export function useSetPeriodLock() {
  const qc = useQueryClient();
  return useMutation({
    // Gap 281: reopening needs a correction reason (and an amendment role).
    mutationFn: async ({ id, locked, reason }: { id: string; locked: boolean; reason?: string | null }) =>
      (await apiPatch(`/gst/reports/filed-periods/${id}/lock`, { locked, reason: reason ?? null })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gst-report'] });
      qc.invalidateQueries({ queryKey: ['gst-filed-periods'] });
    },
  });
}

// ── Group D — e-invoice and e-way bill ─────────────────────────────────────
//
// These reports answer with an `applicability` block before they answer with
// rows, and the screen renders that FIRST. An empty e-invoice register means
// one of two opposite things — nothing was due, or nothing has been sent — and
// the rows alone cannot say which.

export interface EInvoiceApplicability {
  applicable: boolean;
  /** Correction 14's wording. Never a turnover figure. */
  statement: string;
  note: string;
  settingsPath: string;
}

export interface IrnRow {
  id: string;
  kind: 'invoice' | 'credit_note' | 'debit_note';
  documentNumber: string;
  documentDate: string;
  recipientName: string | null;
  recipientGstin: string | null;
  taxableValue: number;
  taxAmount: number;
  totalAmount: number;
  irn: string | null;
  ackNo: string | null;
  ackDate: string | null;
  status: string;
  error: string | null;
  attemptedAt: string | null;
  cancelledAt: string | null;
  daysToDeadline: number | null;
}

/** D-1 — E-invoice (IRN) Register. */
export const useEInvoiceRegister = (q: GstReportQuery & { status?: string }, on = true) =>
  useReport<{
    applicability: EInvoiceApplicability;
    summary: {
      required: number; registered: number; pending: number; failed: number;
      notSent: number; cancelled: number; totalValue: number; totalTax: number;
    };
    rows: IrnRow[];
    note: string;
  }>('einvoice-register', '/gst/reports/einvoice-register', q as GstReportQuery, on);

/** D-2 — Failed IRN Report. */
export const useFailedIrn = (q: GstReportQuery, on = true) =>
  useReport<{
    applicability: EInvoiceApplicability;
    uploadDays: number;
    summary: {
      outstanding: number; rejected: number; neverSent: number;
      awaiting: number; overdue: number; valueAtRisk: number;
    };
    rows: Array<IrnRow & { overdue: boolean; reason: string }>;
    note: string;
  }>('failed-irn', '/gst/reports/failed-irn', q, on);

export interface EwayRow {
  returnId: string;
  date: string;
  documentNumber: string;
  status: string;
  itemName: string;
  hsnCode: string | null;
  quantity: number;
  consignmentValue: number;
  supplierName: string | null;
  supplierGstin: string | null;
  destination: string | null;
  ewayBillNumber: string | null;
  ewayBillDate: string | null;
  billRequired: boolean;
}

/** D-3 — E-way Bill Register. */
export const useEwayBills = (q: GstReportQuery, on = true) =>
  useReport<{
    applicability: EInvoiceApplicability;
    threshold: number;
    summary: {
      movements: number; aboveThreshold: number; withBill: number;
      missingBill: number; totalValue: number;
    };
    rows: EwayRow[];
    note: string;
  }>('eway-bills', '/gst/reports/eway-bills', q, on);

// ── A-13 — amendments ──────────────────────────────────────────────────────
//
// Deliberately NOT keyed on the shared period picker. An amendment belongs to
// the return being prepared now and corrects an earlier one, so the filter here
// names the period being CORRECTED.

export interface AmendmentRow {
  table: '9A' | '9C' | '10';
  change: string;
  originalNumber: string;
  originalDate: string | null;
  originalPeriod: string;
  recipientGstin: string | null;
  placeOfSupply: string | null;
  filedValue: number | null;
  currentValue: number | null;
  filedTax: number | null;
  currentTax: number | null;
  difference: number;
  reason: string;
}

export const useGstr1Amendments = (q: { returnPeriod?: string }, on = true) =>
  useReport<{
    summary: {
      filedPeriods: number; comparablePeriods: number; amendments: number;
      table9A: number; table9C: number; table10: number; netValueChange: number;
    };
    periods: Array<{
      returnPeriod: string; filedAt: string; locked: boolean;
      status?: 'filed_locked' | 'filed_open'; filed?: FiledHeadline;
      comparable: boolean; amendments: number; note: string;
      /** Gap 281: what the diff is against — the original filing, or a later return's declaration. */
      baseline?: { kind: 'original' | 'declared'; inPeriod: string | null };
      /** Gap 281: reopens, corrections and re-locks of this period. */
      corrections?: Array<{ action: string; version: number | null; reason: string | null; at: string; by?: string | null }>;
    }>;
    rows: AmendmentRow[];
    note: string;
  }>('gstr1-amendments', '/gst/reports/gstr1-amendments', q as GstReportQuery, on);
