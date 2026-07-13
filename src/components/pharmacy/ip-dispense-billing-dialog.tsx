'use client';

import { toast } from 'sonner';
import { Loader2, Pill, BedDouble, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBaseQty } from '@/lib/pharmacy-units';
import { useDispenseIpPrescription, type PrescriptionListItem } from '@/hooks/use-pharmacy';

// IP pharmacy "billing" step. Same queue -> billing flow as OP, but the pharmacy
// collects ₹0 (flagged IP) — the medicine cost is posted to the patient's
// hospital IP ledger, not charged at the counter.

const n = (v: number | string | null | undefined) => Number(v ?? 0);
const money = (v: number | string | null | undefined) => `₹${n(v).toFixed(2)}`;

export function IpDispenseBillingDialog({ rx, open, onOpenChange }: {
  rx: PrescriptionListItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const dispense = useDispenseIpPrescription();
  if (!rx) return null;

  const patientName = `${rx.patient?.firstName ?? ''} ${rx.patient?.lastName ?? ''}`.trim();
  const ward = rx.visit?.admission?.ward?.name;
  const bed = rx.visit?.admission?.bed?.bedNumber;

  const lines = (rx.prescriptionItems ?? [])
    .filter((it) => it.drugId && !it.isPrn && n(it.quantity) > 0)
    .map((it) => {
      const unitPrice = n(it.drug?.price);
      return { ...it, unitPrice, lineTotal: unitPrice * n(it.quantity) };
    });
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);

  const submit = async () => {
    try {
      await dispense.mutateAsync(rx.id);
      toast.success("Dispensed — billed to the patient's IP ledger.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not dispense to the IP ledger.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Pill className="h-5 w-5 text-primary" /> IP Pharmacy Billing
            <Badge className="bg-purple-100 text-purple-700 text-[10px]">IP PATIENT</Badge>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><strong>{patientName}</strong>{rx.patient?.mrn ? ` · ${rx.patient.mrn}` : ''}</span>
            {(ward || bed) && (
              <span className="inline-flex items-center gap-1"><BedDouble className="h-3 w-3" />{[ward, bed].filter(Boolean).join(' · ')}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {lines.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No stocked, non-PRN medicine with a quantity to dispense on this prescription.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit ₹</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-3 py-2"><span className="font-medium">{l.drugName}</span>{l.dosage ? <span className="text-muted-foreground"> {l.dosage}</span> : null}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatBaseQty(n(l.quantity), l.drug?.dosageForm, l.drug?.looseUnitLabel)}</td>
                    <td className="px-3 py-2 text-right">{money(l.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Billing summary — pharmacy collects ₹0, ledger holds the charge. */}
        <div className="space-y-1.5 rounded-lg border border-purple-300 bg-purple-50/40 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Medicines (≈, billed to ledger)</span>
            <span className="font-semibold">{money(total)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-1.5">
            <span className="font-medium text-foreground">Pharmacy collection</span>
            <span className="font-bold text-foreground">₹0.00</span>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-purple-800">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            IP patient — nothing is charged at the pharmacy counter. The medicine cost is posted to the patient&apos;s <strong>hospital IP ledger</strong> and settled in Hospital Billing.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={dispense.isPending || lines.length === 0} className="gap-1.5">
            {dispense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Dispense &amp; bill to ledger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
