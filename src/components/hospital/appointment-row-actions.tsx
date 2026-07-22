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
  Siren,
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
import { isEmergencyPatient } from '@/lib/emergency';
import { useUpdateAppointmentStatus, useInitiateFrontdeskPayment } from '@/hooks/use-hospital';

import { CancelAppointmentDialog } from './cancel-appointment-dialog';
import { RescheduleAppointmentDialog } from './reschedule-appointment-dialog';
import { PatientDetailDialog } from './patient-detail-dialog';
import { CollectFrontdeskPaymentDialog } from './collect-frontdesk-payment-dialog';
import {
  EmergencyResolveDialog,
  type EmergencyResolveTarget,
} from './emergency-resolve-dialog';
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
 * plus View details / Reschedule / Cancel / Mark no-show on every live row,
 * and Register-or-Connect for a temporary casualty record.
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
  const [resolveTarget, setResolveTarget] = useState<EmergencyResolveTarget | null>(null);

  const updateStatus = useUpdateAppointmentStatus();
  const initiatePayment = useInitiateFrontdeskPayment();

  const status = apt.status;
  const patient = apt.patient ?? null;

  /** Payment was deferred to the counter and money is still outstanding. */
  const needsPayment =
    apt.paymentInfo?.paymentStatus === 'pay_at_frontdesk' && apt.paymentInfo.balanceDue > 0;

  const canReschedule = ['pending_payment', 'booked', 'confirmed', 'no_show'].includes(status);
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
        {status === 'pending_payment' && (
          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 text-xs text-white hover:bg-amber-700"
            disabled={paymentPending}
            onClick={handleStartPayment}
            title="Patient chose Pay at Front Desk — collect cash/UPI now"
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
            variant={needsPayment ? 'default' : 'outline'}
            className={cn('gap-1.5 text-xs', needsPayment && 'bg-amber-600 text-white hover:bg-amber-700')}
            disabled={updateStatus.isPending}
            onClick={handleConfirm}
            title={needsPayment ? 'Collect front-desk payment, then confirm' : undefined}
          >
            {needsPayment ? <Banknote className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {needsPayment
              ? `Collect ₹${apt.paymentInfo!.balanceDue.toLocaleString('en-IN')} & Confirm`
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

        {/* Checked in — the doctor starts the consultation from their queue,
            so the counter just sees where the patient is. */}
        {status === 'checked_in' && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-label text-[11px] font-semibold text-primary">
            With doctor next
          </span>
        )}

        {status === 'in_consultation' && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-label text-[11px] font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            In consultation
          </span>
        )}

        {/* A temporary casualty record is resolved straight from the queue. */}
        {patient && isEmergencyPatient(patient) && (
          <Button
            size="sm"
            className="gap-1.5 bg-red-600 text-xs text-white hover:bg-red-700"
            onClick={() =>
              setResolveTarget({
                id: patient.id,
                mrn: patient.mrn ?? '',
                firstName: patient.firstName,
                lastName: patient.lastName,
                gender: patient.gender ?? undefined,
                phone: patient.phone ?? undefined,
                type: 'op',
              })
            }
          >
            <Siren className="h-3.5 w-3.5" />
            Register / Connect
          </Button>
        )}

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

      <EmergencyResolveDialog
        open={!!resolveTarget}
        onOpenChange={(o) => {
          if (!o) setResolveTarget(null);
        }}
        patient={resolveTarget}
        onResolved={() => {
          setResolveTarget(null);
          onChanged?.();
        }}
      />
    </>
  );
}
