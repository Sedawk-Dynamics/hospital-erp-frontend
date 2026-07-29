'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BedDouble, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWards, useBeds, useAssignAdmissionBed } from '@/hooks/use-clinical';
import { getApiErrorMessage } from '@/lib/utils';

interface AssignBedDialogProps {
  admissionId: string;
  currentBedId?: string | null;
  currentWardName?: string | null;
  currentBedNumber?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Front-desk "assign / change bed" from the IP workspace — beds are no longer
// picked at registration, so this is where a patient gets (or moves) a bed during
// the stay. Applied instantly (frees the old bed, occupies the new one).
export function AssignBedDialog({
  admissionId,
  currentBedId,
  currentWardName,
  currentBedNumber,
  open,
  onOpenChange,
}: AssignBedDialogProps) {
  const { data: wards } = useWards();
  const [wardId, setWardId] = useState<string>('');
  const [bedId, setBedId] = useState<string>('');
  const assign = useAssignAdmissionBed();

  // Available beds in the chosen ward, plus the currently-occupied bed so a
  // "change within the same ward" still lists where the patient is now.
  const { data: beds } = useBeds(wardId ? { wardId, status: 'available' } : undefined);
  const bedOptions = useMemo(() => beds ?? [], [beds]);

  const reset = () => {
    setWardId('');
    setBedId('');
  };

  const handleAssign = async () => {
    if (!bedId) return;
    try {
      await assign.mutateAsync({ id: admissionId, bedId });
      toast.success('Bed assigned');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err) ?? 'Failed to assign bed');
    }
  };

  const handleClear = async () => {
    try {
      await assign.mutateAsync({ id: admissionId, bedId: null });
      toast.success('Bed cleared');
      reset();
      onOpenChange(false);
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
            Current: {currentWardName ?? '—'} / Bed {currentBedNumber ?? '—'}. Applied immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Ward</label>
            <select
              value={wardId}
              onChange={(e) => { setWardId(e.target.value); setBedId(''); }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select ward…</option>
              {(wards ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.availableBeds != null ? ` (${w.availableBeds} free)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Available bed</label>
            <select
              value={bedId}
              onChange={(e) => setBedId(e.target.value)}
              disabled={!wardId}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">{wardId ? 'Select bed…' : 'Pick a ward first'}</option>
              {bedOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  Bed {b.bedNumber}{b.bedType ? ` · ${b.bedType}` : ''}
                </option>
              ))}
            </select>
            {wardId && bedOptions.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-600">No free beds in this ward.</p>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          {currentBedId ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={handleClear}
              disabled={assign.isPending}
            >
              Clear bed
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }} disabled={assign.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAssign} disabled={!bedId || assign.isPending} className="gap-1.5">
              {assign.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {currentBedId ? 'Move here' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
