'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatDate,
  toInputDateStr,
  getCurrentISTTime,
  isToday,
} from '@/lib/date-utils';
import { FullCalendar, type CalendarView } from '@/components/doctor/full-calendar';
import { useDoctorProfileWithSchedules } from '@/hooks/use-doctor-schedule';
import { useDoctorLeaves } from '@/hooks/use-doctor-leaves';
import { useScheduleOverrides } from '@/hooks/use-schedule-overrides';
import { useDoctorAppointments } from '@/hooks/use-doctor';
import { useAvailableSlots } from '@/hooks/use-hospital';

// ── Local date helpers ─────────────────────────────────────────

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

/** Parse a yyyy-MM-dd input string to a local Date (midnight). */
function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

// ── Props ──────────────────────────────────────────────────────

interface DoctorCalendarPickerProps {
  /** DoctorProfile id whose calendar to display. */
  doctorId: string;
  /** Currently selected appointment date (yyyy-MM-dd). */
  selectedDate: string;
  /** Currently selected slot start time (HH:MM). */
  selectedStartTime?: string;
  /** Called with a yyyy-MM-dd string when a calendar day is picked. */
  onDateChange: (date: string) => void;
  /** Called with HH:MM start/end when a time slot is picked. */
  onSlotSelect: (startTime: string, endTime: string) => void;
  /** Earliest selectable date (yyyy-MM-dd). Defaults to today. */
  minDate?: string;
}

// ── Component ───────────────────────────────────────────────────

/**
 * A read-only view of a doctor's calendar (recurring schedule, date overrides,
 * approved/pending leaves and already-booked appointments) combined with a
 * per-day time-slot grid. Front-desk staff use it to see the doctor's whole
 * schedule at a glance and pick a free slot when booking or rescheduling.
 */
export function DoctorCalendarPicker({
  doctorId,
  selectedDate,
  selectedStartTime,
  onDateChange,
  onSlotSelect,
  minDate,
}: DoctorCalendarPickerProps) {
  const effectiveMinDate = minDate ?? toInputDateStr();

  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(
    () => parseInputDate(selectedDate) ?? new Date(),
  );

  // Follow the externally-selected date so the calendar always frames it.
  useEffect(() => {
    const d = parseInputDate(selectedDate);
    if (d) setAnchorDate(d);
  }, [selectedDate]);

  // Query window covering the visible range (with a little padding for month).
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

  // Calendar data sources.
  const { data: profileWithSchedules } = useDoctorProfileWithSchedules(doctorId);
  const schedules = profileWithSchedules?.schedules ?? [];
  const { data: leaves = [] } = useDoctorLeaves(doctorId, { fromDate, toDate });
  const { data: overrides = [] } = useScheduleOverrides(doctorId, { fromDate, toDate });
  const { data: appointmentsResp } = useDoctorAppointments({
    doctorId,
    fromDate,
    toDate,
    limit: 500,
  });
  const appointments = appointmentsResp?.data ?? [];

  // Slots for the currently-selected day.
  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    doctorId,
    selectedDate,
  );

  const currentTime = getCurrentISTTime();
  const isTodaySelected = isToday(selectedDate);
  const slots = (slotsData?.slots ?? []).map((slot) => ({
    ...slot,
    isPast: isTodaySelected && slot.startTime < currentTime,
  }));

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
      return `${formatDate(s)} – ${formatDate(addDays(s, 6))}`;
    }
    return anchorDate.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [view, anchorDate]);

  const handleSelectDate = useCallback(
    (date: Date) => {
      const str = toInputDateStr(date);
      // Booking is future-only — ignore days before the minimum.
      if (str < effectiveMinDate) return;
      onDateChange(str);
    },
    [effectiveMinDate, onDateChange],
  );

  const selectedDateObj = parseInputDate(selectedDate);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(0)}>
            Today
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1.5 text-xs font-semibold text-foreground">{title}</span>
        </div>

        <div className="inline-flex rounded-lg border overflow-hidden">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold transition-colors border-r last:border-r-0',
                view === v.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className={cn(view === 'month' ? '' : 'max-h-[420px]')}>
        <FullCalendar
          view={view}
          anchorDate={anchorDate}
          schedules={schedules}
          leaves={leaves}
          overrides={overrides}
          appointments={appointments}
          selectedDate={selectedDateObj}
          onSelectDate={handleSelectDate}
        />
      </div>

      {/* Slot grid for the selected day */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>Time slots</span>
          {selectedDateObj && (
            <span className="text-xs font-normal text-muted-foreground">
              · {formatDate(selectedDateObj)}
            </span>
          )}
        </div>

        {slotsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading slots...</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center">
            <CalendarDays className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-sm text-muted-foreground">
              {slotsData?.message ??
                'No slots available for this doctor on the selected date.'}
            </p>
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-md border p-2">
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
              {slots.map((slot) => {
                const isSelected = selectedStartTime === slot.startTime;
                const isOnLeave = !slot.available && (slot as { onLeave?: boolean }).onLeave;
                const isDisabled = !slot.available || slot.isPast;
                return (
                  <Button
                    key={slot.startTime}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    disabled={isDisabled}
                    className={
                      isOnLeave
                        ? 'opacity-80 cursor-not-allowed bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
                        : !slot.available
                          ? 'opacity-60 cursor-not-allowed bg-red-50 text-red-400 border-red-200 line-through dark:bg-red-950/20 dark:text-red-400/60 dark:border-red-900/30'
                          : slot.isPast
                            ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                            : isSelected
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'hover:bg-primary/10 hover:text-primary hover:border-primary'
                    }
                    onClick={() => onSlotSelect(slot.startTime, slot.endTime)}
                  >
                    <span className="flex flex-col items-center leading-tight">
                      <span>{slot.startTime}</span>
                      {!slot.available && (
                        <span className="text-[9px] font-bold">
                          {isOnLeave ? 'On Leave' : 'Booked'}
                        </span>
                      )}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
