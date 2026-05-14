import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface DicomInstance {
  id: string;
  sopInstanceUid: string;
  instanceNumber: number | null;
  fileUrl: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  rows: number | null;
  columns: number | null;
}

export interface DicomSeries {
  id: string;
  seriesInstanceUid: string;
  seriesNumber: number | null;
  seriesDescription: string | null;
  modality: string | null;
  bodyPart: string | null;
  numberOfInstances: number | null;
  instances: DicomInstance[];
}

export interface DicomStudy {
  id: string;
  patientId: string;
  studyInstanceUid: string;
  accessionNumber: string | null;
  studyDate: string | null;
  studyDescription: string | null;
  modality: string | null;
  numberOfSeries: number | null;
  numberOfInstances: number | null;
  patientName: string | null;
  patientDicomId: string | null;
  referringPhysician: string | null;
  storagePath: string | null;
  viewerUrl: string | null;
  createdAt: string;
  patient?: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    gender?: string | null;
  };
  series?: DicomSeries[];
  instances?: DicomInstance[];
  _count?: { instances: number; series: number };
}

export interface WorklistEntry {
  accessionNumber: string;
  requestId: string;
  patient: {
    patientId: string;
    patientName: string;
    patientDob: string | null;
    patientGender: string | null;
  };
  scheduledProcedureStep: {
    modality: string;
    scheduledStationAeTitle: string;
    scheduledProcedureStepStartDate: string | null;
    bodyPart: string | null;
    room: string | null;
    indication: string | null;
    urgency: string;
    status: string;
  };
  referringPhysician: string | null;
}

// ============================================================
// Hooks
// ============================================================

export function useDicomStudies(params?: {
  patientId?: string;
  imagingRequestId?: string;
  modality?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['dicom', 'studies', params],
    queryFn: async () => {
      const res = await apiGet<DicomStudy[]>('/imaging/dicom/studies', { params });
      return { data: res.data, meta: res.meta };
    },
  });
}

export function useDicomStudy(id: string | null) {
  return useQuery({
    queryKey: ['dicom', 'studies', 'detail', id],
    queryFn: async () => {
      const res = await apiGet<DicomStudy>(`/imaging/dicom/studies/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useDicomStudiesByPatient(patientId: string | null) {
  return useQuery({
    queryKey: ['dicom', 'studies', 'patient', patientId],
    queryFn: async () => {
      const res = await apiGet<DicomStudy[]>(`/imaging/dicom/patient/${patientId}/studies`);
      return res.data;
    },
    enabled: !!patientId,
  });
}

export function useDicomWorklist(params?: {
  modality?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: ['dicom', 'worklist', params],
    queryFn: async () => {
      const res = await apiGet<WorklistEntry[]>('/imaging/dicom/worklist', { params });
      return res.data;
    },
  });
}

export function useCreateDicomStudy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      studyInstanceUid: string;
      imagingRequestId?: string;
      imagingResultId?: string;
      accessionNumber?: string;
      studyDate?: string;
      studyDescription?: string;
      modality?: string;
      patientName?: string;
      patientDicomId?: string;
      referringPhysician?: string;
      viewerUrl?: string;
    }) => {
      const res = await apiPost<DicomStudy>('/imaging/dicom/studies', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dicom', 'studies'] });
    },
  });
}

export function useAddDicomInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      studyId,
      ...data
    }: {
      studyId: string;
      seriesInstanceUid?: string;
      seriesDescription?: string;
      seriesNumber?: number;
      seriesModality?: string;
      bodyPart?: string;
      sopInstanceUid: string;
      sopClassUid?: string;
      instanceNumber?: number;
      fileUrl: string;
      fileSizeBytes?: number;
      mimeType?: string;
      rows?: number;
      columns?: number;
    }) => {
      const res = await apiPost<DicomInstance>(
        `/imaging/dicom/studies/${studyId}/instances`,
        data,
      );
      return res.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['dicom', 'studies', 'detail', vars.studyId] });
    },
  });
}
