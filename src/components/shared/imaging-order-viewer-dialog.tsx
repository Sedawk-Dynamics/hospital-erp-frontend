'use client';

// Read-only viewer for an imaging request's report + uploaded files.
// Used by doctor / nurse / patient surfaces. Renders impression + radiologist
// metadata from the linked ImagingResult and shows the attachments through
// the universal FileViewer so PDFs, modality JPG/PNG, DICOM and video loops
// all play back inside the same dialog.

import { useMemo } from 'react';
import { Loader2, ScanLine, User as UserIcon, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/date-utils';
import {
  useImagingRequest,
  useImagingResult,
} from '@/hooks/use-imaging';
import { useImagingRequestAttachments } from '@/hooks/use-imaging-attachments';
import { ImagingAttachmentsViewer } from './imaging-attachments-viewer';

interface Props {
  requestId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ImagingOrderViewerDialog({ requestId, onOpenChange }: Props) {
  const open = !!requestId;
  const requestQ = useImagingRequest(requestId ?? '');
  const request = requestQ.data;

  const resultId = useMemo(
    () => (request?.imagingResult?.id ?? null),
    [request?.imagingResult?.id],
  );
  const resultQ = useImagingResult(resultId ?? '');
  const result = resultQ.data;

  const attachmentsQ = useImagingRequestAttachments(requestId ?? undefined);
  const attachments = attachmentsQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-4" /> Imaging Report &amp; Files
          </DialogTitle>
          <DialogDescription>
            {request
              ? `${request.imagingType.toUpperCase()}${request.bodyPart ? ' — ' + request.bodyPart : ''}`
              : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {requestQ.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !request ? (
          <p className="text-sm text-muted-foreground">Imaging request not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground rounded-lg border bg-muted/40 p-3">
              {request.patient && (
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="size-3" />
                  {request.patient.firstName} {request.patient.lastName}
                  {request.patient.mrn ? ` · ${request.patient.mrn}` : ''}
                </span>
              )}
              {request.scheduledAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatDateTime(request.scheduledAt)}
                </span>
              )}
              <Badge variant="outline" className="text-[10px] capitalize">
                {request.status.replace(/_/g, ' ')}
              </Badge>
              {result && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  Result: {result.status}
                </Badge>
              )}
            </div>

            {(result?.impression || result?.radiologist) && (
              <div className="space-y-2 rounded-lg border p-3">
                {result.impression && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Impression
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{result.impression}</p>
                  </div>
                )}
                {result.radiologist && (
                  <p className="text-[11px] text-muted-foreground">
                    Reported by {result.radiologist.firstName} {result.radiologist.lastName}
                    {result.signedAt ? ` · signed ${formatDateTime(result.signedAt)}` : ''}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold">Files</p>
              <ImagingAttachmentsViewer
                requestId={request.id}
                attachments={attachments}
                canUpload={false}
                canManage={false}
                emptyMessage="The radiologist hasn't uploaded any files yet."
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
