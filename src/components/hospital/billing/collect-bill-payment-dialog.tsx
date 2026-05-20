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

import { useRecordPayment, type FrontdeskPaymentMethod } from '@/hooks/use-hospital';

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
  const [submitting, setSubmitting] = useState(false);

  const balanceDue = bill?.balanceDue ?? 0;
  const billNumber = bill?.billNumber ?? '-';
  const patientName = bill?.patientName ?? 'Unknown patient';

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
  const refRequired = REFERENCE_REQUIRED.includes(selectedMethod);

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
    }
  }, [open, bill, reset]);

  const onSubmit = async (data: FormData) => {
    if (!bill || balanceDue <= 0) return;
    if (data.amount > balanceDue) {
      toast.error(`Amount cannot exceed balance due (₹${balanceDue.toLocaleString('en-IN')})`);
      return;
    }
    if (refRequired && !data.referenceNumber?.trim()) {
      toast.error('Reference number is required for this payment method');
      return;
    }

    setSubmitting(true);
    try {
      await recordPayment.mutateAsync({
        billId: bill.id,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      });

      toast.success(
        isPartial
          ? `Partial payment of ₹${data.amount.toLocaleString('en-IN')} collected`
          : `Payment of ₹${data.amount.toLocaleString('en-IN')} collected — bill cleared`,
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

          {/* Payment method grid */}
          <div className="space-y-1.5">
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
                max={balanceDue}
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
            <div className="space-y-1.5">
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
