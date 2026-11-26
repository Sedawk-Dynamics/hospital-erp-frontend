'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  BedDouble,
  Loader2,
  Droplets,
  Wind,
  ClipboardCheck,
  Syringe,
  Gauge,
  Activity,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWards, useBeds, useFloors, useAssignAdmissionBed } from '@/hooks/use-clinical';
import { getApiErrorMessage } from '@/lib/utils';
import { FluidBalanceForm } from './icu/fluid-balance-form';
import { AbgVentForm } from './icu/abg-vent-form';
import { FastHugSepsisForm } from './icu/fasthug-sepsis-form';
import { InvasiveLineForm } from './icu/invasive-line-form';
import { InfusionPumpForm } from './icu/infusion-pump-form';
import { SeverityScoresForm } from './icu/severity-scores-form';

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
  const { data: floors } = useFloors();
  const { data: wards } = useWards();
  const [floorId, setFloorId] = useState('');
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const assign = useAssignAdmissionBed();
  const [isIcuWard, setIsIcuWard] = useState<boolean>(false);
  const wardOptions = useMemo(
    () => (wards ?? []).filter((w) => !floorId || w.floorId === floorId),
    [wards, floorId],
  );

  // Only free beds in the chosen ward are assignable.
  const { data: beds } = useBeds(wardId ? { wardId, status: 'available' } : undefined);
  const bedOptions = useMemo(() => beds ?? [], [beds]);

  // Picking a new floor invalidates the previously-chosen ward (and bed).
  useEffect(() => {
    setWardId('');
  }, [floorId]);

  // Picking a new ward invalidates the previously-chosen bed.
  useEffect(() => {
    setBedId('');
  }, [wardId]);

  const reset = () => {
    setFloorId('');
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

      const selectedWard = wardOptions.find((w) => w.id === wardId)
      const selectedBed = bedOptions.find((a) => a.id === bedId);
      const isIcu =
        ['icu', 'nicu', 'picu'].includes(selectedWard?.wardType ?? '') ||
        selectedBed?.bedType === 'icu';
      if (isIcu) {
        setIsIcuWard(true);
      } else {
        onSuccess?.();
        close();
      }
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
    <>
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
              <Label>Target Floor *</Label>
              <Select value={floorId} onValueChange={(v) => setFloorId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select floor" />
                </SelectTrigger>
                <SelectContent>
                  {(floors ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.level != null ? ` · Level ${f.level}` : ''}
                    </SelectItem>
                  ))}
                  {(floors ?? []).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No floors configured</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Target Ward *</Label>
              <Select value={wardId} onValueChange={(v) => setWardId(v ?? '')} disabled={!floorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={floorId ? 'Select ward' : 'Select floor first'} />
                </SelectTrigger>
                <SelectContent>
                  {wardOptions.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                      {w.availableBeds != null ? ` (${w.availableBeds} free)` : ''}
                    </SelectItem>
                  ))}
                  {floorId && wardOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No wards on this floor</div>
                  )}
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

      <IcuDetails
        open={isIcuWard}
        onOpenChange={setIsIcuWard}
        admissionId={admissionId}
        onSaved={() => {
          setIsIcuWard(false);
          onSuccess?.();
          close();
        }}
      />
    </>
  );
}




// ---------------------------------------------------------------------------
// ICU details capture modal. Opened after a patient is moved to an ICU ward/bed.
// Six charting modules as tabs. UI only for now — no persistence wired yet.
// ---------------------------------------------------------------------------

interface IcuDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId?: string;
  patientName?: string | null;
  onSaved?: () => void;
}

const ICU_TABS = [
  { value: 'fluid', label: 'Fluid Balance', icon: Droplets },
  { value: 'abg', label: 'ABG Analyz + Vent', icon: Wind },
  { value: 'fasthug', label: 'FAST-HUG + Sepsis', icon: ClipboardCheck },
  { value: 'lines', label: 'Invasive Lines', icon: Syringe },
  { value: 'pumps', label: 'Infusion Pumps', icon: Gauge },
  { value: 'scores', label: 'Severity Scores', icon: Activity },
] as const;

export const IcuDetails = ({ open, onOpenChange, admissionId, patientName, onSaved }: IcuDetailsProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            ICU Details{patientName ? ` — ${patientName}` : ''}
          </DialogTitle>
          <DialogDescription>
            Record the patient&apos;s initial ICU charting. Each section can also be updated later from the IP workspace.
          </DialogDescription>
        </DialogHeader>

        {/* Patient weight — shared across all ICU sections (used by dose/fluid calcs). */}
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
          <Label className="shrink-0 text-xs font-semibold text-primary">Patient weight (kg)</Label>
          <Input type="number" step="0.1" min={0} placeholder="kg" className="h-8 w-32 bg-surface" />
        </div>

        <Tabs defaultValue="fluid" className="w-full min-w-0">
          <div className="w-full max-w-full overflow-x-auto sanctuary-scrollbar">
            <TabsList className="flex w-max flex-nowrap justify-start gap-1">
              {ICU_TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.value} value={t.value} className="flex-none gap-1.5 whitespace-nowrap text-xs">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="mt-3 max-h-[55vh] overflow-y-auto pr-1">
            {/* 1. Fluid Balance -------------------------------------------- */}
            <TabsContent value="fluid" className="mt-0 space-y-4">
              <FluidBalanceForm admissionId={admissionId} />
            </TabsContent>

            {/* 2. ABG + Ventilator ---------------------------------------- */}
            <TabsContent value="abg" className="mt-0 space-y-4">
              <AbgVentForm admissionId={admissionId} />
            </TabsContent>

            {/* 3. FAST-HUG + Sepsis --------------------------------------- */}
            <TabsContent value="fasthug" className="mt-0 space-y-4">
              <FastHugSepsisForm admissionId={admissionId} />
            </TabsContent>

            {/* 4. Invasive Lines ------------------------------------------ */}
            <TabsContent value="lines" className="mt-0 space-y-4">
              <InvasiveLineForm admissionId={admissionId} />
            </TabsContent>

            {/* 5. Infusion Pumps ------------------------------------------ */}
            <TabsContent value="pumps" className="mt-0 space-y-4">
              <InfusionPumpForm admissionId={admissionId} />
            </TabsContent>

            {/* 6. Severity Scores ----------------------------------------- */}
            <TabsContent value="scores" className="mt-0 space-y-4">
              <SeverityScoresForm admissionId={admissionId} />
            </TabsContent>
          </div>
        </Tabs>


      </DialogContent>
    </Dialog>
  );
};