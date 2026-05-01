import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

export interface NurseDoctorAssignment {
  id: string;
  tenantId: string;
  nurseId: string;
  doctorId: string;
  assignedById: string;
  assignedAt: string;
  isActive: boolean;
  endedAt: string | null;
  endedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  nurse?: { id: string; firstName: string; lastName: string | null; email: string };
  doctor?: {
    id: string;
    specialization: string | null;
    user: { id: string; firstName: string; lastName: string | null };
    department?: { id: string; name: string };
  };
  assigner?: { id: string; firstName: string; lastName: string | null };
}

export interface ListNurseDoctorAssignmentsQuery {
  nurseId?: string;
  doctorId?: string;
  isActive?: 'true' | 'false' | 'all';
  page?: number;
  limit?: number;
}

export interface MyDoctorEntry {
  assignmentId: string;
  doctor: {
    id: string;
    specialization: string | null;
    user: { id: string; firstName: string; lastName: string | null };
    department?: { id: string; name: string };
  };
  assignedAt: string;
}

export interface MyPatientRecord {
  // 'admission' = IPD admission row.
  // 'appointment' = OPD appointment row that front-desk has confirmed (status
  //   one of confirmed | checked_in | waiting | in_consultation). The OPD list
  //   no longer surfaces raw Visit rows; visits are derived from appointments.
  recordType: 'admission' | 'appointment';
  id: string;
  /** Set when recordType='appointment'. Same value as `id` in that case. */
  appointmentId?: string;
  /**
   * The current visit for the appointment, if one already exists. Forms +
   * vitals creation requires a visitId — when this is null, the nurse UI
   * should pass appointmentId to the creation endpoint so the server can
   * resolve / create the visit.
   */
  visitId?: string | null;
  patientId: string;
  patient: {
    id: string;
    mrn: string | null;
    firstName: string;
    lastName: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    phone?: string | null;
  };
  doctor: {
    id: string;
    user: { id: string; firstName: string; lastName: string | null };
  };
  ward?: { id: string; name: string } | null;
  bed?: { id: string; bedNumber: string } | null;
  status: string;
  admissionDate?: string;
  dischargeDate?: string | null;
  appointmentDate?: string;
  startTime?: string;
  visitType?: 'op' | 'ip';
}

export interface MyPatientsQuery {
  status?: 'admitted' | 'discharged' | 'all';
  type?: 'ip' | 'op' | 'all';
  search?: string;
  /** OPD only — defaults to today on the server. yyyy-MM-dd. */
  date?: string;
  page?: number;
  limit?: number;
}

export const nurseDoctorKeys = {
  all: ['nurse-doctor-assignments'] as const,
  list: (params?: ListNurseDoctorAssignmentsQuery) =>
    ['nurse-doctor-assignments', 'list', params] as const,
  myDoctors: ['nurse-doctor-assignments', 'my-doctors'] as const,
  myPatients: (params?: MyPatientsQuery) =>
    ['nurse-doctor-assignments', 'my-patients', params] as const,
};

export function useNurseDoctorAssignments(params?: ListNurseDoctorAssignmentsQuery) {
  return useQuery({
    queryKey: nurseDoctorKeys.list(params),
    queryFn: async () => {
      const res = await apiGet<NurseDoctorAssignment[]>('/clinical/nurse-doctor-assignments', {
        params,
      });
      return res;
    },
  });
}

export function useCreateNurseDoctorAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nurseId: string; doctorIds: string[]; notes?: string }) => {
      const res = await apiPost<{
        created: number;
        skipped: number;
        assignments: NurseDoctorAssignment[];
      }>('/clinical/nurse-doctor-assignments', data);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseDoctorKeys.all });
    },
  });
}

export function useEndNurseDoctorAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiPost<NurseDoctorAssignment>(
        `/clinical/nurse-doctor-assignments/${id}/end`,
        { reason },
      );
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nurseDoctorKeys.all });
    },
  });
}

/** Doctors the calling nurse is currently assigned to. */
export function useMyAssignedDoctors() {
  return useQuery({
    queryKey: nurseDoctorKeys.myDoctors,
    queryFn: async () => {
      const res = await apiGet<MyDoctorEntry[]>(
        '/clinical/nurse-doctor-assignments/my-doctors',
      );
      return res;
    },
  });
}

/** Patients under the doctors the calling nurse is currently assigned to. */
export function useMyPatients(params?: MyPatientsQuery) {
  return useQuery({
    queryKey: nurseDoctorKeys.myPatients(params),
    queryFn: async () => {
      const res = await apiGet<MyPatientRecord[]>(
        '/clinical/nurse-doctor-assignments/my-patients',
        { params },
      );
      return res;
    },
  });
}
