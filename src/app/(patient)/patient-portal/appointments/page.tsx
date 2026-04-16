'use client';

import { useMemo, useState, useEffect } from 'react';
import { Calendar, Clock, User, X, FileWarning, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { cn } from '@/lib/utils';
import { formatDate, formatTime24, getCurrentISTDate, toInputDateStr } from '@/lib/date-utils';
import Link from 'next/link';
import { IntakeFormsModal } from '@/components/forms/intake-forms-modal';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';
import { usePendingFormsForContext } from '@/hooks/use-forms';

interface PatientAppointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  status: string;
  appointmentType?: string;
  reason?: string;
  doctor?: {
    user?: { firstName: string; lastName: string };
    specialization?: string;
    department?: { name: string };
  };
  patient?: {
    tenant?: { id: string; name: string };
  };
}

const statusStyles: Record<string, string> = {
  pending_payment: 'bg-secondary/10 text-secondary',
  booked: 'bg-primary/10 text-primary',
  confirmed: 'bg-primary/10 text-primary',
  checked_in: 'bg-primary/10 text-primary',
  waiting: 'bg-secondary/10 text-secondary',
  in_consultation: 'bg-secondary/10 text-secondary',
  completed: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  cancelled: 'bg-error/10 text-error',
  no_show: 'bg-secondary/10 text-secondary',
};

// Statuses that represent a terminal/non-completed outcome — always belong in "Past".
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'no_show']);

type FilterKey = 'upcoming' | 'past' | 'all';

const FILTER_LABELS: Record<FilterKey, string> = {
  upcoming: 'Upcoming',
  past: 'Past Bookings',
  all: 'All',
};

// Sub-filter shown only when "Past Bookings" is active.
type PastStatusKey = 'all' | 'completed' | 'cancelled' | 'no_show' | 'missed';

const PAST_STATUS_FILTERS: { value: PastStatusKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
  { value: 'missed', label: 'Missed' },
];

/**
 * An appointment is "past" if:
 *  - its status is terminal (completed / cancelled / no_show), OR
 *  - its scheduled date has already passed (booked but never completed)
 */
function isPastAppointment(apt: PatientAppointment, todayIST: string): boolean {
  if (TERMINAL_STATUSES.has(apt.status)) return true;
  const aptDate = toInputDateStr(apt.appointmentDate);
  return aptDate < todayIST;
}

export default function PatientAppointmentsPage() {
  const queryClient = useQueryClient();
  const { selectedProfileId } = usePatientProfileStore();
  const [filter, setFilter] = useState<FilterKey>('upcoming');
  const [pastStatus, setPastStatus] = useState<PastStatusKey>('all');
  const [showIntakeForms, setShowIntakeForms] = useState(false);
  const [expandedFormsAptId, setExpandedFormsAptId] = useState<string | null>(null);

  const { data: appointmentsRaw, isLoading } = useQuery({
    queryKey: ['patient', 'appointments', selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 100, sortOrder: 'desc' };
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<PatientAppointment[]>('/patient-portal/appointments', { params });
      return res.data ?? [];
    },
  });

  // All forms the patient can fill across every hospital — used to surface
  // a "you have forms to fill" banner that links to /my-forms.
  const { data: availableForms } = useQuery({
    queryKey: ['patient', 'available-forms'],
    queryFn: async () => {
      const res = await apiGet<Array<{ isSubmitted: boolean }>>('/patient-portal/available-forms');
      return res.data ?? [];
    },
  });
  const formsToFillCount = (availableForms ?? []).filter((f) => !f.isSubmitted).length;

  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      return apiPost(`/patient-portal/appointments/${appointmentId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
    },
  });

  // ─── Pending intake forms detection ──────────────────────
  const pendingTarget = useMemo(() => {
    const all = appointmentsRaw ?? [];
    const today = getCurrentISTDate();
    return all.find(
      (a) =>
        !TERMINAL_STATUSES.has(a.status) &&
        toInputDateStr(a.appointmentDate) >= today &&
        a.patient?.tenant?.id,
    );
  }, [appointmentsRaw]);

  const { data: pendingForms } = usePendingFormsForContext({
    trigger: 'appointment_booking',
    tenantId: pendingTarget?.patient?.tenant?.id,
    appointmentId: pendingTarget?.id,
    enabled: !!pendingTarget,
  });

  // Auto-open the modal whenever pending forms appear
  useEffect(() => {
    if (pendingForms && pendingForms.length > 0) {
      setShowIntakeForms(true);
    }
  }, [pendingForms]);

  const appointments = useMemo(() => {
    const all = appointmentsRaw ?? [];
    if (filter === 'all') return all;
    const today = getCurrentISTDate();
    const filtered = all.filter((apt) => {
      const past = isPastAppointment(apt, today);
      return filter === 'past' ? past : !past;
    });
    if (filter !== 'past' || pastStatus === 'all') return filtered;
    return filtered.filter((apt) => {
      if (pastStatus === 'missed') {
        return !TERMINAL_STATUSES.has(apt.status);
      }
      return apt.status === pastStatus;
    });
  }, [appointmentsRaw, filter, pastStatus]);

  const filters: FilterKey[] = ['upcoming', 'past', 'all'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
            Care Records
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            My Appointments
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-1.5">
            Track upcoming visits and review your past bookings
          </p>
        </div>
        <Link
          href="/patient-portal/book-appointment"
          className="inline-flex items-center gap-2 bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
        >
          Book Appointment
        </Link>
      </div>

      {/* Required forms — sticky modal prompt */}
      {pendingForms && pendingForms.length > 0 && (
        <button
          onClick={() => setShowIntakeForms(true)}
          className="flex w-full items-center gap-4 rounded-xl px-5 py-4 shadow-sanctuary text-left transition-all hover:shadow-lg border-l-4 border-secondary bg-secondary-fixed/50"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary shrink-0">
            <FileWarning className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline text-sm font-bold text-on-surface">
              {pendingForms.length} required form{pendingForms.length > 1 ? 's' : ''} need
              your attention
            </p>
            <p className="font-label text-xs text-on-surface-variant mt-0.5">
              Please complete the intake form{pendingForms.length > 1 ? 's' : ''} for your
              upcoming appointment. Click to fill now.
            </p>
          </div>
          <span className="font-label text-xs font-bold text-secondary shrink-0">Open →</span>
        </button>
      )}

      {/* Catch-all forms inbox banner — always points to /my-forms */}
      {formsToFillCount > 0 && (!pendingForms || pendingForms.length === 0) && (
        <Link
          href="/patient-portal/my-forms"
          className="flex w-full items-center gap-4 rounded-xl px-5 py-4 shadow-sanctuary transition-all hover:shadow-lg border-l-4 border-primary bg-primary-fixed/30"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <FileWarning className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline text-sm font-bold text-on-surface">
              {formsToFillCount} form{formsToFillCount > 1 ? 's' : ''} available to fill
            </p>
            <p className="font-label text-xs text-on-surface-variant mt-0.5">
              Open <strong>My Forms</strong> in the sidebar to fill them whenever you&apos;re ready.
            </p>
          </div>
          <span className="font-label text-xs font-bold text-primary shrink-0">View →</span>
        </Link>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-4 py-1.5 font-label text-xs font-bold transition-colors whitespace-nowrap',
              f === filter
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
            )}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {filter === 'past' && (
        <div className="flex gap-2 overflow-x-auto">
          {PAST_STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setPastStatus(f.value)}
              className={cn(
                'rounded-full px-3 py-1 font-label text-[11px] font-bold transition-colors whitespace-nowrap',
                f.value === pastStatus
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:text-primary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
            <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
              <Calendar className="h-5 w-5" />
            </div>
            <p className="font-label text-sm font-semibold text-on-surface">
              {filter === 'upcoming'
                ? 'No upcoming appointments'
                : filter === 'past'
                  ? 'No past bookings'
                  : 'No appointments found'}
            </p>
            <p className="font-label text-xs text-on-surface-variant mt-1">
              {filter === 'upcoming' ? 'Book an appointment to get started' : ' '}
            </p>
          </div>
        ) : (
          appointments.map((apt) => {
            const isFormsExpanded = expandedFormsAptId === apt.id;
            return (
              <div
                key={apt.id}
                className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden transition-colors"
              >
                <div className="flex items-center gap-4 p-4 hover:bg-surface-container-low transition-colors">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label text-sm font-bold text-on-surface">
                      Dr. {apt.doctor?.user?.firstName} {apt.doctor?.user?.lastName}
                    </p>
                    <p className="font-label text-xs text-on-surface-variant">
                      {apt.doctor?.specialization ?? apt.doctor?.department?.name ?? 'General'}
                      {apt.patient?.tenant?.name && ` \u00b7 ${apt.patient.tenant.name}`}
                    </p>
                    {apt.reason && (
                      <p className="font-label text-xs text-on-surface-variant mt-0.5 truncate">
                        {apt.reason}
                      </p>
                    )}
                    <button
                      onClick={() => setExpandedFormsAptId(isFormsExpanded ? null : apt.id)}
                      className="mt-1.5 inline-flex items-center gap-1 font-label text-[11px] font-bold text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      View Submitted Forms
                      {isFormsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <div className="flex items-center gap-1.5 font-label text-sm text-on-surface justify-end">
                      <Calendar className="h-3.5 w-3.5 text-on-surface-variant" />
                      {formatDate(apt.appointmentDate)}
                    </div>
                    {apt.startTime && (
                      <div className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant justify-end">
                        <Clock className="h-3 w-3" />
                        {formatTime24(apt.startTime)}
                        {apt.endTime && ` - ${formatTime24(apt.endTime)}`}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 justify-end">
                      <span
                        className={cn(
                          'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize',
                          statusStyles[apt.status] ?? 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                        )}
                      >
                        {apt.status.replace('_', ' ')}
                      </span>
                      {['booked', 'confirmed'].includes(apt.status) &&
                        !isPastAppointment(apt, getCurrentISTDate()) && (
                          <button
                            onClick={() => cancelMutation.mutate(apt.id)}
                            disabled={cancelMutation.isPending}
                            className="rounded-full p-1 text-on-surface-variant hover:text-error hover:bg-error-container/40 transition-colors"
                            title="Cancel appointment"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                    </div>
                  </div>
                </div>

                {isFormsExpanded && (
                  <div className="border-t border-outline-variant/30 px-4 py-3 bg-surface-container-low">
                    <PatientFormSubmissionsPanel
                      appointmentId={apt.id}
                      title="Forms for this Appointment"
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pending intake forms modal */}
      <IntakeFormsModal
        open={showIntakeForms}
        trigger="appointment_booking"
        tenantId={pendingTarget?.patient?.tenant?.id}
        context={{ appointmentId: pendingTarget?.id }}
        onComplete={() => {
          setShowIntakeForms(false);
          queryClient.invalidateQueries({ queryKey: ['forms', 'pending'] });
        }}
      />
    </div>
  );
}
