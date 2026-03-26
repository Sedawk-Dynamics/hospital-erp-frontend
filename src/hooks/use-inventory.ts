import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface InventoryItem {
  id: string;
  name: string;
  genericName: string | null;
  category: string | null;
  sku: string | null;
  unit: string | null;
  currentStock: number;
  reorderLevel: number | null;
  maxStock: number | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  itemId: string;
  item?: InventoryItem;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  department: string | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string | null;
  supplier?: Supplier;
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';
  totalAmount: number | null;
  itemCount: number;
  notes: string | null;
  orderedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  items?: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  itemId: string | null;
  item?: InventoryItem;
  itemName: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  receivedQuantity: number | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyRequest {
  id: string;
  department: string | null;
  requestedBy: string | null;
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected';
  notes: string | null;
  items?: Array<{ itemId: string; quantity: number; item?: InventoryItem }>;
  createdAt: string;
  updatedAt: string;
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
    list: (params?: PaginatedParams) => ['inventory', 'items', 'list', params] as const,
    lowStock: ['inventory', 'items', 'low-stock'] as const,
  },
  transactions: {
    all: ['inventory', 'transactions'] as const,
    list: (params?: PaginatedParams) => ['inventory', 'transactions', 'list', params] as const,
  },
  purchaseOrders: {
    all: ['inventory', 'purchase-orders'] as const,
    list: (params?: PaginatedParams) => ['inventory', 'purchase-orders', 'list', params] as const,
    detail: (id: string) => ['inventory', 'purchase-orders', 'detail', id] as const,
  },
  suppliers: {
    all: ['inventory', 'suppliers'] as const,
    list: (params?: PaginatedParams) => ['inventory', 'suppliers', 'list', params] as const,
  },
  supplyRequests: {
    all: ['inventory', 'supply-requests'] as const,
    list: (params?: PaginatedParams) => ['inventory', 'supply-requests', 'list', params] as const,
  },
};

// ============================================================
// Inventory Item Hooks
// ============================================================

export function useInventoryItems(params?: PaginatedParams) {
  return useQuery({
    queryKey: inventoryKeys.items.list(params),
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useLowStockItems() {
  return useQuery({
    queryKey: inventoryKeys.items.lowStock,
    queryFn: async () => {
      const response = await apiGet<InventoryItem[]>('/inventory/items/low-stock');
      return response.data;
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      genericName?: string;
      category?: string;
      sku?: string;
      unit?: string;
      currentStock?: number;
      reorderLevel?: number;
      maxStock?: number;
      purchasePrice?: number;
      sellingPrice?: number;
    }) => {
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
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const response = await apiPut<InventoryItem>(`/inventory/items/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
    },
  });
}

// ============================================================
// Stock Transaction Hooks
// ============================================================

export function useStockTransactions(params?: PaginatedParams) {
  return useQuery({
    queryKey: inventoryKeys.transactions.list(params),
    queryFn: async () => {
      const response = await apiGet<StockTransaction[]>('/inventory/transactions', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useCreateStockTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      itemId: string;
      type: 'in' | 'out' | 'adjustment' | 'transfer';
      quantity: number;
      referenceType?: string;
      referenceId?: string;
      department?: string;
      notes?: string;
    }) => {
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
// Purchase Order Hooks
// ============================================================

export function usePurchaseOrders(params?: PaginatedParams) {
  return useQuery({
    queryKey: inventoryKeys.purchaseOrders.list(params),
    queryFn: async () => {
      const response = await apiGet<PurchaseOrder[]>('/inventory/purchase-orders', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      supplierId?: string;
      notes?: string;
      items: Array<{
        itemId?: string;
        itemName: string;
        quantity: number;
        unitPrice?: number;
      }>;
    }) => {
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
    mutationFn: async ({ id, items }: { id: string; items?: Array<{ itemId: string; receivedQuantity: number }> }) => {
      const response = await apiPatch<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`, { items });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders.all });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items.all });
    },
  });
}

// ============================================================
// Supplier Hooks
// ============================================================

export function useSuppliers(params?: PaginatedParams) {
  return useQuery({
    queryKey: inventoryKeys.suppliers.list(params),
    queryFn: async () => {
      const response = await apiGet<Supplier[]>('/inventory/suppliers', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
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
      gstNumber?: string;
    }) => {
      const response = await apiPost<Supplier>('/inventory/suppliers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers.all });
    },
  });
}
