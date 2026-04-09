'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusProgression } from './status-progression';
import { CancelAppointmentDialog } from './cancel-appointment-dialog';
import { RescheduleAppointmentDialog } from './reschedule-appointment-dialog';
import { PatientDetailDialog } from './patient-detail-dialog';
import { cn } from '@/lib/utils';
import { formatDate, formatTime24 } from '@/lib/date-utils';
import {
  Eye,
  MoreHorizontal,
  UserCheck,
  Stethoscope,
  CheckCircle2,
  XCircle,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Appointment } from '@/types';
import { useUpdateAppointmentStatus } from '@/hooks/use-hospital';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppointmentTableProps {
  appointments: Appointment[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Normalize @db.Time() values (plain "HH:mm" or "HH:mm:ss") into ISO strings that formatTime24 can parse */
function normalizeTimeValue(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value.includes('T')) return value; // already ISO
  if (/^\d{2}:\d{2}/.test(value)) return `1970-01-01T${value}Z`;
  return value;
}

const categoryColors: Record<string, string> = {
  consultation: 'bg-error',
  follow_up: 'bg-primary',
  emergency: 'bg-tertiary',
  procedure: 'bg-secondary',
};

// Valid next statuses from current status (front-desk / hospital staff actions only)
// Start Consultation & Complete are doctor-panel responsibilities
const nextStatusMap: Record<string, { status: string; label: string; icon: typeof UserCheck }[]> = {
  booked: [
    { status: 'confirmed', label: 'Confirm', icon: ShieldCheck },
  ],
  confirmed: [
    { status: 'checked_in', label: 'Check In', icon: UserCheck },
  ],
};

export function AppointmentTable({
  appointments,
  isLoading,
  page,
  totalPages,
  total,
  onPageChange,
}: AppointmentTableProps) {
  const updateStatus = useUpdateAppointmentStatus();
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [viewPatientId, setViewPatientId] = useState<string | null>(null);

  const handleStatusAdvance = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update status';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 font-label text-sm text-on-surface-variant">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center text-on-surface-variant font-label">
          No appointments found.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 font-semibold">Patient Details</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Appointment Details</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Date & Time</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Payment Status</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Purpose</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {appointments.map((apt) => {
                const patient = apt.patient;
                const initials = patient
                  ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                  : '?';

                const canCancel = ['booked', 'confirmed', 'checked_in'].includes(apt.status);
                const canReschedule = ['booked', 'confirmed'].includes(apt.status);
                const statusActions = nextStatusMap[apt.status] ?? [];

                return (
                  <tr key={apt.id} className="group hover:bg-surface-container-low transition-colors">
                    {/* Patient Details */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10 rounded-xl">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary rounded-xl">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-lowest',
                              ((apt.consultationType || apt.type) && categoryColors[apt.consultationType || apt.type]) || 'bg-outline'
                            )}
                            title={apt.consultationType || apt.type}
                          />
                        </div>
                        <div>
                          <p className="font-label text-sm font-bold">
                            {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 font-label text-[10px] text-on-surface-variant">
                            <span>{patient?.mrn || '-'}</span>
                            <span>|</span>
                            <span>{patient?.phone || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Appointment Details */}
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-label text-sm font-bold">
                          {apt.doctor
                            ? `Dr. ${apt.doctor.user?.firstName || ''} ${apt.doctor.user?.lastName || ''}`
                            : '-'}
                        </p>
                        <p className="font-label text-[10px] text-on-surface-variant capitalize">{(apt.consultationType || apt.type)?.replace('_', ' ') || 'General'}</p>
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-label text-[10px] text-on-surface-variant">{formatDate(apt.appointmentDate)}</p>
                        <p className="font-label text-sm font-bold">{formatTime24(normalizeTimeValue(apt.startTime))} - {formatTime24(normalizeTimeValue(apt.endTime))}</p>
                      </div>
                    </td>

                    {/* Payment Status */}
                    <td className="px-4 py-4">
                      {apt.paymentInfo ? (
                        <div>
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full inline-block',
                            apt.paymentInfo.paymentStatus === 'paid_online' && 'bg-green-100 text-green-700',
                            apt.paymentInfo.paymentStatus === 'pay_at_frontdesk' && 'bg-amber-100 text-amber-700',
                            apt.paymentInfo.paymentStatus === 'pending' && 'bg-blue-100 text-blue-700',
                          )}>
                            {apt.paymentInfo.paymentStatus === 'paid_online' && 'Paid Online'}
                            {apt.paymentInfo.paymentStatus === 'pay_at_frontdesk' && 'Pay at Desk'}
                            {apt.paymentInfo.paymentStatus === 'pending' && 'Payment Pending'}
                          </span>
                          {apt.paymentInfo.balanceDue > 0 && (
                            <p className="text-[10px] text-on-surface-variant mt-0.5 font-label">
                              &#8377;{apt.paymentInfo.balanceDue.toLocaleString('en-IN')} due
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                          No Billing
                        </span>
                      )}
                    </td>

                    {/* Purpose */}
                    <td className="px-4 py-4">
                      <p className="font-label text-sm truncate max-w-[150px]">
                        {apt.reason || '-'}
                      </p>
                    </td>

                    {/* Status Progression */}
                    <td className="px-4 py-4">
                      <StatusProgression status={apt.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="h-8 w-8 text-outline hover:text-primary transition-colors" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewPatientId(apt.patientId)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>

                          {statusActions.length > 0 && <DropdownMenuSeparator />}

                          {statusActions.map((action) => (
                            <DropdownMenuItem
                              key={action.status}
                              onClick={() => handleStatusAdvance(apt.id, action.status)}
                            >
                              <action.icon className="mr-2 h-4 w-4" />
                              {action.label}
                            </DropdownMenuItem>
                          ))}

                          {(canReschedule || canCancel) && <DropdownMenuSeparator />}

                          {canReschedule && (
                            <DropdownMenuItem onClick={() => setRescheduleTarget(apt)}>
                              <CalendarClock className="mr-2 h-4 w-4" />
                              Reschedule
                            </DropdownMenuItem>
                          )}

                          {canCancel && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setCancelTarget(apt)}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-xs text-on-surface-variant">
              Showing page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      <CancelAppointmentDialog
        open={!!cancelTarget}
        onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
        appointment={cancelTarget}
      />

      {/* Reschedule Dialog */}
      <RescheduleAppointmentDialog
        open={!!rescheduleTarget}
        onOpenChange={(open) => { if (!open) setRescheduleTarget(null); }}
        appointment={rescheduleTarget}
      />

      {/* Patient Detail Dialog */}
      <PatientDetailDialog
        open={!!viewPatientId}
        onOpenChange={(open) => { if (!open) setViewPatientId(null); }}
        patientId={viewPatientId}
      />
    </>
  );
}
