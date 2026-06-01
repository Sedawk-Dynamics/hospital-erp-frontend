import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, apiPatch, apiClient } from '@/lib/api';
import { imagingKeys } from '@/hooks/use-imaging';

// Imaging attachments — files (scanned PDFs, modality JPG/PNG, DICOM .dcm,
// USG/echo loops) tied to a request and optionally to its result. Radiology
// roles upload from /radiology; doctors / nurses / patients see the same
// files at their respective surfaces. Mirrors use-lab-attachments shape so
// the same FileViewer can render either with no special casing.

export type ImagingAttachmentCategory =
  | 'report_pdf'
  | 'image'
  | 'dicom'
  | 'video'
  | 'scan'
  | 'raw_data'
  | 'other';

export interface ImagingAttachment {
  id: string;
  tenantId: string;
  imagingRequestId: string;
  imagingResultId?: string | null;
  category: ImagingAttachmentCategory;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  description?: string | null;
  uploadedBy: string;
  uploader?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export const imagingAttachmentKeys = {
  byRequest: (requestId: string) =>
    ['imaging', 'attachments', 'request', requestId] as const,
  byResult: (resultId: string) =>
    ['imaging', 'attachments', 'result', resultId] as const,
};

export function useImagingRequestAttachments(requestId?: string) {
  return useQuery({
    queryKey: imagingAttachmentKeys.byRequest(requestId ?? ''),
    queryFn: async () => {
      const res = await apiGet<ImagingAttachment[]>(
        `/imaging/requests/${requestId}/attachments`,
      );
      return res.data ?? [];
    },
    enabled: !!requestId,
  });
}

export function useImagingResultAttachments(resultId?: string) {
  return useQuery({
    queryKey: imagingAttachmentKeys.byResult(resultId ?? ''),
    queryFn: async () => {
      const res = await apiGet<ImagingAttachment[]>(
        `/imaging/results/${resultId}/attachments`,
      );
      return res.data ?? [];
    },
    enabled: !!resultId,
  });
}

export interface UploadImagingAttachmentInput {
  requestId: string;
  file: File;
  category?: ImagingAttachmentCategory;
  imagingResultId?: string;
  description?: string;
}

export function useUploadImagingAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadImagingAttachmentInput) => {
      const formData = new FormData();
      formData.append('file', input.file);
      if (input.category) formData.append('category', input.category);
      if (input.imagingResultId) formData.append('imagingResultId', input.imagingResultId);
      if (input.description) formData.append('description', input.description);

      const { data } = await apiClient.post(
        `/imaging/requests/${input.requestId}/attachments`,
        formData,
        {
          // Axios infers the multipart boundary — explicit Content-Type breaks it.
          headers: { 'Content-Type': undefined as any },
        },
      );
      return (data as { data: ImagingAttachment }).data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: imagingAttachmentKeys.byRequest(variables.requestId),
      });
      if (variables.imagingResultId) {
        queryClient.invalidateQueries({
          queryKey: imagingAttachmentKeys.byResult(variables.imagingResultId),
        });
      }
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
    },
  });
}

export function useUpdateImagingAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      description?: string;
      category?: ImagingAttachmentCategory;
    }) => {
      const res = await apiPatch<ImagingAttachment>(`/imaging/attachments/${input.id}`, {
        description: input.description,
        category: input.category,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imaging', 'attachments'] });
    },
  });
}

export function useDeleteImagingAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete<{ success: boolean }>(`/imaging/attachments/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imaging', 'attachments'] });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function resolveAttachmentUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const origin = apiUrl.replace(/\/api\/v\d+\/?$/, '');
  const full = `${origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
  // Authenticated PACS retrieve endpoint (used after PACS_DROP_LOCAL) — plain
  // <a>/<img>/fetch can't send the Authorization header, so pass the access
  // token as a query param the endpoint understands.
  if (fileUrl.startsWith('/api/') && fileUrl.includes('/pacs/file')) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) return `${full}${full.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }
  return full;
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function isDicomFile(file: { fileName?: string; mimeType?: string }): boolean {
  const name = (file.fileName ?? '').toLowerCase();
  if (name.endsWith('.dcm') || name.endsWith('.dicom')) return true;
  return file.mimeType === 'application/dicom';
}

export function isVideoMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith('video/');
}

export function isImageMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

export function isPdfMime(mime?: string | null): boolean {
  return mime === 'application/pdf';
}
