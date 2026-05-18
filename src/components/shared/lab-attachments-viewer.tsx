'use client';

// Shared viewer for lab attachments (PDFs, images, scans).
// Used by:
//   • Laboratory operator UI — supports upload + delete
//   • Doctor / Nurse IP workspace + investigation history — read-only viewer
//   • Patient portal lab reports — read-only viewer with download
//
// Inline thumbnail for images, "Open PDF" button for PDFs, "Download" for
// everything else. Clicking a row opens the file in a new tab via the static
// /uploads handler on the backend.

import { useRef, useState } from 'react';
import { Download, FileText, FileImage, Trash2, Upload, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  type LabAttachment,
  resolveAttachmentUrl,
  formatFileSize,
  isImageMime,
  isPdfMime,
  useUploadLabAttachment,
  useDeleteLabAttachment,
  type LabAttachmentCategory,
} from '@/hooks/use-lab-attachments';

interface LabAttachmentsViewerProps {
  attachments?: LabAttachment[] | null;
  /** When set + canUpload, file uploads are sent against this order. */
  orderId?: string;
  /** Optional — link the upload to a specific report. */
  reportId?: string;
  /** Lab roles only. Disables upload button when false. */
  canUpload?: boolean;
  /** Lab roles only. Disables the delete button when false. */
  canDelete?: boolean;
  /** Read-only by default — set true for the lab operator dialog. */
  showCategorySelect?: boolean;
  /** Compact mode for embedding inline (no upload zone, slim list). */
  dense?: boolean;
  emptyMessage?: string;
}

const CATEGORY_OPTIONS: { value: LabAttachmentCategory; label: string }[] = [
  { value: 'report_pdf', label: 'Report PDF' },
  { value: 'image', label: 'Image / Microscopy' },
  { value: 'scan', label: 'Scan' },
  { value: 'raw_data', label: 'Raw Data' },
  { value: 'other', label: 'Other' },
];

export function LabAttachmentsViewer({
  attachments,
  orderId,
  reportId,
  canUpload = false,
  canDelete = false,
  showCategorySelect = true,
  dense = false,
  emptyMessage = 'No attachments yet.',
}: LabAttachmentsViewerProps) {
  const [category, setCategory] = useState<LabAttachmentCategory>('report_pdf');
  const [description, setDescription] = useState('');
  const [previewing, setPreviewing] = useState<LabAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadLabAttachment();
  const remove = useDeleteLabAttachment();

  const handleFile = async (file: File) => {
    if (!orderId) return;
    try {
      await upload.mutateAsync({
        orderId,
        file,
        category,
        labReportId: reportId,
        description: description || undefined,
      });
      toast.success(`Uploaded ${file.name}`);
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this attachment? It will be hidden from doctors, nurses and patients.')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Attachment removed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete');
    }
  };

  const items = attachments ?? [];

  return (
    <div className="space-y-3">
      {canUpload && orderId && (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
          {showCategorySelect && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LabAttachmentCategory)}
                className="rounded-md border bg-background px-2 py-1.5 text-xs"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="rounded-md border bg-background px-2 py-1.5 text-xs"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
              className="gap-1.5"
            >
              <Upload className="size-3.5" />
              {upload.isPending ? 'Uploading…' : 'Upload Report / Image'}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              PDF, JPG, PNG, WEBP — max 10 MB
            </p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className={dense ? 'text-[11px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => {
            const url = resolveAttachmentUrl(a.fileUrl);
            const Icon = isImageMime(a.mimeType) ? FileImage : FileText;
            const isImage = isImageMime(a.mimeType);

            return (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewing(a)}
                    className="h-10 w-10 shrink-0 overflow-hidden rounded border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={a.fileName}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{a.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="mr-1 text-[9px] capitalize">
                      {a.category.replace('_', ' ')}
                    </Badge>
                    {formatFileSize(a.sizeBytes)}
                    {a.uploader && ` · ${a.uploader.firstName} ${a.uploader.lastName ?? ''}`.trim()}
                    {a.description && ` · ${a.description}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {isImage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPreviewing(a)}
                      className="h-7 w-7"
                      title="Preview"
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    nativeButton={false}
                    render={
                      <a href={url} target="_blank" rel="noopener noreferrer" download={a.fileName} />
                    }
                    className="h-7 w-7"
                    title={isPdfMime(a.mimeType) ? 'Open PDF' : 'Download'}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(a.id)}
                      className="h-7 w-7 text-error"
                      disabled={remove.isPending}
                      title="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {previewing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewing(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setPreviewing(null)}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveAttachmentUrl(previewing.fileUrl)}
            alt={previewing.fileName}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
