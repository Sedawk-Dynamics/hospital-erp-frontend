import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, apiClient } from '@/lib/api';
import { labKeys } from '@/hooks/use-lab';

// Lab attachments — files (PDFs, images, scans, raw data) tied to an order or
// report. Lab roles upload from /laboratory; doctors / nurses / patients see
// the same files at their respective surfaces. Files are served from the
// backend's /uploads static path, so the URL on the row is what we render.

export type LabAttachmentCategory = 'report_pdf' | 'image' | 'scan' | 'raw_data' | 'other';

export interface LabAttachment {
  id: string;
  tenantId: string;
  labOrderId: string;
  labReportId?: string | null;
  labOrderItemId?: string | null;
  category: LabAttachmentCategory;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  description?: string | null;
  uploadedBy: string;
  uploader?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export const labAttachmentKeys = {
  byOrder: (orderId: string) => ['lab', 'attachments', 'order', orderId] as const,
  byReport: (reportId: string) => ['lab', 'attachments', 'report', reportId] as const,
};

export function useLabOrderAttachments(orderId?: string) {
  return useQuery({
    queryKey: labAttachmentKeys.byOrder(orderId ?? ''),
    queryFn: async () => {
      const res = await apiGet<LabAttachment[]>(`/lab/orders/${orderId}/attachments`);
      return res.data ?? [];
    },
    enabled: !!orderId,
  });
}

export function useLabReportAttachments(reportId?: string) {
  return useQuery({
    queryKey: labAttachmentKeys.byReport(reportId ?? ''),
    queryFn: async () => {
      const res = await apiGet<LabAttachment[]>(`/lab/reports/${reportId}/attachments`);
      return res.data ?? [];
    },
    enabled: !!reportId,
  });
}

export interface UploadLabAttachmentInput {
  orderId: string;
  file: File;
  category?: LabAttachmentCategory;
  labReportId?: string;
  labOrderItemId?: string;
  description?: string;
}

export function useUploadLabAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadLabAttachmentInput) => {
      const formData = new FormData();
      formData.append('file', input.file);
      if (input.category) formData.append('category', input.category);
      if (input.labReportId) formData.append('labReportId', input.labReportId);
      if (input.labOrderItemId) formData.append('labOrderItemId', input.labOrderItemId);
      if (input.description) formData.append('description', input.description);

      const { data } = await apiClient.post(`/lab/orders/${input.orderId}/attachments`, formData, {
        // Let axios pick the multipart boundary; explicitly setting Content-Type
        // breaks the boundary and the server can't parse the upload.
        headers: { 'Content-Type': undefined as any },
      });
      return (data as { data: LabAttachment }).data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: labAttachmentKeys.byOrder(variables.orderId) });
      if (variables.labReportId) {
        queryClient.invalidateQueries({ queryKey: labAttachmentKeys.byReport(variables.labReportId) });
      }
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'investigation-history'] });
    },
  });
}

export function useDeleteLabAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete<{ success: boolean }>(`/lab/attachments/${id}`);
      return res.data;
    },
    onSuccess: () => {
      // Coarse invalidation — both order and report views consume attachments.
      queryClient.invalidateQueries({ queryKey: ['lab', 'attachments'] });
      queryClient.invalidateQueries({ queryKey: labKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: labKeys.reports.all });
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Backend stores fileUrl as `/uploads/...`. Browser needs the full origin from
 * NEXT_PUBLIC_API_URL — strip the `/api/v1` suffix so the static handler resolves.
 */
export function resolveAttachmentUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//.test(fileUrl)) return fileUrl;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const origin = apiUrl.replace(/\/api\/v\d+\/?$/, '');
  return `${origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function isImageMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

export function isPdfMime(mime?: string | null): boolean {
  return mime === 'application/pdf';
}
