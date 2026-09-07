import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

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

export const useSalesRegister = (q: GstReportQuery, on = true) =>
  useReport<{ period: GstPeriod; rows: SalesLine[] }>('sales-register', '/gst/reports/sales-register', q, on);

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
    }>;
    threshold: number;
    totals: TaxTotals;
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
      exemptTurnover: { exempt: number; nilRated: number; nonGst: number; total: number };
      creditNotes: { count: number; taxableValue: number; taxAmount: number; notReportable: number; outsideTimeLimit: number };
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
    };
  }>('gstr1', '/gst/reports/gstr1', q, on);

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
    }>;
  }>('purchase-register', '/gst/reports/purchase-register', q, on);

export const useItcSummary = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    byRate: Array<{ ratePercent: number | null; count: number; taxableValue: number; taxAmount: number; landingTotal: number }>;
    bySupplier: Array<{ supplierId: string | null; supplierName: string | null; supplierGstin: string | null; count: number; taxableValue: number; taxAmount: number; landingTotal: number }>;
    totals: { count: number; taxableValue: number; taxAmount: number; landingTotal: number };
    withoutRate: number;
    coverage: string;
  }>('itc-summary', '/gst/reports/itc-summary', q, on);

export const useItcReversal = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    working: Array<{ step: string; label: string; amount: number; source: string }>;
    exemptRatioPercent: number;
    creditAvailable: number;
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
    }>;
    expiryWriteOffs: Array<{
      transactionId: string; date: string; itemName: string; supplierName: string | null;
      batchNumber: string | null; expiryDate: string | null; quantity: number; value: number;
    }>;
    totals: {
      returns: number; returnedValue: number; taxToReverse: number;
      withoutSupplierCreditNote: number; expiryWriteOffs: number; expiredValue: number;
    };
    notes: string[];
  }>('purchase-returns', '/gst/reports/purchase-returns', q, on);

// ── Group C — operational and control ──────────────────────────────────────

export const useDailyCollection = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    byDay: Array<{ day: string; collected: number; taxCollected: number; count: number }>;
    byMethod: Array<{ method: string; collected: number; taxCollected: number; count: number }>;
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

export const useCancelledInvoices = (q: GstReportQuery, on = true) =>
  useReport<{
    period: GstPeriod;
    rows: Array<{
      billId: string; billNumber: string; invoiceNumber: string | null;
      billDate: string; cancelledAt: string; cancelledBy: string | null;
      reason: string | null; patientName: string | null; mrn: string | null;
      totalAmount: number; taxAmount: number;
      creditNotes: Array<{ creditNoteNumber: string; taxAmount: number; totalAmount: number }>;
      unreversed: boolean;
    }>;
    totals: { count: number; taxAmount: number; totalAmount: number; unreversed: number };
  }>('cancelled-invoices', '/gst/reports/cancelled-invoices', q, on);
