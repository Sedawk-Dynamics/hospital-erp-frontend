import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface LabTestCatalog {
  id: string;
  testName: string;
  testCode?: string;
  /** @deprecated alias for testName */
  name?: string;
  /** @deprecated alias for testCode */
  code?: string;
  category?: string;
  sampleType?: string;
  description?: string;
  normalRange?: string;
  unit?: string;
  turnaroundHours?: number;
  /** @deprecated alias for turnaroundHours */
  turnaroundTime?: string;
  price: number;
  isActive: boolean;
  // Structured parameter list (from cloned template or admin-added). When
  // null/empty the lab "Add Details" mode falls back to free-form rows.
  // Shape matches backend parameterSpecSchema (lab.validation.ts).
  parameters?: LabTestParameter[] | null;
  templateId?: string | null;
  specimen?: string | null;
  instructions?: string | null;
  interpretation?: string | null;
  // Dynamic-search synonyms + tags. Editable by hospital admin per row
  // without touching the platform template.
  aliases?: string[];
  tags?: string[];
  // True for hospital-authored tests with no platform-template link.
  isCustom?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabTestParameter {
  id: string;
  name: string;
  code?: string | null;
  unit?: string | null;
  refLow?: number | null;
  refHigh?: number | null;
  refRangeText?: string | null;
  decimals?: number | null;
  group?: string | null;
  inputType?: 'number' | 'text' | 'select';
  options?: { value: string; label: string }[] | null;
  notes?: string | null;
  /** @deprecated legacy free-text range — replaced by refRangeText / refLow / refHigh */
  normalRange?: string | null;
  /** @deprecated unused */
  method?: string | null;
}

export interface LabOrder {
  id: string;
  orderNumber?: string;
  patientId: string;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    gender?: string;
    dateOfBirth?: string;
  };
  doctorId?: string;
  doctor?: {
    id: string;
    userId: string;
    user?: { firstName: string; lastName: string };
  };
  orderer?: { id: string; firstName: string; lastName: string };
  assignedToId?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  visitId?: string;
  isThirdParty?: boolean;
  thirdPartyLabName?: string | null;
  tests?: { id: string; name: string; code?: string; category?: string; price?: number }[];
  labOrderItems?: Array<{
    id: string;
    testId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    test: {
      id: string;
      testName: string;
      testCode?: string;
      sampleType?: string | null;
      normalRange?: string | null;
      unit?: string | null;
      // Structured parameter list (from cloned template). When present, the
      // lab "Add Details" UI renders one input row per parameter spec
      // instead of free-form rows.
      parameters?: LabTestParameter[] | null;
      interpretation?: string | null;
    };
    // Eager-loaded by GET /lab/orders/:id so the order-detail dialog can
    // render saved structured-mode results inline.
    labResults?: Array<{
      id: string;
      parameterName: string;
      value?: string | null;
      unit?: string | null;
      normalRange?: string | null;
      isAbnormal?: boolean | null;
      status?: string;
      correctionNotes?: string | null;
      // How the value got here. 'ocr' was read off an uploaded report file and
      // is unverified — the entry grid flags it so the lab checks it before the
      // supervisor approves. 'manual'/absent means a human typed it.
      source?: string | null;
    }>;
  }>;
  labSamples?: Array<{
    id: string;
    status: string;
    sampleType: string;
    barcode?: string | null;
  }>;
  // Eager-loaded by GET /lab/orders/:id — present once the report has been
  // generated (draft) or auto-published via the upload+mark-done flow.
  labReport?: {
    id: string;
    status: 'draft' | 'review' | 'approved' | 'published' | 'corrected';
    version?: number;
    signedAt?: string | null;
    publishedAt?: string | null;
  } | null;
  priority?: 'routine' | 'urgent' | 'stat';
  urgency?: 'routine' | 'urgent' | 'stat';
  status:
    | 'pending'
    | 'ordered'
    | 'sample_collected'
    | 'in_transit'
    | 'received'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  totalAmount?: number;
  paidAmount?: number;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  notes?: string;
  clinicalNotes?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabSample {
  id: string;
  orderId: string;
  order?: LabOrder;
  sampleType: string;
  collectedBy?: string;
  collectedAt?: string;
  barcode?: string;
  status: 'collected' | 'in_transit' | 'received' | 'processing' | 'completed' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabResult {
  id: string;
  orderId: string;
  order?: LabOrder;
  testId: string;
  test?: { id: string; name: string };
  parameters?: { name: string; value: string; unit?: string; normalRange?: string; isAbnormal?: boolean }[];
  status: 'pending' | 'entered' | 'verified' | 'released';
  enteredBy?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabReport {
  id: string;
  reportNumber?: string;
  /** legacy alias — backend returns labOrderId */
  orderId?: string;
  labOrderId?: string;
  order?: LabOrder;
  labOrder?: LabOrder;
  patient?: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
  };
  tests?: { id: string; name: string }[];
  generatedAt?: string;
  generatedBy?: string;
  /** Lab report state machine */
  status: 'draft' | 'generated' | 'delivered' | 'printed' | 'review' | 'approved' | 'published' | 'corrected';
  fileUrl?: string;
  pdfUrl?: string;
  qrCodeUrl?: string;
  reportContent?: string | null;
  hospitalBranding?: any;
  version?: number;
  signedBy?: string;
  signedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  correctionNotes?: string;
  attachments?: Array<{
    id: string;
    labOrderId: string;
    labReportId?: string | null;
    labOrderItemId?: string | null;
    category: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
    description?: string | null;
    uploader?: { id: string; firstName: string; lastName: string };
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category?: string;
  sku?: string;
  currentStock: number;
  reorderLevel: number;
  unit?: string;
  unitPrice?: number;
  supplierId?: string;
  supplier?: { id: string; name: string };
  expiryDate?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: { id: string; name: string; email?: string; phone?: string };
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
  orderDate?: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
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

// ============================================================
// Query Keys
// ============================================================

export const labKeys = {
  tests: {
    all: ['lab', 'tests'] as const,
    list: (params?: PaginatedParams) => ['lab', 'tests', 'list', params] as const,
    detail: (id: string) => ['lab', 'tests', 'detail', id] as const,
  },
  orders: {
    all: ['lab', 'orders'] as const,
    list: (params?: PaginatedParams & { status?: string; priority?: string }) => ['lab', 'orders', 'list', params] as const,
    detail: (id: string) => ['lab', 'orders', 'detail', id] as const,
  },
  samples: {
    all: ['lab', 'samples'] as const,
    list: (params?: PaginatedParams & { status?: string }) => ['lab', 'samples', 'list', params] as const,
  },
  results: {
    all: ['lab', 'results'] as const,
    list: (params?: PaginatedParams) => ['lab', 'results', 'list', params] as const,
  },
  reports: {
    all: ['lab', 'reports'] as const,
    list: (params?: PaginatedParams & { status?: string }) => ['lab', 'reports', 'list', params] as const,
    detail: (id: string) => ['lab', 'reports', 'detail', id] as const,
  },
  inventory: {
    all: ['lab', 'inventory'] as const,
    list: (params?: PaginatedParams & { category?: string; status?: string }) => ['lab', 'inventory', 'list', params] as const,
    lowStock: ['lab', 'inventory', 'low-stock'] as const,
  },
  purchaseOrders: {
    all: ['lab', 'purchase-orders'] as const,
    list: (params?: PaginatedParams & { status?: string }) => ['lab', 'purchase-orders', 'list', params] as const,
  },
  suppliers: {
    all: ['lab', 'suppliers'] as const,
    list: (params?: PaginatedParams) => ['lab', 'suppliers', 'list', params] as const,
  },
};

// ============================================================
// Lab Test Hooks
// ============================================================

export function useLabTests(params?: PaginatedParams) {
  return useQuery({
    queryKey: labKeys.tests.list(params),
    queryFn: async () => {
      const response = await apiGet<LabTestCatalog[]>('/lab/tests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useLabTest(id: string) {
  return useQuery({
    queryKey: labKeys.tests.detail(id),
    queryFn: async () => {
      const response = await apiGet<LabTestCatalog>(`/lab/tests/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

type LabTestPayload = {
  testName: string;
  testCode?: string;
  description?: string;
  normalRange?: string;
  unit?: string;
  price?: number;
  turnaroundHours?: number;
  sampleType?: string;
  specimen?: string | null;
  instructions?: string | null;
  parameters?: LabTestParameter[] | null;
  interpretation?: string | null;
  // Dynamic-search synonyms + tags + custom-test flag (see 2026-05-23
  // meeting decisions).
  aliases?: string[];
  tags?: string[];
  isCustom?: boolean;
  isActive?: boolean;
};

type LegacyLabTestPayload = {
  name?: string;
  code?: string;
  category?: string;
  turnaroundTime?: string;
};

function normalizeTestPayload(data: Partial<LabTestPayload> & LegacyLabTestPayload) {
  const out: any = { ...data };
  if (data.name && !data.testName) out.testName = data.name;
  if (data.code && !data.testCode) out.testCode = data.code;
  if (data.turnaroundTime && !data.turnaroundHours) {
    const m = String(data.turnaroundTime).match(/(\d+)/);
    if (m) out.turnaroundHours = Number(m[1]);
  }
  delete out.name; delete out.code;
  delete out.category; delete out.turnaroundTime;
  return out;
}

export function useCreateLabTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<LabTestPayload> & LegacyLabTestPayload) => {
      const response = await apiPost<LabTestCatalog>('/lab/tests', normalizeTestPayload(data));
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.tests.all });
    },
  });
}

export function useUpdateLabTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<LabTestPayload> & LegacyLabTestPayload) => {
      const response = await apiPut<LabTestCatalog>(`/lab/tests/${id}`, normalizeTestPayload(data));
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: labKeys.tests.all });
      queryClient.invalidateQueries({ queryKey: labKeys.tests.detail(variables.id) });
    },
  });
}

export function useDeleteLabTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/lab/tests/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.tests.all });
    },
  });
}

// Narrow update for lab supervisors — only price + TAT. Backend exposes
// /lab/tests/:id/price separately so supervisors can't drift the catalog's
// parameter list via the full PUT endpoint.
export function useUpdateLabTestPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, price, turnaroundHours }: { id: string; price?: number; turnaroundHours?: number }) => {
      const response = await apiPatch<LabTestCatalog>(`/lab/tests/${id}/price`, {
        price,
        turnaroundHours,
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: labKeys.tests.all });
      queryClient.invalidateQueries({ queryKey: labKeys.tests.detail(variables.id) });
    },
  });
}

// ============================================================
// Lab Order Hooks
// ============================================================

export type LabOrdersFilters = PaginatedParams & {
  status?: string;
  /**
   * Several statuses at once, comma separated. `status` only ever took one, so
   * a worklist wanting "everything still open" had to fetch a page and drop the
   * finished rows in the browser — which filtered ONE page, leaving the table
   * showing 6 of 20 rows while the pager still claimed 20 pages of them.
   */
  statuses?: string;
  priority?: string;
  urgency?: string;
  assignedTo?: string;
  outsourced?: boolean;
  isThirdParty?: boolean;
  accepted?: boolean;
  /** Open >24h with no report signed or published — the SLA risk list. */
  overdue?: boolean;
  /** Nobody has picked it up yet — the supervisor's triage queue. */
  unassigned?: boolean;
  date?: string;
  fromDate?: string;
  toDate?: string;
  patientId?: string;
};

/** Every status an order can be in while it is still live work. */
export const LAB_OPEN_STATUSES = 'ordered,sample_collected,in_transit,received,in_progress';

export function useLabOrders(params?: LabOrdersFilters) {
  return useQuery({
    queryKey: labKeys.orders.list(params),
    queryFn: async () => {
      const response = await apiGet<LabOrder[]>('/lab/orders', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useAcceptLabOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      assignedToId,
      notes,
    }: {
      id: string;
      assignedToId?: string;
      notes?: string;
    }) => {
      const response = await apiPatch<LabOrder>(`/lab/orders/${id}/accept`, {
        assignedToId,
        notes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

export function useLabOrder(id: string) {
  return useQuery({
    queryKey: labKeys.orders.detail(id),
    queryFn: async () => {
      const response = await apiGet<LabOrder>(`/lab/orders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateLabOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      doctorId: string;
      testIds: string[];
      priority?: 'routine' | 'urgent' | 'stat';
      notes?: string;
      clinicalNotes?: string;
    }) => {
      const response = await apiPost<LabOrder>('/lab/orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

export function useCancelLabOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiPatch<LabOrder>(`/lab/orders/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

// ============================================================
// Lab Sample Hooks
// ============================================================

export function useLabSamples(params?: PaginatedParams & { status?: string }) {
  return useQuery({
    queryKey: labKeys.samples.list(params),
    queryFn: async () => {
      const response = await apiGet<LabSample[]>('/lab/samples', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCollectSample() {
  const queryClient = useQueryClient();
  return useMutation({
    // The field is `labOrderId` — collectSampleSchema requires it and rejects
    // anything else. This used to send `orderId`, so EVERY collect attempt 400d
    // on "Invalid order ID" and no sample could be created from any surface.
    mutationFn: async (data: {
      labOrderId: string;
      sampleType: string;
      barcode?: string;
      notes?: string;
    }) => {
      const response = await apiPost<LabSample>('/lab/samples', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.samples.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

export function useUpdateSampleStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiPatch<LabSample>(`/lab/samples/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.samples.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

export function useRejectSample() {
  const queryClient = useQueryClient();
  return useMutation({
    // Body key is `rejectionReason` — sending `reason` failed the schema's
    // min(1) check on a field that was never present.
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiPatch<LabSample>(`/lab/samples/${id}/reject`, {
        rejectionReason: reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.samples.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

// ============================================================
// Lab Result Hooks
// ============================================================

export function useLabResults(params?: PaginatedParams) {
  return useQuery({
    queryKey: labKeys.results.list(params),
    queryFn: async () => {
      const response = await apiGet<LabResult[]>('/lab/results', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useEnterResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      labOrderItemId: string;
      labOrderId: string;
      patientId: string;
      results: {
        parameterName: string;
        value?: string;
        unit?: string;
        normalRange?: string;
        isAbnormal?: boolean;
      }[];
    }) => {
      const response = await apiPost<LabResult[]>('/lab/results', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.results.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

// Marks a single test on a lab order as done. Server-side: when every item
// on the order is completed the order auto-finalizes and a LabReport is
// published in one shot — uploaded attachments ARE the report.
export function useCompleteLabOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      const response = await apiPatch(`/lab/orders/${orderId}/items/${itemId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: ['lab', 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['lab', 'dashboard'] });
    },
  });
}

export function useVerifyResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      correctionNotes,
    }: {
      id: string;
      action?: 'approve' | 'request_correction';
      correctionNotes?: string;
    }) => {
      const response = await apiPatch<LabResult>(`/lab/results/${id}/verify`, {
        action: action ?? 'approve',
        correctionNotes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.results.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

// ============================================================
// Lab Report Hooks
// ============================================================

export function useLabReports(params?: PaginatedParams & { status?: string }) {
  return useQuery({
    queryKey: labKeys.reports.list(params),
    queryFn: async () => {
      const response = await apiGet<LabReport[]>('/lab/reports', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useLabReport(id: string) {
  return useQuery({
    queryKey: labKeys.reports.detail(id),
    queryFn: async () => {
      const response = await apiGet<LabReport>(`/lab/reports/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useGenerateLabReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      hospitalBranding,
      reportContent,
    }: {
      orderId: string;
      hospitalBranding?: Record<string, unknown>;
      reportContent?: string;
    }) => {
      const response = await apiPost<LabReport>(`/lab/reports/${orderId}/generate`, {
        hospitalBranding,
        reportContent,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

export function useSignLabReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<LabReport>(`/lab/reports/${id}/sign`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
    },
  });
}

export function usePublishLabReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notify }: { id: string; notify?: boolean }) => {
      const response = await apiPatch<LabReport>(`/lab/reports/${id}/publish`, {
        notify: notify ?? true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: ['lab', 'dashboard'] });
    },
  });
}

// One-shot submit: generate (if needed) + sign + publish in a single call.
// Backend route is gated by `lab_reports.create`, so technicians can call
// this without supervisor sign-off — matches the auto-publish behaviour of
// the upload+mark-done path.
export function useSubmitLabReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      notify,
      reportContent,
      hospitalBranding,
    }: {
      orderId: string;
      notify?: boolean;
      reportContent?: string;
      hospitalBranding?: Record<string, unknown>;
    }) => {
      const response = await apiPost<LabReport>(`/lab/reports/${orderId}/submit`, {
        notify: notify ?? true,
        reportContent,
        hospitalBranding,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: ['lab', 'dashboard'] });
    },
  });
}

export function useCorrectLabReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      correctionNotes,
      reportContent,
      notify,
    }: {
      id: string;
      correctionNotes: string;
      reportContent?: string;
      notify?: boolean;
    }) => {
      const response = await apiPatch<LabReport>(`/lab/reports/${id}/correct`, {
        correctionNotes,
        reportContent,
        notify: notify ?? true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
    },
  });
}

export interface LabReportAnalytics {
  summary: {
    totalOrders: number;
    completedOrders: number;
    openOrders: number;
    totalSamples: number;
    avgTatHours: number;
    medianTatHours: number;
  };
  testVolume: { testId: string; testName: string; count: number }[];
}

export function useLabReportAnalytics(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['lab', 'reports', 'analytics', params],
    queryFn: async () => {
      const response = await apiGet<LabReportAnalytics>('/lab/reports/analytics', { params });
      return response.data;
    },
  });
}

export interface LabDashboardData {
  summary: {
    incomingOrders: number;
    inProgressOrders: number;
    samplesCollected: number;
    samplesInTransit: number;
    samplesReceived: number;
    samplesProcessing: number;
    resultsAwaitingVerify: number;
    reportsAwaitingSign: number;
    reportsAwaitingPublish: number;
    publishedToday: number;
    correctedReports: number;
    abnormalRecent: number;
    overdueOrders: number;
  };
  recentOrders: Array<{
    id: string;
    createdAt: string;
    status: string;
    urgency?: string;
    acceptedAt?: string | null;
    patient: { id: string; mrn: string; firstName: string; lastName: string | null };
    orderer?: { id: string; firstName: string; lastName: string };
    labOrderItems?: { id: string }[];
  }>;
  recentPublishedReports: Array<{
    id: string;
    publishedAt: string;
    version: number;
    patient: { firstName: string; lastName: string | null; mrn: string };
    labOrder: { id: string };
  }>;
  overdueOrders: Array<{
    id: string;
    createdAt: string;
    status: string;
    urgency?: string;
    patient: { firstName: string; lastName: string | null; mrn: string };
  }>;
}

export function useLabDashboard() {
  return useQuery({
    queryKey: ['lab', 'dashboard'],
    queryFn: async () => {
      const response = await apiGet<LabDashboardData>('/lab/dashboard');
      return response.data;
    },
    refetchInterval: 60_000, // 1 min — keeps the worklist counts current without polling spam
  });
}

export interface LabAnalyticsExtended {
  perTestTat: Array<{
    testId: string;
    testName: string;
    sampleCount: number;
    avgTatHours: number;
    medianTatHours: number;
    p95TatHours: number;
    tatLimitHours: number | null;
    breaches: number;
    breachRate: number;
  }>;
  overallBreaches: number;
  dailyTrend: Array<{ date: string; count: number }>;
  abnormalResults: number;
  totalResults: number;
  abnormalRate: number;
}

export function useLabAnalyticsExtended(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['lab', 'reports', 'analytics-extended', params],
    queryFn: async () => {
      const response = await apiGet<LabAnalyticsExtended>('/lab/reports/analytics-extended', { params });
      return response.data;
    },
  });
}

// ============================================================
// Inventory Hooks
// ============================================================

export function useInventoryItems(params?: PaginatedParams & { category?: string; status?: string }) {
  return useQuery({
    queryKey: labKeys.inventory.list(params),
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useLowStockItems() {
  return useQuery({
    queryKey: labKeys.inventory.lowStock,
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items/low-stock');
      return response.data;
    },
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      category?: string;
      sku?: string;
      currentStock: number;
      reorderLevel: number;
      unit?: string;
      unitPrice?: number;
      supplierId?: string;
      expiryDate?: string;
    }) => {
      const response = await apiPost<InventoryItem>('/inventory/items', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.inventory.all });
    },
  });
}

// ============================================================
// Purchase Order Hooks
// ============================================================

export function usePurchaseOrders(params?: PaginatedParams & { status?: string }) {
  return useQuery({
    queryKey: labKeys.purchaseOrders.list(params),
    queryFn: async () => {
      const response = await apiGet<PurchaseOrder[]>('/inventory/purchase-orders', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      supplierId: string;
      items: { itemId: string; quantity: number; unitPrice: number }[];
      expectedDeliveryDate?: string;
      notes?: string;
    }) => {
      const response = await apiPost<PurchaseOrder>('/inventory/purchase-orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.purchaseOrders.all });
    },
  });
}

export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<PurchaseOrder>(`/inventory/purchase-orders/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.purchaseOrders.all });
    },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.purchaseOrders.all });
      queryClient.invalidateQueries({ queryKey: labKeys.inventory.all });
    },
  });
}

// ============================================================
// Supplier Hooks
// ============================================================

export function useSuppliers(params?: PaginatedParams) {
  return useQuery({
    queryKey: labKeys.suppliers.list(params),
    queryFn: async () => {
      const response = await apiGet<Supplier[]>('/inventory/suppliers', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
    }) => {
      const response = await apiPost<Supplier>('/inventory/suppliers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.suppliers.all });
    },
  });
}
