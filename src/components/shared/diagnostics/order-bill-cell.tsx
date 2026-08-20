'use client';

// The money column, shared by the lab and radiology worklists so a row reads
// the same in both. Radiology has carried a version of this since the
// payment-verify gate; the lab had no money column at all, which is why an
// unpaid order looked identical to a settled one.

import {
  IndianRupee,
  Wallet,
  BedDouble,
  ShieldCheck,
  CircleAlert,
  Stethoscope,
  CircleCheck,
  Clock3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ADMISSION_TYPE_LABELS,
  formatPaymentMethod,
  money,
  type DiagnosticConsultation,
  type DiagnosticEncounter,
  type DiagnosticLinkedBill,
} from './types';

/**
 * Where the patient is — shown on the worklist row, not just inside the accept
 * dialog. It is the one fact that changes what accepting does: an admitted
 * patient's charge goes to the stay ledger and nothing is collected here, so
 * the admin needs to know before they open anything and reach for the cash box.
 */
export function EncounterBadge({
  encounter,
  className,
}: {
  encounter?: DiagnosticEncounter | null;
  className?: string;
}) {
  if (!encounter) {
    return (
      <Badge
        variant="outline"
        className={cn('border-sky-300 bg-sky-50 text-[10px] text-sky-700', className)}
        title="Outpatient — pays at this counter"
      >
        OP
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn('border-teal-300 bg-teal-50 text-[10px] text-teal-700', className)}
      title="Admitted — the charge goes to the stay ledger and settles at discharge. Nothing is collected here."
    >
      <BedDouble className="mr-1 size-3" />
      {ADMISSION_TYPE_LABELS[encounter.admissionType]}
    </Badge>
  );
}

export function OrderBillCell({ bill }: { bill?: DiagnosticLinkedBill | null }) {
  if (!bill) return <span className="text-xs text-muted-foreground">Not billed yet</span>;

  const charge = Number(bill.chargeAmount ?? 0);
  const paid = Number(bill.amountPaid ?? 0);
  const due = Number(bill.balanceDue ?? 0);

  // An admitted patient's charge sits on the stay ledger. Showing a balance
  // there invites somebody to collect it twice — it is settled at discharge.
  if (bill.isLedger) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1">
          <IndianRupee className="size-3" />
          <span className="text-xs">{charge.toLocaleString('en-IN')}</span>
        </div>
        <Badge
          variant="outline"
          className="border-teal-300 bg-teal-50 text-[10px] text-teal-700"
        >
          <BedDouble className="mr-1 size-3" /> On stay ledger
        </Badge>
      </div>
    );
  }

  const modes = Array.from(
    new Set((bill.payments ?? []).map((p) => formatPaymentMethod(p.paymentMethod))),
  );

  return (
    <div className="space-y-0.5">
      <div className="font-mono text-[10px]">{bill.billNumber}</div>
      <div className="flex items-center gap-1">
        <IndianRupee className="size-3" />
        <span className="text-xs">{charge.toLocaleString('en-IN')}</span>
        <Badge variant="outline" className="ml-1 text-[10px] capitalize">
          {bill.status?.replace(/_/g, ' ') ?? 'pending'}
        </Badge>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Paid {paid.toLocaleString('en-IN')} · Due {due.toLocaleString('en-IN')}
      </div>
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        <Wallet className="size-3 text-muted-foreground" />
        {modes.length > 0 ? (
          modes.map((m) => (
            <Badge
              key={m}
              variant="outline"
              className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700"
            >
              {m}
            </Badge>
          ))
        ) : (
          <span className="text-[10px] italic text-muted-foreground">No payment recorded</span>
        )}
      </div>
    </div>
  );
}

/**
 * The status-column badge for money. Three distinct states, because "unpaid"
 * and "deliberately accepted on credit" are not the same thing and a counter
 * chasing the first must not be sent after the second.
 */
export function PaymentStatusBadge({
  paymentVerified,
  deferredReason,
  isLedger,
  className,
}: {
  paymentVerified?: boolean | null;
  deferredReason?: string | null;
  isLedger?: boolean;
  className?: string;
}) {
  if (isLedger) {
    return (
      <Badge
        variant="outline"
        className={cn('border-teal-300 bg-teal-50 text-[10px] text-teal-700', className)}
        title="Charged to the admission's running ledger, settled at discharge"
      >
        <BedDouble className="mr-1 size-3" /> Ledger
      </Badge>
    );
  }
  if (paymentVerified) {
    return (
      <Badge
        variant="outline"
        className={cn('border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700', className)}
      >
        <ShieldCheck className="mr-1 size-3" /> Paid
      </Badge>
    );
  }
  if (deferredReason) {
    return (
      <Badge
        variant="outline"
        className={cn('border-amber-300 bg-amber-50 text-[10px] text-amber-800', className)}
        title={deferredReason}
      >
        <CircleAlert className="mr-1 size-3" /> On credit
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn('border-red-300 bg-red-50 text-[10px] text-red-700', className)}
    >
      <Wallet className="mr-1 size-3" /> Unpaid
    </Badge>
  );
}

export { money };

/**
 * Whether the doctor has actually seen this patient yet.
 *
 * A test follows the consultation: the doctor sends the patient down, the test
 * runs, the patient goes back with the result. But the queue row alone cannot
 * tell that apart from a patient who is still in the waiting room, so the
 * department had no way to judge whether it was reasonable to start — or to
 * start writing a report.
 *
 * Nothing is rendered for an inpatient: a ward patient has rounds, not a
 * consultation, and the encounter badge beside this already says they are
 * admitted.
 */
export function ConsultationBadge({
  consultation,
  className,
}: {
  consultation?: DiagnosticConsultation | null;
  className?: string;
}) {
  if (!consultation || consultation.visitType !== 'op') return null;

  const by = consultation.doctorName ? ` · Dr. ${consultation.doctorName}` : '';

  if (consultation.state === 'done') {
    return (
      <Badge
        variant="outline"
        className={cn('border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700', className)}
        title={`The doctor has seen this patient${by}. The order can be worked and reported.`}
      >
        <CircleCheck className="mr-1 size-3" />
        Consultation done
      </Badge>
    );
  }

  if (consultation.state === 'in_consultation') {
    return (
      <Badge
        variant="outline"
        className={cn('border-amber-300 bg-amber-50 text-[10px] text-amber-800', className)}
        title={`The doctor has this patient now${by} — the order was raised during the consultation.`}
      >
        <Stethoscope className="mr-1 size-3" />
        In consultation
      </Badge>
    );
  }

  if (consultation.state === 'awaiting') {
    return (
      <Badge
        variant="outline"
        className={cn('border-slate-300 bg-slate-50 text-[10px] text-slate-600', className)}
        title="The patient has not been seen by the doctor yet. A test is meant to follow the consultation."
        data-testid="consultation-awaiting"
      >
        <Clock3 className="mr-1 size-3" />
        Consultation pending
      </Badge>
    );
  }

  // 'none' — no appointment behind this order, or one that was cancelled or
  // not attended. Worth saying plainly rather than leaving the row blank.
  return (
    <Badge
      variant="outline"
      className={cn('border-slate-300 bg-slate-50 text-[10px] text-slate-600', className)}
      title="No consultation stands behind this order — there is no appointment, or it was cancelled or not attended."
    >
      <Clock3 className="mr-1 size-3" />
      No consultation
    </Badge>
  );
}
