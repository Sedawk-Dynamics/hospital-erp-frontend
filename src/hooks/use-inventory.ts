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
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  licenseNumber: string | null;
  supplyType: SupplyType | null;
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
  inventoryItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number | string | null;
  totalPrice: number | string | null;
  inventoryItem?: Pick<InventoryItem, 'id' | 'itemName' | 'itemCode' | 'unitOfMeasurement'> & {
    currentStock?: number;
  };
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
  items: Array<{
    inventoryItemId: string;
    quantityOrdered: number;
    unitPrice?: number;
  }>;
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
      items: Array<{ purchaseOrderItemId: string; quantityReceived: number }>;
    }) => {
      const response = await apiPatch<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`, {
        items,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transactions.all });
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
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  licenseNumber?: string;
  supplyType?: SupplyType;
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
      queryClient.invalidateQueries({ queryKey: inventoryKeys.transactions.all });
    },
  });
}
