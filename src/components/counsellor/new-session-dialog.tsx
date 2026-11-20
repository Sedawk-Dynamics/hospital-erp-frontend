'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PatientVisitPicker, type SelectedPatient } from '@/components/doctor/patient-visit-picker';
import {
  COUNSELLING_SESSION_TYPES,
  useCounsellors,
  useCreateCounsellingSession,
  type CounsellingSession,
  type CounsellingSessionType,
} from '@/hooks/use-counselling';
import { useAuthStore } from '@/stores/auth-store';
import { getCurrentISTDate, getCurrentISTTime } from '@/lib/date-utils';
import { fullName } from '@/lib/person-name';
import { getApiErrorMessage } from '@/lib/utils';

// Gap #298: New Session used to open the doctor New Appointment dialog (doctor,
// slot, consultation type). A counselling session is its own record — patient,
// what it is about, which counsellor, when — so it gets its own form.

const schema = z
  .object({
    patientId: z.string().min(1, 'Pick a patient'),
    sessionType: z.string().min(1, 'Pick a session type'),
    counsellorId: z.string().min(1, 'Pick a counsellor'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time'),
    notes: z.string().max(2000, 'Keep notes under 2000 characters').optional(),
    isReferral: z.boolean(),
    referralSource: z.string().max(200, 'Keep this under 200 characters').optional(),
  })
  .refine((d) => !d.isReferral || !!d.referralSource?.trim(), {
    message: 'Say who referred the patient',
    path: ['referralSource'],
  });

type FormValues = z.infer<typeof schema>;

/** Server field name → form field, for pinning API validation errors inline. */
const SERVER_FIELD: Record<string, Path<FormValues>> = {
  patientId: 'patientId',
  counsellorId: 'counsellorId',
  sessionType: 'sessionType',
  scheduledAt: 'time',
  notes: 'notes',
  referralSource: 'referralSource',
};

const selectClass =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive';

/** The next quarter hour today (IST), or 10:00 for another day. */
function defaultTime(date: string): string {
  if (date !== getCurrentISTDate()) return '10:00';
  const [h, m] = getCurrentISTTime().split(':').map(Number);
  const next = Math.min(h * 60 + m + (15 - (m % 15)), 23 * 60 + 45);
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day Counsellor Home is showing (YYYY-MM-DD) — the session defaults to it. */
  defaultDate?: string;
  onCreated?: (session: CounsellingSession) => void;
}

export function NewSessionDialog({ open, onOpenChange, defaultDate, onCreated }: NewSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so every opening starts from a blank form
            on the day the page is showing — no stale patient or error. */}
        {open && <NewSessionForm onOpenChange={onOpenChange} defaultDate={defaultDate} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function NewSessionForm({ onOpenChange, defaultDate, onCreated }: Omit<NewSessionDialogProps, 'open'>) {
  const [patient, setPatient] = useState<SelectedPatient | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: counsellors, isLoading: counsellorsLoading } = useCounsellors();
  const create = useCreateCounsellingSession();

  const initialDate = defaultDate || getCurrentISTDate();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: '',
      sessionType: '',
      counsellorId: '',
      date: initialDate,
      time: defaultTime(initialDate),
      notes: '',
      isReferral: false,
      referralSource: '',
    },
  });

  // A counsellor booking their own session should not have to find themselves
  // in the list; with a single counsellor there is nothing to choose.
  useEffect(() => {
    if (!counsellors?.length || getValues('counsellorId')) return;
    const self = counsellors.find((c) => c.id === currentUserId);
    const onlyCounsellor = counsellors.filter((c) => c.isCounsellor);
    const pick = self ?? (onlyCounsellor.length === 1 ? onlyCounsellor[0] : undefined);
    if (pick) setValue('counsellorId', pick.id);
  }, [counsellors, currentUserId, getValues, setValue]);

  const isReferral = useWatch({ control, name: 'isReferral' });

  const onSelectPatient = (p: SelectedPatient | null) => {
    setPatient(p);
    setValue('patientId', p?.id ?? '', { shouldValidate: !!p });
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const session = await create.mutateAsync({
        patientId: values.patientId,
        counsellorId: values.counsellorId,
        sessionType: values.sessionType as CounsellingSessionType,
        // The time is the hospital's (IST) clock, whatever zone the browser is in.
        scheduledAt: new Date(`${values.date}T${values.time}:00+05:30`).toISOString(),
        notes: values.notes?.trim() || undefined,
        kind: values.isReferral ? 'referral' : 'session',
        referralSource: values.isReferral ? values.referralSource?.trim() : undefined,
      });
      toast.success(values.isReferral ? 'Referral added' : 'Counselling session booked');
      onCreated?.(session);
      onOpenChange(false);
    } catch (err) {
      // Pin what the server rejected to its field; anything else is shown on
      // the form. Never a success toast on failure.
      const data = (err as { response?: { data?: { errors?: Array<{ field?: string; message?: string }>; details?: { field?: string }; message?: string } } })
        ?.response?.data;
      let pinned = false;
      for (const e of data?.errors ?? []) {
        const field = SERVER_FIELD[(e.field ?? '').split('.').pop() ?? ''];
        if (field && e.message) {
          setError(field, { message: e.message });
          pinned = true;
        }
      }
      const detailField = data?.details?.field ? SERVER_FIELD[data.details.field] : undefined;
      if (detailField && data?.message) {
        setError(detailField, { message: data.message });
        pinned = true;
      }
      const message = getApiErrorMessage(err, 'Could not book the session');
      if (!pinned) setFormError(message);
      toast.error(message);
    }
  };

  const busy = isSubmitting || create.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline text-lg font-bold">New Counselling Session</DialogTitle>
        <DialogDescription>
          Book a counselling session, or record a patient referred for counselling.
        </DialogDescription>
      </DialogHeader>

      {/* Outside the <form> so the picker's own buttons can never submit it. */}
      <div className="space-y-1">
        <PatientVisitPicker
          selectedPatient={patient}
          onSelectPatient={onSelectPatient}
          selectedVisitId=""
          onSelectVisitId={() => {}}
          requireVisit={false}
        />
        {errors.patientId && <p className="text-xs text-destructive">{errors.patientId.message}</p>}
      </div>

      <form id="new-counselling-session" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <input type="hidden" {...register('patientId')} />

        <div className="space-y-1.5">
          <Label htmlFor="cs-type">Session type *</Label>
          <select id="cs-type" className={selectClass} aria-invalid={!!errors.sessionType} {...register('sessionType')}>
            <option value="">Select session type</option>
            {COUNSELLING_SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.sessionType && <p className="text-xs text-destructive">{errors.sessionType.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cs-counsellor">Counsellor *</Label>
          <select
            id="cs-counsellor"
            className={selectClass}
            aria-invalid={!!errors.counsellorId}
            disabled={counsellorsLoading}
            {...register('counsellorId')}
          >
            <option value="">{counsellorsLoading ? 'Loading…' : 'Select counsellor'}</option>
            {(counsellors ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {fullName(c, 'Unnamed user')}
                {c.isCounsellor ? '' : ' (Admin)'}
              </option>
            ))}
          </select>
          {!counsellorsLoading && counsellors && counsellors.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No counsellors yet. Add a user with the Counsellor role under Settings → Users.
            </p>
          )}
          {errors.counsellorId && <p className="text-xs text-destructive">{errors.counsellorId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cs-date">Date *</Label>
            <Input id="cs-date" type="date" aria-invalid={!!errors.date} {...register('date')} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-time">Time *</Label>
            <Input id="cs-time" type="time" aria-invalid={!!errors.time} {...register('time')} />
            {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cs-notes">Notes</Label>
          <Textarea id="cs-notes" rows={3} placeholder="What should the session cover?" {...register('notes')} />
          {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-primary" {...register('isReferral')} />
            This is a referral
          </label>
          {isReferral && (
            <div className="space-y-1.5">
              <Label htmlFor="cs-referral">Referred by *</Label>
              <Input
                id="cs-referral"
                placeholder="e.g. Dr. Mehta (Cardiology), Front desk, Insurance desk"
                aria-invalid={!!errors.referralSource}
                {...register('referralSource')}
              />
              {errors.referralSource && (
                <p className="text-xs text-destructive">{errors.referralSource.message}</p>
              )}
            </div>
          )}
        </div>

        {formError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" form="new-counselling-session" disabled={busy} className="gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {isReferral ? 'Add Referral' : 'Book Session'}
        </Button>
      </DialogFooter>
    </>
  );
}
