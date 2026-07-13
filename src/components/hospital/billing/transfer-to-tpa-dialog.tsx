'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ArrowRightLeft, ShieldCheck, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTransferToTpa, usePatientPolicies } from '@/hooks/use-ip-billing';

// Transfer an IP bill to the TPA. Pick the patient's existing policy, or enter
// the insurer / TPA + policy details inline (created on the fly at transfer).

export function TransferToTpaDialog({
  admissionId, patientId, open, onOpenChange,
}: {
  admissionId: string;
  patientId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const transfer = useTransferToTpa();
  const { data: policies, isLoading } = usePatientPolicies(open ? patientId : null);

  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [policyId, setPolicyId] = useState<string>('');
  const [insurerName, setInsurerName] = useState('');
  const [tpaName, setTpaName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [coverageAmount, setCoverageAmount] = useState<number>(0);
  const [coPayPercent, setCoPayPercent] = useState<number>(0);
  const [deductibleAmount, setDeductibleAmount] = useState<number>(0);

  const activePolicies = (policies ?? []).filter((p) => p.status === 'active');

  useEffect(() => {
    if (!open) return;
    if (activePolicies.length > 0) { setMode('existing'); setPolicyId(activePolicies[0].id); }
    else { setMode('new'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, policies]);

  const submit = async () => {
    try {
      if (mode === 'existing') {
        if (!policyId) { toast.error('Pick a policy.'); return; }
        await transfer.mutateAsync({ admissionId, policyId });
      } else {
        if (!insurerName.trim()) { toast.error('Enter the insurer name.'); return; }
        await transfer.mutateAsync({
          admissionId,
          newPolicy: {
            insurerName: insurerName.trim(),
            tpaName: tpaName.trim() || undefined,
            policyNumber: policyNumber.trim() || undefined,
            coverageAmount: coverageAmount || undefined,
            coPayPercent: coPayPercent || undefined,
            deductibleAmount: deductibleAmount || undefined,
          },
        });
      }
      toast.success('Transferred to TPA — claim raised.');
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Transfer to TPA failed.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Transfer to TPA</DialogTitle>
          <DialogDescription>Raise the insurance claim for this IP bill. Insurer-tagged lines are claimed.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading policies…</div>
        ) : (
          <div className="space-y-3">
            {activePolicies.length > 0 && (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setMode('existing')}
                  className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs', mode === 'existing' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}>
                  Existing policy
                </button>
                <button type="button" onClick={() => setMode('new')}
                  className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs', mode === 'new' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}>
                  <Plus className="mr-1 inline h-3 w-3" /> New policy
                </button>
              </div>
            )}

            {mode === 'existing' && activePolicies.length > 0 ? (
              <div className="space-y-1.5">
                {activePolicies.map((p) => (
                  <label key={p.id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm', policyId === p.id ? 'border-primary bg-primary/5' : 'hover:bg-accent')}>
                    <input type="radio" name="policy" checked={policyId === p.id} onChange={() => setPolicyId(p.id)} className="accent-primary" />
                    <div className="min-w-0">
                      <div className="font-medium">{p.insurer?.name ?? 'Insurer'} · <span className="font-mono text-[11px]">{p.policyNumber}</span></div>
                      {p.tpa?.name && <div className="text-[11px] text-muted-foreground">TPA: {p.tpa.name}</div>}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Insurer *</Label>
                    <Input value={insurerName} onChange={(e) => setInsurerName(e.target.value)} placeholder="e.g. Star Health" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">TPA</Label>
                    <Input value={tpaName} onChange={(e) => setTpaName(e.target.value)} placeholder="e.g. MediAssist" className="mt-1 h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Policy number</Label>
                  <Input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="Optional" className="mt-1 h-8 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Coverage ₹</Label>
                    <Input type="number" min={0} value={coverageAmount || ''} onChange={(e) => setCoverageAmount(Math.max(0, parseFloat(e.target.value) || 0))} placeholder="limit" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Co-pay %</Label>
                    <Input type="number" min={0} max={100} value={coPayPercent || ''} onChange={(e) => setCoPayPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Deductible ₹</Label>
                    <Input type="number" min={0} value={deductibleAmount || ''} onChange={(e) => setDeductibleAmount(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 h-8 text-sm" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">The insurer covers the claim minus the deductible and co-pay (capped at the coverage limit); the patient owes the rest + any patient-only lines.</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={transfer.isPending} className="gap-1.5">
            {transfer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Transfer to TPA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
