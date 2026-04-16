'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, Clock, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { HospitalFilter } from '../_components/hospital-filter';
import { usePatientProfileStore } from '@/stores/patient-profile-store';

interface FollowUp {
  id: string;
  prescriptionId: string;
  followUpDate: string;
  durationText?: string;
  notes?: string;
  prescriptionDate: string;
  tenantId?: string | null;
  doctorId?: string;
  doctor?: { user?: { firstName: string; lastName: string } };
  patient?: { tenant?: { id: string; name: string } };
}

type FilterKey = 'all' | 'upcoming' | 'overdue' | 'completed';

export default function PatientFollowUpsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [filter, setFilter] = useState<FilterKey>('upcoming');
  const { selectedProfileId } = usePatientProfileStore();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'follow-ups', hospitalFilter, selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<FollowUp[]>('/patient-portal/follow-ups', { params });
      return res.data ?? [];
    },
  });

  const followUps = data ?? [];

  const categorized = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return followUps.map((fu) => {
      const dateObj = new Date(fu.followUpDate);
      dateObj.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let category: 'overdue' | 'today' | 'upcoming' | 'far';
      if (diffDays < 0) category = 'overdue';
      else if (diffDays === 0) category = 'today';
      else if (diffDays <= 7) category = 'upcoming';
      else category = 'far';

      return { ...fu, dateObj, diffDays, category };
    });
  }, [followUps]);

  const filtered = useMemo(() => {
    if (filter === 'all') return categorized;
    if (filter === 'overdue') return categorized.filter((f) => f.category === 'overdue');
    if (filter === 'upcoming') return categorized.filter((f) => f.category !== 'overdue');
    return [];
  }, [categorized, filter]);

  const overdueCount = categorized.filter((f) => f.category === 'overdue').length;
  const upcomingCount = categorized.filter((f) => f.category !== 'overdue').length;

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'upcoming', label: 'Upcoming', count: upcomingCount },
    { key: 'overdue', label: 'Overdue', count: overdueCount },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
            Care Records
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            Follow-Up Visits
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-1.5">
            Track follow-ups your doctors have scheduled for you
          </p>
        </div>
        <Link
          href="/patient-portal/book-appointment"
          className="inline-flex items-center gap-2 bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
        >
          <CalendarPlus className="h-4 w-4" />
          Book Appointment
        </Link>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {/* Overdue alert banner */}
      {overdueCount > 0 && filter !== 'overdue' && (
        <div className="flex items-center gap-4 rounded-xl px-5 py-4 shadow-sanctuary border-l-4 border-error bg-error-container/40">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-error/10 text-error shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline text-sm font-bold text-on-surface">
              {overdueCount} overdue follow-up{overdueCount > 1 ? 's' : ''}
            </p>
            <p className="font-label text-xs text-on-surface-variant mt-0.5">
              Please schedule your follow-up appointment as soon as possible.
            </p>
          </div>
          <button
            onClick={() => setFilter('overdue')}
            className="font-label text-xs font-bold text-error hover:underline shrink-0"
          >
            View All
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-label text-xs font-bold transition-colors whitespace-nowrap',
              f.key === filter
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  f.key === filter
                    ? 'bg-white/20 text-white'
                    : 'bg-on-surface/10 text-on-surface',
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Follow-up cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
          <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
            <CalendarDays className="h-5 w-5" />
          </div>
          <p className="font-label text-sm font-semibold text-on-surface">
            {filter === 'overdue' ? 'No overdue follow-ups' : 'No follow-up visits scheduled'}
          </p>
          <p className="font-label text-xs text-on-surface-variant mt-1">
            Follow-up reminders will appear here when your doctor schedules them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fu) => (
            <FollowUpCard key={fu.id} followUp={fu} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Follow-Up Card ────────────────────────────────────────────

function FollowUpCard({
  followUp,
}: {
  followUp: {
    id: string;
    followUpDate: string;
    durationText?: string;
    notes?: string;
    prescriptionDate: string;
    diffDays: number;
    category: 'overdue' | 'today' | 'upcoming' | 'far';
    tenantId?: string | null;
    doctorId?: string;
    doctor?: { user?: { firstName: string; lastName: string } };
    patient?: { tenant?: { id: string; name: string } };
  };
}) {
  const fu = followUp;
  const isOverdue = fu.category === 'overdue';
  const isToday = fu.category === 'today';
  const isSoon = fu.category === 'upcoming' && fu.diffDays <= 3;

  const displayDate = new Date(fu.followUpDate).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const prescriptionDate = new Date(fu.prescriptionDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let statusLabel: string;
  if (isToday) statusLabel = 'Today';
  else if (isOverdue)
    statusLabel = `${Math.abs(fu.diffDays)} day${Math.abs(fu.diffDays) !== 1 ? 's' : ''} overdue`;
  else if (fu.diffDays === 1) statusLabel = 'Tomorrow';
  else statusLabel = `in ${fu.diffDays} day${fu.diffDays !== 1 ? 's' : ''}`;

  const doctorName = fu.doctor?.user
    ? `Dr. ${fu.doctor.user.firstName} ${fu.doctor.user.lastName}`
    : 'Doctor';

  const accent = isOverdue
    ? 'border-error bg-error-container/40'
    : isToday
      ? 'border-secondary bg-secondary-fixed/50'
      : isSoon
        ? 'border-secondary bg-secondary-fixed/30'
        : 'border-primary bg-primary-fixed/20';

  const iconBg = isOverdue
    ? 'bg-error/10 text-error'
    : isToday
      ? 'bg-secondary/10 text-secondary'
      : isSoon
        ? 'bg-secondary/10 text-secondary'
        : 'bg-primary/10 text-primary';

  const chipClass = isOverdue
    ? 'bg-error/10 text-error'
    : isToday
      ? 'bg-secondary/10 text-secondary'
      : isSoon
        ? 'bg-secondary/10 text-secondary'
        : 'bg-primary/10 text-primary';

  return (
    <div
      className={cn(
        'rounded-xl shadow-sanctuary overflow-hidden transition-all border-l-4',
        accent,
      )}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Date circle */}
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl h-14 w-14 shrink-0',
            iconBg,
          )}
        >
          <CalendarDays className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-label text-sm font-bold text-on-surface">{displayDate}</p>
            <span
              className={cn(
                'text-[10px] font-bold font-label px-2 py-0.5 rounded-full capitalize',
                chipClass,
              )}
            >
              {statusLabel}
            </span>
          </div>
          <p className="font-label text-xs text-on-surface-variant mt-0.5">
            {doctorName}
            {fu.patient?.tenant?.name && ` · ${fu.patient.tenant.name}`}
          </p>
          {fu.durationText && (
            <p className="font-label text-[11px] text-on-surface-variant mt-0.5">
              <Clock className="inline h-3 w-3 mr-0.5 -mt-0.5" />
              {fu.durationText}
            </p>
          )}
          {fu.notes && (
            <p className="font-label text-[11px] text-on-surface-variant mt-1">{fu.notes}</p>
          )}
          <p className="font-label text-[10px] text-outline mt-1">
            Prescribed on {prescriptionDate}
          </p>
        </div>

        {/* Action */}
        <Link
          href={(() => {
            const tenantId = fu.tenantId || fu.patient?.tenant?.id;
            const tenantName = fu.patient?.tenant?.name;
            const params = new URLSearchParams();
            if (tenantId) params.set('tenantId', tenantId);
            if (tenantName) params.set('tenantName', tenantName);
            if (fu.doctorId) params.set('doctorId', fu.doctorId);
            if (fu.followUpDate) params.set('date', fu.followUpDate);
            const qs = params.toString();
            return qs ? `/patient-portal/book-appointment?${qs}` : '/patient-portal/book-appointment';
          })()}
          className="shrink-0"
        >
          <Button
            size="sm"
            variant={isOverdue || isToday ? 'default' : 'outline'}
            className="gap-1.5"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Book Now
          </Button>
        </Link>
      </div>
    </div>
  );
}
