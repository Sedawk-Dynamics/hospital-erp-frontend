'use client';

// The radiologist's bench for one study.
//
// Uploading a file no longer completes the study. It opens a DRAFT the
// radiologist owns — add another series, swap a wrong file, remove one, write
// the impression — until they explicitly Mark as Done, which is what puts it in
// the admin's approval queue. Before this, the first upload flipped the request
// straight to completed and into that queue, so a half-loaded study was already
// in front of the approver with no way back for the person who uploaded it.
//
// This is the mirror of the lab's per-test Upload + Mark Done, with the same
// rule: the uploaded files ARE the report, so Done needs at least one.

import { useState } from 'react';
import { CheckCircle2, Lock, PencilLine, Send, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/utils';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';
import { ImagingAttachmentsViewer } from '@/components/shared/imaging-attachments-viewer';
import { useImagingRequestAttachments } from '@/hooks/use-imaging-attachments';
import {
  useEditImagingResult,
  useSubmitImagingResult,
  type ImagingRequest,
} from '@/hooks/use-imaging';
import { useRadiologyRole } from '@/hooks/use-radiology-role';

export function UploadResultDialog({
  request,
  onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { isRadiologyAdmin } = useRadiologyRole();
  const attachmentsQ = useImagingRequestAttachments(request?.id);
  const submit = useSubmitImagingResult();
  const editResult = useEditImagingResult();

  const [impression, setImpression] = useState('');
  const result = request?.imagingResult;
  const status = result?.status;
  const isPublished = status === 'published';
  const isFinalized = status === 'finalized';
  const files = attachmentsQ.data ?? [];
  const hasFiles = files.length > 0;
  const resultId =result?.id ?? files.find((f) => f.imagingResultId)?.imagingResultId ?? undefined;

  useSeedOnChange(request?.id ?? null, () => {
    setImpression((request?.imagingResult as { impression?: string } | undefined)?.impression ?? '');
  });

  const handleSaveDraft = async () => {
    if (!resultId) {
      // Nothing has been uploaded yet, so there is no result row to write to.
      toast.error('Upload at least one file first');
      return;
    }
    try {
      await editResult.mutateAsync({ id: resultId, impression: impression.trim() });
      toast.success('Draft saved');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the draft'));
    }
  };

  const handleMarkDone = async () => {
    if (!resultId || !hasFiles) {
      toast.error('Upload the study files before marking this done');
      return;
    }
    try {
      await submit.mutateAsync({ id: resultId, impression: impression.trim() || undefined });
      toast.success('Marked done — sent to the radiology admin for approval');
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not mark this done'));
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPublished ? 'Published Report' : isFinalized ? 'Submitted Report' : 'Study Draft'}
            <StateChip status={status} />
          </DialogTitle>
          <DialogDescription>
            {isPublished
              ? 'This report has been approved and released. Its files are locked.'
              : isFinalized
                ? 'Marked done and waiting on the radiology admin. You can still correct it until they approve.'
                : 'Upload the modality output, scanned PDF, DICOM or video loop. Nothing leaves this draft until you mark it done.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {request && (
            <div className="rounded-lg bg-surface-container-low px-3 py-2 text-sm">
              <span className="font-medium">
                {request.patient?.firstName} {request.patient?.lastName}
              </span>{' '}
              · <span className="capitalize">{request.imagingType.replace(/_/g, ' ')}</span>
              {request.bodyPart ? ` · ${request.bodyPart}` : ''}
              {request.clinicalIndication && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {request.clinicalIndication}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold">Attached Files</p>
            {request && (
              <ImagingAttachmentsViewer
                requestId={request.id}
                resultId={resultId ?? undefined}
                attachments={files}
                canUpload={!isPublished}
                canManage={!isPublished}
                enableOrthanc
                emptyMessage="No files yet — upload modality images, PDFs, DICOM or videos."
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rad-impression">Impression / findings (optional)</Label>
            <Textarea
              id="rad-impression"
              rows={3}
              disabled={isPublished}
              placeholder="What the study shows…"
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
            />
          </div>

          {!isPublished && !isFinalized && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[11px] text-indigo-900">
              This is a <strong>draft</strong>. The ordering doctor and the patient cannot see it.
              Marking it done sends it to the radiology admin, who approves and publishes.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isPublished && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={editResult.isPending || !resultId}
            >
              {editResult.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PencilLine className="size-3.5" />
              )}{' '}
              Save draft
            </Button>
          )}
          {!isPublished && !isFinalized && (
            <Button onClick={handleMarkDone} disabled={submit.isPending || !hasFiles}>
              {submit.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" /> Mark as Done
                </>
              )}
            </Button>
          )}
          {isFinalized && !isRadiologyAdmin && (
            <span className="inline-flex items-center gap-1 px-2 text-[11px] italic text-muted-foreground">
              <Send className="size-3" /> With the admin
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StateChip({ status }: { status?: string | null }) {
  if (status === 'published') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700"
      >
        <Lock className="mr-1 size-3" /> Locked
      </Badge>
    );
  }
  if (status === 'finalized') {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
        <ShieldCheck className="mr-1 size-3" /> Awaiting approval
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-[10px] text-indigo-700">
      <PencilLine className="mr-1 size-3" /> Draft
    </Badge>
  );
}
