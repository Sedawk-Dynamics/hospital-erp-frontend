'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2, ChevronLeft, ChevronRight, Calendar as CalIcon,
  CalendarClock, Plus, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { useAuthStore } from '@/stores/auth-store';
import { useDoctorProfile, useDoctorAppointments } from '@/hooks/use-doctor';
import { useDoctorProfileWithSchedules } from '@/hooks/use-doctor-schedule';
import { useDoctorLeaves } from '@/hooks/use-doctor-leaves';
import { useScheduleOverrides } from '@/hooks/use-schedule-overrides';
import { FullCalendar, type CalendarView } from '@/components/doctor/full-calendar';
import { LeavesPanel } from '@/components/doctor/leaves-panel';
import { ApplyLeaveDialog } from '@/components/doctor/apply-leave-dialog';

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

export default function DoctorSchedulePage() {
  const { user } = useAuthStore();
  const { data: profile, isLoading: profileLoading } = useDoctorProfile();
  const doctorId = profile?.id;

  const [view, setView] = useState<CalendarView>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyInitialDate, setApplyInitialDate] = useState<string | undefined>();

  const { fromDate, toDate } = useMemo(() => {
    if (view === 'month') {
      const s = startOfMonth(anchorDate);
      s.setDate(s.getDate() - 6);
      const e = endOfMonth(anchorDate);
      e.setDate(e.getDate() + 6);
      return { fromDate: toInputDateStr(s), toDate: toInputDateStr(e) };
    }
    if (view === 'week') {
      const s = startOfWeek(anchorDate);
      return { fromDate: toInputDateStr(s), toDate: toInputDateStr(addDays(s, 6)) };
    }
    return { fromDate: toInputDateStr(anchorDate), toDate: toInputDateStr(anchorDate) };
  }, [view, anchorDate]);

  const { data: profileWithSchedules } = useDoctorProfileWithSchedules(doctorId ?? '');
  const schedules = profileWithSchedules?.schedules ?? [];

  const { data: leaves = [] } = useDoctorLeaves(doctorId, { fromDate, toDate });
  const { data: overrides = [] } = useScheduleOverrides(doctorId, { fromDate, toDate });

  const { data: appointmentsResp } = useDoctorAppointments({
    doctorUserId: user?.id,
    fromDate,
    toDate,
    limit: 500,
  });
  const appointments = appointmentsResp?.data ?? [];

  const navigate = (dir: -1 | 0 | 1) => {
    if (dir === 0) {
      setAnchorDate(new Date());
      return;
    }
    if (view === 'month') setAnchorDate((d) => addMonths(d, dir));
    else if (view === 'week') setAnchorDate((d) => addDays(d, dir * 7));
    else setAnchorDate((d) => addDays(d, dir));
  };

  const title = useMemo(() => {
    if (view === 'month') {
      return anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
      const s = startOfWeek(anchorDate);
      const e = addDays(s, 6);
      return `${formatDate(s)} – ${formatDate(e)}`;
    }
    return anchorDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [view, anchorDate]);

  const onCellClick = (date: Date) => {
    // Switch to day view on month-cell click
    if (view === 'month') {
      setAnchorDate(date);
      setView('day');
    }
  };

  const openApplyForDate = (date?: Date) => {
    setApplyInitialDate(date ? toInputDateStr(date) : undefined);
    setApplyOpen(true);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 text-center">
        <CalIcon className="h-10 w-10 text-on-surface-variant mx-auto mb-3" />
        <p className="font-label text-sm font-medium text-on-surface">No doctor profile found</p>
        <p className="font-label text-xs text-on-surface-variant mt-1">
          Contact your hospital administrator to set up your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Schedule & Leaves
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-0.5">
            Your shifts, approved leaves, and appointments — all in one place. Approved leaves automatically block patient booking.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => openApplyForDate()}>
          <Plus className="h-4 w-4 mr-1.5" />
          Apply for Leave
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 font-label text-xs">
        <Info className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
        <span className="text-on-surface-variant">
          Schedules & fees are managed by Hospital Admin. Tip: in month view, click any date to drill into the day view.
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(0)}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 font-label text-sm font-semibold text-on-surface">{title}</span>
        </div>

        <div className="inline-flex rounded-xl border border-outline-variant/30 overflow-hidden bg-surface-container-lowest">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={cn(
                'px-3 py-1.5 font-label text-xs font-semibold transition-colors border-r border-outline-variant/30 last:border-r-0',
                view === v.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid: calendar + leaves side panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <FullCalendar
          view={view}
          anchorDate={anchorDate}
          schedules={schedules}
          leaves={leaves}
          overrides={overrides}
          appointments={appointments}
          onCellClick={onCellClick}
          onApplyLeaveForDate={(d) => openApplyForDate(d)}
        />

        <div className="min-h-[500px] xl:max-h-[760px]">
          <LeavesPanel
            doctorId={doctorId}
            onApplyClick={() => openApplyForDate()}
          />
        </div>
      </div>

      <ApplyLeaveDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        doctorId={doctorId}
        initialDate={applyInitialDate}
      />
    </div>
  );
}
