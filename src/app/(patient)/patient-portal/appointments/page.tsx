'use client';

import { useMemo, useState, useEffect } from 'react';
import { Calendar, Clock, User, X, FileWarning, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate, formatTime24, getCurrentISTDate, toInputDateStr } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
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
  pending_payment: 'bg-amber-100 text-amber-800',
  booked: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  checked_in: 'bg-teal-100 text-teal-800',
  waiting: 'bg-amber-100 text-amber-800',
  in_consultation: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-orange-100 text-orange-800',
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
  const [filter, setFilter] = useState<FilterKey>('upcoming');
  const [pastStatus, setPastStatus] = useState<PastStatusKey>('all');
  const [showIntakeForms, setShowIntakeForms] = useState(false);
  const [expandedFormsAptId, setExpandedFormsAptId] = useState<string | null>(null);

  const { data: appointmentsRaw, isLoading } = useQuery({
    queryKey: ['patient', 'appointments'],
    queryFn: async () => {
      const res = await apiGet<PatientAppointment[]>('/patient-portal/appointments', {
        params: { limit: 100, sortOrder: 'desc' },
      });
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
  // Find the most recent appointment that's still actionable
  // (not cancelled / no_show / completed). Check if it has any pending
  // required forms — if yes, auto-open the IntakeFormsModal so the patient
  // can't escape the form by refreshing the page.
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
    // Apply Past Bookings sub-filter
    return filtered.filter((apt) => {
      if (pastStatus === 'missed') {
        // Past-dated but never completed (not in a terminal state)
        return !TERMINAL_STATUSES.has(apt.status);
      }
      return apt.status === pastStatus;
    });
  }, [appointmentsRaw, filter, pastStatus]);

  const filters: FilterKey[] = ['upcoming', 'past', 'all'];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">My Appointments</h1>
        <Link href="/patient-portal/book-appointment">
          <Button>Book Appointment</Button>
        </Link>
      </div>

      {/* Required forms — sticky modal prompt */}
      {pendingForms && pendingForms.length > 0 && (
        <button
          onClick={() => setShowIntakeForms(true)}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100/70 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-200 shrink-0">
            <FileWarning className="h-5 w-5 text-amber-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {pendingForms.length} required form{pendingForms.length > 1 ? 's' : ''} need
              your attention
            </p>
            <p className="text-[11px] text-amber-800">
              Please complete the intake form{pendingForms.length > 1 ? 's' : ''} for your
              upcoming appointment. Click to fill now.
            </p>
          </div>
          <span className="text-xs font-semibold text-amber-900">Open →</span>
        </button>
      )}

      {/* Catch-all forms inbox banner — always points to /my-forms */}
      {formsToFillCount > 0 && (!pendingForms || pendingForms.length === 0) && (
        <Link
          href="/patient-portal/my-forms"
          className="flex w-full items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100/70 transition-colors"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-200 shrink-0">
            <FileWarning className="h-5 w-5 text-blue-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900">
              {formsToFillCount} form{formsToFillCount > 1 ? 's' : ''} available to fill
            </p>
            <p className="text-[11px] text-blue-800">
              Open <strong>My Forms</strong> in the sidebar to fill them whenever you're ready.
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-900">View →</span>
        </Link>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              f === filter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
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
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                f.value === pastStatus
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
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
          <div className="rounded-xl border bg-card p-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">
              {filter === 'upcoming'
                ? 'No upcoming appointments'
                : filter === 'past'
                  ? 'No past bookings'
                  : 'No appointments found'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filter === 'upcoming' ? 'Book an appointment to get started' : ' '}
            </p>
          </div>
        ) : (
          appointments.map((apt) => {
            const isFormsExpanded = expandedFormsAptId === apt.id;
            return (
              <div key={apt.id} className="rounded-xl border bg-card overflow-hidden transition-colors">
                <div className="flex items-center gap-4 p-4 hover:bg-muted/30">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Dr. {apt.doctor?.user?.firstName} {apt.doctor?.user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {apt.doctor?.specialization ?? apt.doctor?.department?.name ?? 'General'}
                      {apt.patient?.tenant?.name && ` \u00b7 ${apt.patient.tenant.name}`}
                    </p>
                    {apt.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Reason: {apt.reason}
                      </p>
                    )}
                    <button
                      onClick={() => setExpandedFormsAptId(isFormsExpanded ? null : apt.id)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      View Submitted Forms
                      {isFormsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-foreground justify-end">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(apt.appointmentDate)}
                    </div>
                    {apt.startTime && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
                        <Clock className="h-3 w-3" />
                        {formatTime24(apt.startTime)}
                        {apt.endTime && ` - ${formatTime24(apt.endTime)}`}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        statusStyles[apt.status] ?? 'bg-gray-100 text-gray-800',
                      )}>
                        {apt.status.replace('_', ' ')}
                      </span>
                      {['booked', 'confirmed'].includes(apt.status) &&
                        !isPastAppointment(apt, getCurrentISTDate()) && (
                          <button
                            onClick={() => cancelMutation.mutate(apt.id)}
                            disabled={cancelMutation.isPending}
                            className="rounded-full p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Cancel appointment"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                    </div>
                  </div>
                </div>

                {isFormsExpanded && (
                  <div className="border-t px-4 py-3 bg-muted/20">
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

      {/* Pending intake forms modal — auto-opens whenever the patient has a
          required form to complete for any of their upcoming appointments.
          Cannot be dismissed until all required forms are submitted, and
          will re-appear on every page refresh until then. */}
      <IntakeFormsModal
        open={showIntakeForms}
        trigger="appointment_booking"
        tenantId={pendingTarget?.patient?.tenant?.id}
        context={{ appointmentId: pendingTarget?.id }}
        onComplete={() => {
          setShowIntakeForms(false);
          // Refetch pending so the next pending form (if any) auto-opens
          queryClient.invalidateQueries({ queryKey: ['forms', 'pending'] });
        }}
      />
    </div>
  );
}
