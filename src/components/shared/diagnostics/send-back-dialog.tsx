'use client';

// Refusing a submitted report, in both departments.
//
// Approving and refusing are the two halves of one decision, and only approving
// existed — a report that was wrong could be published or left in the queue
// forever. The reason is the whole point: the person who did the work has to be
// told what to fix, or the report comes straight back unchanged.

import { useState } from 'react';
import { Undo2, Loader2 } from 'lucide-react';
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
import { cn, getApiErrorMessage } from '@/lib/utils';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';

/** What a reviewer actually sends a report back for. */
const COMMON_REASONS = [
  'Wrong or unreadable file uploaded',
  'Result does not match the sample',
  'Values incomplete — some parameters missing',
  'Needs a repeat run to confirm',
  'Patient or test details are wrong',
];

export function SendBackDialog({
  open,
  onOpenChange,
  /** What is being sent back, shown so the reviewer can see they picked right. */
  subject,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: { title: string; sublabel?: string | null } | null;
  submitting?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(COMMON_REASONS[0]);

  useSeedOnChange(open ? (subject?.title ?? 'open') : null, () => {
    setReason(COMMON_REASONS[0]);
  });

  const isCustom = !COMMON_REASONS.includes(reason);

  const handle = async () => {
    if (!reason.trim()) {
      toast.error('Say what needs fixing — that is what gets sent back with it');
      return;
    }
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send this back'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Back for Changes</DialogTitle>
          <DialogDescription>
            Returns the report to the bench as a draft so it can be corrected and
            re-submitted. Nothing is deleted — the files and results stay put, and
            the patient never saw it.
          </DialogDescription>
        </DialogHeader>

        {subject && (
          <div className="rounded-lg bg-surface-container-low px-3 py-2 text-sm">
            <span className="font-medium">{subject.title}</span>
            {subject.sublabel && (
              <p className="text-[11px] text-muted-foreground">{subject.sublabel}</p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>What needs fixing? *</Label>
          <select
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            value={isCustom ? '__custom' : reason}
            onChange={(e) => setReason(e.target.value === '__custom' ? '' : e.target.value)}
          >
            {COMMON_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="__custom">Something else — type it</option>
          </select>
          {isCustom && (
            <Textarea
              autoFocus
              rows={2}
              placeholder="Tell them what to correct…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <p className="text-[11px] text-muted-foreground">
            This is sent to whoever ran the test and saved on the report.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handle}
            disabled={submitting}
            className={cn('bg-amber-600 hover:bg-amber-700')}
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Sending back…
              </>
            ) : (
              <>
                <Undo2 className="size-3.5" /> Send Back
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Kept next to the dialog so both departments word the reasons the same. */
export { COMMON_REASONS as SEND_BACK_REASONS };
