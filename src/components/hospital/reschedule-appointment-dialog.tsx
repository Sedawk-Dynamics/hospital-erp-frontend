'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toInputDateStr } from '@/lib/date-utils';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { useCancelAppointment } from '@/hooks/use-hospital';
import { DoctorCalendarPicker } from '@/components/hospital/doctor-calendar-picker';
import { apiPost } from '@/lib/api';
import type { Appointment } from '@/types';

// ============================================================
// Props
// ============================================================

interface RescheduleAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    doctorId: string;
    patientId?: string;
    type?: string;
    consultationType?: string;
    priority?: string;
    patient?: { firstName: string; lastName: string };
  } | null;
}

// ============================================================
// Component
// ============================================================

export function RescheduleAppointmentDialog({
  open,
  onOpenChange,
  appointment,
}: RescheduleAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const cancelMutation = useCancelAppointment();

  const [selectedDate, setSelectedDate] = useState(toInputDateStr());
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedDate(toInputDateStr());
      setSelectedSlot(null);
      setIsRescheduling(false);
    }
  }, [open]);

  // Clear slot selection when date changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const patientName = appointment?.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
    : 'Unknown Patient';

  const handleReschedule = async () => {
    if (!appointment || !selectedSlot) return;

    setIsRescheduling(true);
    try {
      // Step 1: Cancel the old appointment
      await cancelMutation.mutateAsync({
        id: appointment.id,
        reason: 'Rescheduled',
      });

      // Step 2: Create a new appointment with the new date/time
      await apiPost<Appointment>('/appointments', {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentDate: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        type: appointment.type ?? appointment.consultationType ?? 'consultation',
        priority: appointment.priority ?? 'normal',
        notes: `Rescheduled from appointment ${appointment.id}`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });

      toast.success('Appointment rescheduled successfully');
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to reschedule appointment';
      toast.error(message);
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Pick a new date and time slot for{' '}
            <span className="font-label text-on-surface-variant">
              {patientName}
            </span>{' '}
            from the doctor&apos;s calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {appointment?.doctorId && (
            <DoctorCalendarPicker
              key={`${appointment.id}-${open}`}
              doctorId={appointment.doctorId}
              selectedDate={selectedDate}
              selectedStartTime={selectedSlot?.startTime}
              onDateChange={setSelectedDate}
              onSlotSelect={(startTime, endTime) =>
                setSelectedSlot({ startTime, endTime })
              }
            />
          )}

          {selectedSlot && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <span className="text-muted-foreground">New slot: </span>
              <span className="font-semibold text-foreground">
                {selectedDate} at {selectedSlot.startTime}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRescheduling}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedSlot || isRescheduling}
            onClick={handleReschedule}
          >
            {isRescheduling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
