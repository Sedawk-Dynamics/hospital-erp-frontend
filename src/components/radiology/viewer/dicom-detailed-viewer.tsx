'use client';

// Detailed (fullscreen) DICOM view used by clinical surfaces.
//
// Routing rule the product wants:
//   • Preview tile  → in-house DicomRenderer / RadiologyViewer (fast, no PACS)
//   • Detailed view → Orthanc PACS, rendered by the bundled OHIF viewer
//
// This component implements the detailed view. It asks the backend to resolve
// (and lazily archive, if needed) the attachment into the PACS, then embeds the
// OHIF viewer over DICOMweb. When no PACS is configured, the file isn't a DICOM
// study, or resolution fails, it falls back to the in-house RadiologyViewer so
// the file is always viewable.

import { Loader2, Download, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDicomConfig, useDicomAttachmentViewer } from '@/hooks/use-dicom';
import { RadiologyViewer } from './radiology-viewer';

interface DicomDetailedViewerProps {
  /** ImagingAttachment id — used to resolve/archive the study in the PACS. */
  attachmentId: string;
  /** Resolved /uploads URL — used for download + the in-house fallback. */
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  canDownload?: boolean;
  onClose?: () => void;
}

export function DicomDetailedViewer({
  attachmentId,
  fileUrl,
  fileName,
  mimeType,
  canDownload = true,
  onClose,
}: DicomDetailedViewerProps) {
  const { data: pacs, isLoading: pacsLoading } = useDicomConfig();
  const embeddable =
    !!pacs && pacs.provider !== 'none' && pacs.configured && pacs.embeddable;

  const viewerQ = useDicomAttachmentViewer(attachmentId, embeddable);

  // Still figuring out whether the PACS can serve this file.
  if (pacsLoading || (embeddable && viewerQ.isLoading)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-300">
        <Loader2 className="size-6 animate-spin" />
        <span className="text-sm">Preparing PACS viewer…</span>
      </div>
    );
  }

  const viewerUrl = embeddable ? viewerQ.data?.viewerUrl ?? null : null;

  // PACS path — embed OHIF (or the configured cloud viewer) over DICOMweb.
  if (viewerUrl) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{fileName}</p>
            <p className="truncate text-[11px] text-zinc-400">
              {pacs?.label ?? 'PACS'} · streamed via DICOMweb
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant="ghost"
              nativeButton={false}
              render={<a href={viewerUrl} target="_blank" rel="noreferrer" />}
              className="h-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              title="Open viewer in new tab"
            >
              <ExternalLink className="size-3.5" />
              <span className="ml-1 hidden sm:inline">New tab</span>
            </Button>
            {canDownload && (
              <Button
                size="sm"
                variant="ghost"
                nativeButton={false}
                render={<a href={fileUrl} target="_blank" rel="noreferrer" download={fileName} />}
                className="h-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                title="Download .dcm"
              >
                <Download className="size-3.5" />
                <span className="ml-1 hidden sm:inline">Download</span>
              </Button>
            )}
            {onClose && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="size-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                title="Close (Esc)"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-black">
          <iframe
            src={viewerUrl}
            title={`PACS viewer — ${fileName}`}
            className="h-full w-full"
            style={{ border: 0 }}
            allow="fullscreen"
          />
        </div>
      </div>
    );
  }

  // Fallback — no PACS / unresolved: in-house viewer keeps the file viewable.
  return (
    <RadiologyViewer
      fileUrl={fileUrl}
      fileName={fileName}
      mimeType={mimeType}
      fileType="dicom"
      canDownload={canDownload}
      events={{ onClose }}
    />
  );
}
