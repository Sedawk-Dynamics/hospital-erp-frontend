import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

// ============================================================
// The centralized patient file.
//
// Everything the hospital holds on one patient, on one page. The BACKEND
// decides what this contains: a hospital user only ever resolves a patient
// registered at their own hospital, super_admin resolves any. `access.scope`
// says which of those happened, so the page can label itself rather than
// leaving two people wondering why they see different lists.
// ============================================================

export interface PatientFileAccess {
  scope: 'hospital' | 'platform';
  hospital: { id: string; name: string };
}

export interface PatientFilePerson {
  id: string;
  mrn: string;
  isTemporary: boolean;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  occupation: string | null;
  nationality: string | null;
  religion: string | null;
  abhaNumber: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  referredBy: string | null;
  notes: string | null;
  isActive: boolean;
  registeredOn: string;
  updatedAt: string;
}

export interface PatientFile {
  access: PatientFileAccess;
  patient: PatientFilePerson;
  portalAccount: {
    id: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
  } | null;
  emergencyContacts: Array<{
    id: string;
    name: string;
    relationship: string | null;
    phone: string | null;
    isPrimary: boolean;
  }>;
  safety: {
    allergies: Array<{
      id: string;
      allergen: string;
      allergyType: string;
      severity: string | null;
      reaction: string | null;
    }>;
    familyHistory: Array<{
      id: string;
      relationSide: string | null;
      relationship: string | null;
      conditionName: string;
      notes: string | null;
    }>;
    personalHistory: {
      smokingStatus: string | null;
      alcoholConsumption: string | null;
      diet: string | null;
      disorders: string | null;
    } | null;
  };
  status: {
    currentlyAdmitted: boolean;
    currentAdmission: {
      id: string;
      admittedOn: string;
      status: string;
      ward: string | null;
      bed: string | null;
      doctor: string | null;
    } | null;
  };
  counts: {
    visits: number;
    admissions: number;
    appointments: number;
    prescriptions: number;
    labOrders: number;
    imaging: number;
    documents: number;
    dischargeSummaries: number;
  };
  visits: Array<{
    id: string;
    date: string;
    type: string;
    status: string;
    chiefComplaint: string | null;
    doctor: string | null;
    diagnosisCount: number;
  }>;
  admissions: Array<{
    id: string;
    ipNumber: string | null;
    admittedOn: string;
    dischargedOn: string | null;
    status: string;
    ward: string | null;
    bed: string | null;
    doctor: string | null;
  }>;
  appointments: Array<{
    id: string;
    date: string;
    startTime: string | null;
    status: string;
    type: string;
    visitType: string | null;
    doctor: string | null;
  }>;
  diagnoses: Array<{
    id: string;
    code: string | null;
    name: string;
    type: string;
    notes: string | null;
    recordedOn: string;
  }>;
  prescriptions: Array<{
    id: string;
    date: string;
    status: string;
    type: string | null;
    doctor: string | null;
    itemCount: number;
  }>;
  labOrders: Array<{
    id: string;
    date: string;
    status: string;
    reportStatus: string | null;
    tests: string[];
  }>;
  imaging: Array<{
    id: string;
    date: string;
    modality: string | null;
    bodyPart: string | null;
    status: string;
  }>;
  billing: {
    totals: { billed: number; paid: number; outstanding: number; billCount: number };
    bills: Array<{
      id: string;
      billNumber: string;
      date: string;
      status: string;
      total: number;
      paid: number;
      balance: number;
    }>;
    payments: Array<{
      id: string;
      date: string;
      amount: number;
      method: string;
      type: string;
      status: string;
    }>;
  };
  documents: Array<{
    id: string;
    documentType: string;
    title: string;
    fileUrl: string;
    uploadedAt: string;
    fromAnotherHospital: boolean;
  }>;
  dischargeSummaries: Array<{
    id: string;
    status: string;
    createdAt: string;
    admissionId: string;
  }>;
  /** Presence only — name and MRN. Their records stay with them. */
  otherHospitals: Array<{
    patientId: string;
    tenantId: string;
    name: string;
    mrn: string;
    firstSeen: string;
  }>;
}

export function usePatientFile(patientId: string | null) {
  return useQuery({
    queryKey: ['patient-file', patientId],
    queryFn: async () => (await apiGet<PatientFile>(`/patients/${patientId}/file`)).data,
    enabled: !!patientId,
  });
}

// ── Platform directory (super_admin) ───────────────────────────────────────

export interface PlatformPatientRow {
  id: string;
  mrn: string;
  isTemporary: boolean;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  abhaNumber: string | null;
  isActive: boolean;
  registeredOn: string;
  hospital: { id: string; name: string };
  hasPortalAccount: boolean;
}

export interface PlatformDirectoryResult {
  patients: PlatformPatientRow[];
  total: number;
  page: number;
  limit: number;
}

export function usePlatformPatientDirectory(params: {
  search?: string;
  tenantId?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['platform-patients', params],
    queryFn: async () =>
      (
        await apiGet<PlatformDirectoryResult>('/patients/platform-directory', {
          params: {
            search: params.search || undefined,
            tenantId: params.tenantId || undefined,
            page: params.page ?? 1,
            limit: params.limit ?? 25,
          },
        })
      ).data,
  });
}

export function usePlatformPatientHospitals() {
  return useQuery({
    queryKey: ['platform-patients', 'hospitals'],
    queryFn: async () =>
      (
        await apiGet<Array<{ tenantId: string; name: string; patientCount: number }>>(
          '/patients/platform-hospitals',
        )
      ).data ?? [],
  });
}
