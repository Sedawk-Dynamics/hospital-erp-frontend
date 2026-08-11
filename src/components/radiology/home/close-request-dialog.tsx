'use client';

// Moved out of the 958-line radiology page unchanged. Used for studies that
// won't produce a report file — the patient didn't come, refused, had it done
// elsewhere, or it's no longer required.

import { useState } from 'react';
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
import { getApiErrorMessage } from '@/lib/utils';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';
import {
  useCloseImagingRequest,
  IMAGING_CLOSURE_REASONS,
  type ImagingClosureReason,
  type ImagingRequest,
} from '@/hooks/use-imaging';

export function CloseRequestDialog({
  request,
  onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const close = useCloseImagingRequest();
  const [reason, setReason] = useState<ImagingClosureReason>('patient_no_show');
  const [note, setNote] = useState('');

  useSeedOnChange(request?.id ?? null, () => {
    setReason('patient_no_show');
    setNote('');
  });

  const selected = IMAGING_CLOSURE_REASONS.find((r) => r.value === reason);

  const handle = async () => {
    if (!request) return;
    if (reason === 'other' && !note.trim()) {
      toast.error('Add a note describing the reason');
      return;
    }
    try {
      await close.mutateAsync({ id: request.id, reason, note: note.trim() || undefined });
      toast.success(
        reason === 'patient_no_show' ? 'Marked as no-show' : 'Request closed — doctor notified',
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to close request'));
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Imaging Request</DialogTitle>
          <DialogDescription>
            Use this for studies that won&apos;t produce a report file — the patient didn&apos;t
            come, refused, had it done elsewhere, or it&apos;s no longer required. The ordering
            doctor is notified.
          </DialogDescription>
        </DialogHeader>
        {request && (
          <div className="rounded-lg bg-surface-container-low px-3 py-2 text-sm">
            <span className="font-medium">
              {request.patient?.firstName} {request.patient?.lastName}
            </span>{' '}
            · <span className="capitalize">{request.imagingType.replace(/_/g, ' ')}</span>
            {request.bodyPart ? ` · ${request.bodyPart}` : ''}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label>Reason *</Label>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as ImagingClosureReason)}
            >
              {IMAGING_CLOSURE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {selected && <p className="mt-1 text-xs text-muted-foreground">{selected.hint}</p>}
          </div>
          <div>
            <Label>Note {reason === 'other' ? '*' : '(optional)'}</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any extra detail for the record / doctor…"
            />
          </div>
          {reason === 'patient_no_show' ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This will be recorded as a <strong>no-show</strong>. You can reopen it later from the
              Closed / No-show tab if the patient returns.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              This will mark the request <strong>cancelled</strong> with the reason saved for
              reporting. It can be reopened later if needed.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={close.isPending}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={close.isPending} className="bg-rose-600 hover:bg-rose-700">
            {close.isPending ? 'Closing…' : 'Close Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
