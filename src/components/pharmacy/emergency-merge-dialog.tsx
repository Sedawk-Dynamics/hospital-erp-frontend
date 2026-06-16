'use client';

import { useState } from 'react';
import { Siren, Search, Loader2, ArrowRight } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { usePatientSearch } from '@/hooks/use-hospital';
import { useEmergencyPatients, useMergeEmergencyPatient } from '@/hooks/use-pharmacy';

const inr = (n: number) => `₹${(n ?? 0).toFixed(2)}`;

/**
 * G16: retrospective merge UI. Pick an emergency (TEMP-ER) patient and the
 * permanent MRN created at registration; the merge moves all pharmacy history
 * (bills, dispenses, returns) onto the real patient and retires the temp record.
 */
export function EmergencyMergeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tempId, setTempId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [target, setTarget] = useState<{ id: string; name: string; mrn?: string } | null>(null);

  const { data: emergencies = [], isLoading } = useEmergencyPatients(open);
  const { data: patientResults } = usePatientSearch(patientSearch);
  const merge = useMergeEmergencyPatient();

  function reset() {
    setTempId(null);
    setPatientSearch('');
    setTarget(null);
  }

  async function handleMerge() {
    if (!tempId || !target) return;
    try {
      await merge.mutateAsync({ id: tempId, targetPatientId: target.id });
      toast.success('Emergency record merged into the registered patient');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to merge');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-rose-500" />
            Merge emergency record
          </DialogTitle>
          <DialogDescription>
            Move a Golden-Hour temp patient&apos;s pharmacy charges onto the permanent MRN created
            after registration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 1. Pick the emergency temp patient */}
          <div>
            <label className="text-xs font-medium">Emergency (temp) patient</label>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : emergencies.length === 0 ? (
              <EmptyState icon={Siren} title="No emergency records" description="No active temp patients to merge." />
            ) : (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border">
                {emergencies.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setTempId(e.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted',
                      tempId === e.id && 'bg-primary/10',
                    )}
                  >
                    <span>
                      <span className="font-mono text-xs">{e.mrn}</span>{' '}
                      <span className="text-muted-foreground">{e.firstName} {e.lastName}</span>
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {e.billCount} bill{e.billCount === 1 ? '' : 's'} · {inr(e.heldAmount)}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Pick the permanent patient */}
          {tempId && (
            <div>
              <label className="text-xs font-medium">Registered patient (target)</label>
              {target ? (
                <div className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
                  <span>
                    <b>{target.name}</b>
                    {target.mrn && <span className="ml-2 font-mono text-xs text-muted-foreground">{target.mrn}</span>}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search name, MRN or phone"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {(patientResults?.length ?? 0) > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-md border">
                      {patientResults!.map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            setTarget({ id: p.id, name: `${p.firstName} ${p.lastName ?? ''}`.trim(), mrn: p.mrn })
                          }
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-medium">{p.firstName} {p.lastName}</span>
                          {p.mrn && <span className="ml-2 font-mono text-xs text-muted-foreground">{p.mrn}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMerge} disabled={!tempId || !target || merge.isPending}>
            {merge.isPending ? 'Merging…' : <>Merge <ArrowRight className="ml-1 h-3.5 w-3.5" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
