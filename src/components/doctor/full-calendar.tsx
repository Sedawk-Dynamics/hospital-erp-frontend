'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDate, formatTime24 } from '@/lib/date-utils';
import { UserRound, Sun, Moon, Sparkles } from 'lucide-react';
import type { DoctorScheduleEntry } from '@/hooks/use-doctor-schedule';
import type { DoctorLeave } from '@/hooks/use-doctor-leaves';
import type { ScheduleOverride } from '@/hooks/use-schedule-overrides';
import type { Appointment } from '@/types';

// ── Types ─────────────────────────────────────────────────────

export type CalendarView = 'month' | 'week' | 'day';

interface FullCalendarProps {
  view: CalendarView;
  anchorDate: Date;
  schedules: DoctorScheduleEntry[];
  leaves: DoctorLeave[];
  overrides?: ScheduleOverride[];
  appointments: Appointment[];
  onCellClick?: (date: Date) => void;
  onApplyLeaveForDate?: (date: Date) => void;
  /** If set, cells become clickable with "pencil" affordance (used by admin view). */
  onEditDate?: (date: Date) => void;
}

// ── Helpers ───────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Monday-first week
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

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseUtcTime(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minToHhmm(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function isLeaveActiveOn(leave: DoctorLeave, date: Date): boolean {
  const start = new Date(leave.leaveDate);
  start.setHours(0, 0, 0, 0);
  const end = leave.endDate ? new Date(leave.endDate) : start;
  end.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

function leaveIsFullDay(leave: DoctorLeave): boolean {
  return !leave.startTime && !leave.endTime;
}

function leaveTimeRange(leave: DoctorLeave): { startMin: number; endMin: number } | null {
  const s = parseUtcTime(leave.startTime);
  const e = parseUtcTime(leave.endTime);
  if (!s || !e) return null;
  return { startMin: hhmmToMin(s), endMin: hhmmToMin(e) };
}

function sameDateAsOverride(override: ScheduleOverride, d: Date): boolean {
  const od = new Date(override.date);
  return od.getUTCFullYear() === d.getFullYear()
    && od.getUTCMonth() === d.getMonth()
    && od.getUTCDate() === d.getDate();
}

/** Return the override for this date, or null. */
function findOverride(overrides: ScheduleOverride[] | undefined, d: Date): ScheduleOverride | null {
  if (!overrides) return null;
  return overrides.find((o) => sameDateAsOverride(o, d)) ?? null;
}

/**
 * Resolve the effective shifts for a date: override shifts if present (even empty),
 * otherwise the recurring weekly schedule for that day-of-week.
 *
 * Returns { shifts, isOverride, isDayOff } — isDayOff is true if the override explicitly marks off.
 */
function resolveShifts(
  date: Date,
  schedules: DoctorScheduleEntry[],
  overrides: ScheduleOverride[] | undefined,
): { shifts: Array<{ startTime: string; endTime: string; slotDurationMinutes: number; maxPatients?: number | null }>; isOverride: boolean; isDayOff: boolean; note?: string | null } {
  const override = findOverride(overrides, date);
  if (override) {
    if (override.isDayOff) {
      return { shifts: [], isOverride: true, isDayOff: true, note: override.note };
    }
    return {
      shifts: override.shifts.map((s) => ({
        startTime: parseUtcTime(s.startTime),
        endTime: parseUtcTime(s.endTime),
        slotDurationMinutes: s.slotDurationMinutes,
        maxPatients: s.maxPatients ?? undefined,
      })),
      isOverride: true,
      isDayOff: false,
      note: override.note,
    };
  }
  const dow = date.getDay();
  const weekly = schedules
    .filter((s) => s.dayOfWeek === dow && s.isActive)
    .map((s) => ({
      startTime: parseUtcTime(s.startTime),
      endTime: parseUtcTime(s.endTime),
      slotDurationMinutes: s.slotDurationMinutes,
      maxPatients: s.maxPatients ?? undefined,
    }));
  return { shifts: weekly, isOverride: false, isDayOff: false };
}

// ── Main Component ────────────────────────────────────────────

export function FullCalendar(props: FullCalendarProps) {
  if (props.view === 'month') return <MonthView {...props} />;
  if (props.view === 'day') return <DayView {...props} />;
  return <WeekView {...props} />;
}

// ── Month View ────────────────────────────────────────────────

function MonthView({ anchorDate, schedules, leaves, overrides, appointments, onCellClick, onEditDate }: FullCalendarProps) {
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const interactive = !!onCellClick || !!onEditDate;

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-2 py-2 font-semibold text-center">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 auto-rows-[minmax(100px,auto)]">
        {cells.map((date, idx) => {
          const inMonth = date >= monthStart && date <= monthEnd;
          const isToday = sameDate(date, today);

          const resolved = resolveShifts(date, schedules, overrides);
          const dayLeaves = leaves.filter((l) => isLeaveActiveOn(l, date));
          const approvedLeave = dayLeaves.find((l) => l.status === 'approved');
          const pendingLeave = dayLeaves.find((l) => l.status === 'pending');

          const dayAppointments = appointments.filter((a) => {
            const ad = new Date(a.appointmentDate);
            return sameDate(ad, date);
          });

          const isFullDayLeave = approvedLeave && leaveIsFullDay(approvedLeave);
          const isDayOff = resolved.isDayOff;

          const handleClick = () => {
            if (onEditDate) onEditDate(date);
            else if (onCellClick) onCellClick(date);
          };

          return (
            <div
              key={idx}
              onClick={interactive ? handleClick : undefined}
              className={cn(
                'border-b border-r min-h-[100px] p-1.5 flex flex-col gap-1 overflow-hidden',
                !inMonth && 'bg-muted/20 text-muted-foreground/50',
                isToday && 'bg-primary/5',
                (idx % 7) === 6 && 'border-r-0',
                interactive && 'cursor-pointer hover:bg-primary/5 hover:ring-1 hover:ring-primary/40 transition-all',
                resolved.isOverride && !isDayOff && 'bg-blue-50/50',
                isDayOff && 'bg-slate-100',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-[11px] font-semibold',
                  isToday && 'rounded-full bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center',
                )}>
                  {date.getDate()}
                </span>
                <div className="flex items-center gap-0.5">
                  {resolved.isOverride && (
                    <span title="Custom schedule override" className="inline-flex">
                      <Sparkles className="h-2.5 w-2.5 text-blue-600" />
                    </span>
                  )}
                  {resolved.shifts.length > 0 && !isFullDayLeave && !isDayOff && (
                    <span className="text-[9px] font-medium text-primary">
                      {resolved.shifts.length} shift{resolved.shifts.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {isDayOff ? (
                <div className="rounded-sm bg-slate-200 border border-slate-300 px-1.5 py-0.5">
                  <p className="text-[10px] font-semibold text-slate-700 truncate">Day Off</p>
                </div>
              ) : isFullDayLeave ? (
                <div className="rounded-sm bg-red-100 border border-red-200 px-1.5 py-0.5">
                  <p className="text-[10px] font-semibold text-red-700 capitalize truncate">
                    On Leave · {approvedLeave!.leaveType}
                  </p>
                </div>
              ) : (
                <>
                  {dayLeaves
                    .filter((l) => l.status === 'approved' && !leaveIsFullDay(l))
                    .map((l) => {
                      const s = parseUtcTime(l.startTime);
                      const e = parseUtcTime(l.endTime);
                      return (
                        <div key={l.id} className="rounded-sm bg-red-50 border border-red-200 px-1.5 py-0.5">
                          <p className="text-[10px] font-semibold text-red-700 truncate">
                            Leave {s}-{e}
                          </p>
                        </div>
                      );
                    })}

                  {pendingLeave && (
                    <div className="rounded-sm bg-amber-50 border border-amber-200 px-1.5 py-0.5">
                      <p className="text-[10px] font-medium text-amber-700 truncate">Leave pending</p>
                    </div>
                  )}

                  {dayAppointments.slice(0, 2).map((a) => (
                    <div key={a.id} className="rounded-sm bg-primary/10 px-1.5 py-0.5 truncate">
                      <p className="text-[10px] font-medium text-primary truncate">
                        {formatTime24(a.startTime)} · {(a as any).patient?.firstName ?? 'Patient'}
                      </p>
                    </div>
                  ))}
                  {dayAppointments.length > 2 && (
                    <p className="text-[10px] text-muted-foreground">+{dayAppointments.length - 2} more</p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────

const HOUR_HEIGHT = 48; // px per hour
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;

function WeekView(props: FullCalendarProps) {
  const weekStart = startOfWeek(props.anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return <TimeGrid {...props} days={days} showToday />;
}

// ── Day View ──────────────────────────────────────────────────

function DayView(props: FullCalendarProps) {
  const day = new Date(props.anchorDate);
  day.setHours(0, 0, 0, 0);
  return <TimeGrid {...props} days={[day]} showToday />;
}

// ── Shared time-grid (Week + Day) ─────────────────────────────

function TimeGrid({
  days, schedules, leaves, overrides, appointments, showToday, onApplyLeaveForDate, onEditDate,
}: FullCalendarProps & {
  days: Date[];
  showToday?: boolean;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;
  const gridStartMin = DAY_START_HOUR * 60;
  const gridEndMin = DAY_END_HOUR * 60;

  const hourLabels = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => DAY_START_HOUR + i,
  );

  // Auto-scroll to 8am on mount
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 2 * HOUR_HEIGHT; // start at 8am
    }
  }, []);

  const gutterWidth = 'w-14';

  // Current-time line (only if today is in range)
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const nowDate = new Date();
  const nowTop = ((nowDate.getHours() * 60 + nowDate.getMinutes()) - gridStartMin) * (HOUR_HEIGHT / 60);

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      {/* Header row */}
      <div className="flex border-b bg-muted/40">
        <div className={cn('flex-shrink-0 border-r', gutterWidth)} />
        {days.map((d) => {
          const isToday = sameDate(d, today) && showToday;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'flex-1 px-2 py-2 text-center border-r last:border-r-0',
                isToday && 'bg-primary/10',
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </p>
              <p className={cn('text-sm font-bold', isToday && 'text-primary')}>
                {formatDate(d)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div
        ref={scrollRef}
        className="overflow-auto max-h-[640px] relative"
      >
        <div className="flex" style={{ height: gridHeight }}>
          {/* Hour gutter */}
          <div className={cn('flex-shrink-0 border-r relative bg-muted/10', gutterWidth)}>
            {hourLabels.map((h, i) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-dashed border-border/50 first:border-t-0"
                style={{ top: i * HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-1 text-[10px] text-muted-foreground">
                  {h.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const isToday = sameDate(d, today);

            // Resolve shifts (override > weekly). Also surface override metadata.
            const resolved = resolveShifts(d, schedules, overrides);
            const daySchedules = resolved.shifts;
            const isDayOff = resolved.isDayOff;
            const isOverride = resolved.isOverride;

            const dayLeaves = leaves.filter((l) => isLeaveActiveOn(l, d));
            const approvedFullDay = dayLeaves.find((l) => l.status === 'approved' && leaveIsFullDay(l));

            const dayAppointments = appointments.filter((a) => {
              const ad = new Date(a.appointmentDate);
              return sameDate(ad, d);
            });

            return (
              <div
                key={d.toISOString()}
                className={cn('flex-1 relative border-r last:border-r-0', isToday && 'bg-primary/5')}
              >
                {/* Hour grid lines */}
                {hourLabels.map((h, i) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-dashed border-border/50 first:border-t-0"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ))}

                {/* Day-off (admin override) — takes precedence over everything */}
                {isDayOff && !approvedFullDay && (
                  <div
                    className="absolute left-1 right-1 rounded-md bg-slate-100 border-2 border-slate-300 flex items-center justify-center"
                    style={{ top: 0, height: gridHeight }}
                  >
                    <div className="text-center px-2">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Day Off</p>
                      <p className="text-[11px] text-slate-600 mt-1">Marked by Admin</p>
                      {resolved.note && (
                        <p className="text-[11px] text-slate-700/80 mt-1 italic line-clamp-3">{resolved.note}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Full-day leave overlay */}
                {approvedFullDay && (
                  <div
                    className="absolute left-1 right-1 rounded-md bg-red-100 border-2 border-red-300 flex items-center justify-center"
                    style={{ top: 0, height: gridHeight }}
                  >
                    <div className="text-center px-2">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wider">On Leave</p>
                      <p className="text-[11px] text-red-700 capitalize mt-1">{approvedFullDay.leaveType}</p>
                      {approvedFullDay.reason && (
                        <p className="text-[11px] text-red-700/80 mt-1 italic line-clamp-3">{approvedFullDay.reason}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Override badge (top-right) when using an override but not a day-off */}
                {isOverride && !isDayOff && !approvedFullDay && (
                  <div className="absolute top-1 right-1 z-40 inline-flex items-center gap-0.5 rounded-full bg-blue-100 border border-blue-300 px-1.5 py-0.5">
                    <Sparkles className="h-2.5 w-2.5 text-blue-700" />
                    <span className="text-[9px] font-semibold text-blue-700 uppercase tracking-wider">Custom</span>
                  </div>
                )}

                {!approvedFullDay && !isDayOff && (
                  <>
                    {/* Shift blocks (light primary background) */}
                    {daySchedules.map((s, idx) => {
                      const startMin = hhmmToMin(s.startTime);
                      const endMin = hhmmToMin(s.endTime);
                      const clampedStart = Math.max(startMin, gridStartMin);
                      const clampedEnd = Math.min(endMin, gridEndMin);
                      if (clampedEnd <= clampedStart) return null;
                      const top = (clampedStart - gridStartMin) * (HOUR_HEIGHT / 60);
                      const height = (clampedEnd - clampedStart) * (HOUR_HEIGHT / 60);
                      const isMorning = startMin < 12 * 60;
                      const isEvening = startMin >= 18 * 60;
                      const Icon = isEvening ? Moon : Sun;
                      return (
                        <div
                          key={idx}
                          className="absolute left-0.5 right-0.5 rounded-md bg-primary/10 border border-primary/20"
                          style={{ top, height }}
                        >
                          <div className="px-1.5 py-1 flex items-center gap-1">
                            <Icon className={cn(
                              'h-2.5 w-2.5 flex-shrink-0',
                              isMorning ? 'text-amber-600' : isEvening ? 'text-indigo-600' : 'text-orange-600',
                            )} />
                            <span className="text-[10px] font-semibold text-foreground truncate">
                              {s.startTime}–{s.endTime}
                            </span>
                          </div>
                          <p className="px-1.5 text-[9px] text-muted-foreground">
                            {s.slotDurationMinutes}m slots
                          </p>
                        </div>
                      );
                    })}

                    {/* Partial approved leaves (red overlay) */}
                    {dayLeaves
                      .filter((l) => l.status === 'approved' && !leaveIsFullDay(l))
                      .map((l) => {
                        const range = leaveTimeRange(l);
                        if (!range) return null;
                        const top = (Math.max(range.startMin, gridStartMin) - gridStartMin) * (HOUR_HEIGHT / 60);
                        const height = (Math.min(range.endMin, gridEndMin) - Math.max(range.startMin, gridStartMin)) * (HOUR_HEIGHT / 60);
                        if (height <= 0) return null;
                        return (
                          <div
                            key={l.id}
                            className="absolute left-1 right-1 rounded-md bg-red-200/70 border-2 border-red-400 backdrop-blur-[1px] z-10 overflow-hidden"
                            style={{ top, height }}
                            title={`Leave ${minToHhmm(range.startMin)} – ${minToHhmm(range.endMin)}${l.reason ? ` · ${l.reason}` : ''}`}
                          >
                            <div className="p-1">
                              <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider">
                                Leave
                              </p>
                              <p className="text-[10px] text-red-800">
                                {minToHhmm(range.startMin)}–{minToHhmm(range.endMin)}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                    {/* Pending leaves (amber, dashed) */}
                    {dayLeaves
                      .filter((l) => l.status === 'pending')
                      .map((l) => {
                        const range = leaveTimeRange(l);
                        const top = range
                          ? (Math.max(range.startMin, gridStartMin) - gridStartMin) * (HOUR_HEIGHT / 60)
                          : 0;
                        const height = range
                          ? (Math.min(range.endMin, gridEndMin) - Math.max(range.startMin, gridStartMin)) * (HOUR_HEIGHT / 60)
                          : gridHeight;
                        if (height <= 0) return null;
                        return (
                          <div
                            key={l.id}
                            className="absolute left-1 right-1 rounded-md bg-amber-100/60 border-2 border-dashed border-amber-400 z-10 overflow-hidden"
                            style={{ top, height }}
                            title={`Pending approval${l.reason ? ` · ${l.reason}` : ''}`}
                          >
                            <div className="p-1">
                              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                                Pending
                              </p>
                              {range && (
                                <p className="text-[10px] text-amber-800">
                                  {minToHhmm(range.startMin)}–{minToHhmm(range.endMin)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {/* Appointment pills */}
                    {dayAppointments.map((a) => {
                      const sTime = parseUtcTime(a.startTime);
                      const eTime = parseUtcTime(a.endTime) || sTime;
                      if (!sTime) return null;
                      const startMin = hhmmToMin(sTime);
                      const endMin = eTime ? hhmmToMin(eTime) : startMin + 15;
                      const top = (Math.max(startMin, gridStartMin) - gridStartMin) * (HOUR_HEIGHT / 60);
                      const height = Math.max(
                        18,
                        (Math.min(endMin, gridEndMin) - Math.max(startMin, gridStartMin)) * (HOUR_HEIGHT / 60),
                      );
                      const patientName = (a as any).patient?.firstName
                        ? `${(a as any).patient.firstName} ${(a as any).patient.lastName ?? ''}`.trim()
                        : 'Patient';
                      return (
                        <div
                          key={a.id}
                          className="absolute left-1 right-1 rounded-md bg-primary text-primary-foreground shadow-sm z-20 overflow-hidden cursor-default"
                          style={{ top, height }}
                          title={`${sTime} ${patientName}${a.reason ? ' · ' + a.reason : ''}`}
                        >
                          <div className="px-1.5 py-0.5 flex items-center gap-1">
                            <UserRound className="h-2.5 w-2.5 flex-shrink-0" />
                            <span className="text-[10px] font-semibold truncate">{sTime}</span>
                            <span className="text-[10px] truncate">{patientName}</span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Now line */}
                {isToday && nowTop >= 0 && nowTop <= gridHeight && (
                  <div
                    className="absolute left-0 right-0 z-30 pointer-events-none"
                    style={{ top: nowTop }}
                  >
                    <div className="h-0.5 bg-red-500 w-full" />
                    <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-3 flex-wrap text-[11px]">
        <LegendSwatch className="bg-primary/10 border-primary/20" label="Scheduled Shift" />
        <LegendSwatch className="bg-red-200 border-red-400" label="Approved Leave" />
        <LegendSwatch className="bg-amber-100 border-amber-400" label="Pending Leave" dashed />
        <LegendSwatch className="bg-primary" label="Appointment" />
        <LegendSwatch className="bg-slate-100 border-slate-300" label="Day Off (Admin)" />
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-blue-600" />
          <span className="text-muted-foreground">Custom Override</span>
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({ className, label, dashed }: { className: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('h-3 w-4 rounded-sm border', dashed && 'border-dashed', className)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
