// Calculator hooks — wraps /calculator (backend: src/modules/calculator).
// A calculator is a doctor-defined formula: dynamic input variables, a math
// expression over their IDs, and interpretation bands. `scope` decides
// visibility: `personal` (only the creator) or `shared` (all doctors of the
// mapped specialties).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

export type CalculatorScope = 'personal' | 'shared';
export type CalculatorBandColor = 'emerald' | 'amber' | 'rose' | 'sky' | 'gray';

export interface CalculatorVariable {
  variableId: string;
  name: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

export interface CalculatorBand {
  min?: number;
  max?: number;
  label: string;
  color: CalculatorBandColor;
  recommendation?: string;
}

export interface Calculator {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  expression: string;
  resultUnit?: string | null;
  resultDecimals: number;
  specialties: string[];
  variables: CalculatorVariable[];
  bands: CalculatorBand[];
  scope: CalculatorScope;
  createdById: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalculatorListParams {
  scope?: CalculatorScope;
  specialty?: string;
  search?: string;
}

export const calculatorKeys = {
  all: ['calculators'] as const,
  list: (params?: CalculatorListParams) => ['calculators', 'list', params] as const,
};

export function useCalculators(params?: CalculatorListParams) {
  return useQuery({
    queryKey: calculatorKeys.list(params),
    queryFn: async () => {
      const response = await apiGet<Calculator[]>('/calculator', { params });
      return response.data;
    },
  });
}

export interface CreateCalculatorInput {
  name: string;
  description?: string;
  expression: string;
  resultUnit?: string;
  resultDecimals?: number;
  specialties?: string[];
  scope?: CalculatorScope;
  variables: CalculatorVariable[];
  bands?: CalculatorBand[];
}

export function useCreateCalculator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCalculatorInput) => {
      const response = await apiPost<Calculator>('/calculator', data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calculatorKeys.all });
    },
  });
}

export interface UpdateCalculatorInput extends Partial<CreateCalculatorInput> {
  id: string;
}

export function useUpdateCalculator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateCalculatorInput) => {
      const response = await apiPut<Calculator>(`/calculator/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calculatorKeys.all });
    },
  });
}
