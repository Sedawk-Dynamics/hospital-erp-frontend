'use client';

// What this booking will be charged and the follow-up rule that decided it,
// for the booking screens that take no money themselves (gap #019).

import { IndianRupee, Loader2 } from 'lucide-react';
import { useBookingChargePreview } from '@/hooks/use-follow-up-rules';
import { consultationFeeText, followUpNote, isWaivedFollowUp, ruleHint, rupees } from '@/lib/follow-up-fee';

export function BookingFeeNote({
  doctorId,
  patientId,
  type,
  date,
  chargeRegistrationFee,
}: {
  doctorId: string;
  patientId: string;
  type: string;
  date: string;
  chargeRegistrationFee?: boolean | null;
}) {
  const { data: preview, isLoading } = useBookingChargePreview({
    doctorId, patientId, type, date, chargeRegistrationFee, enabled: !!patientId && !!date,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the fee…
      </div>
    );
  }
  if (!preview) return null;

  const { consultationFee: fee, followUp, registration } = preview;
  const note = followUpNote(fee, followUp) ?? ruleHint(followUp);
  return (
    <div className="rounded-lg border px-3 py-2 text-sm" data-testid="booking-fee-note">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <IndianRupee className="h-3.5 w-3.5" /> Consultation fee
        </span>
        <span className="font-semibold tabular-nums">
          {isWaivedFollowUp(fee, followUp) && followUp.listFee > 0 && (
            <span className="mr-1.5 font-normal text-muted-foreground line-through">{rupees(followUp.listFee)}</span>
          )}
          {consultationFeeText(fee, followUp)}
        </span>
      </div>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      {registration.applies && (
        <div className="mt-1 flex items-center justify-between gap-2 border-t pt-1 text-xs text-muted-foreground">
          <span>With {registration.label}</span>
          <span className="tabular-nums">{rupees(preview.total)}</span>
        </div>
      )}
    </div>
  );
}
