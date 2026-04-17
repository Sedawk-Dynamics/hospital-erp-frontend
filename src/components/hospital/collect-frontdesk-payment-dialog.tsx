'use client';

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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  useRecordPayment,
  useUpdateAppointmentStatus,
  type FrontdeskPaymentMethod,
} from '@/hooks/use-hospital';
import type { Appointment } from '@/types';

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
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CollectFrontdeskPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  /** Called after payment recorded AND appointment confirmed. */
  onConfirmed?: (apt: Appointment) => void;
}

export function CollectFrontdeskPaymentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirmed,
}: CollectFrontdeskPaymentDialogProps) {
  const recordPayment = useRecordPayment();
  const updateStatus = useUpdateAppointmentStatus();
  const [submitting, setSubmitting] = useState(false);

  const balanceDue = appointment?.paymentInfo?.balanceDue ?? 0;
  const billNumber = appointment?.paymentInfo?.billNumber ?? '-';
  const billId = appointment?.paymentInfo?.billId;

  const patientName = appointment?.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
    : 'Unknown Patient';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { paymentMethod: 'cash', notes: '' },
  });

  const selectedMethod = watch('paymentMethod');

  useEffect(() => {
    if (!open) {
      reset();
      setSubmitting(false);
    }
  }, [open, reset]);

  const onSubmit = async (data: FormData) => {
    if (!appointment || !billId || balanceDue <= 0) return;

    setSubmitting(true);
    try {
      await recordPayment.mutateAsync({
        billId,
        amount: balanceDue,
        paymentMethod: data.paymentMethod,
        notes: data.notes?.trim() || undefined,
      });

      await updateStatus.mutateAsync({ id: appointment.id, status: 'confirmed' });

      toast.success(
        `Payment of ₹${balanceDue.toLocaleString('en-IN')} collected. Appointment confirmed.`,
      );
      onOpenChange(false);
      onConfirmed?.(appointment);
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
          <DialogTitle>Collect Payment Before Confirmation</DialogTitle>
          <DialogDescription>
            <span className="font-label text-on-surface-variant">{patientName}</span> chose to pay
            at the front desk. Collect the amount below to confirm the appointment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Amount summary */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Amount Due
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
            <Button type="submit" disabled={submitting || !billId || balanceDue <= 0}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Mark Paid &amp; Confirm</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
