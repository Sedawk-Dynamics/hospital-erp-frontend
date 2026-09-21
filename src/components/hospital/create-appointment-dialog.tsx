'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toInputDateStr, formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import { Search, Loader2, UserRound, CalendarDays, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { usePatientVisitStatus } from '@/hooks/use-registration-fee';

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

import { useDoctorsList, useGlobalPatientSearch, useProvisionLocalPatient, type GlobalPatientMatch } from '@/hooks/use-hospital';
import { DoctorCalendarPicker } from '@/components/hospital/doctor-calendar-picker';
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
  endTime: z.string().min(1, 'End time is required'),
  type: z.enum(['consultation', 'follow_up', 'procedure']),
  priority: z.enum(['normal', 'urgent', 'emergency']),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

const TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow Up',
  procedure: 'Procedure',
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  emergency: 'Emergency',
};

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
  // The desk's registration-fee decision. Null until the visit-status lookup
  // comes back and pre-ticks it, so we never send a guess.
  const [chargeRegistration, setChargeRegistration] = useState<boolean | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const { data: matches, isLoading: patientsLoading } = useGlobalPatientSearch(patientQuery);
  const provisionLocal = useProvisionLocalPatient();
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
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      appointmentDate: toInputDateStr(),
      startTime: '',
      endTime: '',
      type: 'consultation',
      priority: 'normal',
      notes: '',
      reason: '',
    },
  });

  const watchedDoctorId = watch('doctorId');
  const watchedDate = watch('appointmentDate');
  const watchedStartTime = watch('startTime');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset();
      setPatientQuery('');
      setSelectedPatient(null);
      setShowPatientDropdown(false);
    }
  }, [open, reset]);

  // Clear selected slot when doctor or date changes
  useEffect(() => {
    setValue('startTime', '', { shouldValidate: false });
    setValue('endTime', '', { shouldValidate: false });
  }, [watchedDoctorId, watchedDate, setValue]);

  const handleSelectPatient = useCallback(
    async (m: GlobalPatientMatch) => {
      // Local patient → use directly. Cross-hospital patient → provision a local
      // record here (new MRN, same person) and use that.
      let localId = m.localPatientId;
      let firstName = m.firstName;
      let lastName = m.lastName ?? '';
      let mrn = m.mrn ?? '';
      if (!localId) {
        try {
          const p = await provisionLocal.mutateAsync(m.sourcePatientId);
          if (!p?.id) throw new Error('no id');
          localId = p.id;
          firstName = p.firstName ?? firstName;
          lastName = p.lastName ?? lastName;
          mrn = p.mrn ?? mrn;
          toast.success(`Added ${firstName} to this hospital (MRN ${mrn})`);
        } catch {
          toast.error('Could not add this patient to your hospital');
          return;
        }
      }
      setSelectedPatient({ id: localId, firstName, lastName, mrn } as Patient);
      setValue('patientId', localId, { shouldValidate: true });
      setPatientQuery(`${[firstName, lastName].filter(Boolean).join(' ')} (${mrn})`);
      setShowPatientDropdown(false);
    },
    [setValue, provisionLocal]
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

  const handleSlotSelect = useCallback(
    (startTime: string, endTime: string) => {
      setValue('startTime', startTime, { shouldValidate: true });
      setValue('endTime', endTime, { shouldValidate: true });
    },
    [setValue]
  );

  const handleDateSelect = useCallback(
    (date: string) => {
      setValue('appointmentDate', date, { shouldValidate: true });
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
        endTime: data.endTime,
        type: data.type,
        priority: data.priority,
        notes: data.notes || undefined,
        reason: data.reason || undefined,
        // Only sent when the desk was actually shown the choice. Omitting it
        // lets the server fall back to the rule, which is what a portal
        // booking (no checkbox) relies on.
        chargeRegistrationFee: chargeRegistration ?? undefined,
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
      {/*
        Full-height two-pane layout. The dialog itself no longer scrolls —
        the details pane and the calendar pane each scroll independently, so
        the header, the footer and the month grid all stay put. The old
        single-scroll box made the calendar feel cramped and pushed the
        Create button below the fold.
      */}
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[88rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[88rem]">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
          <DialogTitle className="font-headline text-lg font-bold">New Appointment</DialogTitle>
          <DialogDescription>
            Schedule a new outpatient appointment — pick a slot from the
            doctor&apos;s calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,26rem)_1fr]">
            {/* LEFT: appointment details — own scroll area */}
            <div className="min-h-0 space-y-5 overflow-y-auto border-b px-6 py-5 lg:border-r lg:border-b-0">
              <SectionHeading icon={UserRound} title="Patient & Doctor" />
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

              {/* Patient dropdown — searches EVERY hospital on the ERP. */}
              {showPatientDropdown && matches && matches.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-56 overflow-y-auto">
                  {matches.map((m) => (
                    <button
                      key={m.sourcePatientId}
                      type="button"
                      disabled={provisionLocal.isPending}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors disabled:opacity-50"
                      onClick={() => handleSelectPatient(m)}
                    >
                      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {m.firstName} {m.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.isLocal ? `MRN: ${m.mrn ?? '—'}` : `at ${m.hospital}`} &middot; {m.phone ?? '—'}
                        </p>
                      </div>
                      {!m.isLocal && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Add here
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {showPatientDropdown &&
                matches &&
                matches.length === 0 &&
                !patientsLoading &&
                patientQuery.length >= 2 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-lg">
                    <p className="text-sm text-muted-foreground">No patients found on the ERP.</p>
                  </div>
                )}
            </div>
            {errors.patientId && (
              <p className="text-xs text-destructive">{errors.patientId.message}</p>
            )}
            {selectedPatient && (
              <PatientVisitPanel
                patientId={selectedPatient.id}
                chargeRegistration={chargeRegistration}
                onChangeCharge={setChargeRegistration}
              />
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
                    <SelectValue placeholder={doctorsLoading ? 'Loading...' : 'Select doctor'}>
                      {(value) => {
                        const doc = doctors.find((d) => d.id === value);
                        if (!doc) return doctorsLoading ? 'Loading...' : 'Select doctor';
                        return (
                          <span className="flex items-center gap-1.5 truncate">
                            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{doc.name}</span>
                            {doc.specialization && (
                              <span className="text-xs text-muted-foreground">
                                ({doc.specialization})
                              </span>
                            )}
                          </span>
                        );
                      }}
                    </SelectValue>
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

          <SectionHeading icon={ClipboardList} title="Visit Details" className="pt-1" />

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
                      <SelectValue>
                        {(value) => TYPE_LABELS[value as string] ?? 'Select type'}
                      </SelectValue>
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
                      <SelectValue>
                        {(value) => PRIORITY_LABELS[value as string] ?? 'Select priority'}
                      </SelectValue>
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

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="appointment-reason">Reason</Label>
            <Input
              id="appointment-reason"
              placeholder="Reason for visit..."
              {...register('reason')}
            />
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
            </div>

            {/* RIGHT: doctor calendar + slot picker — own scroll area */}
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-muted/20 px-6 py-5">
              <SectionHeading
                icon={CalendarDays}
                title="Doctor's Calendar & Time Slot *"
                hint={
                  watchedDoctorId
                    ? 'Pick a day, then choose an available slot.'
                    : undefined
                }
              />

              {!watchedDoctorId ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-background/60 p-10 text-center">
                  <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="font-label text-sm font-medium text-foreground">
                    No doctor selected
                  </p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Choose a doctor on the left to load their calendar and
                    available time slots.
                  </p>
                </div>
              ) : (
                <DoctorCalendarPicker
                  doctorId={watchedDoctorId}
                  selectedDate={watchedDate}
                  selectedStartTime={watchedStartTime}
                  onDateChange={handleDateSelect}
                  onSlotSelect={handleSlotSelect}
                />
              )}

              {(errors.appointmentDate || errors.startTime || errors.endTime) && (
                <p className="text-xs text-destructive">
                  {errors.appointmentDate?.message ||
                    errors.startTime?.message ||
                    errors.endTime?.message}
                </p>
              )}
            </div>
          </div>

          {/* Sticky footer — the chosen slot stays visible next to the action */}
          <DialogFooter className="mx-0 mb-0 shrink-0 items-center gap-3 px-6 py-4 sm:justify-between">
            {watchedStartTime && watchedDate ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-label text-xs text-muted-foreground">
                  Selected slot
                </span>
                <span className="font-label text-sm font-bold text-foreground">
                  {formatDate(watchedDate)} at {watchedStartTime}
                </span>
              </div>
            ) : (
              <p className="font-label text-xs text-muted-foreground">
                Select a doctor and a time slot to continue.
              </p>
            )}

            <div className="flex gap-2">
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
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Section heading ────────────────────────────────────────
//
// Small labelled divider that groups the form into readable blocks instead of
// one undifferentiated stack of fields.

function SectionHeading({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {title}
        </h3>
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── First visit here? ──────────────────────────────────────
//
// Two things the desk needs before booking: has this patient been to THIS
// hospital before (and if so, when), and is the one-time registration fee due.
//
// "First time" is per-hospital. A patient who already has an account on the
// portal, or who is a regular at another hospital on this platform, is still
// opening a new file here.

// "how many days ago" for the last visit — a quick read for the desk when it
// decides whether a return counts as a follow-up. Returns '' for a future or
// unparseable date so we simply show nothing.
function daysAgoLabel(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 0) return '';
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function PatientVisitPanel({
  patientId,
  chargeRegistration,
  onChangeCharge,
}: {
  patientId: string;
  chargeRegistration: boolean | null;
  onChangeCharge: (v: boolean | null) => void;
}) {
  const { data, isLoading } = usePatientVisitStatus(patientId);

  // Pre-tick from the server's suggestion, once per patient. The desk can then
  // untick it; their choice is not overwritten by a refetch.
  const suggested = data?.suggestCharge ?? null;
  useEffect(() => {
    onChangeCharge(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, suggested]);

  if (isLoading || !data) {
    return (
      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking visit history…
      </p>
    );
  }

  const fee = data.settings;
  const feeTotal = fee.amount + Math.round(fee.amount * (fee.gstRatePercent / 100) * 100) / 100;

  const lastVisitKindLabel =
    data.lastVisitKind === 'admission'
      ? 'admitted'
      : data.lastVisitKind === 'appointment'
        ? 'appointment'
        : 'visit';

  return (
    <div className="mt-2 overflow-hidden rounded-lg border-2 border-primary/30 bg-primary/5">
      {/* Who this patient is to this hospital. The desk reads this before it
          decides anything, so it is a banner rather than a caption. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-primary/20 px-3.5 py-2.5">
        {data.isFirstVisit ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-sm font-bold text-white">
            <UserRound className="h-4 w-4" />
            First visit to this hospital
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-3 py-1.5 text-sm font-bold text-white">
              <UserRound className="h-4 w-4" />
              Existing patient
            </span>
            {data.lastVisitAt && (
              <span className="text-sm text-on-surface-variant">
                Last {lastVisitKindLabel}{' '}
                <b className="font-semibold text-foreground">{formatDate(data.lastVisitAt)}</b>
                {/* Days-since, so the desk can judge a follow-up at a glance
                    without doing the date math. */}
                {daysAgoLabel(data.lastVisitAt) && (
                  <span className="text-muted-foreground"> ({daysAgoLabel(data.lastVisitAt)})</span>
                )}
                {data.priorEncounters > 0 && (
                  <>
                    {' · '}
                    <b className="font-semibold text-foreground">{data.priorEncounters}</b>
                    {` visit${data.priorEncounters === 1 ? '' : 's'} here`}
                  </>
                )}
              </span>
            )}
          </>
        )}
      </div>

      {/* Only shown when the hospital actually charges one. */}
      {fee.enabled && fee.amount > 0 && (
        <label
          className={`flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors ${
            chargeRegistration === true ? 'bg-amber-100/70' : 'bg-surface-container-lowest'
          } ${
            fee.oncePerPatient && data.registrationFeeCharged
              ? 'cursor-not-allowed opacity-70'
              : 'hover:bg-amber-50'
          }`}
        >
          <input
            type="checkbox"
            checked={chargeRegistration === true}
            disabled={fee.oncePerPatient && data.registrationFeeCharged}
            onChange={(e) => onChangeCharge(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="min-w-0">
            {/* The amount is money going onto this bill, so it is the loudest
                thing in the block after the patient's status. */}
            <span className="block text-sm font-semibold">
              Add {fee.label} —{' '}
              <span className="text-base font-bold text-amber-800">
                ₹{feeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </span>
            <span className="mt-1 block text-[13px] leading-snug text-on-surface-variant">
              {fee.oncePerPatient && data.registrationFeeCharged
                ? `Already charged${data.registrationFeeChargedAt ? ` on ${formatDate(data.registrationFeeChargedAt)}` : ''} — it cannot be taken twice.`
                : data.registrationFeeCharged
                  ? // Chargeable again, but the desk should know it has been
                    // taken before — otherwise a repeat charge looks like a
                    // mistake to whoever reads the bill afterwards.
                    `Charged before${data.registrationFeeChargedAt ? ` on ${formatDate(data.registrationFeeChargedAt)}` : ''}. This hospital allows it more than once — tick to charge it again.`
                  : data.isFirstVisit
                    ? 'Ticked because this is their first visit here. It goes on this appointment’s bill.'
                    : 'Not a first visit — tick only if this patient still owes the registration fee.'}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
