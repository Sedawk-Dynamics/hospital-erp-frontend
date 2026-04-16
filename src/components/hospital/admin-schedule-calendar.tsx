'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, CalendarDays, Layers, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { FullCalendar, type CalendarView } from '@/components/doctor/full-calendar';
import { ScheduleOverrideEditor } from './schedule-override-editor';
import { BulkOverrideDialog } from './bulk-override-dialog';
import { useDoctorProfileWithSchedules } from '@/hooks/use-doctor-schedule';
import { useDoctorLeaves } from '@/hooks/use-doctor-leaves';
import { useScheduleOverrides } from '@/hooks/use-schedule-overrides';
import { useDoctorAppointments } from '@/hooks/use-doctor';

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

interface Props {
  doctorId: string;
  doctorName: string;
  /** Doctor user id — used for loading their appointments. */
  doctorUserId?: string;
}

export function AdminScheduleCalendar({ doctorId, doctorName, doctorUserId }: Props) {
  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

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

  const { data: profileWithSchedules } = useDoctorProfileWithSchedules(doctorId);
  const schedules = profileWithSchedules?.schedules ?? [];

  const { data: leaves = [] } = useDoctorLeaves(doctorId, { fromDate, toDate });
  const { data: overrides = [] } = useScheduleOverrides(doctorId, { fromDate, toDate });

  const { data: appointmentsResp } = useDoctorAppointments({
    doctorUserId,
    fromDate,
    toDate,
    limit: 500,
  });
  const appointments = appointmentsResp?.data ?? [];

  const editingOverride = useMemo(() => {
    if (!editingDate) return null;
    return overrides.find((o) => {
      const od = new Date(o.date);
      const ed = new Date(editingDate);
      return od.getUTCFullYear() === ed.getFullYear()
        && od.getUTCMonth() === ed.getMonth()
        && od.getUTCDate() === ed.getDate();
    }) ?? null;
  }, [editingDate, overrides]);

  const navigate = (dir: -1 | 0 | 1) => {
    if (dir === 0) { setAnchorDate(new Date()); return; }
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

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
        <Info className="h-3.5 w-3.5 text-blue-700 mt-0.5 flex-shrink-0" />
        <span className="text-blue-900">
          <strong>Tip:</strong> Click any date to set custom shifts or mark it as a day off. Use <strong>Bulk Apply</strong> to set shifts across many dates at once (e.g. "8am-2pm every Sunday this month").
          Overrides take priority over the weekly recurring schedule.
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(0)}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-semibold">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <Layers className="h-4 w-4 mr-1.5" />
            Bulk Apply
          </Button>
          <div className="inline-flex rounded-lg border overflow-hidden bg-card">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0',
                  view === v.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <FullCalendar
        view={view}
        anchorDate={anchorDate}
        schedules={schedules}
        leaves={leaves}
        overrides={overrides}
        appointments={appointments}
        onEditDate={(date) => setEditingDate(toInputDateStr(date))}
      />

      {/* Edit dialog */}
      {editingDate && (
        <ScheduleOverrideEditor
          open={true}
          onOpenChange={(v) => { if (!v) setEditingDate(null); }}
          doctorId={doctorId}
          doctorName={doctorName}
          date={editingDate}
          existingOverride={editingOverride}
          weeklySchedules={schedules}
        />
      )}

      <BulkOverrideDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        doctorId={doctorId}
        doctorName={doctorName}
        defaultRange={
          view === 'month'
            ? { fromDate: toInputDateStr(startOfMonth(anchorDate)), toDate: toInputDateStr(endOfMonth(anchorDate)) }
            : view === 'week'
              ? { fromDate: toInputDateStr(startOfWeek(anchorDate)), toDate: toInputDateStr(addDays(startOfWeek(anchorDate), 6)) }
              : undefined
        }
      />
    </div>
  );
}
