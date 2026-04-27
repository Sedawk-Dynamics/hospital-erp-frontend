import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

export interface Vital {
  id: string;
  visitId: string;
  patientId: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulseRate: number | null;
  temperature: string | null;
  respiratoryRate: number | null;
  oxygenSaturation: string | null;
  weightKg: string | null;
  heightCm: string | null;
  bmi: string | null;
  bloodSugar: string | null;
  notes: string | null;
  recordedBy: string | null;
  recordedAt: string;
  supersedesVitalId: string | null;
  correctionReason: string | null;
  correctedById: string | null;
  isCorrection: boolean;
  recorder?: { id: string; firstName: string; lastName: string | null };
  corrector?: { id: string; firstName: string; lastName: string | null } | null;
}

export interface CorrectVitalInput {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulseRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
  bloodSugar?: number;
  notes?: string;
  correctionReason: string;
}

export function useVitalHistory(vitalId: string | undefined) {
  return useQuery({
    queryKey: ['vital-history', vitalId],
    queryFn: async () => {
      const res = await apiGet<Vital[]>(`/clinical/vitals/${vitalId}/history`);
      return res.data;
    },
    enabled: !!vitalId,
  });
}

export function useCorrectVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & CorrectVitalInput) => {
      const res = await apiPost<{
        mode: 'self-correct-silent' | 'audited-correction';
        vital: Vital;
      }>(`/clinical/vitals/${id}/correct`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vitals'] });
      qc.invalidateQueries({ queryKey: ['vital-history'] });
      qc.invalidateQueries({ queryKey: ['nurse-vitals'] });
    },
  });
}
