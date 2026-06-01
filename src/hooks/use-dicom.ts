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

export interface PacsConfig {
  provider: 'none' | 'orthanc' | 'postdicom';
  configured: boolean;
  embeddable: boolean;
  label: string;
  /** Viewer traffic routed through the authenticating PACS proxy. */
  proxy: boolean;
}

// ============================================================
// Hooks
// ============================================================

/** How DICOM is archived + viewed for this deployment (Orthanc / PostDICOM / in-house). */
export function useDicomConfig() {
  return useQuery({
    queryKey: ['dicom', 'config'],
    queryFn: async () => {
      const res = await apiGet<PacsConfig>('/imaging/dicom/config');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Resolve the embeddable PACS viewer URL for a DICOM attachment (used by the
 * detailed/fullscreen view). The backend lazily archives the file first if
 * needed. Returns viewerUrl: null when the file can't be served from a PACS,
 * so the caller falls back to the in-house viewer.
 */
export function useDicomAttachmentViewer(attachmentId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['dicom', 'attachment-viewer', attachmentId],
    queryFn: async () => {
      const res = await apiGet<{
        viewerUrl: string | null;
        studyInstanceUid?: string;
        reason?: string;
      }>(`/imaging/dicom/attachment/${attachmentId}/viewer`);
      return res.data;
    },
    enabled: enabled && !!attachmentId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Mint the short-lived PACS session cookie so the OHIF iframe (served by the
 * backend proxy) can reach DICOMweb. Must be called before showing the iframe
 * when PACS proxy mode is on. withCredentials so the Set-Cookie is stored.
 */
export function useCreatePacsSession() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiPost<{ viewerBase: string; ttlMin: number }>(
        '/pacs/session',
        {},
        { withCredentials: true },
      );
      return res.data;
    },
  });
}

/** Manually (re)push a DICOM attachment to the configured PACS. */
export function useSyncDicomAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await apiPost<{
        synced: boolean;
        reason?: string;
        studyId?: string;
        studyInstanceUid?: string;
        viewerUrl?: string;
      }>(`/imaging/dicom/sync-attachment/${attachmentId}`, {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dicom', 'studies'] });
    },
  });
}

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
