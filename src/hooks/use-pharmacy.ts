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

export interface DrugCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface FormularyItem {
  id: string;
  drugName: string;
  genericName: string | null;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  manufacturer: string | null;
  dosageForm: DosageForm | null;
  strength: string | null;
  unitOfMeasurement: string | null;
  price: number | string | null;
  // Loose / sub-unit sale + GST (per base unit). packSize = base units per pack.
  packSize: number | null;
  looseUnitLabel: string | null;
  taxPercent: number | string | null;
  indications: string | null;
  contraindications: string | null;
  isActive: boolean;
  isRecalled: boolean;
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
  purchasePrice: number | string | null;
  sellingPrice: number | string | null;
  quantityReceived: number;
  quantityInStock: number;
  isExpired: boolean;
  isRecalled: boolean;
  recallReason: string | null;
  createdAt: string;
  updatedAt: string;
  drug?: Pick<
    FormularyItem,
    'id' | 'drugName' | 'genericName' | 'strength' | 'dosageForm' | 'packSize' | 'looseUnitLabel' | 'taxPercent'
  >;
  supplier?: { id: string; name: string } | null;
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
  id: string;
  returnType: 'patient_return' | 'vendor_return';
  drugBatchId: string;
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
  categoryId?: string;
  dosageForm?: DosageForm;
  isActive?: boolean | string;
  stockStatus?: 'in' | 'out';
}

export interface BatchQueryParams extends PaginatedParams {
  drugId?: string | null;
  isExpired?: boolean | string;
  availableOnly?: boolean | string;
}

// ============================================================
// Query Keys
// ============================================================

export const pharmacyKeys = {
  categories: {
    all: ['pharmacy', 'categories'] as const,
    list: (params?: PaginatedParams) => ['pharmacy', 'categories', 'list', params] as const,
  },
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
// Category Hooks
// ============================================================

export function usePharmacyCategories(params?: PaginatedParams) {
  return useQuery({
    queryKey: pharmacyKeys.categories.list(params),
    queryFn: async () => {
      const response = await apiGet<DrugCategory[]>('/pharmacy/categories', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiPost<DrugCategory>('/pharmacy/categories', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.categories.all });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string | null }) => {
      const response = await apiPut<DrugCategory>(`/pharmacy/categories/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.categories.all });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/pharmacy/categories/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.categories.all });
    },
  });
}

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
  genericName?: string;
  categoryId?: string;
  manufacturer?: string;
  dosageForm?: DosageForm;
  strength?: string;
  unitOfMeasurement?: string;
  price?: number;
  packSize?: number;
  looseUnitLabel?: string;
  taxPercent?: number;
  indications?: string;
  contraindications?: string;
  isActive?: boolean;
}

export function useCreateFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFormularyInput) => {
      const response = await apiPost<FormularyItem>('/pharmacy/formulary', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

// Import a drug from the platform DrugMaster catalog into this tenant's
// formulary (one-click "add to formulary"). Backend dedupes on drugMasterId.
export function useImportFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { drugMasterId: string; categoryId?: string; price?: number }) => {
      const response = await apiPost<FormularyItem>('/pharmacy/formulary/import', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] });
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
  mrp: number | string | null;
  schedule: string | null;
  imported: boolean;
  formularyId: string | null;
}

export interface CatalogQueryParams extends PaginatedParams {
  dosageForm?: DosageForm;
  schedule?: string;
  imported?: 'yes' | 'no';
}

export function usePharmacyCatalog(params?: CatalogQueryParams) {
  return useQuery({
    queryKey: ['pharmacy', 'catalog', params],
    queryFn: async () => {
      const response = await apiGet<CatalogItem[]>('/pharmacy/catalog', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

// Bulk copy many catalog drugs into the formulary in one call (dedupes server-side).
export function useImportFormularyBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { drugMasterIds: string[]; categoryId?: string }) => {
      const response = await apiPost<{ requested: number; created: number; skipped: number }>(
        '/pharmacy/formulary/import-bulk',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] });
    },
  });
}

export function useUpdateFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateFormularyInput> & { isRecalled?: boolean }) => {
      const response = await apiPut<FormularyItem>(`/pharmacy/formulary/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.detail(variables.id) });
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
  purchasePrice?: number;
  sellingPrice?: number;
  quantityReceived: number;
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
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

export interface UpdateBatchInput {
  batchNumber?: string;
  manufacturingDate?: string | null;
  expiryDate?: string;
  supplierId?: string | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  quantityInStock?: number;
  isExpired?: boolean;
  isRecalled?: boolean;
  recallReason?: string | null;
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
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });
}

// ============================================================
// Counter Billing (POS sale) Hooks
// ============================================================

export interface PharmacySaleItemInput {
  drugBatchId: string;
  prescriptionItemId?: string;
  quantity: number;
  saleUnit?: 'pack' | 'loose';
  discountPercent?: number;
  unitPrice?: number;
}

export interface CreatePharmacySaleInput {
  patientId?: string;
  prescriptionId?: string;
  items: PharmacySaleItemInput[];
  paymentMethod?: 'cash' | 'credit_card' | 'debit_card' | 'upi' | 'net_banking' | 'cheque' | 'other';
  amountPaid?: number;
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
      returnType: 'patient_return' | 'vendor_return';
      // Optional when dispensingRecordId is supplied — the batch is taken from
      // the original sale line.
      drugBatchId?: string;
      dispensingRecordId?: string;
      patientId?: string;
      supplierId?: string;
      quantity: number;
      reason?: string;
    }) => {
      const response = await apiPost<PharmacyReturn>('/pharmacy/returns', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.returns.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'returnable'] });
    },
  });
}

// A patient's returnable counter-sale lines — drives the patient-return picker.
export function useReturnableDispenses(patientId: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'returnable', patientId],
    queryFn: async () => {
      const response = await apiGet<{ items: ReturnableDispense[]; total: number }>(
        '/pharmacy/returnable',
        { params: { patientId } },
      );
      return response.data?.items ?? [];
    },
    enabled: !!patientId,
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
    },
  });
}

// ============================================================
// Prescription Queue (incoming e-prescriptions for the pharmacy)
// ============================================================

export interface PrescriptionListItem {
  id: string;
  status: 'active' | 'dispensed' | 'partially_dispensed' | 'cancelled';
  prescriptionType: 'op' | 'ip';
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  visit?: { id: string; visitDate: string; visitType: string };
  prescriptionItems: Array<{
    id: string;
    drugId: string | null;
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string | null;
    route: string;
    instructions: string | null;
    quantity: number | null;
    isPrn: boolean;
  }>;
}

export interface PrescriptionQueueParams extends PaginatedParams {
  patientId?: string;
  doctorId?: string;
  status?: 'active' | 'dispensed' | 'partially_dispensed' | 'cancelled' | 'pending';
  prescriptionType?: 'op' | 'ip';
  dispensed?: boolean | string;
  fromDate?: string;
  toDate?: string;
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
    revenueByCategory: { categoryId: string; categoryName: string; revenue: number }[];
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

export interface RecalledDrug {
  id: string;
  drugName: string;
  genericName: string | null;
  isRecalled: boolean;
  category?: { id: string; name: string } | null;
  _count?: { drugBatches: number };
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

export function useRecalledItems(type: 'batch' | 'drug' | 'all' = 'all') {
  return useQuery({
    queryKey: ['pharmacy', 'recalls', type],
    queryFn: async () => {
      const response = await apiGet<{
        recalledBatches: RecalledBatch[];
        recalledDrugs: RecalledDrug[];
      }>('/pharmacy/recalls', { params: { type } });
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
    },
  });
}

export function useRecallDrug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, recallReason }: { id: string; recallReason: string }) => {
      const response = await apiPatch(`/pharmacy/recalls/drugs/${id}`, { recallReason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'recalls'] });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
    },
  });
}

// ============================================================
// GST Report
// ============================================================

export interface GstReport {
  gstRate: number;
  summary: {
    totalSales: number;
    taxableValue: number;
    totalGst: number;
    cgst: number;
    sgst: number;
    igst: number;
    transactions: number;
  };
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    taxableValue: number;
    gstAmount: number;
    totalAmount: number;
    transactions: number;
  }>;
}

export function useGstReport(params?: { fromDate?: string; toDate?: string; gstRate?: number }) {
  return useQuery({
    queryKey: ['pharmacy', 'gst', params],
    queryFn: async () => {
      const response = await apiGet<GstReport>('/pharmacy/gst', { params });
      return response.data;
    },
  });
}
