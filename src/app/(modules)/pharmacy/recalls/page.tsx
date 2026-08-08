'use client';

// Recalled batches, inside the Pharmacy module.
//
// The recall machinery already existed and worked — flag, lift, affected
// patients, and dispensing is auto-blocked server-side. It just lived on a
// batch row under Inventory → Storage, and `pharmacist` has no access to the
// Inventory module, so the one role that hands medicine to patients could not
// see what had been recalled or who had already received it.
//
// Read-only for a pharmacist by design: declaring or lifting a recall needs
// `pharmacy:approve`, which only pharmacy_admin holds. The server enforces
// that; the button is simply hidden for everyone else rather than offered and
// then refused.

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, ShieldOff, Users, Ban } from 'lucide-react';
import {
  useRecalledItems,
  useRecallAffectedPatients,
  useUnrecallBatch,
  type RecalledBatch,
} from '@/hooks/use-pharmacy';
import { usePharmacyRole } from '@/hooks/use-pharmacy-role';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

export default function PharmacyRecallsPage() {
  const { data, isLoading } = useRecalledItems();
  const { isPharmacyAdmin } = usePharmacyRole();
  const unrecall = useUnrecallBatch();
  const [affectedFor, setAffectedFor] = useState<RecalledBatch | null>(null);

  const batches = data?.recalledBatches ?? [];

  const handleLift = async (batch: RecalledBatch) => {
    if (!confirm(`Lift the recall on batch ${batch.batchNumber}? Dispensing will be allowed again.`))
      return;
    try {
      await unrecall.mutateAsync(batch.id);
      toast.success('Recall lifted');
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to lift recall');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
          <ShieldOff className="h-5 w-5 text-red-600" /> Recalled Stock
        </h1>
        <p className="text-xs text-muted-foreground">
          These batches are blocked from dispensing and counter sale. If a sale is refused at the
          till, check here first.
          {!isPharmacyAdmin && ' Only a pharmacy admin can declare or lift a recall.'}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading recalls…
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest py-16 text-center shadow-sanctuary">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing is recalled. All stock is clear to dispense.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left font-label text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-2">Medicine</th>
                  <th className="px-4 py-2">Batch</th>
                  <th className="px-4 py-2">Expiry</th>
                  <th className="px-4 py-2 text-right">Still in stock</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Supplier</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {batches.map((b) => {
                  const dispensed = b._count?.dispensingRecords ?? 0;
                  return (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{b.drug.drugName}</p>
                        {b.drug.genericName && (
                          <p className="text-[11px] text-muted-foreground">{b.drug.genericName}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{b.batchNumber}</td>
                      <td className="px-4 py-2.5 text-xs">{formatDate(b.expiryDate)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {/* Stock still on the shelf under a recall is the thing
                            someone has to physically pull. */}
                        {b.quantityInStock > 0 ? (
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                            {b.quantityInStock} to pull
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">none</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {b.recallReason || <span className="italic">no reason recorded</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {b.supplier?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Already dispensed = people who need contacting. */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setAffectedFor(b)}
                            disabled={dispensed === 0}
                            title={
                              dispensed === 0
                                ? 'None of this batch was dispensed'
                                : 'Patients who already received this batch'
                            }
                          >
                            <Users className="h-3 w-3" />
                            {dispensed === 0 ? 'None dispensed' : `${dispensed} dispensed`}
                          </Button>
                          {isPharmacyAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleLift(b)}
                              disabled={unrecall.isPending}
                            >
                              <Ban className="h-3 w-3" />
                              Lift
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AffectedPatientsDialog batch={affectedFor} onClose={() => setAffectedFor(null)} />
    </div>
  );
}

/** Who already received this batch — the list someone has to ring round. */
function AffectedPatientsDialog({
  batch,
  onClose,
}: {
  batch: RecalledBatch | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useRecallAffectedPatients(batch?.id ?? null);

  return (
    <Dialog open={!!batch} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Patients who received this batch
          </DialogTitle>
          <DialogDescription>
            {batch?.drug.drugName} · batch {batch?.batchNumber}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !data || data.patients.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No dispensing records for this batch.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {data.totalPatients} patient{data.totalPatients === 1 ? '' : 's'} across{' '}
              {data.totalDispenses} dispense{data.totalDispenses === 1 ? '' : 's'}.
            </p>
            <ul className="divide-y rounded-lg border">
              {data.patients.map((p) => (
                <li key={p.patientId} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{p.mrn}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {/* The phone number is the point of this screen. */}
                    {p.phone ?? 'no phone on record'} · {p.totalQuantity} unit
                    {p.totalQuantity === 1 ? '' : 's'} · last{' '}
                    {formatDate(p.dispenses[0]?.dispensedAt ?? '')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
