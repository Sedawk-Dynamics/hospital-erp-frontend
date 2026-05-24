'use client';

// Shared viewer for imaging (radiology) attachments.
// Used by:
//   • Radiology operator UI — supports upload + edit + delete
//   • Doctor / Nurse — read-only viewer inside investigation / orders panel
//   • Patient portal imaging — read-only viewer with download
//
// Each file is rendered through the universal <FileViewer />, which handles
// PDF / image / DICOM / video / audio / text / fallback download.

import { useRef, useState } from 'react';
import { Upload, Trash2, Edit3, Save, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  type ImagingAttachment,
  type ImagingAttachmentCategory,
  formatFileSize,
  useUploadImagingAttachment,
  useDeleteImagingAttachment,
  useUpdateImagingAttachment,
} from '@/hooks/use-imaging-attachments';
import { FileViewer, FilePreviewDialog, toViewable } from './file-viewer';

const CATEGORY_OPTIONS: { value: ImagingAttachmentCategory; label: string }[] = [
  { value: 'report_pdf', label: 'Report PDF' },
  { value: 'image', label: 'Modality Image' },
  { value: 'dicom', label: 'DICOM (.dcm)' },
  { value: 'video', label: 'Video / Loop' },
  { value: 'scan', label: 'Scanned Document' },
  { value: 'raw_data', label: 'Raw Data' },
  { value: 'other', label: 'Other' },
];

interface Props {
  attachments?: ImagingAttachment[] | null;
  /** When set + canUpload, file uploads are sent against this request. */
  requestId?: string;
  /** Optional — link the upload to a specific result. */
  resultId?: string;
  /** Radiology roles only. Disables upload button when false. */
  canUpload?: boolean;
  /** Radiology roles only. Disables edit/delete buttons when false. */
  canManage?: boolean;
  /** Compact mode — small tiles only (used in patient-side / inline panels). */
  dense?: boolean;
  emptyMessage?: string;
}

export function ImagingAttachmentsViewer({
  attachments,
  requestId,
  resultId,
  canUpload = false,
  canManage = false,
  dense = false,
  emptyMessage = 'No files attached yet.',
}: Props) {
  const [category, setCategory] = useState<ImagingAttachmentCategory>('report_pdf');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ description: string; category: ImagingAttachmentCategory }>({
    description: '',
    category: 'image',
  });
  const [previewing, setPreviewing] = useState<ImagingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadImagingAttachment();
  const remove = useDeleteImagingAttachment();
  const update = useUpdateImagingAttachment();

  const handleFile = async (file: File) => {
    if (!requestId) return;
    try {
      await upload.mutateAsync({
        requestId,
        file,
        category,
        imagingResultId: resultId,
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
    if (!confirm('Remove this file? It will no longer be visible to doctors, nurses or patients.'))
      return;
    try {
      await remove.mutateAsync(id);
      toast.success('Attachment removed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete');
    }
  };

  const startEdit = (att: ImagingAttachment) => {
    setEditingId(att.id);
    setEditDraft({ description: att.description ?? '', category: att.category });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await update.mutateAsync({
        id: editingId,
        description: editDraft.description,
        category: editDraft.category,
      });
      toast.success('Saved');
      setEditingId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update');
    }
  };

  const items = attachments ?? [];

  return (
    <div className="space-y-3">
      {canUpload && requestId && (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ImagingAttachmentCategory)}
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
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.tif,.tiff,.dcm,.dicom,.mp4,.webm,.mov,.doc,.docx"
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
              {upload.isPending ? 'Uploading…' : 'Upload File'}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              PDF, JPG, PNG, DICOM (.dcm), MP4, WebM — max 100 MB
            </p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : dense ? (
        // Dense list — small file tiles, click preview to open
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
              <Badge variant="outline" className="text-[9px] capitalize">
                {a.category.replace('_', ' ')}
              </Badge>
              <button
                type="button"
                onClick={() => setPreviewing(a)}
                className="min-w-0 flex-1 text-left text-xs hover:underline"
              >
                <span className="block truncate font-medium">{a.fileName}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {formatFileSize(a.sizeBytes)}
                  {a.uploader && ` · ${a.uploader.firstName} ${a.uploader.lastName ?? ''}`.trim()}
                  {a.description && ` · ${a.description}`}
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPreviewing(a)}
                className="h-7 w-7"
                title="Preview"
              >
                <Eye className="size-3.5" />
              </Button>
              {canManage && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(a)}
                    className="h-7 w-7"
                    title="Edit details"
                  >
                    <Edit3 className="size-3.5" />
                  </Button>
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
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        // Rich list — inline preview tiles
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="space-y-1">
              {editingId === a.id ? (
                <div className="rounded-lg border bg-card p-3 space-y-2">
                  <p className="text-xs font-medium truncate">{a.fileName}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editDraft.category}
                      onChange={(e) =>
                        setEditDraft((d) => ({
                          ...d,
                          category: e.target.value as ImagingAttachmentCategory,
                        }))
                      }
                      className="rounded-md border bg-background px-2 py-1.5 text-xs"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={editDraft.description}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, description: e.target.value }))
                      }
                      placeholder="Description"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      disabled={update.isPending}
                    >
                      <X className="size-3.5 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit} disabled={update.isPending}>
                      <Save className="size-3.5 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <FileViewer file={toViewable(a)} />
              )}
              {canManage && editingId !== a.id && (
                <div className="flex items-center justify-end gap-1 px-1">
                  <Badge variant="outline" className="text-[9px] capitalize mr-auto">
                    {a.category.replace('_', ' ')}
                    {a.description ? ` · ${a.description}` : ''}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(a)}
                    className="h-7 px-2"
                  >
                    <Edit3 className="size-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(a.id)}
                    className="h-7 px-2 text-error"
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-3.5 mr-1" /> Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FilePreviewDialog
        file={previewing ? toViewable(previewing) : null}
        open={!!previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />
    </div>
  );
}
