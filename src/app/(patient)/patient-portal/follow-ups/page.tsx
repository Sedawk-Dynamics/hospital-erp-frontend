'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, Clock, CheckCircle2, AlertTriangle, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { HospitalFilter } from '../_components/hospital-filter';

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

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'follow-ups', hospitalFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      const res = await apiGet<FollowUp[]>('/patient-portal/follow-ups', { params });
      return res.data ?? [];
    },
  });

  const followUps = data ?? [];

  // Categorize follow-ups
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
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Follow-Up Visits</h1>
        <Link href="/patient-portal/book-appointment">
          <Button className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Book Appointment
          </Button>
        </Link>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {/* Overdue alert banner */}
      {overdueCount > 0 && filter !== 'overdue' && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-200 shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-900">
              {overdueCount} overdue follow-up{overdueCount > 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-red-700">
              Please schedule your follow-up appointment as soon as possible.
            </p>
          </div>
          <button
            onClick={() => setFilter('overdue')}
            className="text-xs font-semibold text-red-900 hover:underline shrink-0"
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
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              f.key === filter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                f.key === filter
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-foreground/10',
              )}>
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
        <div className="rounded-xl border bg-card p-8 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">
            {filter === 'overdue' ? 'No overdue follow-ups' : 'No follow-up visits scheduled'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
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
  else if (isOverdue) statusLabel = `${Math.abs(fu.diffDays)} day${Math.abs(fu.diffDays) !== 1 ? 's' : ''} overdue`;
  else if (fu.diffDays === 1) statusLabel = 'Tomorrow';
  else statusLabel = `in ${fu.diffDays} day${fu.diffDays !== 1 ? 's' : ''}`;

  const doctorName = fu.doctor?.user
    ? `Dr. ${fu.doctor.user.firstName} ${fu.doctor.user.lastName}`
    : 'Doctor';

  return (
    <div
      className={cn(
        'rounded-xl border-2 bg-card overflow-hidden transition-all',
        isOverdue && 'border-red-300',
        isToday && 'border-orange-300',
        isSoon && 'border-amber-200',
        !isOverdue && !isToday && !isSoon && 'border-border',
      )}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Date circle */}
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-xl h-14 w-14 shrink-0',
            isOverdue && 'bg-red-100',
            isToday && 'bg-orange-100',
            isSoon && 'bg-amber-100',
            !isOverdue && !isToday && !isSoon && 'bg-primary/10',
          )}
        >
          <CalendarDays
            className={cn(
              'h-5 w-5',
              isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : isSoon ? 'text-amber-600' : 'text-primary',
            )}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground">{displayDate}</p>
            <Badge
              className={cn(
                'text-[10px] px-1.5 py-0',
                isOverdue && 'bg-red-100 text-red-700',
                isToday && 'bg-orange-100 text-orange-700',
                isSoon && 'bg-amber-100 text-amber-700',
                !isOverdue && !isToday && !isSoon && 'bg-blue-100 text-blue-700',
              )}
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doctorName}
            {fu.patient?.tenant?.name && ` · ${fu.patient.tenant.name}`}
          </p>
          {fu.durationText && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              <Clock className="inline h-3 w-3 mr-0.5 -mt-0.5" />
              {fu.durationText}
            </p>
          )}
          {fu.notes && (
            <p className="text-[11px] text-foreground/70 mt-1">{fu.notes}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
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
