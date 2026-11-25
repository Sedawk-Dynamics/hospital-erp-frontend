'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MIN_CLOSE_REASON_LENGTH, useCloseStaleClaimQuery, useCloseStalePreAuth } from '@/hooks/use-insurance-admin';

interface Props {
  request: { id: string; requestNumber?: string | null } | null;
  onClose: () => void;
  /** What is being closed: an overdue pre-auth (default) or a stale payer query on a claim. */
  kind?: 'preauth' | 'claimQuery';
}

/** Gap 294: close an overdue request that will never be decided — reason required. */
export function CloseStaleRequestDialog({ request, onClose, kind = 'preauth' }: Props) {
  const [reason, setReason] = useState('');
  const closePreAuth = useCloseStalePreAuth();
  const closeQuery = useCloseStaleClaimQuery();
  const close = kind === 'claimQuery' ? closeQuery : closePreAuth;
  const trimmed = reason.trim();
  const tooShort = trimmed.length < MIN_CLOSE_REASON_LENGTH;

  function dismiss() {
    setReason('');
    onClose();
  }

  async function submit() {
    if (!request || tooShort) return;
    try {
      await close.mutateAsync({ id: request.id, reason: trimmed });
      toast.success(`${request.requestNumber ?? 'Request'} closed`);
      dismiss();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not close the request');
    }
  }

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close {request?.requestNumber ?? 'request'}</DialogTitle>
          <DialogDescription>
            Use this for an overdue request that will not be decided (payer silent, patient converted to cash,
            superseded…). It leaves the overdue queue; your name, the time and the reason are kept in its history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="close-reason">Reason *</Label>
          <Textarea
            id="close-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Payer has not responded in 3 weeks; patient discharged and paid as cash"
          />
          <p className={`text-[11px] ${tooShort && reason ? 'text-destructive' : 'text-on-surface-variant'}`}>
            At least {MIN_CLOSE_REASON_LENGTH} characters ({trimmed.length}/{MIN_CLOSE_REASON_LENGTH}).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>Cancel</Button>
          <Button variant="destructive" disabled={tooShort || close.isPending} onClick={submit}>
            {close.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Close request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
