import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface Admission {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    uhid?: string;
    gender?: string;
    dateOfBirth?: string;
    phone?: string;
  };
  admissionDate: string;
  dischargeDate?: string;
  wardId?: string;
  ward?: {
    id: string;
    name: string;
  };
  bedId?: string;
  bed?: {
    id: string;
    bedNumber: string;
  };
  doctorId?: string;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  admissionType?: string;
  diagnosis?: string;
  procedure?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    uhid?: string;
  };
  doctorId?: string;
  doctor?: {
    id: string;
    user?: { firstName: string; lastName: string };
  };
  visitDate: string;
  visitType?: string;
  chiefComplaint?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  description?: string | null;
  isActive: boolean;
  _count?: { wards: number };
  wards?: Ward[];
}

export interface BedAvailability {
  id: string;
  bedNumber: string;
  wardId: string;
  ward?: {
    id: string;
    name: string;
    floor?: { id: string; name: string; level: number } | null;
  };
  status: string;
  bedType?: string;
}

export interface Ward {
  id: string;
  name: string;
  description?: string;
  floorId?: string | null;
  floor?: { id: string; name: string; level: number } | null;
  totalBeds: number;
  occupiedBeds?: number;
  availableBeds?: number;
  wardType?: string;
  status?: string;
  isActive?: boolean;
  beds?: BedAvailability[];
  _count?: {
    beds: number;
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdmissionParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  wardId?: string;
  date?: string;
  sortOrder?: 'asc' | 'desc';
}

interface BedListParams {
  wardId?: string;
  floorId?: string;
  status?: 'available' | 'occupied' | 'reserved' | 'maintenance';
  bedType?: string;
  forPatientId?: string;
  limit?: number;
}

interface VisitParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  date?: string;
  doctorId?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// Query Keys
// ============================================================

export const clinicalKeys = {
  all: ['clinical'] as const,
  admissions: {
    all: ['clinical', 'admissions'] as const,
    list: (params?: AdmissionParams) => ['clinical', 'admissions', 'list', params] as const,
    detail: (id: string) => ['clinical', 'admissions', 'detail', id] as const,
  },
  visits: {
    all: ['clinical', 'visits'] as const,
    list: (params?: VisitParams) => ['clinical', 'visits', 'list', params] as const,
    detail: (id: string) => ['clinical', 'visits', 'detail', id] as const,
  },
  beds: {
    all: ['clinical', 'beds'] as const,
    list: (params?: BedListParams) => ['clinical', 'beds', 'list', params] as const,
    availability: ['clinical', 'beds', 'availability'] as const,
    occupancy: ['clinical', 'beds', 'occupancy'] as const,
  },
  wards: {
    all: ['clinical', 'wards'] as const,
    detail: (id: string) => ['clinical', 'wards', 'detail', id] as const,
  },
  floors: {
    all: ['clinical', 'floors'] as const,
    detail: (id: string) => ['clinical', 'floors', 'detail', id] as const,
  },
};

// ============================================================
// Admission Hooks
// ============================================================

export function useAdmissions(params?: AdmissionParams) {
  return useQuery({
    queryKey: clinicalKeys.admissions.list(params),
    queryFn: async () => {
      const response = await apiGet<Admission[]>('/clinical/admissions', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useAdmission(id: string) {
  return useQuery({
    queryKey: clinicalKeys.admissions.detail(id),
    queryFn: async () => {
      const response = await apiGet<Admission>(`/clinical/admissions/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateAdmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      wardId?: string;
      bedId?: string;
      doctorId?: string;
      admissionType?: string;
      diagnosis?: string;
      procedure?: string;
      notes?: string;
    }) => {
      const response = await apiPost<Admission>('/clinical/admissions', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicalKeys.admissions.all });
      queryClient.invalidateQueries({ queryKey: clinicalKeys.beds.all });
    },
  });
}

export function useDischargePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      dischargeNotes?: string;
      dischargeSummary?: string;
    }) => {
      const response = await apiPatch<Admission>(`/clinical/admissions/${id}/discharge`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clinicalKeys.admissions.all });
      queryClient.invalidateQueries({ queryKey: clinicalKeys.admissions.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: clinicalKeys.beds.all });
    },
  });
}

// ============================================================
// Visit Hooks
// ============================================================

export function useVisits(params?: VisitParams) {
  return useQuery({
    queryKey: clinicalKeys.visits.list(params),
    queryFn: async () => {
      const response = await apiGet<Visit[]>('/clinical/visits', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      doctorId?: string;
      visitType?: string;
      chiefComplaint?: string;
      notes?: string;
    }) => {
      const response = await apiPost<Visit>('/clinical/visits', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicalKeys.visits.all });
    },
  });
}

export function useCloseVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      notes?: string;
    }) => {
      const response = await apiPatch<Visit>(`/clinical/visits/${id}/close`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clinicalKeys.visits.all });
      queryClient.invalidateQueries({ queryKey: clinicalKeys.visits.detail(variables.id) });
    },
  });
}

// ============================================================
// Bed & Ward Hooks
// ============================================================

export function useBedAvailability() {
  return useQuery({
    queryKey: clinicalKeys.beds.availability,
    queryFn: async () => {
      const response = await apiGet<BedAvailability[]>('/infrastructure/beds/availability');
      return response.data;
    },
  });
}

export function useBeds(params?: BedListParams) {
  return useQuery({
    queryKey: clinicalKeys.beds.list(params),
    queryFn: async () => {
      const response = await apiGet<BedAvailability[]>('/infrastructure/beds', {
        params: { limit: 500, ...params },
      });
      return response.data;
    },
    enabled: params?.wardId !== undefined ? Boolean(params.wardId) : true,
  });
}

export function useOccupancy() {
  return useQuery({
    queryKey: clinicalKeys.beds.occupancy,
    queryFn: async () => {
      const response = await apiGet<unknown>('/infrastructure/occupancy');
      return response.data;
    },
  });
}

export function useWards() {
  return useQuery({
    queryKey: clinicalKeys.wards.all,
    queryFn: async () => {
      const response = await apiGet<Ward[]>('/infrastructure/wards', {
        params: { limit: 500 },
      });
      return response.data;
    },
  });
}

export function useWard(id: string) {
  return useQuery({
    queryKey: clinicalKeys.wards.detail(id),
    queryFn: async () => {
      const response = await apiGet<Ward>(`/infrastructure/wards/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useFloors() {
  return useQuery({
    queryKey: clinicalKeys.floors.all,
    queryFn: async () => {
      const response = await apiGet<Floor[]>('/infrastructure/floors', {
        params: { limit: 500 },
      });
      return response.data;
    },
  });
}

export function useFloor(id: string) {
  return useQuery({
    queryKey: clinicalKeys.floors.detail(id),
    queryFn: async () => {
      const response = await apiGet<Floor>(`/infrastructure/floors/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}
