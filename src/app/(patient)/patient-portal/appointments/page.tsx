'use client';

import { useMemo, useState } from 'react';
import { Calendar, Clock, User, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { cn } from '@/lib/utils';
import { formatDate, formatTime24, getCurrentISTDate, toInputDateStr } from '@/lib/date-utils';
import Link from 'next/link';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

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

  const { data: appointmentsRaw, isLoading } = useQuery({
    queryKey: ['patient', 'appointments', selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 100, sortOrder: 'desc' };
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<PatientAppointment[]>('/patient-portal/appointments', { params });
      return res.data ?? [];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      return apiPost(`/patient-portal/appointments/${appointmentId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
      toast.success('Appointment cancelled');
    },
    // A cancellation that silently fails is the worst of these: the patient
    // believes they have cancelled and does not turn up, while the slot stays
    // booked and the desk is still expecting them.
    onError: (err) => toast.error(getApiErrorMessage(err) || 'Could not cancel that appointment'),
  });

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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
