'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BedDouble, Loader2, ArrowLeftRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWards, useBeds, useAssignAdmissionBed } from '@/hooks/use-clinical';
import { apiPost } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';

/**
 * The single ward/bed picker dialog used everywhere a patient gets (or moves)
 * a bed. Two modes over the SAME UI:
 *  - `assign`   — instant assign/change via PATCH /admissions/:id/assign-bed
 *                 (front-desk power from the IP workspace; can also clear).
 *  - `transfer` — records a ward/bed transfer via POST /clinical/transfers
 *                 (auto-approved → applied instantly) with an optional reason.
 * Both render styled Selects so the two never drift apart visually again.
 */
interface AssignBedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  mode?: 'assign' | 'transfer';

  /** Current location (shown in the banner + used as the transfer `from`). */
  currentBedId?: string | null;
  currentWardId?: string | null;
  currentWardName?: string | null;
  currentBedNumber?: string | null;

  /** Transfer mode only. */
  patientId?: string;
  visitId?: string;
  patientName?: string;

  /** Extra query invalidation the caller wants after a successful move. */
  onSuccess?: () => void;
}

export function AssignBedDialog({
  open,
  onOpenChange,
  admissionId,
  mode = 'assign',
  currentBedId,
  currentWardId,
  currentWardName,
  currentBedNumber,
  patientId,
  visitId,
  patientName,
  onSuccess,
}: AssignBedDialogProps) {
  const isTransfer = mode === 'transfer';
  const queryClient = useQueryClient();

  const { data: wards } = useWards();
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState('');

  // Re-fetch beds whenever the ward changes; only free beds are assignable.
  const { data: beds } = useBeds(wardId ? { wardId, status: 'available' } : undefined);
  const bedOptions = useMemo(() => beds ?? [], [beds]);

  // Picking a new ward invalidates the previously-chosen bed.
  useEffect(() => {
    setBedId('');
  }, [wardId]);

  const reset = () => {
    setWardId('');
    setBedId('');
    setReason('');
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  // --- assign mode ---------------------------------------------------------
  const assign = useAssignAdmissionBed();

  // --- transfer mode -------------------------------------------------------
  const transfer = useMutation({
    mutationFn: () => {
      const transferType: 'ward_to_ward' | 'bed_to_bed' =
        wardId && wardId !== currentWardId ? 'ward_to_ward' : 'bed_to_bed';
      // `from` fields may be null (a patient can be admitted without a bed) —
      // null fails uuid validation, so omit any empty field entirely.
      const payload: Record<string, unknown> = {
        patientId,
        visitId,
        transferType,
        toWardId: wardId,
        toBedId: bedId,
        reason: reason || undefined,
        autoApprove: true, // front desk moves the patient instantly
      };
      if (currentWardId) payload.fromWardId = currentWardId;
      if (currentBedId) payload.fromBedId = currentBedId;
      return apiPost('/clinical/transfers', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', 'admissions'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'beds'] });
    },
  });

  const pending = isTransfer ? transfer.isPending : assign.isPending;

  const handleSubmit = async () => {
    if (!bedId) return;
    try {
      if (isTransfer) {
        await transfer.mutateAsync();
        toast.success('Patient transferred to the new bed.');
      } else {
        await assign.mutateAsync({ id: admissionId, bedId });
        toast.success('Bed assigned');
      }
      onSuccess?.();
      close();
    } catch (err) {
      toast.error(getApiErrorMessage(err) ?? (isTransfer ? 'Transfer failed' : 'Failed to assign bed'));
    }
  };

  const handleClear = async () => {
    try {
      await assign.mutateAsync({ id: admissionId, bedId: null });
      toast.success('Bed cleared');
      onSuccess?.();
      close();
    } catch (err) {
      toast.error(getApiErrorMessage(err) ?? 'Failed to clear bed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTransfer ? (
              <ArrowLeftRight className="h-4 w-4 text-primary" />
            ) : (
              <BedDouble className="h-4 w-4 text-primary" />
            )}
            {isTransfer ? 'Transfer Patient' : currentBedId ? 'Change bed' : 'Assign bed'}
          </DialogTitle>
          <DialogDescription>
            {isTransfer && patientName ? (
              <>Transfer <strong>{patientName}</strong> to a different ward/bed.</>
            ) : (
              'Move the patient to a ward/bed. Applied immediately.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Current location */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Current:</span>{' '}
          <strong>{currentWardName ?? '—'}</strong> / Bed{' '}
          <strong>{currentBedNumber ?? '—'}</strong>
        </div>

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label>Target Ward *</Label>
            <Select value={wardId} onValueChange={(v) => setWardId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select ward" />
              </SelectTrigger>
              <SelectContent>
                {(wards ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.availableBeds != null ? ` (${w.availableBeds} free)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Target Bed *</Label>
            <Select value={bedId} onValueChange={(v) => setBedId(v ?? '')} disabled={!wardId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={wardId ? 'Select bed' : 'Select ward first'} />
              </SelectTrigger>
              <SelectContent>
                {bedOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    Bed {b.bedNumber}{b.bedType ? ` · ${b.bedType}` : ''}
                  </SelectItem>
                ))}
                {wardId && bedOptions.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No available beds</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {isTransfer && (
            <div className="grid gap-1.5">
              <Label>Reason</Label>
              <Textarea
                placeholder="Reason for transfer..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {!isTransfer && currentBedId ? (
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50 sm:mr-auto"
              onClick={handleClear}
              disabled={pending}
            >
              Clear bed
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!bedId || pending} className="gap-1.5">
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isTransfer ? 'Transfer' : currentBedId ? 'Move here' : 'Assign'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
