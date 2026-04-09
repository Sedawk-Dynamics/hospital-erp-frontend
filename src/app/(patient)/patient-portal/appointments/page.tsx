'use client';

import { useMemo, useState } from 'react';
import { Calendar, Clock, User, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate, formatTime24, getCurrentISTDate, toInputDateStr } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
    tenant?: { name: string };
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

  const { data: appointmentsRaw, isLoading } = useQuery({
    queryKey: ['patient', 'appointments'],
    queryFn: async () => {
      const res = await apiGet<PatientAppointment[]>('/patient-portal/appointments', {
        params: { limit: 100, sortOrder: 'desc' },
      });
      return res.data ?? [];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      return apiPost(`/patient-portal/appointments/${appointmentId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
    },
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
          appointments.map((apt) => (
            <div key={apt.id} className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30">
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
          ))
        )}
      </div>
    </div>
  );
}
