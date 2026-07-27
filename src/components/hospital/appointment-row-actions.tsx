'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  LogIn,
  MoreHorizontal,
  ShieldCheck,
  UserX,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUpdateAppointmentStatus, useInitiateFrontdeskPayment } from '@/hooks/use-hospital';

import { CancelAppointmentDialog } from './cancel-appointment-dialog';
import { RescheduleAppointmentDialog } from './reschedule-appointment-dialog';
import { PatientDetailDialog } from './patient-detail-dialog';
import { CollectFrontdeskPaymentDialog } from './collect-frontdesk-payment-dialog';
import type { Appointment } from '@/types';

/**
 * The complete set of front-counter actions for one appointment row.
 *
 * Shared by the Front Desk dashboard and the hospital-admin Walk In queue so
 * the two screens can never drift apart again — the Walk In queue previously
 * only offered Confirm and Check In, which meant a `checked_in` or
 * `pending_payment` row rendered an empty Actions cell with nothing to do.
 *
 * Lifecycle covered here:
 *   pending_payment → Collect Payment (mints the front-desk bill)
 *   booked          → Confirm, or Collect ₹X & Confirm when payment is due
 *   confirmed       → Check In
 *   checked_in      → waiting for the doctor (they start the consultation)
 * plus View details / Reschedule / Cancel / Mark no-show on every live row.
 */

/** Minimal row shape both screens can satisfy. */
export interface AppointmentRowLike {
  id: string;
  status: string;
  patientId?: string;
  doctorId?: string;
  type?: string;
  consultationType?: string;
  priority?: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string | null;
    phone?: string | null;
    gender?: string | null;
  } | null;
  paymentInfo?: {
    billId: string;
    billNumber: string;
    billStatus: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: string;
  } | null;
}

interface AppointmentRowActionsProps {
  appointment: AppointmentRowLike;
  /** Called after any mutation so the host can refresh its own queries. */
  onChanged?: () => void;
  className?: string;
}

export function AppointmentRowActions({
  appointment: apt,
  onChanged,
  className,
}: AppointmentRowActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [collectTarget, setCollectTarget] = useState<Appointment | null>(null);

  const updateStatus = useUpdateAppointmentStatus();
  const initiatePayment = useInitiateFrontdeskPayment();

  const status = apt.status;
  const patient = apt.patient ?? null;

  /** Payment was deferred to the counter and money is still outstanding. */
  const needsPayment =
    apt.paymentInfo?.paymentStatus === 'pay_at_frontdesk' && apt.paymentInfo.balanceDue > 0;

  /**
   * Anything the counter can still take money for: a live appointment that has
   * an outstanding balance, or none at all because no bill was ever raised.
   *
   * Appointments booked through the New Appointment dialog never raise a bill
   * (they show "No Billing"), and the Collect action used to appear only on
   * `pending_payment` rows — so a walk-in that was already checked in had no
   * way to be charged from the queue at all.
   */
  const isLive = !['completed', 'cancelled', 'no_show'].includes(status);
  const outstanding = apt.paymentInfo ? apt.paymentInfo.balanceDue > 0 : true;
  const canCollect = isLive && outstanding;

  const canReschedule = ['pending_payment', 'booked', 'confirmed', 'no_show', 'checked_in'].includes(status);
  const canCancel = ['pending_payment', 'booked', 'confirmed', 'checked_in'].includes(status);
  const canNoShow = ['pending_payment', 'booked', 'confirmed'].includes(status);

  const advance = async (next: string, message: string) => {
    try {
      await updateStatus.mutateAsync({ id: apt.id, status: next });
      toast.success(message);
      onChanged?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  /** Confirm, but collect the outstanding fee first when one is due. */
  const handleConfirm = () => {
    if (needsPayment) {
      setCollectTarget(apt as unknown as Appointment);
      return;
    }
    advance('confirmed', 'Appointment confirmed');
  };

  /**
   * A `pending_payment` row has no bill yet — mint it server-side, then hand
   * the freshly created bill to the collect dialog.
   */
  const handleStartPayment = async () => {
    try {
      const bill = await initiatePayment.mutateAsync(apt.id);
      if (!bill) {
        toast.error('Failed to create front-desk bill');
        return;
      }
      if (bill.balanceDue <= 0) {
        // Usually means the doctor has no consultation fee configured, so the
        // bill came out at ₹0 — there is nothing to collect.
        toast.info(
          bill.totalAmount > 0
            ? `Bill ${bill.billNumber} is already fully paid`
            : `Bill ${bill.billNumber} raised at ₹0 — no consultation fee is set on this doctor's profile`,
        );
        onChanged?.();
        return;
      }
      setCollectTarget({
        ...(apt as unknown as Appointment),
        status: 'booked',
        paymentInfo: {
          billId: bill.billId,
          billNumber: bill.billNumber,
          billStatus: bill.status,
          totalAmount: bill.totalAmount,
          amountPaid: bill.amountPaid,
          balanceDue: bill.balanceDue,
          paymentStatus: 'pay_at_frontdesk',
        },
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start front-desk payment');
    }
  };

  const paymentPending = initiatePayment.isPending && initiatePayment.variables === apt.id;

  return (
    <>
      <div className={cn('flex items-center justify-end gap-1.5', className)}>
        {/* ── Primary step for the current status ── */}
        {/* Collect is offered on any live row with money outstanding, whatever
            step the patient is at — including one with no bill yet. */}
        {canCollect && status !== 'booked' && (
          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 text-xs text-white hover:bg-amber-700"
            disabled={paymentPending}
            onClick={handleStartPayment}
            title="Raise the consultation bill and collect cash/UPI now"
          >
            {paymentPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Banknote className="h-3.5 w-3.5" />
            )}
            Collect Payment
          </Button>
        )}

        {status === 'booked' && (
          <Button
            size="sm"
            variant={canCollect ? 'default' : 'outline'}
            className={cn('gap-1.5 text-xs', canCollect && 'bg-amber-600 text-white hover:bg-amber-700')}
            disabled={updateStatus.isPending || paymentPending}
            onClick={canCollect ? handleStartPayment : handleConfirm}
            title={canCollect ? 'Collect the consultation fee, then confirm' : undefined}
          >
            {paymentPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : canCollect ? (
              <Banknote className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {needsPayment
              ? `Collect ₹${apt.paymentInfo!.balanceDue.toLocaleString('en-IN')} & Confirm`
              : canCollect
                ? 'Collect & Confirm'
                : 'Confirm'}
          </Button>
        )}

        {status === 'confirmed' && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={updateStatus.isPending}
            onClick={() => advance('checked_in', 'Patient checked in')}
          >
            <LogIn className="h-3.5 w-3.5" />
            Check In
          </Button>
        )}

        {/* No counter action for checked_in / in_consultation — the doctor
            drives those steps, and the Status column's progression already
            shows where the patient is. */}

        {/* ── Overflow: always available ── */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-outline transition-colors hover:text-primary"
              />
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDetailOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>

            {canCollect && (
              <DropdownMenuItem onClick={handleStartPayment}>
                <Banknote className="mr-2 h-4 w-4" />
                Collect Payment
              </DropdownMenuItem>
            )}

            {status === 'booked' && (
              <DropdownMenuItem onClick={handleConfirm}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm
              </DropdownMenuItem>
            )}
            {status === 'confirmed' && (
              <DropdownMenuItem onClick={() => advance('checked_in', 'Patient checked in')}>
                <LogIn className="mr-2 h-4 w-4" />
                Check In
              </DropdownMenuItem>
            )}

            {(canReschedule || canCancel || canNoShow) && <DropdownMenuSeparator />}

            {canReschedule && (
              <DropdownMenuItem onClick={() => setRescheduleOpen(true)}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Reschedule
              </DropdownMenuItem>
            )}
            {canNoShow && (
              <DropdownMenuItem onClick={() => advance('no_show', 'Marked as no-show')}>
                <UserX className="mr-2 h-4 w-4" />
                Mark No-Show
              </DropdownMenuItem>
            )}
            {canCancel && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Dialogs ── */}
      <PatientDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        patientId={detailOpen ? (apt.patientId ?? patient?.id ?? null) : null}
        appointmentId={detailOpen ? apt.id : null}
      />

      <RescheduleAppointmentDialog
        open={rescheduleOpen}
        onOpenChange={(o) => {
          setRescheduleOpen(o);
          if (!o) onChanged?.();
        }}
        appointment={
          rescheduleOpen
            ? {
                id: apt.id,
                doctorId: apt.doctorId ?? '',
                patientId: apt.patientId ?? patient?.id,
                type: apt.type,
                consultationType: apt.consultationType,
                priority: apt.priority,
                patient: patient
                  ? { firstName: patient.firstName, lastName: patient.lastName }
                  : undefined,
              }
            : null
        }
      />

      <CancelAppointmentDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o);
          if (!o) onChanged?.();
        }}
        appointment={
          cancelOpen
            ? {
                id: apt.id,
                patient: patient
                  ? { firstName: patient.firstName, lastName: patient.lastName }
                  : undefined,
              }
            : null
        }
      />

      <CollectFrontdeskPaymentDialog
        open={!!collectTarget}
        onOpenChange={(o) => {
          if (!o) setCollectTarget(null);
        }}
        appointment={collectTarget}
        onConfirmed={() => {
          setCollectTarget(null);
          onChanged?.();
        }}
      />

    </>
  );
}
