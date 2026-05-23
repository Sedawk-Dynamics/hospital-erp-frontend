// React Query hooks for lab unit groups + units.
//
// Backed by the lab-units.service backend. Read endpoint merges platform-
// global (tenantId = null) + tenant-local groups in one list. Writes route
// to either scope automatically — pass `isGlobal: true` on create to
// author at the platform level (super_admin only).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface LabUnit {
  id: string;
  tenantId: string | null;
  unitGroupId: string;
  symbol: string;
  name?: string | null;
  conversionFactor?: string | number | null;
  isBase: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface LabUnitGroup {
  id: string;
  tenantId: string | null;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  sortOrder: number;
  units: LabUnit[];
}

export type LabUnitGroupInput = {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isGlobal?: boolean; // super_admin only
};

export type LabUnitInput = {
  unitGroupId: string;
  symbol: string;
  name?: string | null;
  conversionFactor?: number | null;
  isBase?: boolean;
  sortOrder?: number;
};

const keys = {
  all: ['lab-unit-groups'] as const,
  list: () => [...keys.all, 'list'] as const,
};

export function useLabUnitGroups() {
  return useQuery({
    queryKey: keys.list(),
    queryFn: async () => {
      const res = await apiGet<LabUnitGroup[]>('/lab/unit-groups');
      return res.data;
    },
  });
}

export function useCreateLabUnitGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LabUnitGroupInput) => {
      const res = await apiPost<LabUnitGroup>('/lab/unit-groups', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateLabUnitGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: { id: string } & Partial<Pick<LabUnitGroupInput, 'name' | 'description' | 'sortOrder'>>) => {
      const res = await apiPut<LabUnitGroup>(`/lab/unit-groups/${id}`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteLabUnitGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete(`/lab/unit-groups/${id}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useCreateLabUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LabUnitInput) => {
      const res = await apiPost<LabUnit>('/lab/units', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateLabUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: { id: string } & Partial<Omit<LabUnitInput, 'unitGroupId'>>) => {
      const res = await apiPut<LabUnit>(`/lab/units/${id}`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteLabUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete(`/lab/units/${id}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

// Helper for the parameter builder — given a unit symbol, find the
// matching unit-group code. Used to back-fill `unitGroupCode` when the
// caller picks a unit before picking a group, and to render a "Group"
// hint chip next to legacy parameters that have no unitGroupCode set.
export function findUnitGroupForSymbol(
  groups: LabUnitGroup[] | undefined,
  symbol: string | null | undefined,
): { group: LabUnitGroup; unit: LabUnit } | null {
  if (!groups || !symbol) return null;
  for (const g of groups) {
    const u = g.units.find((x) => x.symbol === symbol);
    if (u) return { group: g, unit: u };
  }
  return null;
}
