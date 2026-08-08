'use client';

// ───────────────────────────────────────────────────────────────────────
// Collect Bill Payment Dialog
//
// Front-desk / cashier-style payment acceptance for any pending bill — not
// tied to an appointment confirmation step. Mirrors the UX of
// CollectFrontdeskPaymentDialog (same payment-method grid, amount summary,
// notes), with two differences: (1) it accepts a Bill payload, not an
// Appointment, so it works on the Hospital Billing > Pending List tab and
// other bill-centric surfaces; (2) the amount is editable so partial
// payments can be recorded against the same bill.
// ───────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Loader2,
  Wallet,
  CreditCard,
  Landmark,
  Smartphone,
  ScrollText,
  Coins,
} from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  useRecordPayment,
  useAdvanceBalance,
  useAdjustAdvance,
  type FrontdeskPaymentMethod,
} from '@/hooks/use-hospital';

const PAYMENT_METHODS: {
  value: FrontdeskPaymentMethod;
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

const formSchema = z.object({
  paymentMethod: z.enum([
    'cash',
    'credit_card',
    'debit_card',
    'upi',
    'net_banking',
    'cheque',
    'other',
  ]),
  amount: z.number().positive('Amount must be greater than zero'),
  referenceNumber: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface CollectBillPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: {
    id: string;
    billNumber: string;
    balanceDue: number;
    patientName?: string;
    /**
     * Enables settling from money the patient has already deposited. Without
     * it the advance is invisible here and the desk has to take the payment
     * twice over — once into the advance, once again at the counter.
     */
    patientId?: string;
  } | null;
  /** Called after the payment has been recorded successfully. */
  onCollected?: () => void;
}

const REFERENCE_REQUIRED: FrontdeskPaymentMethod[] = [
  'credit_card',
  'debit_card',
  'upi',
  'net_banking',
  'cheque',
];

export function CollectBillPaymentDialog({
  open,
  onOpenChange,
  bill,
  onCollected,
}: CollectBillPaymentDialogProps) {
  const recordPayment = useRecordPayment();
  const adjustAdvance = useAdjustAdvance();
  const [submitting, setSubmitting] = useState(false);
  // Settle from the advance instead of taking money at the counter.
  const [payFromAdvance, setPayFromAdvance] = useState(false);

  const balanceDue = bill?.balanceDue ?? 0;
  const billNumber = bill?.billNumber ?? '-';
  const patientName = bill?.patientName ?? 'Unknown patient';

  const { data: advance } = useAdvanceBalance(bill?.patientId);
  const advanceBalance = advance?.balance ?? 0;
  const canUseAdvance = !!bill?.patientId && advanceBalance > 0;
  // Neither side can be exceeded: not the deposit, not what the bill owes.
  const maxFromAdvance = Math.min(advanceBalance, balanceDue);
  const maxAmount = payFromAdvance ? maxFromAdvance : balanceDue;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentMethod: 'cash',
      amount: 0,
      referenceNumber: '',
      notes: '',
    },
  });

  const selectedMethod = watch('paymentMethod');
  const amountValue = watch('amount');
  const isPartial = amountValue > 0 && amountValue < balanceDue;
  // An advance is money already taken — there is no card or cheque to reference.
  const refRequired = !payFromAdvance && REFERENCE_REQUIRED.includes(selectedMethod);

  // Re-seed form when the dialog opens for a new bill — we want the amount
  // to default to the full balance every time, not carry across bills.
  useEffect(() => {
    if (open && bill) {
      reset({
        paymentMethod: 'cash',
        amount: bill.balanceDue,
        referenceNumber: '',
        notes: '',
      });
      setSubmitting(false);
      setPayFromAdvance(false);
    }
  }, [open, bill, reset]);

  const onSubmit = async (data: FormData) => {
    if (!bill || balanceDue <= 0) return;
    if (data.amount > maxAmount) {
      toast.error(
        payFromAdvance
          ? `Only ₹${maxFromAdvance.toLocaleString('en-IN')} can be taken from the advance`
          : `Amount cannot exceed balance due (₹${balanceDue.toLocaleString('en-IN')})`,
      );
      return;
    }
    if (refRequired && !data.referenceNumber?.trim()) {
      toast.error('Reference number is required for this payment method');
      return;
    }

    setSubmitting(true);
    try {
      if (payFromAdvance && bill.patientId) {
        // Moves money already on deposit onto this bill — no cash changes hands.
        await adjustAdvance.mutateAsync({
          patientId: bill.patientId,
          billId: bill.id,
          amount: data.amount,
        });
      } else {
        await recordPayment.mutateAsync({
          billId: bill.id,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
        });
      }

      const settled = payFromAdvance ? 'adjusted from advance' : 'collected';
      toast.success(
        isPartial
          ? `Partial payment of ₹${data.amount.toLocaleString('en-IN')} ${settled}`
          : `Payment of ₹${data.amount.toLocaleString('en-IN')} ${settled} — bill cleared`,
      );
      onOpenChange(false);
      onCollected?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to collect payment';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Record a front-desk payment against{' '}
            <span className="font-label text-on-surface-variant">{patientName}</span>&rsquo;s bill.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Amount summary */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Balance Due
                </p>
                <p className="font-display text-2xl font-bold text-primary">
                  ₹{balanceDue.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Bill #
                </p>
                <p className="font-label text-sm font-bold">{billNumber}</p>
              </div>
            </div>
          </div>

          {/* Money the patient has already deposited. Shown above the payment
              methods because if there is an advance sitting there, using it is
              almost always the right answer — otherwise the desk collects the
              same money twice and has to refund the deposit later. */}
          {canUseAdvance && (
            <div className="space-y-2">
              <Label>Settle using</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPayFromAdvance(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
                    !payFromAdvance
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-surface-container bg-surface-container-low hover:border-primary/40',
                  )}
                >
                  <Coins className="h-4 w-4 shrink-0" />
                  <span className="font-label text-xs font-bold">Collect now</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayFromAdvance(true);
                    // Default to whatever the advance can actually cover.
                    setValue('amount', maxFromAdvance, { shouldValidate: true });
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all',
                    payFromAdvance
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-surface-container bg-surface-container-low hover:border-primary/40',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 shrink-0" />
                    <span className="font-label text-xs font-bold">From advance</span>
                  </span>
                  <span className="font-label text-[11px] font-bold">
                    ₹{advanceBalance.toLocaleString('en-IN')}
                  </span>
                </button>
              </div>
              {payFromAdvance && advanceBalance < balanceDue && (
                <p className="text-[11px] text-muted-foreground">
                  The advance covers ₹{maxFromAdvance.toLocaleString('en-IN')} of ₹
                  {balanceDue.toLocaleString('en-IN')}. Collect the rest separately once this is
                  applied.
                </p>
              )}
            </div>
          )}

          {/* Payment method grid — irrelevant when the money is already on
              deposit, so it is hidden rather than left there to be filled in. */}
          <div className={cn('space-y-1.5', payFromAdvance && 'hidden')}>
            <Label>Payment Method *</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const active = selectedMethod === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setValue('paymentMethod', m.value, { shouldValidate: true })}
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
            {errors.paymentMethod && (
              <p className="text-xs text-destructive">{errors.paymentMethod.message}</p>
            )}
          </div>

          {/* Amount + Reference row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Amount *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0"
                max={maxAmount}
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
              {isPartial && (
                <p className="text-[11px] text-secondary">
                  Partial payment — balance remains{' '}
                  ₹{(balanceDue - amountValue).toLocaleString('en-IN')}
                </p>
              )}
            </div>
            {/* No card, cheque or UPI id exists for money already on deposit. */}
            <div className={cn('space-y-1.5', payFromAdvance && 'hidden')}>
              <Label htmlFor="payment-reference">
                Reference{refRequired ? ' *' : ' (optional)'}
              </Label>
              <Input
                id="payment-reference"
                placeholder={
                  selectedMethod === 'cheque'
                    ? 'Cheque number'
                    : selectedMethod === 'upi'
                      ? 'UPI transaction ID'
                      : 'Transaction reference'
                }
                {...register('referenceNumber')}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              placeholder="Any remarks for this payment..."
              rows={2}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !bill || balanceDue <= 0}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Record Payment</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
