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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  useCancelAppointment,
  useAvailableSlots,
  hospitalKeys,
} from '@/hooks/use-hospital';
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

  // Fetch available slots for the selected doctor + date
  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    appointment?.doctorId ?? '',
    selectedDate
  );

  const availableSlots = (slotsData?.slots ?? []).filter((s) => s.available);

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Pick a new date and time slot for{' '}
            <span className="font-label text-on-surface-variant">
              {patientName}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">New Date</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={selectedDate}
              min={toInputDateStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Slot Grid */}
          <div className="space-y-1.5">
            <Label>Available Slots</Label>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading slots...
                </span>
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No available slots for this date.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border p-2">
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.map((slot) => {
                    const isSelected =
                      selectedSlot?.startTime === slot.startTime &&
                      selectedSlot?.endTime === slot.endTime;

                    return (
                      <button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type="button"
                        onClick={() =>
                          setSelectedSlot({
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                          })
                        }
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {slot.startTime}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
