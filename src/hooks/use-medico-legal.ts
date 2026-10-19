import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface MedicoLegalInjuryRecord {
  id: string;
  recordId: string;
  bodySite: string;
  nature: string | null;
  lengthCm: string | number | null;
  widthCm: string | number | null;
  createdAt: string;
}

export interface MedicoLegalRecord {
  id: string;
  tenantId: string;
  patientId: string;
  admissionId: string;
  visitId: string | null;
  isMlc: boolean;
  mlcSerialNumber: string | null;
  policeStation: string | null;
  investigatingOfficer: string | null;
  policeIntimationAt: string | null;
  ioArrivalAt: string | null;
  receiptAckNo: string | null;
  items: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  injuries: MedicoLegalInjuryRecord[];
}

export interface AddMedicoLegalInput {
  patientId: string;
  admissionId: string;
  visitId?: string;
  isMlc: boolean;
  mlcSerialNumber?: string;
  policeStation?: string;
  investigatingOfficer?: string;
  policeIntimationAt?: string;
  ioArrivalAt?: string;
  receiptAckNo?: string;
  items: string[];
  injuries: { bodySite: string; nature?: string; length?: number; width?: number }[];
}

export const medicoLegalKeys = {
  all: ['medico-legal'] as const,
  list: (admissionId: string) => ['medico-legal', admissionId] as const,
};


export function useMedicoLegalRecords(admissionId: string | null) {
  return useQuery({
    queryKey: medicoLegalKeys.list(admissionId ?? ''),
    queryFn: async () => {
      const res = await apiGet<MedicoLegalRecord[]>('/medico-legal', {
        params: { admissionId },
      });
      return res.data;
    },
    enabled: !!admissionId,
  });
}

/** Create a medico-legal record (with its injuries) for a patient's admission. */
export function useAddMedicoLegal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddMedicoLegalInput) => {
      const res = await apiPost<MedicoLegalRecord>('/medico-legal', data);
      return res.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: medicoLegalKeys.list(created.admissionId) });
    },
  });
}
