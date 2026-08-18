'use client';

// The one-time registration fee, shown to the desk BEFORE the bill is raised.
//
// The fee is resolved inside `ensureAppointmentBill` from three inputs the
// counter never saw: the hospital setting, whether this is the patient's first
// visit here, and an override only the booking call could write. QA looked for
// a "collect registration charge" action, found nothing, and reported it
// missing — which is fair, because there was no moment at which the desk was
// ever asked.
//
// This is that moment. It only appears for hospitals that actually charge a
// registration fee; everywhere else the counter flow is unchanged.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ReceiptText } from 'lucide-react';
import { useAppointmentChargePreview } from '@/hooks/use-hospital';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function RegistrationFeePrompt({
  appointmentId,
  open,
  onOpenChange,
  onDecided,
}: {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** true = put the fee on the bill, false = waive it for this patient. */
  onDecided: (chargeRegistrationFee: boolean) => void | Promise<void>;
}) {
  const { data: preview, isLoading } = useAppointmentChargePreview(appointmentId);
  const reg = preview?.registration;

  // Whether the rule WOULD apply it, which is what the primary button confirms.
  const wouldCharge = reg?.applies ?? false;
  const consultation = preview?.consultationFee ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" /> Confirm charges
          </DialogTitle>
          <DialogDescription>
            Check what goes on this bill before the money is taken.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !reg ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border">
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span>Consultation fee</span>
                <span className="font-medium tabular-nums">{inr(consultation)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className={wouldCharge ? '' : 'text-muted-foreground line-through'}>
                  {reg.label}
                </span>
                <span
                  className={
                    wouldCharge ? 'font-medium tabular-nums' : 'text-muted-foreground tabular-nums'
                  }
                >
                  {inr(reg.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t bg-surface-container-low px-3 py-2 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {inr(consultation + (wouldCharge ? reg.totalAmount : 0))}
                </span>
              </div>
            </div>

            {/* Say why it does or does not apply — a desk that expected a fee
                and does not see one should not have to guess. */}
            <p className="text-xs text-muted-foreground">{reg.reason}</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {/* The desk can always overrule the rule in either direction — waive a
              fee the patient has already effectively paid elsewhere, or charge
              one on a re-registration after a long absence. */}
          {wouldCharge ? (
            <>
              <Button variant="outline" onClick={() => onDecided(false)} disabled={isLoading}>
                Skip {reg?.label ?? 'fee'}
              </Button>
              <Button onClick={() => onDecided(true)} disabled={isLoading}>
                Charge {inr(consultation + (reg?.totalAmount ?? 0))}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onDecided(true)} disabled={isLoading}>
                Add {reg?.label ?? 'fee'}
              </Button>
              <Button onClick={() => onDecided(false)} disabled={isLoading}>
                Charge {inr(consultation)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
