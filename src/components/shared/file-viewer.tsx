'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Universal multi-format file viewer.
//
// Renders the right player/preview for the attachment based on MIME type and
// extension. Falls back to a download tile when the type isn't directly
// renderable in the browser.
//
// Supports:
//   • PDF                — embedded iframe + open-in-new-tab
//   • Image              — <img> with zoom/pan inside a modal
//   • DICOM (.dcm)       — DicomRenderer (dicom-parser) for uncompressed
//                          syntaxes, falls back to download for compressed
//   • Video (mp4/webm)   — native <video controls>
//   • Audio              — native <audio controls>
//   • Plain text         — fetched + rendered in <pre>
//   • Everything else    — download tile with file metadata
//
// Two surfaces:
//   • <FileViewer attachment={…} />       — renders a self-contained tile
//   • <FilePreviewDialog />               — opens any attachment in a modal
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import {
  Download, FileText, FileImage, FileVideo, FileAudio,
  FileCode, ScanLine, X, Maximize2, FileQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DicomRenderer } from '@/components/radiology/dicom-renderer';
import {
  type ImagingAttachment,
  resolveAttachmentUrl,
  formatFileSize,
  isDicomFile,
  isVideoMime,
  isImageMime,
  isPdfMime,
} from '@/hooks/use-imaging-attachments';

// Shape that any attachment (lab or imaging) can be cast to before
// passing into the viewer — only the fields we actually read are required.
export interface ViewableFile {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes?: number;
  description?: string | null;
  category?: string;
  uploader?: { id: string; firstName: string; lastName: string } | null;
  createdAt?: string;
}

interface FileViewerProps {
  file: ViewableFile;
  // Compact tile renders just an icon + filename + actions, no inline preview.
  dense?: boolean;
  // Optional override — if false, the viewer never tries to render the file
  // inline, only shows the action tile.
  inlinePreview?: boolean;
}

export function FileViewer({ file, dense = false, inlinePreview = true }: FileViewerProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const url = resolveAttachmentUrl(file.fileUrl);
  const isPdf = isPdfMime(file.mimeType);
  const isImage = isImageMime(file.mimeType);
  const isVideo = isVideoMime(file.mimeType);
  const isAudio = file.mimeType?.startsWith('audio/');
  const isDicom = isDicomFile({ fileName: file.fileName, mimeType: file.mimeType });
  const isText =
    file.mimeType === 'text/plain' ||
    file.mimeType === 'text/csv' ||
    file.mimeType?.startsWith('text/');

  const Icon = isPdf
    ? FileText
    : isImage
      ? FileImage
      : isVideo
        ? FileVideo
        : isAudio
          ? FileAudio
          : isDicom
            ? ScanLine
            : isText
              ? FileCode
              : FileQuestion;

  if (dense || !inlinePreview) {
    return (
      <>
        <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{file.fileName}</p>
            <p className="text-[10px] text-muted-foreground">
              {file.sizeBytes ? formatFileSize(file.sizeBytes) : ''}
              {file.description ? ` · ${file.description}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            {(isImage || isPdf || isVideo || isAudio || isDicom || isText) && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPreviewOpen(true)}
                className="h-7 w-7"
                title="Preview"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              nativeButton={false}
              render={<a href={url} target="_blank" rel="noreferrer" download={file.fileName} />}
              className="h-7 w-7"
              title="Download"
            >
              <Download className="size-3.5" />
            </Button>
          </div>
        </div>
        <FilePreviewDialog file={file} open={previewOpen} onOpenChange={setPreviewOpen} />
      </>
    );
  }

  // Inline preview tile — used in the radiology dialog and any "single file"
  // viewing surface where we want the file shown immediately.
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.fileName}</p>
            {file.sizeBytes ? (
              <p className="text-[10px] text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPreviewOpen(true)}
            className="h-7 w-7"
            title="Fullscreen"
          >
            <Maximize2 className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            nativeButton={false}
            render={<a href={url} target="_blank" rel="noreferrer" download={file.fileName} />}
            className="h-7 w-7"
            title="Download"
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="max-h-[480px] overflow-hidden bg-black/5">
        <InlineRenderer file={file} url={url} />
      </div>
      <FilePreviewDialog file={file} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}

// Render the actual file content for the inline preview. Each branch picks
// the right player for the MIME type and falls through to a "no preview"
// hint when the type isn't browser-renderable.
function InlineRenderer({ file, url }: { file: ViewableFile; url: string }) {
  const isPdf = isPdfMime(file.mimeType);
  const isImage = isImageMime(file.mimeType);
  const isVideo = isVideoMime(file.mimeType);
  const isAudio = file.mimeType?.startsWith('audio/');
  const isDicom = isDicomFile({ fileName: file.fileName, mimeType: file.mimeType });
  const isText =
    file.mimeType === 'text/plain' ||
    file.mimeType === 'text/csv' ||
    file.mimeType?.startsWith('text/');

  if (isPdf) {
    return (
      <iframe
        src={`${url}#toolbar=0&navpanes=0`}
        title={file.fileName}
        className="w-full"
        style={{ height: 480 }}
      />
    );
  }
  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={file.fileName}
        className="mx-auto max-h-[480px] object-contain"
      />
    );
  }
  if (isVideo) {
    return (
      <video
        controls
        src={url}
        className="mx-auto max-h-[480px] w-full bg-black"
      />
    );
  }
  if (isAudio) {
    return (
      <div className="flex items-center justify-center p-8">
        <audio controls src={url} className="w-full max-w-md" />
      </div>
    );
  }
  if (isDicom) {
    return (
      <div className="h-[480px] bg-black">
        <DicomRenderer fileUrl={url} className="h-full" />
      </div>
    );
  }
  if (isText) {
    return <TextRenderer url={url} />;
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <FileQuestion className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No inline preview for this file type.
      </p>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<a href={url} target="_blank" rel="noreferrer" download={file.fileName} />}
      >
        <Download className="size-3.5 mr-1" /> Download
      </Button>
    </div>
  );
}

function TextRenderer({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text.slice(0, 200_000)); // 200KB cap
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return <p className="p-4 text-xs text-error">Failed to load: {error}</p>;
  }
  if (content == null) {
    return <p className="p-4 text-xs text-muted-foreground">Loading…</p>;
  }
  return (
    <pre className="max-h-[480px] overflow-auto p-3 text-[11px] leading-relaxed font-mono bg-background">
      {content}
    </pre>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fullscreen dialog — opens any file in a large modal preview.
// ─────────────────────────────────────────────────────────────────────────────

interface FilePreviewDialogProps {
  file: ViewableFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({ file, open, onOpenChange }: FilePreviewDialogProps) {
  if (!file) return null;
  const url = resolveAttachmentUrl(file.fileUrl);
  const isPdf = isPdfMime(file.mimeType);
  const isImage = isImageMime(file.mimeType);
  const isVideo = isVideoMime(file.mimeType);
  const isAudio = file.mimeType?.startsWith('audio/');
  const isDicom = isDicomFile({ fileName: file.fileName, mimeType: file.mimeType });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-[95vw] h-[92vh] p-0 gap-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.fileName}</p>
            <p className="text-[10px] text-muted-foreground">
              {file.sizeBytes ? formatFileSize(file.sizeBytes) : ''}
              {file.description ? ` · ${file.description}` : ''}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<a href={url} target="_blank" rel="noreferrer" download={file.fileName} />}
            >
              <Download className="size-3.5 mr-1" /> Download
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} className="h-8 w-8">
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-black/90">
          {isPdf ? (
            <iframe src={url} title={file.fileName} className="w-full h-full bg-white" />
          ) : isImage ? (
            <div className="flex h-full w-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={file.fileName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : isVideo ? (
            <div className="flex h-full w-full items-center justify-center">
              <video controls src={url} className="max-h-full max-w-full" />
            </div>
          ) : isAudio ? (
            <div className="flex h-full w-full items-center justify-center bg-background">
              <audio controls src={url} className="w-full max-w-lg" />
            </div>
          ) : isDicom ? (
            <DicomRenderer fileUrl={url} className="h-full" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background">
              <FileQuestion className="size-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Preview not available for this file type.
              </p>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={url} target="_blank" rel="noreferrer" download={file.fileName} />}
              >
                <Download className="size-4 mr-1.5" /> Download {file.fileName}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper for callers that hold an ImagingAttachment directly.
export function toViewable(att: ImagingAttachment): ViewableFile {
  return {
    id: att.id,
    fileName: att.fileName,
    fileUrl: att.fileUrl,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    description: att.description,
    category: att.category,
    uploader: att.uploader,
    createdAt: att.createdAt,
  };
}
