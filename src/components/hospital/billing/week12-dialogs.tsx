'use client';

// ───────────────────────────────────────────────────────────────────────
// Week 12 payment dialogs
//
// Multi-mode split payment, advance collection, refund request/approve,
// payment reversal, bill cancellation. Each is a small focused dialog —
// the cashier surfaces use them by passing the relevant bill/payment.
// ───────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Plus, Trash2, Wallet, CreditCard, Landmark, Smartphone, ScrollText,
  Coins, AlertTriangle, CheckCircle2, X, RotateCcw, Ban, Globe, IndianRupee,
} from 'lucide-react';

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  useCreateSplitPayment,
  useCreateAdvancePayment,
  useAdjustAdvance,
  useAdvanceBalance,
  useReversePayment,
  useCancelBill,
  useCreateRefund,
  useApproveRefund,
  useRejectRefund,
  useCreateOnlineOrder,
  useVerifyOnlinePayment,
  type BillingPaymentMethod,
  type SplitEntry,
} from '@/hooks/use-hospital';

const fmt = (n: number | string | undefined | null) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const METHODS: { value: BillingPaymentMethod; label: string; icon: typeof Wallet }[] = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'debit_card', label: 'Debit Card', icon: CreditCard },
  { value: 'net_banking', label: 'Bank Transfer', icon: Landmark },
  { value: 'cheque', label: 'Cheque', icon: ScrollText },
  { value: 'other', label: 'Other', icon: Coins },
];

// ────────────────────────────────────────────────────────────────────────
// 1. Split Payment Dialog
// ────────────────────────────────────────────────────────────────────────

export interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bill: { id: string; billNumber: string; balanceDue: number; patientName?: string } | null;
  /** When the cashier wants advance-money applied first. */
  advanceBalance?: number;
  onSettled?: () => void;
}

export function SplitPaymentDialog({
  open,
  onOpenChange,
  bill,
  advanceBalance = 0,
  onSettled,
}: SplitPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split Payment</DialogTitle>
          <DialogDescription>
            Collect a single bill via multiple modes — e.g. ₹5,000 cash + ₹3,000 card.
          </DialogDescription>
        </DialogHeader>
        {open && bill && (
          <SplitPaymentBody
            key={`${bill.id}|${open}`}
            bill={bill}
            advanceBalance={advanceBalance}
            onClose={() => onOpenChange(false)}
            onSettled={() => {
              onSettled?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SplitPaymentBody({
  bill,
  advanceBalance,
  onClose,
  onSettled,
}: {
  bill: { id: string; billNumber: string; balanceDue: number; patientName?: string };
  advanceBalance: number;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [splits, setSplits] = useState<SplitEntry[]>([
    { amount: bill.balanceDue, paymentMethod: 'cash', referenceNumber: '', notes: '' },
  ]);
  const splitTotal = splits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const remaining = bill.balanceDue - splitTotal;

  const createSplit = useCreateSplitPayment();

  const update = (idx: number, patch: Partial<SplitEntry>) => {
    setSplits((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };
  const remove = (idx: number) => setSplits((s) => s.filter((_, i) => i !== idx));
  const add = () =>
    setSplits((s) => [
      ...s,
      { amount: Math.max(0, bill.balanceDue - splitTotal), paymentMethod: 'cash', referenceNumber: '', notes: '' },
    ]);

  const handleSubmit = async () => {
    if (splitTotal <= 0) {
      toast.error('Add at least one positive split');
      return;
    }
    if (splitTotal > bill.balanceDue + 0.001) {
      toast.error(`Total ${fmt(splitTotal)} exceeds balance ${fmt(bill.balanceDue)}`);
      return;
    }
    for (const s of splits) {
      if (s.amount <= 0) {
        toast.error('Each split must be positive');
        return;
      }
    }
    try {
      await createSplit.mutateAsync({
        billId: bill.id,
        splits: splits.map((s) => ({
          amount: Number(s.amount),
          paymentMethod: s.paymentMethod,
          referenceNumber: s.referenceNumber?.trim() || undefined,
          notes: s.notes?.trim() || undefined,
        })),
      });
      toast.success(
        remaining <= 0
          ? `Split of ${fmt(splitTotal)} collected — bill cleared`
          : `Split of ${fmt(splitTotal)} collected — ${fmt(remaining)} still due`,
      );
      onSettled();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to record split payment');
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Balance Due</p>
          <p className="font-display text-2xl font-bold text-primary">{fmt(bill.balanceDue)}</p>
          <p className="font-label text-[10px] text-on-surface-variant">{bill.patientName ?? '—'} · Bill #{bill.billNumber}</p>
        </div>
        <div className="text-right">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Splits Total</p>
          <p className={cn(
            'font-display text-2xl font-bold tabular-nums',
            Math.abs(remaining) < 0.005 ? 'text-primary' : remaining < 0 ? 'text-error' : 'text-secondary',
          )}>{fmt(splitTotal)}</p>
          <p className="font-label text-[10px]">
            {remaining > 0 ? `${fmt(remaining)} remaining` : remaining < 0 ? `${fmt(-remaining)} over` : 'matches balance'}
          </p>
        </div>
      </div>

      {advanceBalance > 0 && (
        <p className="text-xs text-on-surface-variant">
          Patient has <strong>{fmt(advanceBalance)}</strong> advance on file — use the Advance dialog to adjust before splitting.
        </p>
      )}

      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {splits.map((s, idx) => (
          <div key={idx} className="rounded-xl border bg-surface-container-lowest p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Split #{idx + 1}
              </p>
              {splits.length > 1 && (
                <button
                  type="button"
                  className="text-error hover:opacity-70"
                  onClick={() => remove(idx)}
                  aria-label="Remove split"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`amt-${idx}`}>Amount</Label>
                <NumberInput
                  id={`amt-${idx}`}
                  step="0.01"
                  min={0}
                  value={s.amount}
                  onValueChange={(v) => update(idx, { amount: v })}
                />
              </div>
              <div>
                <Label htmlFor={`ref-${idx}`}>Reference</Label>
                <Input
                  id={`ref-${idx}`}
                  placeholder={
                    s.paymentMethod === 'cheque' ? 'Cheque #' :
                    s.paymentMethod === 'upi' ? 'UPI txn ID' : 'Transaction ref'
                  }
                  value={s.referenceNumber ?? ''}
                  onChange={(e) => update(idx, { referenceNumber: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Method</Label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = s.paymentMethod === m.value;
                  return (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => update(idx, { paymentMethod: m.value })}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-bold transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-surface-container bg-surface-container-low text-on-surface',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Split
      </Button>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={createSplit.isPending || splitTotal <= 0}>
          {createSplit.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</>
          ) : (
            `Record ${fmt(splitTotal)}`
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 2. Advance Payment Dialog (collect + adjust to a specific bill)
// ────────────────────────────────────────────────────────────────────────

export interface AdvancePaymentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient: { id: string; firstName: string; lastName: string; mrn?: string | null } | null;
  /** If passed, the dialog defaults to "adjust against this bill" mode. */
  targetBill?: { id: string; billNumber: string; balanceDue: number } | null;
  onDone?: () => void;
}

export function AdvancePaymentDialog({
  open,
  onOpenChange,
  patient,
  targetBill,
  onDone,
}: AdvancePaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Advance Payment</DialogTitle>
          <DialogDescription>
            Collect cash before a bill exists, or apply a patient&apos;s advance balance to an open bill.
          </DialogDescription>
        </DialogHeader>
        {open && patient && (
          <AdvancePaymentBody
            key={`${patient.id}|${targetBill?.id ?? ''}`}
            patient={patient}
            targetBill={targetBill ?? null}
            onClose={() => onOpenChange(false)}
            onDone={() => {
              onDone?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdvancePaymentBody({
  patient,
  targetBill,
  onClose,
  onDone,
}: {
  patient: { id: string; firstName: string; lastName: string; mrn?: string | null };
  targetBill: { id: string; billNumber: string; balanceDue: number } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: balance } = useAdvanceBalance(patient.id);
  const [mode, setMode] = useState<'collect' | 'adjust'>(targetBill ? 'adjust' : 'collect');
  const [amount, setAmount] = useState<number | ''>(
    targetBill ? Math.min(targetBill.balanceDue, balance?.balance ?? targetBill.balanceDue) : '',
  );
  const [method, setMethod] = useState<BillingPaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const collect = useCreateAdvancePayment();
  const adjust = useAdjustAdvance();

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Amount must be > 0');
      return;
    }
    try {
      if (mode === 'collect') {
        await collect.mutateAsync({
          patientId: patient.id,
          amount: amt,
          paymentMethod: method,
          referenceNumber: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success(`Advance ${fmt(amt)} recorded`);
      } else if (targetBill) {
        await adjust.mutateAsync({
          patientId: patient.id,
          billId: targetBill.id,
          amount: amt,
        });
        toast.success(`Adjusted ${fmt(amt)} from advance to bill ${targetBill.billNumber}`);
      }
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Operation failed');
    }
  };

  return (
    <>
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
        <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Patient</p>
        <p className="font-label text-sm font-bold">{patient.firstName} {patient.lastName}</p>
        <p className="font-label text-[10px] text-on-surface-variant">MRN {patient.mrn ?? '-'}</p>
        <div className="mt-2 flex items-center justify-between border-t border-primary/10 pt-2">
          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Advance Balance</span>
          <span className="font-display text-lg font-bold text-primary">{fmt(balance?.balance ?? 0)}</span>
        </div>
      </div>

      {targetBill && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode('collect')}
            className={cn(
              'flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold',
              mode === 'collect' ? 'border-primary bg-primary/10 text-primary' : 'border-surface-container text-on-surface-variant',
            )}
          >Collect new advance</button>
          <button
            type="button"
            onClick={() => setMode('adjust')}
            className={cn(
              'flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold',
              mode === 'adjust' ? 'border-primary bg-primary/10 text-primary' : 'border-surface-container text-on-surface-variant',
            )}
          >Adjust to Bill #{targetBill.billNumber}</button>
        </div>
      )}

      <div className="space-y-2">
        <Label>Amount</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max={mode === 'adjust' ? Math.min(targetBill?.balanceDue ?? 0, balance?.balance ?? 0) : undefined}
          value={amount}
          onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>

      {mode === 'collect' && (
        <>
          <div>
            <Label>Method</Label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-bold',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-surface-container bg-surface-container-low text-on-surface',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={collect.isPending || adjust.isPending || !amount}
        >
          {(collect.isPending || adjust.isPending) ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : mode === 'collect' ? 'Collect Advance' : 'Adjust to Bill'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 3. Refund Request Dialog (creates request → awaiting approve/reject)
// ────────────────────────────────────────────────────────────────────────

export interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payment: { id: string; amount: number; billNumber?: string; patientName?: string } | null;
  onSubmitted?: () => void;
}

export function RefundRequestDialog({ open, onOpenChange, payment, onSubmitted }: RefundRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Refund</DialogTitle>
          <DialogDescription>Refund requests go through manager approval before they hit the bill.</DialogDescription>
        </DialogHeader>
        {open && payment && (
          <RefundRequestBody
            key={payment.id}
            payment={payment}
            onClose={() => onOpenChange(false)}
            onSubmitted={() => {
              onSubmitted?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RefundRequestBody({
  payment,
  onClose,
  onSubmitted,
}: {
  payment: { id: string; amount: number; billNumber?: string; patientName?: string };
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [amount, setAmount] = useState<number | ''>(payment.amount);
  const [reason, setReason] = useState('');
  const create = useCreateRefund();

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Amount must be > 0'); return; }
    if (amt > payment.amount) {
      toast.error(`Cannot refund more than ${fmt(payment.amount)}`);
      return;
    }
    if (reason.trim().length < 3) { toast.error('Reason is required (min 3 chars)'); return; }
    try {
      await create.mutateAsync({ paymentId: payment.id, amount: amt, reason: reason.trim() });
      toast.success('Refund request submitted — awaiting approval');
      onSubmitted();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit refund');
    }
  };

  return (
    <>
      <div className="rounded-xl bg-error-container/30 border border-error/20 px-3 py-2 text-xs text-on-error-container flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        Refund will be deducted from bill on approval. Provide a clear, auditable reason.
      </div>
      <div className="rounded-lg bg-surface-container-low p-2 text-xs">
        <p>Payment: <strong>{fmt(payment.amount)}</strong> · Bill {payment.billNumber ?? '-'} · {payment.patientName ?? '-'}</p>
      </div>
      <div>
        <Label>Refund Amount</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max={payment.amount}
          value={amount}
          onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>
      <div>
        <Label>Reason *</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Request'}
        </Button>
      </DialogFooter>
    </>
  );
}

// Approve/reject inline buttons (used in Refunds list)

export function RefundApproveButton({ refundId, onChanged }: { refundId: string; onChanged?: () => void }) {
  const approve = useApproveRefund();
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1 text-xs text-primary"
      disabled={approve.isPending}
      onClick={async () => {
        try {
          await approve.mutateAsync(refundId);
          toast.success('Refund approved');
          onChanged?.();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed');
        }
      }}
    >
      {approve.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
      Approve
    </Button>
  );
}

export function RefundRejectButton({ refundId, onChanged }: { refundId: string; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const reject = useRejectRefund();
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1 text-xs text-error" onClick={() => setOpen(true)}>
        <X className="h-3 w-3" /> Reject
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Refund</DialogTitle>
            <DialogDescription>Reason will be logged in the refund audit trail.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (reason.trim().length < 3) { toast.error('Reason required'); return; }
                try {
                  await reject.mutateAsync({ refundId, reason: reason.trim() });
                  toast.success('Refund rejected');
                  setOpen(false);
                  setReason('');
                  onChanged?.();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Failed');
                }
              }}
              disabled={reject.isPending}
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 4. Payment Reversal Dialog
// ────────────────────────────────────────────────────────────────────────

export interface PaymentReversalDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payment: { id: string; amount: number; billNumber?: string; method?: string } | null;
  onReversed?: () => void;
}

export function PaymentReversalDialog({ open, onOpenChange, payment, onReversed }: PaymentReversalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reverse Payment</DialogTitle>
          <DialogDescription>
            Mark the payment as reversed (cashier error / wrong bill). The bill balance is re-opened and the action is logged.
          </DialogDescription>
        </DialogHeader>
        {open && payment && (
          <PaymentReversalBody
            key={payment.id}
            payment={payment}
            onClose={() => onOpenChange(false)}
            onReversed={() => {
              onReversed?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentReversalBody({
  payment,
  onClose,
  onReversed,
}: {
  payment: { id: string; amount: number; billNumber?: string; method?: string };
  onClose: () => void;
  onReversed: () => void;
}) {
  const [reason, setReason] = useState('');
  const reverse = useReversePayment();

  const submit = async () => {
    if (reason.trim().length < 3) { toast.error('Reason is required'); return; }
    try {
      await reverse.mutateAsync({ paymentId: payment.id, reason: reason.trim() });
      toast.success(`Payment reversed — ${fmt(payment.amount)} returned to balance`);
      onReversed();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reverse');
    }
  };

  return (
    <>
      <div className="rounded-xl bg-error-container/30 border border-error/20 px-3 py-2 text-xs text-on-error-container flex items-start gap-2">
        <RotateCcw className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        Reversal is for error correction. For genuine returns, use Refund instead.
      </div>
      <div className="rounded-lg bg-surface-container-low p-2 text-xs">
        <p>Payment: <strong>{fmt(payment.amount)}</strong> · Bill {payment.billNumber ?? '-'} · {payment.method ?? '-'}</p>
      </div>
      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for reversal..." />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={reverse.isPending} className="bg-error text-on-error">
          {reverse.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reversing...</> : 'Reverse Payment'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 5. Cancel Bill Dialog
// ────────────────────────────────────────────────────────────────────────

export interface CancelBillDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bill: { id: string; billNumber: string; totalAmount: number; amountPaid: number } | null;
  onCancelled?: () => void;
}

export function CancelBillDialog({ open, onOpenChange, bill, onCancelled }: CancelBillDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Bill</DialogTitle>
          <DialogDescription>
            Cancellation is permanent and visible in the Cancelled Bills list. The bill is not deleted — a cancellation receipt is generated.
          </DialogDescription>
        </DialogHeader>
        {open && bill && (
          <CancelBillBody
            key={bill.id}
            bill={bill}
            onClose={() => onOpenChange(false)}
            onCancelled={() => {
              onCancelled?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelBillBody({
  bill,
  onClose,
  onCancelled,
}: {
  bill: { id: string; billNumber: string; totalAmount: number; amountPaid: number };
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState('');
  const cancel = useCancelBill();

  const submit = async () => {
    if (reason.trim().length < 3) { toast.error('Reason is required'); return; }
    try {
      await cancel.mutateAsync({ billId: bill.id, reason: reason.trim() });
      toast.success(`Bill ${bill.billNumber} cancelled — receipt generated`);
      onCancelled();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel');
    }
  };

  const hasPayments = bill.amountPaid > 0;

  return (
    <>
      {hasPayments && (
        <div className="rounded-xl bg-error-container/30 border border-error/20 px-3 py-2 text-xs text-on-error-container flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          This bill has {fmt(bill.amountPaid)} paid. Refund or reverse those payments before cancelling.
        </div>
      )}
      <div className="rounded-lg bg-surface-container-low p-2 text-xs">
        Bill <strong>{bill.billNumber}</strong> · Total {fmt(bill.totalAmount)} · Paid {fmt(bill.amountPaid)}
      </div>
      <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation..." />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={submit}
          disabled={cancel.isPending || hasPayments}
          className="bg-error text-on-error"
        >
          <Ban className="mr-1 h-4 w-4" />
          {cancel.isPending ? 'Cancelling...' : 'Cancel Bill'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 6. Razorpay Online Payment Dialog (loads checkout via SDK)
// ────────────────────────────────────────────────────────────────────────

function useLoadRazorpay() {
  // External-script load: setState IS the right action when the script
  // finishes loading. The lint rule's "no setState in effect" doesn't apply
  // when synchronizing with an external system (which is the whole point
  // of useEffect).
  const [ready, setReady] = useState<boolean>(typeof window !== 'undefined' && !!window.Razorpay);
  useEffect(() => {
    if (typeof window === 'undefined' || window.Razorpay) return;
    const id = 'razorpay-checkout-js';
    const existing = document.getElementById(id);
    if (existing) {
      const check = setInterval(() => {
        if (window.Razorpay) {
          setReady(true);
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);
  return ready;
}

export interface OnlinePaymentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bill: { id: string; billNumber: string; balanceDue: number; patientName?: string; patientPhone?: string; patientEmail?: string } | null;
  onSettled?: () => void;
}

export function OnlinePaymentDialog({ open, onOpenChange, bill, onSettled }: OnlinePaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Online Payment</DialogTitle>
          <DialogDescription>
            Patient pays via UPI / card / netbanking through Razorpay. Webhook will confirm even if the patient closes the browser.
          </DialogDescription>
        </DialogHeader>
        {open && bill && (
          <OnlinePaymentBody
            key={bill.id}
            bill={bill}
            onClose={() => onOpenChange(false)}
            onSettled={() => {
              onSettled?.();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OnlinePaymentBody({
  bill,
  onClose,
  onSettled,
}: {
  bill: { id: string; billNumber: string; balanceDue: number; patientName?: string; patientPhone?: string; patientEmail?: string };
  onClose: () => void;
  onSettled: () => void;
}) {
  const ready = useLoadRazorpay();
  const createOrder = useCreateOnlineOrder();
  const verify = useVerifyOnlinePayment();
  const [phase, setPhase] = useState<'idle' | 'opening' | 'verifying' | 'done'>('idle');

  const start = async () => {
    if (!ready || !window.Razorpay) {
      toast.error('Razorpay SDK not loaded yet — try again in a moment');
      return;
    }
    try {
      setPhase('opening');
      const order = await createOrder.mutateAsync({ billId: bill.id });
      if (!order) throw new Error('Failed to create order');
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Hospital Bill',
        description: `Bill ${bill.billNumber}`,
        prefill: { name: bill.patientName, contact: bill.patientPhone, email: bill.patientEmail },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setPhase('verifying');
          try {
            await verify.mutateAsync(resp);
            toast.success('Payment captured');
            setPhase('done');
            onSettled();
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Verification failed');
            setPhase('idle');
          }
        },
        modal: {
          ondismiss: () => setPhase('idle'),
        },
      });
      rzp.open();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to start payment');
      setPhase('idle');
    }
  };

  return (
    <>
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-xs space-y-1">
        <p><strong>Bill #{bill.billNumber}</strong> · {bill.patientName ?? '-'}</p>
        <p>Balance Due: <strong>{fmt(bill.balanceDue)}</strong></p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={start} disabled={!ready || createOrder.isPending || phase !== 'idle'}>
          {!ready ? 'Loading SDK...' :
            phase === 'opening' ? 'Opening...' :
            phase === 'verifying' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> :
            <><Globe className="mr-2 h-4 w-4" /> Pay {fmt(bill.balanceDue)}</>}
        </Button>
      </DialogFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 7. Receipt download button
// ────────────────────────────────────────────────────────────────────────

export function ReceiptDownloadButton({
  receiptId,
  label = 'Receipt',
}: {
  receiptId: string;
  label?: string;
}) {
  // The PDF endpoint is auth-gated, so we can't just window.open it on the
  // browser. Instead we fetch with the auth header, blob it, and trigger a
  // download.
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('@/lib/api');
      const response = await apiClient.get(`/billing/receipts/${receiptId}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to download');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={download} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <IndianRupee className="h-3 w-3" />}
      {label}
    </Button>
  );
}

