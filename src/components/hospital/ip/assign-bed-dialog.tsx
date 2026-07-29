'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BedDouble, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWards, useBeds, useAssignAdmissionBed } from '@/hooks/use-clinical';
import { getApiErrorMessage } from '@/lib/utils';

/**
 * The ONE ward/bed dialog used everywhere a patient gets, moves, or clears a
 * bed — front-desk list, IP workspace, everywhere. Single behavior: pick a
 * ward + bed and it's applied instantly via PATCH /admissions/:id/assign-bed
 * (moving between wards happens naturally because a bed belongs to a ward).
 * There is no separate "transfer" flow — same popup, same logic, always.
 */
interface AssignBedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;

  /** Current location — shown in the banner. */
  currentBedId?: string | null;
  currentWardName?: string | null;
  currentBedNumber?: string | null;

  /** Extra query invalidation the caller wants after a successful move. */
  onSuccess?: () => void;
}

export function AssignBedDialog({
  open,
  onOpenChange,
  admissionId,
  currentBedId,
  currentWardName,
  currentBedNumber,
  onSuccess,
}: AssignBedDialogProps) {
  const { data: wards } = useWards();
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const assign = useAssignAdmissionBed();

  // Only free beds in the chosen ward are assignable.
  const { data: beds } = useBeds(wardId ? { wardId, status: 'available' } : undefined);
  const bedOptions = useMemo(() => beds ?? [], [beds]);

  // Picking a new ward invalidates the previously-chosen bed.
  useEffect(() => {
    setBedId('');
  }, [wardId]);

  const reset = () => {
    setWardId('');
    setBedId('');
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleAssign = async () => {
    if (!bedId) return;
    try {
      await assign.mutateAsync({ id: admissionId, bedId });
      toast.success('Bed assigned');
      onSuccess?.();
      close();
    } catch (err) {
      toast.error(getApiErrorMessage(err) ?? 'Failed to assign bed');
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
            <BedDouble className="h-4 w-4 text-primary" />
            {currentBedId ? 'Change bed' : 'Assign bed'}
          </DialogTitle>
          <DialogDescription>
            Move the patient to a ward/bed. Applied immediately.
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
        </div>

        <DialogFooter className="sm:justify-between">
          {currentBedId ? (
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50 sm:mr-auto"
              onClick={handleClear}
              disabled={assign.isPending}
            >
              Clear bed
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={close} disabled={assign.isPending}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!bedId || assign.isPending} className="gap-1.5">
              {assign.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {currentBedId ? 'Move here' : 'Assign'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
