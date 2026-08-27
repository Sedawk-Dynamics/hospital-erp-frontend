import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiClient } from '@/lib/api';

// ============================================================
// NDPS Narcotic Accounting (Form 3C/3E/3H + Inspector Dashboard)
// ============================================================

export interface NdpsLocation {
  id: string;
  name: string;
  type: 'main_vault' | 'sub_store';
  wardId: string | null;
  isActive: boolean;
}

export interface NdpsStockByDrug {
  drugId: string;
  drugName: string;
  strength: string | null;
  total: number;
  locations: Array<{ locationId: string; name: string; type: string; quantity: number }>;
}

export interface NdpsRegisterRow {
  id: string;
  occurredAt: string;
  entryType: 'inward' | 'transfer' | 'dispense' | 'disposal';
  drugName: string;
  strength: string | null;
  quantity: number;
  from: string | null;
  to: string | null;
  recordedBy: string | null;
  counterparty: string | null;
  coSignBy: string | null;
  ndpsLicenseNumber: string | null;
  form3cNumber: string | null;
  transportDetails: string | null;
  grossWeight: string | null;
  batchNumber: string | null;
  patient: { mrn: string; name: string } | null;
  doctorRegNo: string | null;
  bedNumber: string | null;
  diagnosis: string | null;
  reasonCode: string | null;
  referenceNumber: string | null;
  attachmentUrl: string | null;
  notes: string | null;
}

export interface NdpsDailyRow {
  id: string;
  date: string;
  drugName: string;
  strength: string | null;
  openingBalance: number;
  received: number;
  dispensed: number;
  disposed: number;
  closingBalance: number;
  physicalCount: number | null;
  isVerified: boolean;
  variance: number | null;
}

const keys = {
  locations: ['ndps', 'locations'] as const,
  stock: (drugId?: string) => ['ndps', 'stock', drugId ?? null] as const,
  register: (p: unknown) => ['ndps', 'register', p] as const,
  daily: (p: unknown) => ['ndps', 'daily', p] as const,
};

export function useNdpsLocations() {
  return useQuery({
    queryKey: keys.locations,
    queryFn: async () => (await apiGet<NdpsLocation[]>('/ndps/locations')).data,
  });
}

export function useNdpsStockByLocation(drugFormularyId?: string) {
  return useQuery({
    queryKey: keys.stock(drugFormularyId),
    queryFn: async () =>
      (await apiGet<{ items: NdpsStockByDrug[] }>('/ndps/stock-by-location', { params: { drugFormularyId } })).data,
  });
}

export function useNdpsRegister(params: { formType?: string; drugFormularyId?: string; fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: keys.register(params),
    queryFn: async () =>
      (await apiGet<{ items: NdpsRegisterRow[]; total: number }>('/ndps/register', { params })).data,
  });
}

export function useNdpsDailyBalances(params: { drugFormularyId?: string; fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: keys.daily(params),
    queryFn: async () =>
      (await apiGet<{ items: NdpsDailyRow[]; total: number }>('/ndps/daily-balances', { params })).data,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['ndps'] });
}

export function useNdpsReceiveConsignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      drugFormularyId: string; quantity: number; ndpsLicenseNumber: string; form3cNumber: string;
      transportDetails?: string; grossWeight?: string; supplierId?: string; batchNumber?: string; expiryDate?: string; notes?: string;
    }) => (await apiPost('/ndps/consignments', body)).data,
    onSuccess: () => invalidateAll(qc),
  });
}

// useNdpsTransfer is gone with its endpoint. Moving a narcotic is a stock
// transfer like any other and goes through the stock-transfer board, which
// applies the same dual-custody rule — see useDispatchStockTransfer.

export function useNdpsConsumption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      drugFormularyId: string; fromLocationId: string; quantity: number; patientId: string;
      doctorRegNo: string; bedNumber: string; diagnosis: string; notes?: string;
    }) => (await apiPost('/ndps/consumption', body)).data,
    onSuccess: () => invalidateAll(qc),
  });
}

export function useNdpsDisposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      drugFormularyId: string; locationId: string; quantity: number; reasonCode: string;
      referenceNumber: string; coSignById: string; attachmentUrl?: string; notes?: string;
    }) => (await apiPost('/ndps/disposals', body)).data,
    onSuccess: () => invalidateAll(qc),
  });
}

export function useNdpsUploadEvidence() {
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      // Axios infers the multipart boundary — an explicit Content-Type breaks it.
      const { data } = await apiClient.post('/ndps/disposals/evidence', fd, {
        headers: { 'Content-Type': undefined as unknown as string },
      });
      return (data as { data: { fileUrl: string; fileName: string } }).data;
    },
  });
}

export function useNdpsCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; type?: string; wardId?: string }) =>
      (await apiPost('/ndps/locations', body)).data,
    onSuccess: () => invalidateAll(qc),
  });
}

export function useNdpsRunDailyClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date?: string) => (await apiPost<{ count: number }>('/ndps/daily-close', { date })).data,
    onSuccess: () => invalidateAll(qc),
  });
}

export function useNdpsVerifyDaily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, physicalCount }: { id: string; physicalCount: number }) =>
      (await apiPatch(`/ndps/daily-balances/${id}/verify`, { physicalCount })).data,
    onSuccess: () => invalidateAll(qc),
  });
}
