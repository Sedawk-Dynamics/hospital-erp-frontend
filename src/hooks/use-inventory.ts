import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api';

// ============================================================
// Types — mirror the Prisma schema in inventory_items, suppliers,
// stock_transactions, purchase_orders, supply_requests.
// ============================================================

export type InventoryCategory = 'drug' | 'consumable' | 'surgical_supply' | 'equipment' | 'other';
export type SupplyType = 'drugs' | 'consumables' | 'equipment' | 'all';
export type StockTransactionType =
  | 'stock_in'
  | 'stock_out'
  | 'return_stock'
  | 'adjustment'
  | 'expired_removal';
export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'delivered'
  | 'partially_delivered'
  | 'cancelled';
export type SupplyRequestStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected';
export type SupplyUrgency = 'routine' | 'urgent';

export interface InventoryItem {
  id: string;
  tenantId?: string;
  itemName: string;
  itemCode: string | null;
  category: InventoryCategory;
  description: string | null;
  unitOfMeasurement: string | null;
  minimumStockThreshold: number;
  currentStock: number;
  costPerUnit: number | string | null;
  sellingPricePerUnit: number | string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  licenseNumber: string | null;
  supplyType: SupplyType | null;
  /** Credit period: days within which this vendor must be paid. */
  paymentTermDays: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface StockTransaction {
  id: string;
  inventoryItemId: string;
  transactionType: StockTransactionType;
  quantity: number;
  batchNumber: string | null;
  expiryDate: string | null;
  supplierId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  unitCost: number | string | null;
  totalCost: number | string | null;
  departmentId: string | null;
  notes: string | null;
  performedBy: string;
  createdAt: string;
  inventoryItem?: Pick<InventoryItem, 'id' | 'itemName' | 'itemCode' | 'unitOfMeasurement'> & {
    category?: InventoryCategory;
    currentStock?: number;
  };
  supplier?: { id: string; name: string } | null;
  performer?: { id: string; firstName: string; lastName: string } | null;
  department?: { id: string; name: string } | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  // A line references EITHER an inventory item OR a pharmacy drug (one is null).
  inventoryItemId: string | null;
  drugId: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number | string | null;
  totalPrice: number | string | null;
  inventoryItem?: (Pick<InventoryItem, 'id' | 'itemName' | 'itemCode' | 'unitOfMeasurement'> & {
    currentStock?: number;
  }) | null;
  drug?: {
    id: string;
    drugName: string;
    genericName: string | null;
    manufacturer: string | null;
    strength: string | null;
    dosageForm: string | null;
    unitOfMeasurement?: string | null;
    packSize?: number | null;
  } | null;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: PurchaseOrderStatus;
  totalAmount: number | string | null;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  _count?: { items: number };
  /** Who raised/approved the PO — shown on the detail card. */
  approver?: { id: string; firstName: string; lastName: string } | null;
}

export interface SupplyRequest {
  id: string;
  inventoryItemId: string;
  departmentId: string;
  wardId: string | null;
  quantityRequested: number;
  quantityFulfilled: number;
  status: SupplyRequestStatus;
  urgency: SupplyUrgency;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
  inventoryItem?: Pick<InventoryItem, 'id' | 'itemName' | 'itemCode' | 'unitOfMeasurement'> & {
    currentStock?: number;
  };
  department?: { id: string; name: string };
  requester?: { id: string; firstName: string; lastName: string };
  approver?: { id: string; firstName: string; lastName: string } | null;
}

export interface ExpiringInventoryRow {
  transactionId: string;
  inventoryItemId: string;
  item: Pick<InventoryItem, 'id' | 'itemName' | 'itemCode' | 'unitOfMeasurement'> & {
    category: InventoryCategory;
    currentStock: number;
  };
  batchNumber: string | null;
  receivedAt: string;
  expiryDate: string;
  receivedQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  supplier: { id: string; name: string } | null;
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

export const inventoryKeys = {
  items: {
    all: ['inventory', 'items'] as const,
    list: (params?: Record<string, unknown>) => ['inventory', 'items', 'list', params] as const,
    detail: (id: string) => ['inventory', 'items', 'detail', id] as const,
    lowStock: ['inventory', 'items', 'low-stock'] as const,
    expiring: (months: number) => ['inventory', 'items', 'expiring', months] as const,
  },
  transactions: {
    all: ['inventory', 'transactions'] as const,
    list: (params?: Record<string, unknown>) => ['inventory', 'transactions', 'list', params] as const,
  },
  purchaseOrders: {
    all: ['inventory', 'purchase-orders'] as const,
    list: (params?: Record<string, unknown>) => ['inventory', 'purchase-orders', 'list', params] as const,
    detail: (id: string) => ['inventory', 'purchase-orders', 'detail', id] as const,
  },
  suppliers: {
    all: ['inventory', 'suppliers'] as const,
    list: (params?: Record<string, unknown>) => ['inventory', 'suppliers', 'list', params] as const,
  },
  supplyRequests: {
    all: ['inventory', 'supply-requests'] as const,
    list: (params?: Record<string, unknown>) => ['inventory', 'supply-requests', 'list', params] as const,
  },
  transfers: {
    all: ['inventory', 'transfers'] as const,
    list: (params?: Record<string, unknown>) => ['inventory', 'transfers', 'list', params] as const,
    detail: (id: string) => ['inventory', 'transfers', 'detail', id] as const,
  },
  settings: ['inventory', 'settings'] as const,
  stockOverview: ['inventory', 'stock-overview'] as const,
  unifiedStock: (params?: Record<string, unknown>) => ['inventory', 'stock', 'unified', params] as const,
  reports: {
    stockBalance: (params?: Record<string, unknown>) => ['inventory', 'reports', 'stock-balance', params] as const,
    deptConsumption: (params?: Record<string, unknown>) => ['inventory', 'reports', 'dept-consumption', params] as const,
    reorderHistory: (params?: Record<string, unknown>) => ['inventory', 'reports', 'reorder-history', params] as const,
    expiryWaste: (params?: Record<string, unknown>) => ['inventory', 'reports', 'expiry-waste', params] as const,
    auditLogs: (params?: Record<string, unknown>) => ['inventory', 'reports', 'audit-logs', params] as const,
  },
};

// ============================================================
// Inventory Item Hooks
// ============================================================

export interface ItemQueryParams extends PaginatedParams {
  category?: InventoryCategory;
  isActive?: boolean | string;
}

export function useInventoryItems(params?: ItemQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.items.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useInventoryItem(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.items.detail(id ?? ''),
    queryFn: async () => {
      const response = await apiGet<InventoryItem & { stockTransactions: StockTransaction[] }>(
        `/inventory/items/${id}`,
      );
      return response.data;
    },
    enabled: !!id,
  });
}

export function useLowStockItems(params?: PaginatedParams) {
  return useQuery({
    queryKey: inventoryKeys.items.lowStock,
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items/low-stock', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useExpiringInventory(months: number = 3) {
  return useQuery({
    queryKey: inventoryKeys.items.expiring(months),
    queryFn: async () => {
      const response = await apiGet<{
        months: number;
        total: number;
        items: ExpiringInventoryRow[];
      }>('/inventory/items/expiring', { params: { months } });
      return response.data;
    },
  });
}

export interface CreateItemInput {
  itemName: string;
  itemCode?: string;
  category: InventoryCategory;
  description?: string;
  unitOfMeasurement?: string;
  minimumStockThreshold?: number;
  currentStock?: number;
  costPerUnit?: number;
  sellingPricePerUnit?: number;
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateItemInput) => {
      const response = await apiPost<InventoryItem>('/inventory/items', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateItemInput> & { isActive?: boolean }) => {
      const response = await apiPut<InventoryItem>(`/inventory/items/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/inventory/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useFlagExpired() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiPost<{ flagged: number }>('/inventory/items/flag-expired');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transactions.all });
    },
  });
}

// ============================================================
// Stock Transactions
// ============================================================

export interface CreateStockTransactionInput {
  inventoryItemId: string;
  transactionType: StockTransactionType;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  supplierId?: string;
  referenceType?: string;
  referenceId?: string;
  unitCost?: number;
  departmentId?: string;
  notes?: string;
}

export interface StockTransactionQueryParams extends PaginatedParams {
  inventoryItemId?: string;
  transactionType?: StockTransactionType;
  fromDate?: string;
  toDate?: string;
}

export function useStockTransactions(params?: StockTransactionQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.transactions.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<StockTransaction[]>('/inventory/transactions', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useCreateStockTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateStockTransactionInput) => {
      const response = await apiPost<StockTransaction>('/inventory/transactions', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

// ============================================================
// Purchase Orders
// ============================================================

export interface PurchaseOrderQueryParams extends PaginatedParams {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  fromDate?: string;
  toDate?: string;
}

export function usePurchaseOrders(params?: PurchaseOrderQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.purchaseOrders.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<PurchaseOrder[]>('/inventory/purchase-orders', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function usePurchaseOrder(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.purchaseOrders.detail(id ?? ''),
    queryFn: async () => {
      const response = await apiGet<PurchaseOrder>(`/inventory/purchase-orders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  expectedDeliveryDate?: string;
  notes?: string;
  // Each line carries exactly one of inventoryItemId / drugId.
  items: Array<{
    inventoryItemId?: string;
    drugId?: string;
    quantityOrdered: number;
    unitPrice?: number;
  }>;
}

// Per-line receive payload. Drug lines additionally carry the batch/expiry (and
// optional pricing/storage) needed to create a real DrugBatch on receipt.
export interface ReceivePurchaseOrderLine {
  purchaseOrderItemId: string;
  quantityReceived: number;
  // Purchase price entered at arrival (PO creation no longer captures price).
  unitPrice?: number;
  batchNumber?: string;
  expiryDate?: string;
  manufacturingDate?: string;
  mrp?: number;
  sellingPrice?: number;
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePurchaseOrderInput) => {
      const response = await apiPost<PurchaseOrder>('/inventory/purchase-orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders.all });
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
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders.all });
    },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      items,
    }: {
      id: string;
      items: ReceivePurchaseOrderLine[];
    }) => {
      const response = await apiPatch<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`, {
        items,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transactions.all });
    },
  });
}

// Reconcile a PO against stock already posted via the bulk-inward flow — only
// advances quantityReceived + status (no stock is posted).
export interface ReconcilePurchaseOrderLine {
  purchaseOrderItemId: string;
  quantityReceived: number;
  unitPrice?: number;
}
export function useReconcilePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, items, markDelivered }: { id: string; items: ReconcilePurchaseOrderLine[]; markDelivered?: boolean }) => {
      const response = await apiPatch<PurchaseOrder>(`/inventory/purchase-orders/${id}/reconcile`, { items, markDelivered });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders.all });
    },
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiPatch<PurchaseOrder>(`/inventory/purchase-orders/${id}/cancel`, {
        reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders.all });
    },
  });
}

// ============================================================
// Suppliers
// ============================================================

export interface SupplierQueryParams extends PaginatedParams {
  isActive?: boolean | string;
  supplyType?: SupplyType;
}

export function useSuppliers(params?: SupplierQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.suppliers.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<Supplier[]>('/inventory/suppliers', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  licenseNumber?: string;
  supplyType?: SupplyType;
  /** Credit period: days within which this vendor must be paid. */
  paymentTermDays?: number;
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSupplierInput) => {
      const response = await apiPost<Supplier>('/inventory/suppliers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers.all });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateSupplierInput> & { isActive?: boolean }) => {
      const response = await apiPut<Supplier>(`/inventory/suppliers/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers.all });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/inventory/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers.all });
    },
  });
}

// ============================================================
// Supply Requests
// ============================================================

export interface SupplyRequestQueryParams extends PaginatedParams {
  status?: SupplyRequestStatus;
  departmentId?: string;
  wardId?: string;
  urgency?: SupplyUrgency;
}

export function useSupplyRequests(params?: SupplyRequestQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.supplyRequests.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<SupplyRequest[]>('/inventory/supply-requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export interface CreateSupplyRequestInput {
  departmentId: string;
  wardId?: string;
  inventoryItemId: string;
  quantityRequested: number;
  urgency?: SupplyUrgency;
  notes?: string;
}

export function useCreateSupplyRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSupplyRequestInput) => {
      const response = await apiPost<SupplyRequest>('/inventory/supply-requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.supplyRequests.all });
    },
  });
}

export function useApproveSupplyRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      notes?: string;
    }) => {
      const response = await apiPatch<SupplyRequest>(`/inventory/supply-requests/${id}/approve`, {
        status,
        notes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.supplyRequests.all });
    },
  });
}

export function useFulfillSupplyRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      quantityFulfilled,
      notes,
    }: {
      id: string;
      quantityFulfilled: number;
      notes?: string;
    }) => {
      const response = await apiPatch<SupplyRequest>(`/inventory/supply-requests/${id}/fulfill`, {
        quantityFulfilled,
        notes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.supplyRequests.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transactions.all });
    },
  });
}

// ============================================================
// Reports (Week 10)
// ============================================================

export interface StockBalanceParams {
  fromDate?: string;
  toDate?: string;
  groupBy?: 'day' | 'month';
  inventoryItemId?: string;
  category?: InventoryCategory;
}

export interface StockBalanceItem {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  category: string;
  currentStock: number;
  totalIn: number;
  totalOut: number;
  net: number;
  unit: string | null;
}

export interface StockBalanceMovement {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  category: string;
  bucket: string;
  stockIn: number;
  stockOut: number;
  adjustments: number;
  expiredRemoval: number;
  returns: number;
  net: number;
}

export interface StockBalanceReport {
  fromDate: string;
  toDate: string;
  groupBy: 'day' | 'month';
  items: StockBalanceItem[];
  movements: StockBalanceMovement[];
  totals: { stockIn: number; stockOut: number; returns: number; expiredRemoval: number };
}

export function useStockBalanceReport(params?: StockBalanceParams) {
  return useQuery({
    queryKey: inventoryKeys.reports.stockBalance(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<StockBalanceReport>('/inventory/reports/stock-balance', { params });
      return response.data;
    },
  });
}

// ── Detailed Analysis report (single-call deep rollup) ──
export interface InventoryDetailedReport {
  period: { fromDate: string; toDate: string; days: number };
  valuation: {
    itemCount: number; units: number; costValue: number; retailValue: number; potentialMargin: number;
    byCategory: { category: string; items: number; units: number; costValue: number; retailValue: number }[];
  };
  lowStock: { count: number; items: { itemName: string; itemCode: string; category: string; stock: number; minStock: number; deficit: number; unit: string }[] };
  movements: {
    stockIn: { qty: number; value: number }; stockOut: { qty: number; value: number };
    adjustments: { qty: number; value: number }; returns: { qty: number; value: number }; expiredRemoval: { qty: number; value: number };
    trend: { date: string; stockIn: number; stockOut: number }[];
  };
  topConsumed: { itemName: string; category: string; qty: number; value: number }[];
  purchases: {
    poCount: number; totalSpend: number;
    byStatus: { status: string; count: number; value: number }[];
    bySupplier: { supplierId: string; name: string; orders: number; value: number }[];
  };
  transfers: { count: number; byStatus: { status: string; count: number; qty: number }[] };
  expiryWaste: {
    summary: { expiringCount: number; expiredCount: number; returnCount: number; wasteValue: number; expiredQuantity: number; returnQuantity: number };
    expiringSoon: { itemName: string; batchNumber: string; expiryDate: string; remaining: number; value: number }[];
  };
  departments: { departmentName: string; quantity: number; cost: number }[];
}

export function useInventoryDetailedReport(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['inventory', 'detailed-report', params],
    queryFn: async () => {
      const response = await apiGet<InventoryDetailedReport>('/inventory/reports/detailed', { params });
      return response.data;
    },
  });
}

export interface DeptConsumptionParams {
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
  inventoryItemId?: string;
}

export interface DeptConsumptionDept {
  departmentId: string;
  departmentName: string;
  totalQuantity: number;
  totalCost: number;
  items: Array<{
    itemId: string;
    itemName: string;
    itemCode: string | null;
    category: string;
    unit: string | null;
    quantity: number;
    totalCost: number;
  }>;
}

export interface DeptConsumptionReport {
  fromDate: string;
  toDate: string;
  departments: DeptConsumptionDept[];
  totals: { quantity: number; cost: number };
}

export function useDeptConsumptionReport(params?: DeptConsumptionParams) {
  return useQuery({
    queryKey: inventoryKeys.reports.deptConsumption(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<DeptConsumptionReport>('/inventory/reports/dept-consumption', { params });
      return response.data;
    },
  });
}

export interface ReorderHistoryParams extends PaginatedParams {
  fromDate?: string;
  toDate?: string;
  supplierId?: string;
  inventoryItemId?: string;
  status?: PurchaseOrderStatus;
}

export interface ReorderHistorySummaryRow {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  totalAmount: number;
}

export function useReorderHistoryReport(params?: ReorderHistoryParams) {
  return useQuery({
    queryKey: inventoryKeys.reports.reorderHistory(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<PurchaseOrder[]>('/inventory/reports/reorder-history', { params });
      return {
        data: response.data,
        meta: response.meta as PaginationMeta | undefined,
        bySupplier:
          (response as unknown as { bySupplier?: ReorderHistorySummaryRow[] }).bySupplier ?? [],
      };
    },
  });
}

export interface ExpiryWasteParams {
  fromDate?: string;
  toDate?: string;
  windowMonths?: number;
  inventoryItemId?: string;
}

export interface ExpiryWasteReport {
  fromDate: string;
  toDate: string;
  windowMonths: number;
  expiringBatches: Array<{
    transactionId: string;
    item: {
      id: string;
      itemName: string;
      itemCode: string | null;
      unitOfMeasurement: string | null;
      category: string;
    };
    batchNumber: string | null;
    expiryDate: string;
    receivedAt: string;
    receivedQuantity: number;
    remainingQuantity: number;
    unitCost: number;
  }>;
  expiredRemovals: StockTransaction[];
  returns: StockTransaction[];
  summary: {
    expiringCount: number;
    expiredCount: number;
    returnCount: number;
    wasteValue: number;
    expiredQuantity: number;
    returnQuantity: number;
  };
}

export function useExpiryWasteReport(params?: ExpiryWasteParams) {
  return useQuery({
    queryKey: inventoryKeys.reports.expiryWaste(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<ExpiryWasteReport>('/inventory/reports/expiry-waste', { params });
      return response.data;
    },
  });
}

export interface AuditLogsParams extends PaginatedParams {
  fromDate?: string;
  toDate?: string;
  userId?: string;
  action?: 'create' | 'update' | 'delete';
  entityType?: string;
}

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string | null;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export function useInventoryAuditLogs(params?: AuditLogsParams) {
  return useQuery({
    queryKey: inventoryKeys.reports.auditLogs(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<AuditLogRow[]>('/inventory/reports/audit-logs', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

// ============================================================
// Stock Transfers (Week 10)
// ============================================================

export type StockTransferStatus =
  | 'pending'
  | 'approved'
  | 'dispatched'
  | 'received'
  | 'rejected'
  | 'cancelled';

export interface StockTransfer {
  id: string;
  transferNumber: string;
  inventoryItemId: string | null;
  drugBatchId: string | null;
  fromDepartmentId: string | null;
  toDepartmentId: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  quantityRequested: number;
  quantityTransferred: number;
  batchNumber: string | null;
  status: StockTransferStatus;
  reason: string | null;
  notes: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  dispatchedBy: string | null;
  dispatchedAt: string | null;
  receivedBy: string | null;
  receivedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  inventoryItem?: (Pick<InventoryItem, 'id' | 'itemName' | 'itemCode' | 'unitOfMeasurement'> & {
    currentStock?: number;
  }) | null;
  // Pharmacy drug transfers reference a drug batch instead of an inventory item.
  drugBatch?: {
    id: string;
    batchNumber: string;
    quantityInStock?: number;
    drug?: { drugName: string } | null;
  } | null;
  fromDepartment?: { id: string; name: string } | null;
  toDepartment?: { id: string; name: string } | null;
  requester?: { id: string; firstName: string; lastName: string };
  approver?: { id: string; firstName: string; lastName: string } | null;
}

export interface CreateStockTransferInput {
  // Exactly one of inventoryItemId / drugBatchId (drug batch = pharmacy stock).
  inventoryItemId?: string;
  drugBatchId?: string;
  fromDepartmentId?: string;
  toDepartmentId?: string;
  fromLocation?: string;
  toLocation?: string;
  quantityRequested: number;
  batchNumber?: string;
  reason?: string;
  notes?: string;
}

export interface StockTransferQueryParams extends PaginatedParams {
  status?: StockTransferStatus;
  fromDepartmentId?: string;
  toDepartmentId?: string;
  inventoryItemId?: string;
  fromDate?: string;
  toDate?: string;
}

export function useStockTransfers(params?: StockTransferQueryParams) {
  return useQuery({
    queryKey: inventoryKeys.transfers.list(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<StockTransfer[]>('/inventory/transfers', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useStockTransfer(id: string | null) {
  return useQuery({
    queryKey: inventoryKeys.transfers.detail(id ?? ''),
    queryFn: async () => {
      const response = await apiGet<StockTransfer>(`/inventory/transfers/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateStockTransferInput) => {
      const response = await apiPost<StockTransfer>('/inventory/transfers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transfers.all });
    },
  });
}

export function useApproveStockTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const response = await apiPatch<StockTransfer>(`/inventory/transfers/${id}/approve`, { notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transfers.all });
    },
  });
}

export function useRejectStockTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const response = await apiPatch<StockTransfer>(`/inventory/transfers/${id}/reject`, {
        rejectionReason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transfers.all });
    },
  });
}

export function useDispatchStockTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantityDispatched }: { id: string; quantityDispatched?: number }) => {
      const response = await apiPatch<StockTransfer>(`/inventory/transfers/${id}/dispatch`, {
        quantityDispatched,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transfers.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useReceiveStockTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<StockTransfer>(`/inventory/transfers/${id}/receive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transfers.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

export function useCancelStockTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiPatch<StockTransfer>(`/inventory/transfers/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transfers.all });
    },
  });
}

// ============================================================
// Inventory Settings & Alerts (per-tenant module configuration)
// ============================================================

export interface InventorySettings {
  id: string;
  tenantId: string;
  defaultLowStockThreshold: number;
  expiryAlertMonths: number;
  lowStockAlertEnabled: boolean;
  expiryAlertEnabled: boolean;
  autoFlagExpired: boolean;
  preventExpiredUse: boolean;
  reorderNotifyEnabled: boolean;
  alertRecipientRoles: string[];
  lastAlertRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateInventorySettingsInput = Partial<
  Pick<
    InventorySettings,
    | 'defaultLowStockThreshold'
    | 'expiryAlertMonths'
    | 'lowStockAlertEnabled'
    | 'expiryAlertEnabled'
    | 'autoFlagExpired'
    | 'preventExpiredUse'
    | 'reorderNotifyEnabled'
    | 'alertRecipientRoles'
  >
>;

export interface RunAlertsResult {
  lowStockAlerts: number;
  expiryAlerts: number;
  expiredFlagged: number;
  ranAt: string;
}

export function useInventorySettings() {
  return useQuery({
    queryKey: inventoryKeys.settings,
    queryFn: async () => {
      const response = await apiGet<InventorySettings>('/inventory/settings');
      return response.data;
    },
  });
}

export function useUpdateInventorySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateInventorySettingsInput) => {
      const response = await apiPut<InventorySettings>('/inventory/settings', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.settings });
      // New default threshold affects item creation; refresh item views too.
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
    },
  });
}

// ============================================================
// Unified Stock Overview (combined Inventory page summary)
// ============================================================

export interface StockOverviewSystem {
  skus: number;
  lowStock: number;
  outOfStock: number;
  expiring: number;
  stockValue: number;
}

export interface StockOverview {
  expiryAlertMonths: number;
  // Drugs mapped to a generic inventory item (de-duped from combined.skus).
  linkedSkus: number;
  items: StockOverviewSystem;
  drugs: StockOverviewSystem & { recalledBatches: number; valueAtRisk: number };
  combined: StockOverviewSystem & { valueAtRisk: number };
}

// One summary spanning BOTH stock systems (generic items + pharmacy drug stock),
// backed by GET /inventory/stock-overview. Powers the combined page header.
export function useInventoryStockOverview() {
  return useQuery({
    queryKey: inventoryKeys.stockOverview,
    queryFn: async () => {
      const response = await apiGet<StockOverview>('/inventory/stock-overview');
      return response.data;
    },
  });
}

// ============================================================
// Unified storage — one list of "things in storage" spanning generic inventory
// items AND pharmacy drugs (batch stock rolled up), backed by GET /inventory/stock.
// ============================================================

export type UnifiedStockKind = 'item' | 'drug';

export interface UnifiedStockRow {
  kind: UnifiedStockKind;
  // InventoryItem.id (kind=item) or DrugFormulary.id (kind=drug).
  refId: string;
  name: string;
  code: string | null;
  category: string;
  unit: string | null;
  currentStock: number;
  reorderLevel: number | null;
  costPerUnit: number | null;
  sellingPrice: number | null;
  tracksBatches: boolean;
  batchCount: number;
  nearestExpiry: string | null;
  isRecalled: boolean;
}

export interface UnifiedStockParams extends PaginatedParams {
  search?: string;
  type?: 'all' | 'item' | 'drug';
  category?: InventoryCategory;
  stockStatus?: 'all' | 'low' | 'out' | 'expiring' | 'in' | 'recalled';
}

export function useUnifiedStock(params?: UnifiedStockParams) {
  return useQuery({
    queryKey: inventoryKeys.unifiedStock(params as Record<string, unknown>),
    queryFn: async () => {
      const response = await apiGet<UnifiedStockRow[]>('/inventory/stock', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export interface CreateUnifiedItemPayload {
  itemName: string;
  itemCode?: string;
  category: InventoryCategory;
  description?: string;
  unitOfMeasurement?: string;
  minimumStockThreshold?: number;
  currentStock?: number;
  costPerUnit?: number;
  sellingPricePerUnit?: number;
}

export interface CreateUnifiedDrugPayload {
  drugName: string;
  // Type of stock — every type is created through this one payload.
  category?: InventoryCategory;
  description?: string;
  // Opening stock → a no-expiry OPENING batch created server-side.
  openingStock?: number;
  costPerUnit?: number;
  genericName?: string;
  manufacturer?: string;
  dosageForm?: string;
  strength?: string;
  unitOfMeasurement?: string;
  looseUnitLabel?: string;
  packSize?: number;
  taxPercent?: number;
  price?: number;
  minStock?: number;
  hsnCode?: string;
  gtin?: string;
  indications?: string;
  contraindications?: string;
}

export interface CreateUnifiedStockInput {
  kind: UnifiedStockKind;
  force?: boolean;
  item?: CreateUnifiedItemPayload;
  drug?: CreateUnifiedDrugPayload;
}

export interface CreateUnifiedStockResult {
  kind: UnifiedStockKind;
  status: 'created' | 'duplicate_suspected';
  item?: { id: string; [k: string]: unknown };
  matches?: Array<{ id: string; drugName: string; score: number; [k: string]: unknown }>;
}

// One "New Item" flow — creates a generic item or a batch-tracked medicine.
export function useCreateUnifiedStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUnifiedStockInput) => {
      const response = await apiPost<CreateUnifiedStockResult>('/inventory/stock', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockOverview });
    },
  });
}

export function useRunInventoryAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data?: { autoFlagExpired?: boolean }) => {
      const response = await apiPost<RunAlertsResult>('/inventory/alerts/run', data ?? {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.settings });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-overview'] });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transactions.all });
    },
  });
}
