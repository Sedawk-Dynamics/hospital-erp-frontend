import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/api';

// ============================================================
// Types — mirror Prisma schema (drug_formulary, drug_batches,
// dispensing_records, drug_returns) so the UI matches reality.
// ============================================================

export type DosageForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'injection'
  | 'cream'
  | 'drops'
  | 'inhaler'
  | 'other';

/**
 * Drug schedule under the Drugs & Cosmetics Rules 1945.
 *   X   strictest — prescription in duplicate, one copy retained, separate licence
 *   H1  prescription + a separate register kept for 3 years
 *   H   prescription drug
 *   H2  a named brand formulation carrying a QR/barcode obligation
 *   G   caution-label only — NOT a prescription drug
 *   OTC unscheduled
 */
export type DrugSchedule = 'X' | 'H1' | 'H' | 'H2' | 'G' | 'OTC';
export type GstTreatment = 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'zero_rated';

export interface FormularyItem {
  id: string;
  drugName: string;
  genericName: string | null;
  composition: string | null;
  manufacturer: string | null;
  // Stock type. Medicines and retail products share batches/POS, while only
  // medicines enter clinical drug workflows.
  category?: 'drug' | 'product' | 'consumable' | 'surgical_supply' | 'equipment' | 'other';
  productCategory?: string | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  unitOfMeasurement: string | null;
  price: number | string | null;
  // Loose / sub-unit sale + GST (per base unit). packSize = base units per pack.
  packSize: number | null;
  looseUnitLabel: string | null;
  taxPercent: number | string | null;
  gstTreatment?: GstTreatment | null;
  // Product Resolution Engine / compliance identity (GTIN-13 consumer unit,
  // GTIN-14 case + units-per-case, HSN code, manufacturer product code).
  gtin?: string | null;
  casePackGtin?: string | null;
  unitsPerCase?: number | null;
  hsnCode?: string | null;
  manufacturerCode?: string | null;
  indications: string | null;
  contraindications: string | null;
  // G9: reorder level (base units).
  minStock?: number | null;
  // Vital/life-saving — bypasses the IP cash-patient credit-clearance gate.
  isLifeSaving?: boolean;
  // NDPS narcotic — governed by the Form 3C/3E/3H accounting workflow.
  isNarcotic?: boolean;
  // ── Drug schedule (Drugs & Cosmetics Rules 1945), resolved by the classifier.
  // Two independent axes: `schedule` is what the counter must collect, while
  // `controlledClass` is which statutory register the drug appears in. Tramadol
  // is Schedule H1 AND a psychotropic — both are true at once.
  schedule?: DrugSchedule | null;
  // 'auto' classified from this drug's composition · 'inherited' from the
  // platform catalog · 'manual' a pharmacy admin overrode it.
  scheduleSource?: 'auto' | 'inherited' | 'manual' | null;
  /** Why this schedule was chosen — shown as the badge tooltip. */
  scheduleReason?: string | null;
  controlledClass?: 'narcotic' | 'psychotropic' | null;
  /** Requires physical safe custody + a witness co-sign. */
  vaultControlled?: boolean;
  /** Schedule H2 formulation — Rule 96(6)-(7) QR/barcode obligation. */
  requiresQrScan?: boolean;
  // TPA/cashless reimbursability (false = patient pays out-of-pocket).
  isReimbursable?: boolean;
  // Linked national-catalogue entry (null = manually added, not from catalogue).
  drugMasterId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  drugBatches?: Array<Pick<DrugBatch, 'id' | 'batchNumber' | 'expiryDate' | 'quantityInStock' | 'sellingPrice'>>;
  // Live stock summary (from getFormulary) — derived from available batches.
  totalStock?: number;
  batchCount?: number;
  inStock?: boolean;
  nearestExpiry?: string | null;
}

export interface DrugBatch {
  id: string;
  drugId: string;
  tenantId?: string;
  batchNumber: string;
  manufacturingDate: string | null;
  expiryDate: string;
  supplierId: string | null;
  // G2 purchase-side fields.
  mrp?: number | string | null;
  purchasePrice: number | string | null;
  purchaseDiscountPercent?: number | string | null;
  gstPercent?: number | string | null;
  freeQuantity?: number;
  sellingPrice: number | string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  quantityReceived: number;
  quantityInStock: number;
  isExpired: boolean;
  isRecalled: boolean;
  recallReason: string | null;
  // Barcode-driven traceability (spec Section 2): scannable code (internal Code-128
  // minted at inward, or a scanned pack barcode).
  barcode?: string | null;
  // GS1 DataMatrix serial (AI 21) captured at receipt.
  serialNumber?: string | null;
  // Where the batch physically sits. Printed on the label as text, never encoded
  // into the barcode — it is the one field that changes when stock moves.
  storageLocation?: string | null;
  createdAt: string;
  updatedAt: string;
  drug?: Pick<
    FormularyItem,
    | 'id' | 'drugName' | 'category' | 'genericName' | 'strength' | 'dosageForm'
    | 'packSize' | 'looseUnitLabel' | 'taxPercent'
  >;
  supplier?: { id: string; name: string } | null;
  // Derived purchase economics (G2) returned by the batch getters.
  economics?: BatchEconomics;
}

// G2: derived purchase economics for a batch (computed server-side).
export interface BatchEconomics {
  netRate: number | null;
  netPurchaseValue: number | null;
  taxAmount: number | null;
  landingPerUnit: number | null;
  marginPerUnit: number | null;
  marginPercent: number | null;
}

export interface DispenseRecord {
  id: string;
  tenantId?: string;
  prescriptionId: string;
  prescriptionItemId: string;
  patientId: string;
  drugBatchId: string;
  quantityDispensed: number;
  dispensedBy: string;
  dispensedAt: string;
  verifiedBy: string | null;
  notes: string | null;
  patient?: { id: string; firstName: string; lastName: string };
  drugBatch?: { id: string; batchNumber: string; drug?: { id: string; drugName: string; genericName?: string | null } };
  dispenser?: { id: string; firstName: string; lastName: string };
  verifier?: { id: string; firstName: string; lastName: string } | null;
}

export interface PharmacyReturn {
  /** Groups the lines of one multi-medicine vendor return (VR-YYYYMMDD-NNNN). */
  returnNumber?: string | null;
  returnGroupId?: string | null;
  id: string;
  returnType: 'patient_return' | 'vendor_return' | 'counter_return';
  drugBatchId: string | null;
  patientId: string | null;
  supplierId: string | null;
  quantity: number;
  reason: string | null;
  status: 'pending' | 'processed' | 'rejected';
  processedBy: string | null;
  createdAt: string;
  // Billing linkage (patient returns anchored to a counter sale).
  dispensingRecordId?: string | null;
  billId?: string | null;
  saleUnit?: 'pack' | 'loose' | null;
  unitPrice?: number | string | null;
  refundAmount?: number | string | null;
  refund?: { id: string; amount: number | string; status: string } | null;
  // counter_return: medicine + optional free-text batch/expiry, no patient.
  drugId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  drug?: { id: string; drugName: string } | null;
  drugBatch?: { id: string; batchNumber: string; drug?: { id: string; drugName: string } };
  patient?: { id: string; firstName: string; lastName: string };
  supplier?: { id: string; name: string };
  processor?: { id: string; firstName: string; lastName: string } | null;
}

// A patient's recent counter-sale line that still has units eligible for return.
export interface ReturnableDispense {
  id: string;
  drugName: string;
  looseUnitLabel: string | null;
  batchNumber: string | null;
  billId: string | null;
  billNumber: string | null;
  saleUnit: 'pack' | 'loose';
  unitPrice: number | null;
  quantityDispensed: number;
  remaining: number;
  // §4.4: line marked non-returnable on the bill — cannot be returned.
  nonReturnable?: boolean;
  dispensedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedParams {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FormularyQueryParams extends PaginatedParams {
  dosageForm?: DosageForm;
  isActive?: boolean | string;
  isNarcotic?: boolean;
  stockStatus?: 'in' | 'out';
  /** One schedule code. */
  schedule?: DrugSchedule;
  /** Drugs the NDPS list names, whatever their schedule. */
  controlled?: boolean;
}

export interface BatchQueryParams extends PaginatedParams {
  drugId?: string | null;
  isExpired?: boolean | string;
  isRecalled?: boolean | string;
  availableOnly?: boolean | string;
  /** Batches expiring on or before N days from now (already-expired included). */
  expiringInDays?: number;
}

// ============================================================
// Query Keys
// ============================================================

export const pharmacyKeys = {
  formulary: {
    all: ['pharmacy', 'formulary'] as const,
    list: (params?: FormularyQueryParams) => ['pharmacy', 'formulary', 'list', params] as const,
    detail: (id: string) => ['pharmacy', 'formulary', 'detail', id] as const,
  },
  batches: {
    all: ['pharmacy', 'batches'] as const,
    list: (params?: BatchQueryParams) => ['pharmacy', 'batches', 'list', params] as const,
    expiring: (params?: Record<string, unknown>) => ['pharmacy', 'batches', 'expiring', params] as const,
  },
  dispensing: {
    all: ['pharmacy', 'dispensing'] as const,
    list: (params?: Record<string, unknown>) => ['pharmacy', 'dispensing', 'list', params] as const,
    detail: (id: string) => ['pharmacy', 'dispensing', 'detail', id] as const,
  },
  returns: {
    all: ['pharmacy', 'returns'] as const,
    list: (params?: PaginatedParams) => ['pharmacy', 'returns', 'list', params] as const,
  },
};


// ============================================================
// Formulary Hooks
// ============================================================

export function useFormulary(params?: FormularyQueryParams) {
  return useQuery({
    queryKey: pharmacyKeys.formulary.list(params),
    queryFn: async () => {
      const response = await apiGet<FormularyItem[]>('/pharmacy/formulary', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useFormularyItem(id: string | null) {
  return useQuery({
    queryKey: pharmacyKeys.formulary.detail(id ?? ''),
    queryFn: async () => {
      const response = await apiGet<FormularyItem>(`/pharmacy/formulary/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export interface CreateFormularyInput {
  drugName: string;
  // Type of stock — the formulary holds consumables/surgical/equipment too.
  category?: 'drug' | 'product' | 'consumable' | 'surgical_supply' | 'equipment' | 'other';
  productCategory?: string | null;
  genericName?: string;
  composition?: string;
  manufacturer?: string;
  dosageForm?: DosageForm;
  strength?: string;
  unitOfMeasurement?: string;
  price?: number;
  packSize?: number;
  looseUnitLabel?: string;
  taxPercent?: number;
  gstTreatment?: GstTreatment | null;
  minStock?: number;
  // Product Resolution Engine / compliance identity. Nullable so an edit can
  // CLEAR a wrong GTIN (send null); create simply omits it when blank.
  gtin?: string | null;
  casePackGtin?: string | null;
  unitsPerCase?: number;
  hsnCode?: string;
  manufacturerCode?: string;
  indications?: string;
  contraindications?: string;
  isLifeSaving?: boolean;
  isNarcotic?: boolean;
  isReimbursable?: boolean;
  isActive?: boolean;
  // G1: set true to create even when a high-confidence near-duplicate exists.
  force?: boolean;
}

// G1: a candidate existing drug the inward typed name might be a duplicate of.
export interface FormularyMatch {
  id: string;
  drugName: string;
  genericName: string | null;
  /** Salt composition — a separate column from genericName on the formulary. */
  composition?: string | null;
  manufacturer: string | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  packSize: number | null;
  price: number | string | null;
  drugMasterId: string | null;
  totalStock: number;
  score: number;
  // 'formulary' = already in this hospital's list (map to it); 'catalog' = a
  // platform DrugMaster suggestion (pick → create/import + stock). Defaults to
  // 'formulary' when absent.
  source?: 'formulary' | 'catalog';
  hsnCode?: string | null;
  gtin?: string | null;
}

// useCreateFormularyItem returns either the created item, or — when the server
// detects a likely duplicate and the user didn't force — the suggestions.
export type CreateFormularyResult =
  | FormularyItem
  | { duplicateSuspected: true; matches: FormularyMatch[] };

export function isDuplicateSuspected(
  r: CreateFormularyResult,
): r is { duplicateSuspected: true; matches: FormularyMatch[] } {
  return (r as { duplicateSuspected?: boolean }).duplicateSuspected === true;
}

export function useCreateFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFormularyInput) => {
      const response = await apiPost<CreateFormularyResult>('/pharmacy/formulary', data);
      return response.data;
    },
    onSuccess: (data) => {
      // Only a real create touches the list — a duplicate prompt changed nothing.
      if (!isDuplicateSuspected(data)) {
        queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
        // The unified Storage list at /inventory reads ['inventory','stock',…].
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      }
    },
  });
}

// G1: live duplicate look-up for the add-drug dialog (debounce on the caller).
export interface FormularyMatchParams {
  name: string;
  genericName?: string;
  manufacturer?: string;
  strength?: string;
  dosageForm?: string;
  category?: CreateFormularyInput['category'];
  excludeId?: string;
}

export function useFormularyMatches(params: FormularyMatchParams, enabled = true) {
  return useQuery({
    queryKey: ['pharmacy', 'formulary', 'match', params],
    queryFn: async () => {
      const response = await apiGet<{ matches: FormularyMatch[] }>('/pharmacy/formulary/match', {
        params,
      });
      return response.data.matches;
    },
    enabled: enabled && !!params.name && params.name.trim().length >= 2,
    staleTime: 30_000,
  });
}

// G8: alternative brands sharing a drug's composition (for out-of-stock swaps).
export interface FormularyAlternative {
  id: string;
  drugName: string;
  category?: string | null;
  genericName: string | null;
  manufacturer: string | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  price: number | string | null;
  packSize: number | null;
  looseUnitLabel: string | null;
  totalStock: number;
  inStock: boolean;
  nearestExpiry: string | null;
}

export function useFormularyAlternatives(id: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'formulary', 'alternatives', id],
    queryFn: async () => {
      const response = await apiGet<{ composition: string | null; alternatives: FormularyAlternative[] }>(
        `/pharmacy/formulary/${id}/alternatives`,
      );
      return response.data;
    },
    enabled: !!id,
  });
}

// G1: merge a duplicate drug (sourceId) into the canonical one — consolidates
// stock that already split across two near-duplicate rows.
export function useMergeFormulary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, sourceId }: { targetId: string; sourceId: string }) => {
      const response = await apiPost(`/pharmacy/formulary/${targetId}/merge`, { sourceId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

// ============================================================
// G1 — Bulk stock inward (CSV / OCR / manual multi-row)
// ============================================================
// One incoming distributor-invoice line as the matcher sees it.
export interface InwardMatchLine {
  drugName: string;
  genericName?: string | null;
  // Salt composition — a separate field from genericName, scored on its own by
  // the matcher and carried onto a product created at inward.
  composition?: string | null;
  manufacturer?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  // Product Resolution Engine: GTIN scanned/parsed off the invoice line.
  gtin?: string | null;
  // A line can be a medicine (default — matched against the formulary) or any
  // other stock item (matched against inventory items); category is set for items.
  kind?: 'drug' | 'item';
  category?: string | null;
}

export type InwardRecommendation = 'map' | 'review' | 'create';
// How a line resolved to a drug, highest-confidence first (Product Resolution Engine).
export type InwardResolvedVia = 'gtin' | 'mapping' | 'similarity' | 'none';

// A scored line + its candidate existing drugs (for the side-by-side review).
export interface InwardMatchedLine {
  index: number;
  incoming: InwardMatchLine;
  matches: FormularyMatch[];
  recommendation: InwardRecommendation;
  resolvedVia: InwardResolvedVia;
  confidence: number;
  // GTIN-14 outer-case scan → this many consumer units per case.
  caseMultiplier: number;
  suggestedFormularyId: string | null;
}

// Step 1: score every incoming line against the formulary (no writes). The
// header supplier threads through so it can be recorded on each received batch.
export function useMatchInward() {
  return useMutation({
    mutationFn: async (payload: InwardMatchLine[] | { lines: InwardMatchLine[]; supplierId?: string }) => {
      const body = Array.isArray(payload) ? { lines: payload } : payload;
      const response = await apiPost<{ lines: InwardMatchedLine[] }>('/pharmacy/inward/match', body);
      return response.data.lines;
    },
  });
}

// ── OCR: a supplier invoice photo/PDF → inward lines (Gemini) ──
export interface OcrInvoiceLine {
  drugName: string;
  genericName?: string | null;
  manufacturer?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  unit?: string | null;
  gtin?: string | null;
  hsnCode?: string | null;
  packSize?: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  quantityReceived?: number | null;
  freeQuantity?: number | null;
  mrp?: number | null;
  purchasePrice?: number | null;
  purchaseDiscountPercent?: number | null;
  gstPercent?: number | null;
  sellingPrice?: number | null;
}

export interface OcrInwardResult {
  model: string;
  header: {
    supplierName?: string | null;
    supplierGstin?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
  };
  lines: OcrInvoiceLine[];
  warnings: string[];
  // Pre-scored match result (same shape as /inward/match) so the UI can jump
  // straight to the review step. Null when the server skipped matching.
  match: { lines: InwardMatchedLine[] } | null;
}

// Upload an invoice image/PDF; the backend OCRs it and (optionally) scores the
// lines through the same matcher as /inward/match. Multipart — pass a File.
export function useOcrInward() {
  return useMutation({
    mutationFn: async ({ file, supplierId, match }: { file: File; supplierId?: string; match?: boolean }) => {
      const form = new FormData();
      form.append('invoice', file);
      if (supplierId) form.append('supplierId', supplierId);
      if (match === false) form.append('match', 'false');
      // Clear the default application/json header so the browser sets
      // multipart/form-data with its boundary — otherwise multer sees no file
      // and the request 400s. (Same override the lab/imaging uploads use.)
      const response = await apiPost<OcrInwardResult>('/pharmacy/inward/ocr', form, {
        headers: { 'Content-Type': undefined },
      });
      return response.data;
    },
  });
}

// ── Scan at stock entry: one scan → a draft inward line ──
export type InwardScanVia = 'formulary_gtin' | 'drugmaster_gtin' | 'gs1' | 'none';

export interface InwardScanResult {
  resolvedVia: InwardScanVia;
  gtin: string | null;
  // GTIN-14 outer-case scan → this many consumer units per case.
  caseMultiplier: number;
  parsed: {
    gtin: string | null;
    batchNumber: string | null;
    expiryDate: string | null;
    manufacturingDate: string | null;
    serial: string | null;
  };
  // Set when the GTIN already maps to a tenant formulary drug (→ suggest 'map').
  suggestedFormularyId: string | null;
  // A ready-to-merge draft line (identity from formulary/catalog + parsed batch).
  line: {
    drugName: string;
    genericName: string | null;
    manufacturer: string | null;
    strength: string | null;
    dosageForm: string | null;
    gtin: string | null;
    hsnCode: string | null;
    packSize: number | null;
    batchNumber: string | null;
    expiryDate: string | null;
    manufacturingDate: string | null;
  };
}

export function useInwardScan() {
  return useMutation({
    mutationFn: async (code: string) =>
      (await apiGet<InwardScanResult>('/pharmacy/inward/scan', { params: { code } })).data,
  });
}

// Barcode-driven dispensing (spec Section 2): resolve one scan → product + batch.
export interface ScanResult {
  resolvedVia: 'gs1' | 'gtin' | 'batch';
  gtin: string | null;
  scannedBatchNumber: string | null;
  drug: {
    id: string;
    drugName: string;
    genericName: string | null;
    strength: string | null;
    dosageForm: string | null;
    packSize: number | null;
    looseUnitLabel: string | null;
    price: number | null;
    hsnCode: string | null;
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    manufacturingDate: string | null;
    sellingPrice: number | null;
    mrp: number | null;
    quantityInStock: number;
    barcode: string | null;
  } | null;
  totalStock: number;
}

export function useResolveScan() {
  return useMutation({
    mutationFn: async (code: string) =>
      (await apiGet<ScanResult>('/pharmacy/scan', { params: { code } })).data,
  });
}

// Automated compliance pre-check (HSN/GST/Schedule rules) before a sale.
export interface ComplianceResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  /**
   * Batches whose pack still has to be scanned — Schedule H2, the Rule
   * 96(6)-(7) anti-counterfeiting list. Returned structurally so the counter
   * can prompt for exactly these; matching on the message text would break the
   * first time the wording changed.
   */
  needsScan?: { drugBatchId: string; drugName: string }[];
}

export function useCheckSaleCompliance() {
  return useMutation({
    mutationFn: async (payload: {
      items: { drugBatchId: string; scannedCode?: string | null }[];
      prescriptionId?: string;
      externalPrescriptionId?: string;
    }) =>
      (await apiPost<ComplianceResult>('/pharmacy/sales/compliance-check', payload)).data,
  });
}

// A reviewed line: the user's map-or-create decision + the batch to receive.
export interface CommitInwardLine extends InwardMatchLine {
  action: 'map' | 'create';
  // Required when action === 'map' — the existing drug (medicine) to add stock to.
  targetFormularyId?: string;
  // Required when action === 'map' for an item line — the existing inventory item.
  targetInventoryItemId?: string;
  // Set on a 'create' line seeded from the DrugMaster catalog — links the new
  // formulary row to the catalog drug.
  drugMasterId?: string;
  // Raw distributor line text stored as the learned-mapping key (defaults to drugName).
  externalName?: string;
  packSize?: number;
  looseUnitLabel?: string;
  // Full product-definition fields carried onto a newly-created product.
  minStock?: number;
  description?: string;
  // Product Resolution Engine identity carried onto a newly-created drug.
  hsnCode?: string;
  manufacturerCode?: string;
  // Batch + expiry required for medicines; optional for other items.
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  // Total units received (paid + free); freeQuantity is the free portion of it.
  quantityReceived: number;
  freeQuantity?: number;
  mrp?: number;
  purchasePrice?: number;
  purchaseDiscountPercent?: number;
  gstPercent?: number;
  sellingPrice?: number;
  supplierId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  addToExisting?: boolean;
}

export interface CommitInwardInput {
  supplierId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  // G2: whole-invoice (total-bill) purchase discount on top of per-line discounts.
  invoiceDiscountPercent?: number;
  invoiceDiscountAmount?: number;
  addToExisting?: boolean;
  lines: CommitInwardLine[];
}

export interface CommitInwardResult {
  total: number;
  createdDrugs: number;
  mappedDrugs: number;
  batchesIn: number;
  failed: number;
  results: Array<{
    index: number;
    drugName: string;
    action: 'map' | 'create';
    status: 'ok' | 'error';
    formularyId?: string;
    batchId?: string;
    message?: string;
  }>;
  // G2: invoice purchase economics (gross → −line disc → −bill disc → net).
  purchaseSummary?: {
    grossValue: number;
    lineDiscount: number;
    invoiceDiscountPercent: number;
    invoiceDiscount: number;
    netValue: number;
  };
}

// Step 2: commit the reviewed map-or-create decisions and post the stock.
export function useCommitInward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CommitInwardInput) => {
      const response = await apiPost<CommitInwardResult>('/pharmacy/inward/commit', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

// Import a drug from the platform DrugMaster catalog into this tenant's
// formulary (one-click "add to formulary"). Backend dedupes on drugMasterId.
// G11: suggest an unlisted brand for addition to the national drug master. Lands
// as an unpublished suggestion a platform admin reviews. Open to pharmacy users.
export function useSuggestDrugMaster() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      genericName?: string | null;
      manufacturer?: string | null;
      strength?: string | null;
      dosageForm?: string | null;
    }) => {
      const response = await apiPost('/drug-master/suggest', data);
      return response.data;
    },
  });
}

export function useImportFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { drugMasterId: string; price?: number }) => {
      const response = await apiPost<FormularyItem>('/pharmacy/formulary/import', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

// ── Tenant catalog browse (platform DrugMaster + imported flag) ──
export interface CatalogItem {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  packSizeLabel: string | null;
  // Numeric base units per pack/strip (e.g. 10). Null = indivisible container.
  packSize: number | null;
  mrp: number | string | null;
  schedule: string | null;
  type: string | null;
  rxRequired?: boolean | null;
  productCategory?: string | null;
  hsnCode?: string | null;
  gstRate?: number | string | null;
  gstTreatment?: GstTreatment | null;
  imported: boolean;
  formularyId: string | null;
}

export interface CatalogQueryParams extends PaginatedParams {
  dosageForm?: DosageForm;
  schedule?: string;
  imported?: 'yes' | 'no';
}

export function usePharmacyCatalog(params?: CatalogQueryParams, enabled = true) {
  return useQuery({
    queryKey: ['pharmacy', 'catalog', params],
    queryFn: async () => {
      const response = await apiGet<CatalogItem[]>('/pharmacy/catalog', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
    enabled,
  });
}

// Bulk copy many catalog drugs into the formulary in one call (dedupes server-side).
export function useImportFormularyBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { drugMasterIds: string[] }) => {
      const response = await apiPost<{ requested: number; created: number; skipped: number }>(
        '/pharmacy/formulary/import-bulk',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useUpdateFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateFormularyInput>) => {
      const response = await apiPut<FormularyItem>(`/pharmacy/formulary/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.detail(variables.id) });
      // Refresh the unified Storage list at /inventory.
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
    },
  });
}

export function useDeleteFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/pharmacy/formulary/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
    },
  });
}

// ============================================================
// Batch Hooks
// ============================================================

export function useBatches(params?: BatchQueryParams) {
  return useQuery({
    queryKey: pharmacyKeys.batches.list(params),
    queryFn: async () => {
      const response = await apiGet<DrugBatch[]>('/pharmacy/batches', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

/**
 * Printable label data for a set of batches — the Code-128 and DataMatrix
 * payloads plus the human-readable text. One request for the whole sheet, so a
 * full inward run prints without a round-trip per label.
 */
export function useBatchLabels(batchIds: string[]) {
  const ids = [...batchIds].sort();
  return useQuery({
    queryKey: ['pharmacy', 'batches', 'labels', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const response = await apiGet<BatchLabelData[]>('/pharmacy/batches/labels', {
        params: { batchIds: ids.join(',') },
      });
      return response.data;
    },
  });
}

export interface BatchLabelData {
  batchId: string;
  drugName: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  category: string | null;
  batchNumber: string;
  expiryDate: string;
  mrp: number | null;
  sellingPrice: number | null;
  storageLocation: string | null;
  code128: string;
  dataMatrix: string;
  dataMatrixFormat: 'gs1datamatrix' | 'datamatrix';
}

export function useBatchesByDrug(drugId: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'batches', 'byDrug', drugId],
    queryFn: async () => {
      const response = await apiGet<DrugBatch[]>('/pharmacy/batches', {
        params: { drugId, availableOnly: true, limit: 50 },
      });
      return response.data;
    },
    enabled: !!drugId,
  });
}

export function useExpiringBatches(params?: { days?: number; page?: number; limit?: number }) {
  return useQuery({
    queryKey: pharmacyKeys.batches.expiring(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<DrugBatch[]>('/pharmacy/batches/expiring', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export interface CreateBatchInput {
  drugId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate: string;
  supplierId?: string;
  // G2 purchase-side discount structure.
  mrp?: number;
  purchasePrice?: number;
  purchaseDiscountPercent?: number;
  gstPercent?: number;
  freeQuantity?: number;
  sellingPrice?: number;
  quantityReceived: number;
  // Barcode traceability: scanned pack barcode + DataMatrix serial.
  barcode?: string;
  serialNumber?: string;
  // Put-away position, printed on the shelf label as text.
  storageLocation?: string | null;
  // GRN invoice traceability + duplicate-batch "Increase Quantity".
  invoiceNumber?: string;
  invoiceDate?: string;
  addToExisting?: boolean;
}

// Remember an unknown barcode against a chosen drug (stock-entry fallback).
export function useAttachBarcode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { gtin: string; drugId: string }) =>
      (await apiPost<{ ok: boolean; gtin: string; drugId: string }>('/pharmacy/barcodes/attach', data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all }),
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBatchInput) => {
      const response = await apiPost<DrugBatch>('/pharmacy/batches', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

export interface UpdateBatchInput {
  batchNumber?: string;
  manufacturingDate?: string | null;
  expiryDate?: string;
  supplierId?: string | null;
  mrp?: number | null;
  purchasePrice?: number | null;
  purchaseDiscountPercent?: number | null;
  gstPercent?: number | null;
  sellingPrice?: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  quantityInStock?: number;
  isExpired?: boolean;
  isRecalled?: boolean;
  recallReason?: string | null;
  // Re-racking is routine, so location is editable after receipt.
  storageLocation?: string | null;
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateBatchInput) => {
      const response = await apiPut<DrugBatch>(`/pharmacy/batches/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      // A stock / expiry edit changes the formulary's derived in-stock view.
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

// G4: deliberate stock-count correction (reason-stamped + audited).
export function useAdjustBatchStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      newQuantity,
      physicalCount,
      reason,
    }: {
      id: string;
      newQuantity?: number;
      physicalCount?: number;
      reason: string;
    }) => {
      const response = await apiPatch<{ from: number; to: number; delta: number }>(
        `/pharmacy/batches/${id}/adjust`,
        { newQuantity, physicalCount, reason },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'stock-adjustments'] });
    },
  });
}

// G4: stock discrepancy report — manual corrections in a date window.
export interface StockAdjustment {
  id: string;
  batchId: string;
  drugName: string | null;
  batchNumber: string | null;
  from: number | null;
  to: number | null;
  delta: number | null;
  physicalCount: number | null;
  reason: string | null;
  user: string | null;
  createdAt: string;
}

export function useStockAdjustments(params?: {
  fromDate?: string;
  toDate?: string;
  drugId?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['pharmacy', 'stock-adjustments', params],
    queryFn: async () => {
      const response = await apiGet<StockAdjustment[]>('/pharmacy/batches/adjustments', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

// G4: physical stock-take — reconcile counted quantities into audited corrections.
export interface StockTakeResult {
  total: number;
  matched: number;
  adjusted: number;
  failed: number;
  netDelta: number;
  valueDelta: number;
  results: Array<{
    batchId: string;
    drugName: string | null;
    batchNumber: string | null;
    system: number;
    counted: number;
    delta: number;
    valueDelta: number;
    status: 'matched' | 'adjusted' | 'error';
    message?: string;
  }>;
}

export function useReconcileStockTake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      reason: string;
      lines: Array<{ batchId: string; countedQuantity: number; reason?: string }>;
    }) => {
      const response = await apiPost<StockTakeResult>('/pharmacy/stock-take/reconcile', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'stock-adjustments'] });
    },
  });
}

// Idempotent maintenance sweep: flags every past-expiry batch as expired so
// the POS / dispensing guards block them. Returns the count flagged.
export function useFlagExpiredBatches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiPost<{ flagged: number }>('/pharmacy/maintenance/flag-expired', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

// G5: run the full expiry check now — flag expired batches + dispatch near-expiry
// alerts to the configured recipients (the daily job does this automatically).
export function useRunPharmacyExpiryAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiPost<{ expiredFlagged: number; expiryAlerts: number }>(
        '/pharmacy/maintenance/run-expiry-alerts',
        {},
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

// ============================================================
// Dispensing Hooks
// ============================================================

export interface DispenseQueryParams extends PaginatedParams {
  patientId?: string;
  fromDate?: string;
  toDate?: string;
}

export function useDispenseRecords(params?: DispenseQueryParams) {
  return useQuery({
    queryKey: pharmacyKeys.dispensing.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<DispenseRecord[]>('/pharmacy/dispensing', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export interface CreateDispenseItem {
  prescriptionItemId: string;
  drugBatchId: string;
  quantity: number;
}

export interface CreateDispenseInput {
  patientId: string;
  prescriptionId: string;
  items: CreateDispenseItem[];
  notes?: string;
}

export function useCreateDispense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDispenseInput) => {
      // Backend dispenses one prescription-item ↔ batch pair at a time.
      // Loop the cart and POST one record per item, all under the same
      // prescription so the queue can mark it dispensed afterward.
      const results: DispenseRecord[] = [];
      for (const item of data.items) {
        const response = await apiPost<DispenseRecord>('/pharmacy/dispensing', {
          patientId: data.patientId,
          prescriptionId: data.prescriptionId,
          prescriptionItemId: item.prescriptionItemId,
          drugBatchId: item.drugBatchId,
          quantityDispensed: item.quantity,
          notes: data.notes,
        });
        results.push(response.data);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.dispensing.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });
}

// ============================================================
// Counter Billing (POS sale) Hooks
// ============================================================

export interface PharmacySaleItemInput {
  drugBatchId: string;
  /**
   * The QR/barcode read off a Schedule H2 pack — the Rule 96(6)-(7)
   * anti-counterfeiting check. Optional: most drugs are not on that list, and
   * the obligation is advisory until a hospital sets qrScanMode to 'require'.
   * Stored against the sale so the check can be evidenced afterwards.
   */
  scannedCode?: string;
  prescriptionItemId?: string;
  quantity: number;
  saleUnit?: 'pack' | 'loose';
  discountPercent?: number;
  unitPrice?: number;
  // §4.4: mark this line non-returnable on the bill (no patient return).
  nonReturnable?: boolean;
}

export type PharmacyPaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'debit_card'
  | 'upi'
  | 'net_banking'
  | 'insurance'
  // G7: deduct from an admitted IP patient's prepaid advance.
  | 'advance'
  | 'cheque'
  | 'other';

// G7: a single tender in a split payment.
export interface PharmacyTenderInput {
  method: PharmacyPaymentMethod;
  amount: number;
  reference?: string;
}

export interface CreatePharmacySaleInput {
  patientId?: string;
  prescriptionId?: string;
  /** A paper prescription captured at the counter — the other way a sale can
   *  be prescription-backed. */
  externalPrescriptionId?: string;
  /** Second person co-signing a vault-narcotic hand-over. */
  witnessedById?: string;
  /** That person's OWN password, proving they were present. Never stored. */
  witnessPassword?: string;
  items: PharmacySaleItemInput[];
  // G2: bill-level discount, applied on top of per-item discounts.
  billDiscountPercent?: number;
  billDiscountAmount?: number;
  paymentMethod?: 'cash' | 'credit_card' | 'debit_card' | 'upi' | 'net_banking' | 'cheque' | 'other';
  amountPaid?: number;
  // G7: split payment — overrides paymentMethod/amountPaid when present.
  payments?: PharmacyTenderInput[];
  // TTO — flags the sale as discharge / take-home medication (full packs).
  isTto?: boolean;
  notes?: string;
}

export interface PharmacyBillItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  discountPercent: number | string;
  discountAmount: number | string;
  taxPercent: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  // What the line was classified as. Rule 46 wants the code against the line it
  // belongs to, and the receipt is the paper that goes out with the medicine.
  hsnSacCode?: string | null;
  gstTreatment?: string | null;
}

/** The GST block carried on a counter-sale receipt. Mirrors the server's. */
export interface PharmacySaleGst {
  registered: boolean;
  documentType: string | null;
  documentLabel: string | null;
  invoiceNumbers: string[];
  financialYear: string | null;
  supplierGstin: string | null;
  supplierStateName: string | null;
  recipientGstin: string | null;
  placeOfSupplyStateCode: string | null;
  placeOfSupplyStateName: string | null;
  isInterState: boolean;
  hasTax: boolean;
  hasClassifiedLines: boolean;
  taxSummary: Array<{
    label: string;
    treatment: string;
    ratePercent: number;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    taxAmount: number;
  }>;
  notes: string[];
  totals: {
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    taxAmount: number;
  };
  /** Section 10.1 item 8 — the tax written out. */
  taxAmountInWords: string;
  /** Rule 46's copy marking, for the title band. */
  copyMarking: string | null;
}

export interface PharmacySale {
  bill: {
    id: string;
    billNumber: string;
    billDate: string;
    subtotal: number | string;
    discountAmount: number | string;
    taxAmount: number | string;
    totalAmount: number | string;
    amountPaid: number | string;
    balanceDue: number | string;
    /** Section 6.9's round-off, so the printed total agrees with the lines. */
    roundOff?: number | string | null;
    status: string;
    patient?: {
      id: string;
      mrn: string;
      firstName: string;
      lastName: string | null;
      gender: string | null;
      dateOfBirth: string | null;
      phone: string | null;
    };
    billItems: PharmacyBillItem[];
    payments: Array<{ id: string; amount: number | string; paymentMethod: string; paymentDate: string }>;
    generator?: { id: string; firstName: string; lastName: string } | null;
  };
  /**
   * What this paper IS — assembled server-side by the same function the IP and
   * OP bills use, so all three documents name themselves the same way. The
   * receipt used to decide for itself and always said "tax invoice".
   */
  gst?: PharmacySaleGst;
  hospital: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

// Bill an entire cart as ONE invoice (partial / loose / walk-in / GST / payment).
export interface SalePreviewLine {
  drugBatchId: string;
  drugName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  hsnSacCode: string | null;
  gstTreatment: string;
  taxRatePercent: number;
  taxableValue: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  taxReason: string;
}

export interface SalePreview {
  lines: SalePreviewLine[];
  /**
   * Reasons this cart cannot be billed as it stands — an unclassified medicine,
   * or one priced at a rate that is not a legal GST slab. The sale itself
   * refuses both; the preview reports them so the counter finds out while there
   * is still time to fix it, rather than with the patient standing there.
   */
  blockers?: string[];
  totals: {
    taxableValue: number; cgstAmount: number; sgstAmount: number;
    igstAmount: number; taxAmount: number; totalAmount: number;
  };
}

/**
 * Price the cart on the SERVER while the cashier is still building it.
 *
 * The POS used to work its own GST out in the browser, falling back to a bare
 * 12% for a drug with no rate — not a rate any medicine carries after GST 2.0,
 * and the common case rather than the rare one. The cashier quoted one figure
 * and the receipt printed another.
 *
 * This asks the same resolver the sale itself runs, so the quote IS the bill.
 * Debounced by the query key: a cart that has not changed is not re-priced.
 */
export function useSalePreview(
  items: Array<{
    drugBatchId: string; quantity: number; saleUnit?: 'pack' | 'loose';
    unitPrice?: number; discountPercent?: number;
  }>,
  enabled = true,
) {
  return useQuery({
    queryKey: ['pharmacy', 'sale-preview', items],
    queryFn: async () =>
      (await apiPost<SalePreview>('/pharmacy/sales/preview', { items })).data,
    enabled: enabled && items.length > 0,
    // The cart is the truth; a stale price is worse than none.
    staleTime: 0,
  });
}

export function useCreatePharmacySale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePharmacySaleInput) => {
      const response = await apiPost<PharmacySale>('/pharmacy/sales', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.dispensing.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });
}

export function usePharmacySale(billId: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'sales', billId],
    queryFn: async () => {
      const response = await apiGet<PharmacySale>(`/pharmacy/sales/${billId}`);
      return response.data;
    },
    enabled: !!billId,
  });
}

// ── Counter-sale list + void (Transactions page) ──────────────

export type PharmacySaleStatus = 'paid' | 'partially_paid' | 'pending' | 'cancelled';

// One row in the counter-sale list (a pharmacy PH- invoice).
export interface PharmacySaleListItem {
  id: string;
  billNumber: string;
  billDate: string;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  status: PharmacySaleStatus;
  patient?: { id: string; mrn: string; firstName: string; lastName: string | null } | null;
  generator?: { id: string; firstName: string; lastName: string } | null;
  _count?: { billItems: number };
}

// Period roll-up returned alongside the list (rendered as summary cards).
export interface PharmacySalesSummary {
  totalBills: number;
  salesCount: number;
  totalAmount: number;
  totalPaid: number;
  cancelledCount: number;
}

export interface PharmacySalesParams extends PaginatedParams {
  status?: PharmacySaleStatus;
  fromDate?: string;
  toDate?: string;
}

export function usePharmacySales(params?: PharmacySalesParams) {
  return useQuery({
    queryKey: ['pharmacy', 'sales', 'list', params],
    queryFn: async () => {
      const response = await apiGet<PharmacySaleListItem[]>('/pharmacy/sales', { params });
      const meta = response.meta as (PaginationMeta & { summary?: PharmacySalesSummary }) | undefined;
      return { data: response.data, meta, summary: meta?.summary };
    },
  });
}

// Void a counter sale — restores stock + reverses the counter payment.
export function useCancelPharmacySale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiPatch<PharmacySale>(`/pharmacy/sales/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'sales'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.dispensing.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });
}

// ============================================================
// Returns Hooks
// ============================================================

export function useReturns(params?: PaginatedParams & { status?: string; returnType?: string }) {
  return useQuery({
    queryKey: pharmacyKeys.returns.list(params),
    queryFn: async () => {
      const response = await apiGet<PharmacyReturn[]>('/pharmacy/returns', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      returnType: 'patient_return' | 'vendor_return' | 'counter_return';
      // A controlled return is witnessed when it is taken back — returns apply
      // immediately, so there is no later approve step to witness at.
      witnessedById?: string;
      witnessPassword?: string;
      // Optional when dispensingRecordId is supplied — the batch is taken from
      // the original sale line.
      drugBatchId?: string;
      dispensingRecordId?: string;
      patientId?: string;
      supplierId?: string;
      // counter_return: the medicine + optional free-text batch / expiry.
      drugId?: string;
      batchNumber?: string;
      expiryDate?: string;
      saleUnit?: 'pack' | 'loose';
      quantity: number;
      reason?: string;
      // Money handed back to the customer on a patient return — overrides the
      // billed price and is refunded against the original bill.
      refundAmount?: number;
      // G5: vendor (expired/damaged) return supplier credit note.
      creditNoteNumber?: string;
      creditAmount?: number;
    }) => {
      const response = await apiPost<PharmacyReturn>('/pharmacy/returns', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.returns.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'returnable'] });
    },
  });
}

export interface VendorReturnLineInput {
  drugBatchId: string;
  quantity: number;
  creditAmount?: number;
  reason?: string;
}

export interface VendorReturnBatchResult {
  returnGroupId: string;
  returnNumber: string;
  supplier: { id: string; name: string };
  creditNoteNumber: string | null;
  creditAmount: number;
  lineCount: number;
  totalQuantity: number;
}

/**
 * Vendor return covering several medicines at once — one supplier, one credit
 * note, many batches. The single-line `useCreateReturn` stays for patient and
 * counter returns, which are genuinely one medicine at a time.
 */
export function useCreateVendorReturnBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      supplierId: string;
      creditNoteNumber?: string;
      creditAmount?: number;
      reason?: string;
      lines: VendorReturnLineInput[];
    }) => {
      const response = await apiPost<VendorReturnBatchResult>('/pharmacy/vendor-returns/batch', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.returns.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export interface ReturnablePatient {
  id: string;
  mrn: string | null;
  firstName: string;
  lastName: string | null;
}

// Returnable counter-sale lines — drives the patient-return picker. G3: look up
// either by patient or by presenting the physical bill (billNumber).
export function useReturnableDispenses(params: {
  patientId?: string | null;
  billNumber?: string | null;
}) {
  const { patientId, billNumber } = params;
  return useQuery({
    queryKey: ['pharmacy', 'returnable', patientId ?? null, billNumber ?? null],
    queryFn: async () => {
      const response = await apiGet<{
        items: ReturnableDispense[];
        total: number;
        patient?: ReturnablePatient | null;
      }>('/pharmacy/returnable', {
        params: { patientId: patientId || undefined, billNumber: billNumber || undefined },
      });
      return response.data;
    },
    enabled: !!patientId || !!billNumber,
  });
}

// G3: full return record + hospital header for the acknowledgement receipt.
export interface ReturnReceipt {
  return: PharmacyReturn & {
    drugBatch?: { id: string; batchNumber: string; expiryDate?: string; drug?: { id: string; drugName: string; looseUnitLabel?: string | null } };
    drug?: { id: string; drugName: string; looseUnitLabel?: string | null } | null;
    patient?: { id: string; mrn?: string | null; firstName: string; lastName: string | null; phone?: string | null };
  };
  billNumber: string | null;
  hospital: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

export function useReturnDetail(id: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'returns', 'detail', id],
    queryFn: async () => {
      const response = await apiGet<ReturnReceipt>(`/pharmacy/returns/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// OP pre-packing — Stock Hold / Pre-Packed (spec OP Step 1).
export interface StockHold {
  id: string;
  status: 'held' | 'collected' | 'released';
  createdAt: string;
  collectedAt: string | null;
  patient: { mrn: string; name: string } | null;
  notes: string | null;
  items: Array<{ id: string; drugName: string; strength: string | null; batchNumber: string | null; quantity: number; unitPrice: number | null }>;
  total: number;
}

export function useStockHolds(params: { status?: string; patientId?: string } = {}) {
  return useQuery({
    queryKey: ['pharmacy', 'holds', params],
    queryFn: async () => (await apiGet<{ items: StockHold[]; total: number }>('/pharmacy/holds', { params })).data,
  });
}

export function usePrePackHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { patientId?: string; prescriptionId?: string; notes?: string; items: { drugBatchId: string; quantity: number }[] }) =>
      (await apiPost('/pharmacy/holds', body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'holds'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useCollectHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payments }: { id: string; payments?: { method: string; amount: number }[] }) =>
      (await apiPatch(`/pharmacy/holds/${id}/collect`, { payments })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'holds'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useReleaseHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiPatch(`/pharmacy/holds/${id}/release`, {})).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'holds'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useProcessReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'processed' | 'rejected' }) => {
      const response = await apiPatch<PharmacyReturn>(`/pharmacy/returns/${id}/process`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.returns.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

// ============================================================
// Prescription Queue (incoming e-prescriptions for the pharmacy)
// ============================================================

export type PharmacyOrderStatus = 'ordered' | 'preparing' | 'ready' | 'collected';
export type IpBillingCategory = 'cash' | 'package' | 'insurance' | 'corporate';

export interface PrescriptionListItem {
  id: string;
  status: 'active' | 'dispensed' | 'partially_dispensed' | 'cancelled';
  prescriptionType: 'op' | 'ip';
  // G12: ward→pharmacy fulfilment stage (null = ordered).
  pharmacyStatus: PharmacyOrderStatus | null;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  visit?: {
    id: string;
    visitDate: string;
    visitType: string;
    // G12: IP context — billing category (collect payment?) + ward/bed.
    admission?: {
      id: string;
      billingCategory: IpBillingCategory | null;
      ward?: { id: string; name: string } | null;
      bed?: { id: string; bedNumber: string } | null;
      /**
       * ip | emergency | daycare. All three are the same IP flow, so all three
       * already reach this queue — the tag is what lets the counter tell an
       * emergency order apart from a planned one.
       */
      admissionType?: string | null;
    } | null;
  };
  prescriptionItems: Array<{
    id: string;
    drugId: string | null;
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string | null;
    route: string;
    instructions: string | null;
    // Per-intake dose multiplier (units each occasion, default 1). Used to
    // re-derive the dispense count when `quantity` isn't stored.
    doseQuantity: number | string | null;
    quantity: number | null;
    isPrn: boolean;
    // Pack/loose config from the stocked drug (null for free-text items) — lets
    // the queue break the total into packs + loose units.
    drug?: {
      packSize: number | null;
      looseUnitLabel: string | null;
      dosageForm: string | null;
      price?: number | string | null;
      // Stock type, so the queue and the cart can badge non-medicines.
      category?: string | null;
      // Control profile, so the cart can say what a line requires before the
      // cashier tries to bill it.
      schedule?: DrugSchedule | null;
      controlledClass?: 'narcotic' | 'psychotropic' | null;
      vaultControlled?: boolean;
    } | null;
  }>;
  // Progress notes a doctor linked to this prescription (visible to anyone who
  // can view the prescription).
  progressNotes?: Array<{
    id: string;
    createdAt: string;
    noteType: string | null;
    content: string;
    doctor?: { user?: { firstName: string; lastName: string } | null } | null;
  }>;
}

export interface PrescriptionQueueParams extends PaginatedParams {
  patientId?: string;
  doctorId?: string;
  status?: 'active' | 'dispensed' | 'partially_dispensed' | 'cancelled' | 'pending';
  prescriptionType?: 'op' | 'ip';
  pharmacyStatus?: PharmacyOrderStatus;
  dispensed?: boolean | string;
  fromDate?: string;
  toDate?: string;
}

// ============================================================
// G15 — Mandatory reports
// ============================================================
export function useDailyTransactionReport(date?: string) {
  return useQuery({
    queryKey: ['pharmacy', 'reports', 'daily', date ?? null],
    queryFn: async () => (await apiGet<any>('/pharmacy/reports/daily-transactions', { params: { date } })).data,
  });
}
export function usePurchaseReport(params: { fromDate?: string; toDate?: string; supplierId?: string }) {
  return useQuery({
    queryKey: ['pharmacy', 'reports', 'purchases', params],
    queryFn: async () => (await apiGet<any>('/pharmacy/reports/purchases', { params })).data,
  });
}
export function useStockValuationReport() {
  return useQuery({
    queryKey: ['pharmacy', 'reports', 'valuation'],
    queryFn: async () => (await apiGet<any>('/pharmacy/reports/stock-valuation')).data,
  });
}
export function useVendorWiseReport(supplierId?: string) {
  return useQuery({
    queryKey: ['pharmacy', 'reports', 'vendor-wise', supplierId ?? null],
    queryFn: async () => (await apiGet<any>('/pharmacy/reports/vendor-wise', { params: { supplierId } })).data,
  });
}
export function useCreditNotesReport(params: { fromDate?: string; toDate?: string; supplierId?: string }) {
  return useQuery({
    queryKey: ['pharmacy', 'reports', 'credit-notes', params],
    queryFn: async () => (await apiGet<any>('/pharmacy/reports/credit-notes', { params })).data,
  });
}
// G17: narcotic / controlled-drug register (DI audit) — by user + date range.
export function useNarcoticRegister(params: { fromDate?: string; toDate?: string; dispensedBy?: string; schedule?: string }) {
  return useQuery({
    queryKey: ['pharmacy', 'reports', 'narcotic', params],
    queryFn: async () => (await apiGet<any>('/pharmacy/reports/narcotic-register', { params })).data,
  });
}
// G9: reorder list — drugs at/below their reorder level (draft purchase order).
export function useReorderList() {
  return useQuery({
    queryKey: ['pharmacy', 'reports', 'reorder'],
    queryFn: async () => (await apiGet<any>('/pharmacy/reports/reorder')).data,
  });
}

// G9: draft purchase orders for drugs.
export interface DrugPurchaseOrderItem {
  id: string;
  drugId: string;
  quantityOrdered: number;
  drug?: { id: string; drugName: string; strength: string | null; manufacturer: string | null };
}

export interface DrugPurchaseOrder {
  id: string;
  supplierId: string | null;
  orderNumber: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  notes: string | null;
  createdAt: string;
  supplier?: { id: string; name: string; gstNumber: string | null; phone: string | null } | null;
  items: DrugPurchaseOrderItem[];
}

export function useDrugPurchaseOrders(status?: string) {
  return useQuery({
    queryKey: ['pharmacy', 'purchase-orders', status ?? 'all'],
    queryFn: async () =>
      (await apiGet<DrugPurchaseOrder[]>('/pharmacy/purchase-orders', {
        params: status ? { status } : undefined,
      })).data,
  });
}

const invalidatePOs = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['pharmacy', 'purchase-orders'] });
  qc.invalidateQueries({ queryKey: ['pharmacy', 'reports', 'reorder'] });
};

export function useGeneratePurchaseOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await apiPost<{ created: number; skipped: number; purchaseOrders: DrugPurchaseOrder[] }>(
        '/pharmacy/purchase-orders/generate',
        {},
      )).data,
    onSuccess: () => invalidatePOs(qc),
  });
}

export function useUpdateDrugPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      supplierId?: string | null;
      notes?: string;
      items?: Array<{ drugId: string; quantityOrdered: number }>;
    }) => (await apiPut<DrugPurchaseOrder>(`/pharmacy/purchase-orders/${id}`, data)).data,
    onSuccess: () => invalidatePOs(qc),
  });
}

export function useSetDrugPurchaseOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'sent' | 'received' | 'cancelled' }) =>
      (await apiPatch<DrugPurchaseOrder>(`/pharmacy/purchase-orders/${id}/status`, { status })).data,
    onSuccess: () => invalidatePOs(qc),
  });
}

export function useDeleteDrugPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiDelete(`/pharmacy/purchase-orders/${id}`)).data,
    onSuccess: () => invalidatePOs(qc),
  });
}

// ============================================================
// G13 — Ward stock sub-module
// ============================================================
export interface WardStockItem {
  id: string;
  drugId: string;
  drugBatchId: string;
  drugName: string;
  looseUnitLabel: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  sellingPrice: number | null;
  quantityInStock: number;
  /** Stock can go bad while it sits on the shelf — the dispense call refuses
   *  both of these, and the shelf says so first. */
  isExpired: boolean;
  isRecalled: boolean;
  recallReason: string | null;
}

export function useWardStock(wardId: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'ward-stock', wardId],
    queryFn: async () => (await apiGet<{ items: WardStockItem[]; total: number }>('/pharmacy/ward-stock', { params: { wardId } })).data.items,
    enabled: !!wardId,
  });
}

export function useWardLedger(params: { wardId: string | null; fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['pharmacy', 'ward-stock', 'ledger', params],
    queryFn: async () =>
      (await apiGet<{ items: any[]; total: number }>('/pharmacy/ward-stock/ledger', {
        params: { wardId: params.wardId, fromDate: params.fromDate, toDate: params.toDate },
      })).data.items,
    enabled: !!params.wardId,
  });
}

export function useTransferToWard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { wardId: string; drugBatchId: string; quantity: number }) =>
      (await apiPost('/pharmacy/ward-stock/transfer', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'ward-stock'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useDispenseFromWard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      wardId: string;
      drugBatchId: string;
      patientId: string;
      quantity: number;
      admissionId?: string;
      reason?: string;
      // Clearance given for an over-deposit cash IP patient (IP credit gate).
      override?: boolean;
    }) =>
      (await apiPost<{ billId: string; billNumber: string; charged: number }>(
        '/pharmacy/ward-stock/dispense',
        data,
      )).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'ward-stock'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'credit-status'] });
    },
  });
}

// G13: return excess / near-expiry ward stock to the central pharmacy.
export function useReturnWardStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { wardId: string; drugBatchId: string; quantity: number; reason?: string }) =>
      (await apiPost('/pharmacy/ward-stock/return', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'ward-stock'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

// G13: correct a ward's on-hand count (breakage / miscount).
export function useAdjustWardStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { wardId: string; drugBatchId: string; newQuantity: number; reason: string }) =>
      (await apiPost('/pharmacy/ward-stock/adjust', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'ward-stock'] });
    },
  });
}

// IP credit & clearance check — the patient's live deposit-vs-bill picture.
export interface CreditStatus {
  patientId: string;
  hasAdmission: boolean;
  admissionId: string | null;
  category: string; // cash | package | insurance | corporate
  deposit: number;
  billed: number;
  balanceDue: number;
  available: number;
  exceeded: boolean;
  requiresClearance: boolean;
}

export function useCreditStatus(patientId: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'credit-status', patientId],
    queryFn: async () =>
      (await apiGet<CreditStatus>('/pharmacy/credit-status', { params: { patientId } })).data,
    enabled: !!patientId,
  });
}

// §4.1 Flow 2: consolidated IP billing / TPA-submission summary for a patient.
export interface IpBillingSummary {
  patient: { id: string; mrn: string; firstName: string; lastName: string | null; phone: string | null };
  admission: { id: string; billingCategory: string; depositAmount: number | string; admissionDate: string } | null;
  category: string;
  isTpa: boolean;
  insurance: { insurer: string | null; tpa: string | null; policyNumber: string; planName: string | null } | null;
  bills: Array<{
    id: string;
    billNumber: string;
    billDate: string;
    totalAmount: number | string;
    amountPaid: number | string;
    balanceDue: number | string;
    status: string;
    billItems: Array<{
      description: string;
      category: string;
      quantity: number;
      unitPrice: number | string;
      totalAmount: number | string;
    }>;
  }>;
  categoryTotals: Array<{ category: string; amount: number }>;
  // TPA reimbursable split + take-home (TTO) total from pharmacy dispenses.
  pharmacySplit?: { reimbursable: number; nonReimbursable: number; takeHome: number };
  totals: { totalBilled: number; totalPaid: number; balanceDue: number; deposit: number; available: number };
}

export function useIpBillingSummary(patientId: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'billing-summary', patientId],
    queryFn: async () =>
      (await apiGet<IpBillingSummary>('/pharmacy/billing-summary', { params: { patientId } })).data,
    enabled: !!patientId,
  });
}


// G12: advance an IP prescription through the ward→pharmacy fulfilment lifecycle.
export function useSetPharmacyOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PharmacyOrderStatus }) => {
      const response = await apiPatch<{ id: string; pharmacyStatus: PharmacyOrderStatus }>(
        `/pharmacy/queue/${id}/status`,
        { status },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions', 'queue'] });
    },
  });
}

// Dispense an IP prescription from the queue → bills the patient's IP ledger
// (hospital bill), not the pharmacy counter.
export function useDispenseIpPrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prescriptionId: string) =>
      (await apiPost(`/pharmacy/queue/${prescriptionId}/dispense-ip`, {})).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['ip-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'ip-bills'] });
    },
  });
}

export function usePrescriptionQueue(params?: PrescriptionQueueParams) {
  return useQuery({
    queryKey: ['prescriptions', 'queue', params],
    queryFn: async () => {
      const response = await apiGet<PrescriptionListItem[]>('/prescriptions', {
        params: { status: 'pending', dispensed: false, limit: 25, ...params },
      });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function usePrescriptionDetail(id: string | null) {
  return useQuery({
    queryKey: ['prescriptions', 'detail', id],
    queryFn: async () => {
      const response = await apiGet<PrescriptionListItem>(`/prescriptions/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// ============================================================
// Analytics — Pharmacy Reports page
// ============================================================

export interface PharmacyAnalytics {
  sales: {
    today: number;
    week: number;
    month: number;
    rangeRevenue: number;
    rangeMargin: number;
    rangeTransactions: number;
  };
  topDrugs: { drugId: string; drugName: string; qty: number; revenue: number }[];
  expiry: {
    soonCount: number;
    expiredCount: number;
    valueAtRisk: number;
    upcoming: {
      batchId: string;
      drugName: string;
      batchNumber: string;
      quantityInStock: number;
      expiryDate: string;
      sellingPrice: number;
    }[];
  };
  stockUsage: {
    activeBatches: number;
    slowMovers: {
      batchId: string;
      drugName: string;
      batchNumber: string;
      quantityInStock: number;
      expiryDate: string;
    }[];
  };
  batchSummary: {
    activeBatches: number;
    totalStockValue: number;
    totalRetailValue: number;
    potentialMargin: number;
  };
}

export function usePharmacyAnalytics(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['pharmacy', 'analytics', params],
    queryFn: async () => {
      const response = await apiGet<PharmacyAnalytics>('/pharmacy/analytics', { params });
      return response.data;
    },
  });
}

// ── Detailed Analysis report (single-call deep rollup) ──
export interface PharmacyDetailedReport {
  period: { fromDate: string; toDate: string; days: number };
  sales: {
    revenue: number; cost: number; grossProfit: number; marginPct: number;
    lines: number; itemsSold: number; bills: number;
    avgBillValue: number; avgLineValue: number; perDayRevenue: number;
  };
  trend: { date: string; revenue: number; profit: number; lines: number; qty: number }[];
  byDosageForm: { form: string; qty: number; revenue: number; sharePct: number }[];
  topByRevenue: { drugId: string; drugName: string; qty: number; revenue: number; profit: number; marginPct: number }[];
  topByQuantity: { drugId: string; drugName: string; qty: number; revenue: number; profit: number; marginPct: number }[];
  abc: Record<'A' | 'B' | 'C', { count: number; revenue: number; sharePct: number }>;
  dispensers: { userId: string; name: string; lines: number; qty: number; revenue: number }[];
  returns: {
    count: number; quantity: number; refundValue: number; returnRatePct: number;
    byType: { type: string; count: number; quantity: number; value: number }[];
  };
  valuation: {
    batchCount: number; drugCount: number; costValue: number; retailValue: number;
    potentialMargin: number; marginPct: number;
    byForm: { form: string; costValue: number; retailValue: number; units: number }[];
  };
  expiry: {
    expiredBatches: number; expiredValue: number; valueAtRisk: number;
    near30: { count: number; value: number }; near60: { count: number; value: number }; near90: { count: number; value: number };
    upcoming: { drugName: string; batchNumber: string; expiryDate: string; qty: number; value: number }[];
  };
  deadStock: { count: number; value: number; items: { drugName: string; stock: number; value: number }[] };
  lowStock: { count: number; items: { drugName: string; stock: number; minStock: number; deficit: number }[] };
  gst: { totalTax: number; taxableValue: number; byRate: { rate: number; taxable: number; tax: number; lines: number }[] };
  purchases: { total: number; suppliers: { supplierId: string; name: string; purchaseValue: number; batches: number; units: number }[] };
}

export function usePharmacyDetailedReport(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['pharmacy', 'detailed-report', params],
    queryFn: async () => {
      const response = await apiGet<PharmacyDetailedReport>('/pharmacy/reports/detailed', { params });
      return response.data;
    },
  });
}

// ============================================================
// Stock Ledger (batch-wise movement register)
// ============================================================

export type StockLedgerMovement = 'receipt' | 'dispense' | 'patient_return' | 'vendor_return' | 'counter_return';

export interface StockLedgerEntry {
  date: string;
  movementType: StockLedgerMovement;
  drugId: string;
  drugName: string;
  batchNumber: string;
  quantityIn: number;
  quantityOut: number;
  party: string | null;
  referenceId: string;
}

export interface StockLedgerResult {
  fromDate: string;
  toDate: string;
  entries: StockLedgerEntry[];
  page: number;
  limit: number;
  total: number;
  summary: {
    totalReceived: number;
    totalDispensed: number;
    totalReturned: number;
    totalIn: number;
    totalOut: number;
    netChange: number;
    closingStock: number;
  };
}

export function useStockLedger(params?: {
  fromDate?: string;
  toDate?: string;
  drugId?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['pharmacy', 'stock-ledger', params],
    queryFn: async () => {
      const response = await apiGet<StockLedgerResult>('/pharmacy/stock-ledger', { params });
      return response.data;
    },
  });
}

// ============================================================
// Recall Management
// ============================================================

export interface RecalledBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityInStock: number;
  isRecalled: boolean;
  recallReason: string | null;
  drug: { id: string; drugName: string; genericName: string | null };
  supplier?: { id: string; name: string } | null;
  _count?: { dispensingRecords: number };
}

export interface RecallAffectedPatients {
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    isRecalled: boolean;
    recallReason: string | null;
    drug: { id: string; drugName: string; genericName: string | null };
  };
  totalPatients: number;
  totalDispenses: number;
  patients: Array<{
    patientId: string;
    mrn: string;
    name: string;
    phone: string | null;
    email: string | null;
    totalQuantity: number;
    dispenses: Array<{
      dispensedAt: string;
      quantity: number;
      prescriptionId: string | null;
      doctorName: string | null;
    }>;
  }>;
}

/** Recalled batches. Recall is batch-level — there is no drug-wide recall. */
export function useRecalledItems() {
  return useQuery({
    queryKey: ['pharmacy', 'recalls'],
    queryFn: async () => {
      const response = await apiGet<{ recalledBatches: RecalledBatch[] }>('/pharmacy/recalls');
      return response.data;
    },
  });
}

export function useRecallAffectedPatients(batchId: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'recalls', 'affected', batchId],
    queryFn: async () => {
      const response = await apiGet<RecallAffectedPatients>(
        `/pharmacy/recalls/batches/${batchId}/affected-patients`,
      );
      return response.data;
    },
    enabled: !!batchId,
  });
}

export function useRecallBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, recallReason }: { id: string; recallReason: string }) => {
      const response = await apiPatch<RecalledBatch>(`/pharmacy/recalls/batches/${id}`, {
        recallReason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'recalls'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useUnrecallBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/pharmacy/recalls/batches/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'recalls'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

// Whole-medicine recall removed — recalls are issued per batch (useRecallBatch).

// ============================================================
// GST Report
// ============================================================

/**
 * The pharmacy's GST position — the A-2 rate-wise summary cut to this
 * department, folded from the same bill lines the hospital files from.
 *
 * There used to be a `gstRate` on both sides of this: the screen asked the user
 * to pick one (defaulting to 12%) and the server applied it to every dispense.
 * Every line already carries the rate it was billed at, so there is nothing to
 * pick — and 12% stopped being a slab on 22 September 2025.
 */
export interface GstReport {
  period: { from: string | null; to: string | null };
  summary: {
    totalSales: number;
    taxableValue: number;
    totalGst: number;
    cgst: number;
    sgst: number;
    igst: number;
    transactions: number;
    lines: number;
  };
  byRate: Array<{
    treatment: string;
    label: string;
    ratePercent: number;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    taxAmount: number;
    totalAmount: number;
    lines: number;
  }>;
  byHsn: Array<{
    hsnSacCode: string | null;
    ratePercent: number;
    taxableValue: number;
    taxAmount: number;
    totalAmount: number;
    lines: number;
  }>;
  byDrug: Array<{
    drugId: string;
    drugName: string;
    hsnSacCode: string | null;
    ratePercent: number;
    treatment: string;
    taxableValue: number;
    gstAmount: number;
    totalAmount: number;
    transactions: number;
  }>;
}

export function useGstReport(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['pharmacy', 'gst', params],
    queryFn: async () => {
      const response = await apiGet<GstReport>('/pharmacy/gst', { params });
      return response.data;
    },
  });
}


// ============================================================
// Outside (paper) prescriptions
// ============================================================
// A walk-in arrives holding a prescription written somewhere else, so there is
// no in-system Prescription to point at. The counter captures the paper one:
// prescriber, council registration number, date, and a photo of the slip.

export interface ExternalPrescription {
  id: string;
  patientId: string | null;
  patientNameRaw: string | null;
  patientAge: number | null;
  patientSex: string | null;
  /** The Schedule H1 register requires the patient's address. */
  patientAddress: string | null;
  prescriberName: string;
  prescriberRegNo: string | null;
  prescriberQualification: string | null;
  hospitalName: string | null;
  prescribedDate: string | null;
  /** Doubles as the retained copy a Schedule X sale requires. */
  imageUrl: string | null;
  notes: string | null;
  retainUntil: string | null;
  createdAt: string;
  patient?: { id: string; mrn: string; firstName: string; lastName: string | null } | null;
}

/** What the OCR could make out. A draft for the operator to confirm. */
export interface PrescriptionOcrResult {
  model: string;
  patientName: string | null;
  patientAge: number | null;
  patientSex: string | null;
  patientAddress: string | null;
  prescriberName: string | null;
  prescriberRegNo: string | null;
  prescriberQualification: string | null;
  hospitalName: string | null;
  prescribedDate: string | null;
  medicines: string[];
  warnings: string[];
  imageUrl: string | null;
}

/**
 * Read a photo of a paper prescription. This creates nothing — a mis-read
 * registration number would make the statutory register wrong, so the operator
 * confirms every field before the record is saved.
 */
export function useOcrPrescription() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      // Clear the JSON default so the browser sets the multipart boundary —
      // without it multer sees no file and the request 400s.
      const response = await apiPost<PrescriptionOcrResult>('/pharmacy/external-prescriptions/ocr', form, {
        headers: { 'Content-Type': undefined },
      });
      return response.data;
    },
  });
}

export interface CreateExternalPrescriptionInput {
  patientId?: string | null;
  patientNameRaw?: string | null;
  patientAge?: number | null;
  patientSex?: 'male' | 'female' | 'other' | null;
  patientAddress?: string | null;
  prescriberName: string;
  prescriberRegNo?: string | null;
  prescriberQualification?: string | null;
  hospitalName?: string | null;
  prescribedDate?: string | null;
  imageUrl?: string | null;
  ocrJson?: unknown;
  notes?: string | null;
  /** Schedules on the cart, so retention matches the strictest one. */
  schedules?: DrugSchedule[];
}

export function useCreateExternalPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateExternalPrescriptionInput) =>
      (await apiPost<ExternalPrescription>('/pharmacy/external-prescriptions', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy', 'external-prescriptions'] });
    },
  });
}

export function useExternalPrescriptions(params?: { patientId?: string; search?: string; limit?: number }) {
  return useQuery({
    queryKey: ['pharmacy', 'external-prescriptions', params],
    queryFn: async () => {
      const response = await apiGet<ExternalPrescription[]>('/pharmacy/external-prescriptions', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

// ============================================================
// Controlled-drug dispensing policy
// ============================================================
// 'legacy_block' reproduces the behaviour that shipped for years: a vault
// narcotic is refused at every ordinary counter. 'inline' lets the dispense
// finish on the same screen once its requirements are met.

export interface ControlledDrugSettings {
  mode: 'legacy_block' | 'inline';
  /** Roles a hospital allows to witness a controlled hand-over. */
  witnessRoles: string[];
}

export function useControlledDrugSettings() {
  return useQuery({
    queryKey: ['hospital-settings', 'controlled-drugs'],
    queryFn: async () =>
      (await apiGet<ControlledDrugSettings>('/hospital-settings/controlled-drugs')).data,
  });
}

// ============================================================
// Controlled-Drug Register
// ============================================================
// Every movement of a scheduled or narcotic medicine, from every path it can
// take, in one chronological ledger — the view a drug inspector reads.

export interface RegisterRow {
  occurredAt: string;
  txnId: string;
  txnType: string;
  drugId: string;
  itemName: string;
  /** Active ingredient + strength — what an inspector cross-references. */
  apiStrength: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  qtyIn: number;
  qtyOut: number;
  transferQty: number;
  opening: number;
  closing: number;
  patientOrDept: string | null;
  prescriber: string | null;
  verification: string | null;
  schedule: DrugSchedule | null;
  /** Why this schedule — shown as the badge tooltip. */
  scheduleReason: string | null;
  controlledClass: 'narcotic' | 'psychotropic' | null;
}

export interface ControlledRegister {
  rows: RegisterRow[];
  summary: {
    openingStock: number;
    inward: number;
    outward: number;
    internalTransfer: number;
    /**
     * The part of internalTransfer that actually left the pharmacy's
     * dispensable stock. A stock-transfer dispatch decrements the batch, so it
     * counts; a historical NDPS challan only moved between NDPS locations, so
     * it does not. Without the distinction the opening balance came out
     * negative.
     */
    transferredOut?: number;
    /** The part of `outward` that spent stock the pharmacy had already issued
     *  to a ward. Genuinely outward, but its balance was lost at issue time —
     *  so the printed sum adds it back rather than subtracting it twice. */
    outwardAlreadyIssued?: number;
    closingBalance: number;
  };
  drugs: Array<{ id: string; drugName: string; schedule: DrugSchedule | null }>;
  window: { from: string; to: string };
}

export interface ControlledRegisterParams {
  fromDate?: string;
  toDate?: string;
  reportType?: 'all' | 'inward' | 'outward' | 'transfer';
  scheduleType?: 'NDPS' | 'X' | 'H1' | 'H' | 'H2' | 'G';
  /** Comma-separated formulary ids. */
  drugIds?: string;
  search?: string;
  doctorRegNo?: string;
  locationId?: string;
}

/** The item picker's options — every controlled drug the hospital stocks. */
export interface ControlledDrugOption {
  id: string;
  drugName: string;
  schedule: string | null;
  controlledClass: 'narcotic' | 'psychotropic' | null;
  apiStrength: string | null;
}

export function useControlledDrugOptions(enabled = true) {
  return useQuery({
    queryKey: ['pharmacy', 'controlled-register', 'drugs'],
    queryFn: async () =>
      (await apiGet<ControlledDrugOption[]>('/pharmacy/controlled-register/drugs')).data ?? [],
    // Reference-ish data: the controlled list changes only when a drug is added
    // or reclassified, so it need not be refetched on every filter change.
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useControlledRegister(params?: ControlledRegisterParams, enabled = true) {
  return useQuery({
    queryKey: ['pharmacy', 'controlled-register', params],
    queryFn: async () =>
      (await apiGet<ControlledRegister>('/pharmacy/controlled-register', { params })).data,
    enabled,
  });
}
