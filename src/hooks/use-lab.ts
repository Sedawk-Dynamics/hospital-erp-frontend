import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface LabDepartment {
  id: string;
  name: string;
  description?: string;
  headOfDepartment?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabTestCatalog {
  id: string;
  name: string;
  code?: string;
  departmentId?: string;
  department?: LabDepartment;
  category?: string;
  sampleType?: string;
  description?: string;
  turnaroundTime?: string;
  price: number;
  isActive: boolean;
  parameters?: LabTestParameter[];
  createdAt: string;
  updatedAt: string;
}

export interface LabTestParameter {
  id: string;
  name: string;
  unit?: string;
  normalRange?: string;
  method?: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
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
  doctorId: string;
  doctor: {
    id: string;
    userId: string;
    user?: { firstName: string; lastName: string };
  };
  tests: { id: string; name: string; code?: string; category?: string; price?: number }[];
  priority: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled';
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
  status: 'collected' | 'received' | 'processing' | 'completed' | 'rejected';
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
  orderId: string;
  order?: LabOrder;
  patient?: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
  };
  tests?: { id: string; name: string }[];
  generatedAt?: string;
  generatedBy?: string;
  status: 'draft' | 'generated' | 'delivered' | 'printed';
  fileUrl?: string;
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
  departments: {
    all: ['lab', 'departments'] as const,
    list: (params?: PaginatedParams) => ['lab', 'departments', 'list', params] as const,
  },
  tests: {
    all: ['lab', 'tests'] as const,
    list: (params?: PaginatedParams & { departmentId?: string }) => ['lab', 'tests', 'list', params] as const,
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
// Lab Department Hooks
// ============================================================

export function useLabDepartments(params?: PaginatedParams) {
  return useQuery({
    queryKey: labKeys.departments.list(params),
    queryFn: async () => {
      const response = await apiGet<LabDepartment[]>('/lab/departments', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateLabDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; headOfDepartment?: string }) => {
      const response = await apiPost<LabDepartment>('/lab/departments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.departments.all });
    },
  });
}

export function useUpdateLabDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; headOfDepartment?: string; isActive?: boolean }) => {
      const response = await apiPut<LabDepartment>(`/lab/departments/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.departments.all });
    },
  });
}

export function useDeleteLabDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/lab/departments/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.departments.all });
    },
  });
}

// ============================================================
// Lab Test Hooks
// ============================================================

export function useLabTests(params?: PaginatedParams & { departmentId?: string }) {
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

export function useCreateLabTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      code?: string;
      departmentId?: string;
      category?: string;
      sampleType?: string;
      description?: string;
      turnaroundTime?: string;
      price: number;
    }) => {
      const response = await apiPost<LabTestCatalog>('/lab/tests', data);
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
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      code?: string;
      departmentId?: string;
      category?: string;
      sampleType?: string;
      description?: string;
      turnaroundTime?: string;
      price?: number;
      isActive?: boolean;
    }) => {
      const response = await apiPut<LabTestCatalog>(`/lab/tests/${id}`, data);
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

// ============================================================
// Lab Order Hooks
// ============================================================

export function useLabOrders(params?: PaginatedParams & { status?: string; priority?: string }) {
  return useQuery({
    queryKey: labKeys.orders.list(params),
    queryFn: async () => {
      const response = await apiGet<LabOrder[]>('/lab/orders', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
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
    mutationFn: async (data: {
      orderId: string;
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
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiPatch<LabSample>(`/lab/samples/${id}/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.samples.all });
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
      orderId: string;
      testId: string;
      parameters: { name: string; value: string; unit?: string; normalRange?: string; isAbnormal?: boolean }[];
      remarks?: string;
    }) => {
      const response = await apiPost<LabResult>('/lab/results', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.results.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
    },
  });
}

export function useVerifyResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const response = await apiPatch<LabResult>(`/lab/results/${id}/verify`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.results.all });
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
    mutationFn: async (orderId: string) => {
      const response = await apiPost<LabReport>(`/lab/reports/${orderId}/generate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
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
