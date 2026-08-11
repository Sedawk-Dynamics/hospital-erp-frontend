'use client';

// Moved out of the radiology page unchanged: add, replace or remove the files on
// a result from the Results tab. Published results stay locked — the backend
// rejects the PATCH, so the button is not offered for them either.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImagingAttachmentsViewer } from '@/components/shared/imaging-attachments-viewer';
import { useImagingResultAttachments } from '@/hooks/use-imaging-attachments';
import type { ImagingResult } from '@/hooks/use-imaging';

export function EditResultDialog({
  result,
  onOpenChange,
}: {
  result: ImagingResult | null;
  onOpenChange: (open: boolean) => void;
}) {
  const requestId = result?.imagingRequest?.id ?? result?.requestId;
  const attachmentsQ = useImagingResultAttachments(result?.id);

  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Imaging Result</DialogTitle>
          <DialogDescription>Add, replace, or remove the attached files.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-sm font-semibold">Attached Files</p>
            {requestId && (
              <ImagingAttachmentsViewer
                requestId={requestId}
                resultId={result?.id}
                attachments={attachmentsQ.data ?? []}
                canUpload={true}
                canManage={true}
                enableOrthanc
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
