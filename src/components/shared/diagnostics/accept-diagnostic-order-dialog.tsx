'use client';

// ────────────────────────────────────────────────────────────────────────
// Accept a diagnostic order — one dialog, both departments.
//
// The admin's whole job in two steps:
//
//   1. Money.  An OP patient pays at this counter, with the same method grid
//              the front desk uses, and the department issues the bill. An
//              admitted patient has nothing to pay here — the charge goes on
//              their stay ledger and settles at discharge — so the step
//              collapses to a statement of where it went.
//   2. Work.   Hand it to whoever will run it.
//
// Both steps post in ONE request, so an order can never end up admitted
// against a payment that failed, or paid for and left in the intake queue.
// ────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  Wallet,
  CreditCard,
  Landmark,
  Smartphone,
  ScrollText,
  Coins,
  ShieldCheck,
  BedDouble,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CircleAlert,
  IndianRupee,
} from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';

import {
  ADMISSION_TYPE_LABELS,
  DEFER_REASONS,
  REFERENCE_REQUIRED,
  money,
  type DiagnosticAcceptPayload,
  type DiagnosticBillingPreview,
  type DiagnosticPaymentMethod,
} from './types';

const PAYMENT_METHODS: {
  value: DiagnosticPaymentMethod;
  label: string;
  icon: typeof Wallet;
}[] = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'debit_card', label: 'Debit Card', icon: CreditCard },
  { value: 'net_banking', label: 'Net Banking', icon: Landmark },
  { value: 'cheque', label: 'Cheque', icon: ScrollText },
  { value: 'other', label: 'Other', icon: Coins },
];

export interface AcceptDialogSubject {
  id: string;
  patientName: string;
  mrn?: string | null;
  /** Order number, accession, or whatever the module calls its reference. */
  reference?: string | null;
  orderedBy?: string | null;
  urgency?: string | null;
  /** What is being admitted — test names, or the study. */
  items: { id: string; label: string; sublabel?: string | null }[];
}

export interface AcceptDiagnosticOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: AcceptDialogSubject | null;
  /** Priced lines + where this patient settles. Fetched by the caller. */
  preview: DiagnosticBillingPreview | null;
  previewLoading?: boolean;
  /** Who the work can go to. */
  assignees: { id: string; name: string }[];
  assigneeLabel: string;
  assigneeHint: string;
  assigneesLoading?: boolean;
  /**
   * Set when the staff list could not be fetched. An empty dropdown and a
   * failed one look identical, and that is exactly how a missing `users:read`
   * permission hid for as long as it did — the control just quietly offered
   * nothing but "Leave unassigned".
   */
  assigneesError?: boolean;
  /** "lab order" / "imaging request" — used in the copy. */
  nounSingular: string;
  submitting?: boolean;
  onAccept: (payload: DiagnosticAcceptPayload & { assigneeId?: string }) => Promise<void>;
}

export function AcceptDiagnosticOrderDialog({
  open,
  onOpenChange,
  subject,
  preview,
  previewLoading = false,
  assignees,
  assigneeLabel,
  assigneeHint,
  assigneesLoading = false,
  assigneesError = false,
  nounSingular,
  submitting = false,
  onAccept,
}: AcceptDiagnosticOrderDialogProps) {
  const [step, setStep] = useState<'payment' | 'assign'>('payment');
  const [collect, setCollect] = useState(true);
  const [method, setMethod] = useState<DiagnosticPaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [deferReason, setDeferReason] = useState<string>(DEFER_REASONS[0].value);
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');

  // Every field resets between orders. Carrying the last order's technician and
  // payment mode into the next one is how a busy counter quietly mis-assigns.
  useSeedOnChange(open ? (subject?.id ?? null) : null, () => {
    setStep('payment');
    setCollect(true);
    setMethod('cash');
    setAmount('');
    setReference('');
    setPayNotes('');
    setDeferReason(DEFER_REASONS[0].value);
    setAssigneeId('');
    setNotes('');
  });

  const isLedger = preview?.mode === 'ip';
  // What is actually outstanding: an existing bill's balance if the front desk
  // got here first, otherwise the full charge.
  const due = preview
    ? preview.bill
      ? Number(preview.bill.balanceDue ?? 0)
      : preview.chargeAmount
    : 0;
  const nothingToCollect = isLedger || due <= 0;
  // With nothing to collect there is no first step to show — go straight to the
  // decision that is actually left.
  const effectiveStep = nothingToCollect ? 'assign' : step;

  const amountNum = amount.trim() === '' ? due : Number(amount);
  const isPartial = amountNum > 0 && amountNum < due;
  const refRequired = collect && REFERENCE_REQUIRED.includes(method);

  const handleContinue = () => {
    if (collect) {
      if (!(amountNum > 0)) {
        toast.error('Enter an amount to collect');
        return;
      }
      if (amountNum > due) {
        toast.error(`Amount cannot exceed ${money(due)}`);
        return;
      }
      if (refRequired && !reference.trim()) {
        toast.error('Reference number is required for this payment method');
        return;
      }
    } else if (!deferReason.trim()) {
      toast.error('Pick a reason for accepting without collecting');
      return;
    }
    setStep('assign');
  };

  const handleAccept = async () => {
    if (!subject) return;
    try {
      await onAccept({
        assigneeId: assigneeId || undefined,
        notes: notes.trim() || undefined,
        ...(nothingToCollect
          ? {}
          : collect
            ? {
                payment: {
                  paymentMethod: method,
                  amount: amountNum,
                  referenceNumber: reference.trim() || undefined,
                  notes: payNotes.trim() || undefined,
                },
                ...(isPartial ? { deferReason: deferReason.trim() } : {}),
              }
            : { deferReason: deferReason.trim() }),
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Failed to accept this ${nounSingular}`));
    }
  };

  const urgent = subject?.urgency === 'stat' || subject?.urgency === 'urgent';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {effectiveStep === 'payment' ? 'Collect Payment' : `Accept ${titleCase(nounSingular)}`}
          </DialogTitle>
          <DialogDescription>
            {effectiveStep === 'payment'
              ? 'Take the payment at this counter — the department raises the bill and hands over the receipt. Accepting follows automatically.'
              : `Admits the ${nounSingular} and hands it to whoever will do the work.`}
          </DialogDescription>
        </DialogHeader>

        {/* Who + what, always visible so nobody assigns work they cannot see. */}
        <div className="rounded-xl bg-surface-container-low px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{subject?.patientName ?? '—'}</span>
            {urgent && (
              <Badge className="bg-red-100 text-red-700 uppercase text-[10px]">
                {subject?.urgency}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {[subject?.mrn, subject?.reference, subject?.orderedBy]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>

        {previewLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Pricing this {nounSingular}…
          </div>
        ) : effectiveStep === 'payment' ? (
          <div className="space-y-4">
            {/* Amount summary — same shape as the front desk's. */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Amount Due
                  </p>
                  <p className="font-display text-2xl font-bold text-primary">{money(due)}</p>
                </div>
                <div className="text-right">
                  <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                    {preview?.bill ? 'Bill #' : 'Bill'}
                  </p>
                  <p className="font-label text-sm font-bold">
                    {preview?.bill?.billNumber ?? 'Raised on accept'}
                  </p>
                </div>
              </div>
              <ChargeLines preview={preview} />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ModeButton
                active={collect}
                onClick={() => setCollect(true)}
                icon={<Coins className="size-4 shrink-0" />}
                label="Collect now"
              />
              <ModeButton
                active={!collect}
                onClick={() => setCollect(false)}
                icon={<ShieldCheck className="size-4 shrink-0" />}
                label="Accept without collecting"
              />
            </div>

            {collect ? (
              <>
                <div className="space-y-1.5">
                  <Label>Payment Method *</Label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {PAYMENT_METHODS.map((m) => {
                      const Icon = m.icon;
                      const active = method === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setMethod(m.value)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-all',
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-surface-container bg-surface-container-low text-on-surface hover:border-primary/40',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-label text-[11px] font-bold">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dx-amount">Amount *</Label>
                    <Input
                      id="dx-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={due}
                      placeholder={String(due)}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    {isPartial && (
                      <p className="text-[11px] text-secondary">
                        Part payment — {money(due - amountNum)} stays due, and the{' '}
                        {nounSingular} keeps an Unpaid badge.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dx-reference">
                      Reference{refRequired ? ' *' : ' (optional)'}
                    </Label>
                    <Input
                      id="dx-reference"
                      placeholder={
                        method === 'cheque'
                          ? 'Cheque number'
                          : method === 'upi'
                            ? 'UPI transaction ID'
                            : 'Transaction reference'
                      }
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dx-paynotes">Payment notes (optional)</Label>
                  <Textarea
                    id="dx-paynotes"
                    rows={2}
                    placeholder="Any remark for this collection…"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Reason *</Label>
                <select
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  value={
                    DEFER_REASONS.some((r) => r.value === deferReason) ? deferReason : '__custom'
                  }
                  onChange={(e) =>
                    setDeferReason(e.target.value === '__custom' ? '' : e.target.value)
                  }
                >
                  {DEFER_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.value}
                    </option>
                  ))}
                  <option value="__custom">Other — type a reason</option>
                </select>
                {!DEFER_REASONS.some((r) => r.value === deferReason) && (
                  <Input
                    autoFocus
                    placeholder="Why is this being accepted unpaid?"
                    value={deferReason}
                    onChange={(e) => setDeferReason(e.target.value)}
                  />
                )}
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  The work is admitted and the bill stays open. The {nounSingular} carries an{' '}
                  <strong>Unpaid</strong> badge with this reason until it is settled.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Where the money went — stated plainly on the step that follows it. */}
            {isLedger ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
                <BedDouble className="mt-0.5 size-4 shrink-0 text-teal-700" />
                <div className="text-xs text-teal-900">
                  <p className="font-bold">
                    {ADMISSION_TYPE_LABELS[preview?.admissionType ?? 'ip']} — posted to the stay
                    ledger
                  </p>
                  <p className="mt-0.5">
                    {money(preview?.chargeAmount)} goes onto the admission&rsquo;s running bill and
                    settles once, at discharge. Nothing is collected here.
                  </p>
                </div>
              </div>
            ) : due <= 0 ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                <div className="text-xs text-emerald-900">
                  <p className="font-bold">Nothing outstanding</p>
                  <p className="mt-0.5">
                    {preview?.bill
                      ? `${preview.bill.billNumber} is already settled.`
                      : 'No priced tests on this order.'}{' '}
                    Accepting will not ask for money.
                  </p>
                </div>
              </div>
            ) : collect ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                <IndianRupee className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="text-xs">
                  <p className="font-bold text-primary">
                    {money(amountNum)} to be collected — {methodLabel(method)}
                  </p>
                  <p className="mt-0.5 text-on-surface-variant">
                    Taken when you accept. A receipt is raised against the bill.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                <div className="text-xs text-amber-900">
                  <p className="font-bold">Accepting unpaid — {money(due)} stays due</p>
                  <p className="mt-0.5">{deferReason}</p>
                </div>
              </div>
            )}

            {subject && subject.items.length > 0 && (
              <div>
                <Label>
                  {subject.items.length === 1 ? 'Study' : `Tests ordered (${subject.items.length})`}
                </Label>
                <ul className="mt-1 max-h-32 divide-y overflow-y-auto rounded-lg border">
                  {subject.items.map((it) => (
                    <li key={it.id} className="px-3 py-1.5 text-xs">
                      {it.label}
                      {it.sublabel && (
                        <span className="ml-1.5 text-muted-foreground">{it.sublabel}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <Label>{assigneeLabel}</Label>
              <select
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
                value={assigneeId}
                disabled={assigneesLoading || assigneesError}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">
                  {assigneesLoading ? 'Loading staff…' : 'Leave unassigned'}
                </option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {assigneesError ? (
                <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  Could not load the staff list — you may not have permission to
                  view users. Accept now and assign from the work queue once
                  that is sorted.
                </p>
              ) : !assigneesLoading && assignees.length === 0 ? (
                <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  Nobody with the right role is set up yet. Accepting will leave
                  this unassigned.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">{assigneeHint}</p>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                rows={2}
                placeholder="Optional intake note"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {effectiveStep === 'assign' && !nothingToCollect ? (
            <Button variant="ghost" onClick={() => setStep('payment')} disabled={submitting}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
          )}
          {effectiveStep === 'payment' ? (
            <Button onClick={handleContinue} disabled={previewLoading}>
              {collect ? `Collect ${money(amountNum)}` : 'Continue'}{' '}
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button onClick={handleAccept} disabled={submitting || previewLoading}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Accepting…
                </>
              ) : assigneeId ? (
                'Accept & Assign'
              ) : (
                'Accept'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The priced breakdown, so the counter can see what the total is made of. */
function ChargeLines({ preview }: { preview: DiagnosticBillingPreview | null }) {
  if (!preview || preview.lines.length === 0) return null;
  return (
    <div className="mt-2 space-y-0.5 border-t border-primary/15 pt-2">
      {preview.lines.map((l) => (
        <div key={l.referenceId} className="flex justify-between text-[11px]">
          <span className="truncate pr-2 text-on-surface-variant">{l.description}</span>
          <span className="shrink-0 font-medium">{money(l.amount)}</span>
        </div>
      ))}
      {preview.unpricedCount > 0 && (
        <p className="pt-1 text-[10px] italic text-amber-700">
          {preview.unpricedCount} item(s) have no price in the catalog and are not billed.
        </p>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-surface-container bg-surface-container-low hover:border-primary/40',
      )}
    >
      {icon}
      <span className="font-label text-xs font-bold">{label}</span>
    </button>
  );
}

function methodLabel(m: DiagnosticPaymentMethod) {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
