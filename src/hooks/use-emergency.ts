import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

// ============================================================
// Front-desk Emergency / Casualty (Golden Hour) patient flow
// ============================================================

export interface EmergencyPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  createdAt: string;
  type: 'op' | 'ip';
  admissionId: string | null;
  admissionStatus: string | null;
  ward: string | null;
  bed: string | null;
  appointmentId: string | null;
  appointmentStatus: string | null;
  billCount: number;
  heldAmount: number;
  balanceDue: number;
}

export interface CreateEmergencyPatientInput {
  type: 'op' | 'ip';
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  age?: number;
  doctorId?: string;
  wardId?: string;
  bedId?: string;
  billingCategory?: 'cash' | 'package' | 'insurance' | 'corporate';
  chiefComplaint?: string;
  notes?: string;
}

export interface RegisterEmergencyPatientInput {
  firstName: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

const emergencyKey = ['emergency', 'patients'] as const;

export function useEmergencyPatients(enabled = true) {
  return useQuery({
    queryKey: emergencyKey,
    queryFn: async () => {
      const response = await apiGet<{ items: EmergencyPatient[]; total: number }>('/emergency/patients');
      return response.data.items;
    },
    enabled,
  });
}

export function useCreateEmergencyPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateEmergencyPatientInput) => {
      const response = await apiPost<EmergencyPatient & { tokenNumber: string | null }>(
        '/emergency/patients',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emergencyKey });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      queryClient.invalidateQueries({ queryKey: ['clinical'] });
    },
  });
}

export function useRegisterEmergencyPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RegisterEmergencyPatientInput }) => {
      const response = await apiPost(`/emergency/patients/${id}/register`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emergencyKey });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      queryClient.invalidateQueries({ queryKey: ['clinical'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useMergeEmergencyPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, targetPatientId }: { id: string; targetPatientId: string }) => {
      const response = await apiPost(`/emergency/patients/${id}/merge`, { targetPatientId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emergencyKey });
      queryClient.invalidateQueries({ queryKey: ['hospital'] });
      queryClient.invalidateQueries({ queryKey: ['clinical'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
