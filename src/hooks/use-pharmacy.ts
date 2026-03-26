import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface DrugCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FormularyItem {
  id: string;
  drugName: string;
  genericName: string | null;
  categoryId: string | null;
  category?: DrugCategory;
  dosageForm: string | null;
  strength: string | null;
  unit: string | null;
  manufacturer: string | null;
  hsnCode: string | null;
  gstRate: number | null;
  mrp: number | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  reorderLevel: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DrugBatch {
  id: string;
  formularyItemId: string;
  formularyItem?: FormularyItem;
  batchNumber: string;
  manufacturingDate: string | null;
  expiryDate: string;
  quantity: number;
  availableQuantity: number;
  purchasePrice: number | null;
  sellingPrice: number | null;
  mrp: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DispenseRecord {
  id: string;
  patientId: string | null;
  patient?: { id: string; firstName: string; lastName: string; uhid?: string };
  prescriptionId: string | null;
  dispensedBy: string | null;
  dispensedAt: string;
  status: 'pending' | 'dispensed' | 'verified' | 'cancelled';
  totalAmount: number | null;
  notes: string | null;
  items?: DispenseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DispenseItem {
  id: string;
  dispenseId: string;
  formularyItemId: string;
  formularyItem?: FormularyItem;
  batchId: string | null;
  batch?: DrugBatch;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface PharmacyReturn {
  id: string;
  dispenseId: string | null;
  dispense?: DispenseRecord;
  patientId: string | null;
  patient?: { id: string; firstName: string; lastName: string };
  reason: string | null;
  status: 'pending' | 'processed' | 'rejected';
  totalRefund: number | null;
  processedBy: string | null;
  processedAt: string | null;
  items?: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  formularyItemId: string;
  formularyItem?: FormularyItem;
  batchId: string | null;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
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

export const pharmacyKeys = {
  categories: {
    all: ['pharmacy', 'categories'] as const,
    list: (params?: PaginatedParams) => ['pharmacy', 'categories', 'list', params] as const,
  },
  formulary: {
    all: ['pharmacy', 'formulary'] as const,
    list: (params?: PaginatedParams) => ['pharmacy', 'formulary', 'list', params] as const,
    detail: (id: string) => ['pharmacy', 'formulary', 'detail', id] as const,
  },
  batches: {
    all: ['pharmacy', 'batches'] as const,
    list: (params?: PaginatedParams) => ['pharmacy', 'batches', 'list', params] as const,
    expiring: (params?: Record<string, unknown>) => ['pharmacy', 'batches', 'expiring', params] as const,
  },
  dispensing: {
    all: ['pharmacy', 'dispensing'] as const,
    list: (params?: PaginatedParams) => ['pharmacy', 'dispensing', 'list', params] as const,
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
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; isActive?: boolean }) => {
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

export function useFormulary(params?: PaginatedParams) {
  return useQuery({
    queryKey: pharmacyKeys.formulary.list(params),
    queryFn: async () => {
      const response = await apiGet<FormularyItem[]>('/pharmacy/formulary', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useFormularyItem(id: string) {
  return useQuery({
    queryKey: pharmacyKeys.formulary.detail(id),
    queryFn: async () => {
      const response = await apiGet<FormularyItem>(`/pharmacy/formulary/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      drugName: string;
      genericName?: string;
      categoryId?: string;
      dosageForm?: string;
      strength?: string;
      unit?: string;
      manufacturer?: string;
      hsnCode?: string;
      gstRate?: number;
      mrp?: number;
      purchasePrice?: number;
      sellingPrice?: number;
      reorderLevel?: number;
    }) => {
      const response = await apiPost<FormularyItem>('/pharmacy/formulary', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
    },
  });
}

export function useUpdateFormularyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Omit<FormularyItem, 'id' | 'createdAt' | 'updatedAt' | 'category'>>) => {
      const response = await apiPut<FormularyItem>(`/pharmacy/formulary/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.formulary.detail(variables.id) });
    },
  });
}

// ============================================================
// Batch Hooks
// ============================================================

export function useBatches(params?: PaginatedParams) {
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
        params: { drugId, limit: 50 },
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

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      formularyItemId: string;
      batchNumber: string;
      manufacturingDate?: string;
      expiryDate: string;
      quantity: number;
      purchasePrice?: number;
      sellingPrice?: number;
      mrp?: number;
      hsnCode?: string;
      gstRate?: number;
    }) => {
      const response = await apiPost<DrugBatch>('/pharmacy/batches', data);
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

export function useDispenseRecords(params?: PaginatedParams) {
  return useQuery({
    queryKey: pharmacyKeys.dispensing.list(params),
    queryFn: async () => {
      const response = await apiGet<DispenseRecord[]>('/pharmacy/dispensing', { params });
      return { data: response.data, meta: response.meta as PaginationMeta | undefined };
    },
  });
}

export function useCreateDispense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      prescriptionId?: string;
      prescriptionItemId?: string;
      items: Array<{
        drugBatchId: string;
        quantity: number;
      }>;
      notes?: string;
    }) => {
      // Backend expects single-item dispense per call, so we dispatch each item
      const results: DispenseRecord[] = [];
      for (const item of data.items) {
        const response = await apiPost<DispenseRecord>('/pharmacy/dispensing', {
          patientId: data.patientId,
          prescriptionId: data.prescriptionId || undefined,
          prescriptionItemId: data.prescriptionItemId || undefined,
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
    },
  });
}

// ============================================================
// Returns Hooks
// ============================================================

export function useReturns(params?: PaginatedParams) {
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
      dispenseId?: string;
      patientId?: string;
      reason?: string;
      items: Array<{
        formularyItemId: string;
        batchId?: string;
        quantity: number;
        unitPrice?: number;
      }>;
    }) => {
      const response = await apiPost<PharmacyReturn>('/pharmacy/returns', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.returns.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.dispensing.all });
    },
  });
}

export function useProcessReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const response = await apiPatch<PharmacyReturn>(`/pharmacy/returns/${id}/process`, { action });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.returns.all });
      queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches.all });
    },
  });
}
