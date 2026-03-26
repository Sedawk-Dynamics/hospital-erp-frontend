'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toInputDateStr } from '@/lib/date-utils';
import { toast } from 'sonner';
import { Search, Loader2, UserRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { usePatientSearch, useDoctorsList, hospitalKeys } from '@/hooks/use-hospital';
import { apiPost } from '@/lib/api';
import type { Patient, Appointment } from '@/types';

// ============================================================
// Schema
// ============================================================

const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  appointmentDate: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Time is required'),
  type: z.enum(['consultation', 'follow_up', 'procedure']),
  priority: z.enum(['normal', 'urgent', 'emergency']),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

// ============================================================
// Props
// ============================================================

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================
// Component
// ============================================================

export function CreateAppointmentDialog({
  open,
  onOpenChange,
}: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();

  // Patient search state
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);
  const { data: doctorsRaw, isLoading: doctorsLoading } = useDoctorsList();

  const doctors = (doctorsRaw || []).map((d) => ({
    id: d.id || d.userId,
    name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
    specialization: d.specialization,
  }));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      appointmentDate: toInputDateStr(),
      startTime: '',
      type: 'consultation',
      priority: 'normal',
      notes: '',
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset();
      setPatientQuery('');
      setSelectedPatient(null);
      setShowPatientDropdown(false);
    }
  }, [open, reset]);

  const handleSelectPatient = useCallback(
    (patient: Patient) => {
      setSelectedPatient(patient);
      setValue('patientId', patient.id, { shouldValidate: true });
      setPatientQuery(`${patient.firstName} ${patient.lastName} (${patient.mrn})`);
      setShowPatientDropdown(false);
    },
    [setValue]
  );

  const handlePatientInputChange = useCallback(
    (value: string) => {
      setPatientQuery(value);
      setSelectedPatient(null);
      setValue('patientId', '', { shouldValidate: false });
      setShowPatientDropdown(value.length >= 2);
    },
    [setValue]
  );

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      await apiPost<Appointment>('/appointments', {
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        type: data.type,
        priority: data.priority,
        notes: data.notes || undefined,
      });

      // Invalidate appointment queries
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });

      toast.success('Appointment created successfully');
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to create appointment';
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>
            Schedule a new outpatient appointment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Patient Search */}
          <div className="space-y-1.5">
            <Label htmlFor="patient-search">Patient *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="patient-search"
                placeholder="Search by name, MRN, or phone..."
                value={patientQuery}
                onChange={(e) => handlePatientInputChange(e.target.value)}
                onFocus={() => {
                  if (patientQuery.length >= 2 && !selectedPatient) {
                    setShowPatientDropdown(true);
                  }
                }}
                className="pl-9"
                autoComplete="off"
              />
              {patientsLoading && patientQuery.length >= 2 && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}

              {/* Patient dropdown */}
              {showPatientDropdown && patients && patients.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-48 overflow-y-auto">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                      onClick={() => handleSelectPatient(patient)}
                    >
                      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          MRN: {patient.mrn} &middot; {patient.phone}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showPatientDropdown &&
                patients &&
                patients.length === 0 &&
                !patientsLoading &&
                patientQuery.length >= 2 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-lg">
                    <p className="text-sm text-muted-foreground">No patients found.</p>
                  </div>
                )}
            </div>
            {errors.patientId && (
              <p className="text-xs text-destructive">{errors.patientId.message}</p>
            )}
          </div>

          {/* Doctor Select */}
          <div className="space-y-1.5">
            <Label>Doctor *</Label>
            <Controller
              name="doctorId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v: string | null) => field.onChange(v ?? '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={doctorsLoading ? 'Loading...' : 'Select doctor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                        {doc.specialization && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({doc.specialization})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.doctorId && (
              <p className="text-xs text-destructive">{errors.doctorId.message}</p>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appointment-date">Date *</Label>
              <Input
                id="appointment-date"
                type="date"
                {...register('appointmentDate')}
              />
              {errors.appointmentDate && (
                <p className="text-xs text-destructive">
                  {errors.appointmentDate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-time">Time *</Label>
              <Input
                id="appointment-time"
                type="time"
                {...register('startTime')}
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime.message}</p>
              )}
            </div>
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v: string | null) => field.onChange(v ?? 'consultation')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v: string | null) => field.onChange(v ?? 'normal')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="appointment-notes">Notes</Label>
            <Textarea
              id="appointment-notes"
              placeholder="Additional notes..."
              rows={3}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Appointment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
