'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock, Plus, Trash2, Save, Loader2, Sun, Moon, CalendarClock,
  ChevronLeft, ChevronRight, Sparkles, RotateCcw, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useDoctorProfileWithSchedules,
  useUpdateDoctorSchedule,
  useUpdateDoctorProfile,
  type DoctorScheduleEntry,
} from '@/hooks/use-doctor-schedule';
import {
  useScheduleOverrides,
  useDeleteScheduleOverride,
  type ScheduleOverride,
} from '@/hooks/use-schedule-overrides';
import { ScheduleOverrideEditor } from '@/components/hospital/schedule-override-editor';
import { toInputDateStr, formatDate } from '@/lib/date-utils';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';

// ── Constants ────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

const SLOT_DURATIONS = [
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

const SHIFT_PRESETS = [
  { label: 'Morning', start: '09:00', end: '13:00', icon: Sun },
  { label: 'Afternoon', start: '14:00', end: '18:00', icon: Sun },
  { label: 'Evening', start: '18:00', end: '21:00', icon: Moon },
  { label: 'Night', start: '21:00', end: '06:00', icon: Moon },
  { label: 'Full Day', start: '09:00', end: '18:00', icon: CalendarClock },
];

interface ShiftEntry {
  _key: string; // UI key
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatients: number | undefined;
  isActive: boolean;
}

function makeKey() {
  return Math.random().toString(36).slice(2, 9);
}

function parseTime(value: string): string {
  if (!value) return '09:00';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return '09:00';
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function fromApi(entries: DoctorScheduleEntry[]): ShiftEntry[] {
  if (!entries || entries.length === 0) return [];
  return entries.map((e) => ({
    _key: makeKey(),
    dayOfWeek: e.dayOfWeek,
    startTime: parseTime(e.startTime),
    endTime: parseTime(e.endTime),
    slotDurationMinutes: e.slotDurationMinutes ?? 15,
    maxPatients: e.maxPatients ?? undefined,
    isActive: e.isActive ?? true,
  }));
}

function toApi(entries: ShiftEntry[]): DoctorScheduleEntry[] {
  return entries.map(({ _key, maxPatients, slotDurationMinutes, ...rest }) => ({
    ...rest,
    slotDurationMinutes: slotDurationMinutes || 15,
    ...(maxPatients != null && maxPatients > 0 ? { maxPatients } : {}),
  }));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function sameDateAsOverride(override: ScheduleOverride, d: Date): boolean {
  const od = new Date(override.date);
  return od.getUTCFullYear() === d.getFullYear()
    && od.getUTCMonth() === d.getMonth()
    && od.getUTCDate() === d.getDate();
}

// ── Props ────────────────────────────────────────────────────

interface DoctorScheduleManagerProps {
  doctorId: string;
  doctorName?: string;
  readOnly?: boolean;
}

// ── Component ────────────────────────────────────────────────

export function DoctorScheduleManager({
  doctorId,
  doctorName,
  readOnly = false,
}: DoctorScheduleManagerProps) {
  const { data: profile, isLoading } = useDoctorProfileWithSchedules(doctorId);
  const updateMutation = useUpdateDoctorSchedule(doctorId);
  const updateProfileMutation = useUpdateDoctorProfile(doctorId);
  const deleteOverrideMutation = useDeleteScheduleOverride();

  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [consultationFee, setConsultationFee] = useState<string>('');
  // Days after a paid consultation with this doctor in which a return visit
  // carries no fee. Blank / 0 = no free follow-up, which is what every doctor
  // had before this existed.
  const [freeFollowUpDays, setFreeFollowUpDays] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  // Week navigator — the week whose overrides we show/edit inline.
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const { data: overrides = [] } = useScheduleOverrides(doctorId, {
    fromDate: toInputDateStr(weekStart),
    toDate: toInputDateStr(weekEnd),
  });

  const [editingDate, setEditingDate] = useState<string | null>(null);

  // Sync from the API once per doctor. Re-running this on every refetch also
  // reset `dirty` to false, so unsaved shift edits were discarded AND the
  // unsaved-changes warning disappeared with them.
  useSeedOnChange(profile ? doctorId : null, () => {
    if (profile?.schedules) {
      setShifts(fromApi(profile.schedules));
      setDirty(false);
    }
    if (profile?.consultationFee !== undefined) {
      setConsultationFee(profile.consultationFee != null ? String(profile.consultationFee) : '');
    }
    if (profile?.freeFollowUpDays !== undefined) {
      setFreeFollowUpDays(profile.freeFollowUpDays ? String(profile.freeFollowUpDays) : '');
    }
  });

  const weeklySchedulesForEditor = useMemo(
    () => (profile?.schedules ?? []),
    [profile],
  );

  // Map dayOfWeek → date in the currently selected week
  const weekDatesByDow = useMemo(() => {
    const map: Record<number, Date> = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      map[d.getDay()] = d;
    }
    return map;
  }, [weekStart]);

  const overrideByDow = useMemo(() => {
    const map: Record<number, ScheduleOverride | undefined> = {};
    for (const dow of Object.keys(weekDatesByDow).map(Number)) {
      const date = weekDatesByDow[dow];
      map[dow] = overrides.find((o) => sameDateAsOverride(o, date));
    }
    return map;
  }, [overrides, weekDatesByDow]);

  // ── Handlers ───────────────────────────────────────────

  const addShift = useCallback((dayOfWeek: number, preset?: typeof SHIFT_PRESETS[number]) => {
    setShifts((prev) => [
      ...prev,
      {
        _key: makeKey(),
        dayOfWeek,
        startTime: preset?.start ?? '09:00',
        endTime: preset?.end ?? '17:00',
        slotDurationMinutes: 15,
        maxPatients: undefined,
        isActive: true,
      },
    ]);
    setDirty(true);
  }, []);

  const removeShift = useCallback((key: string) => {
    setShifts((prev) => prev.filter((s) => s._key !== key));
    setDirty(true);
  }, []);

  const updateShift = useCallback((key: string, field: keyof ShiftEntry, value: any) => {
    setShifts((prev) =>
      prev.map((s) => (s._key === key ? { ...s, [field]: value } : s)),
    );
    setDirty(true);
  }, []);

  const toggleDay = useCallback((dayOfWeek: number) => {
    const dayShifts = shifts.filter((s) => s.dayOfWeek === dayOfWeek);
    if (dayShifts.length > 0) {
      const allActive = dayShifts.every((s) => s.isActive);
      setShifts((prev) =>
        prev.map((s) =>
          s.dayOfWeek === dayOfWeek ? { ...s, isActive: !allActive } : s,
        ),
      );
    } else {
      addShift(dayOfWeek);
    }
    setDirty(true);
  }, [shifts, addShift]);

  const applyToAll = useCallback((sourceDay: number) => {
    const sourceShifts = shifts.filter((s) => s.dayOfWeek === sourceDay);
    if (sourceShifts.length === 0) return;

    const otherDays = DAYS.filter((d) => d.value !== sourceDay);
    const newShifts = shifts.filter((s) => s.dayOfWeek === sourceDay);

    for (const day of otherDays) {
      for (const src of sourceShifts) {
        newShifts.push({
          ...src,
          _key: makeKey(),
          dayOfWeek: day.value,
        });
      }
    }

    setShifts(newShifts);
    setDirty(true);
    toast.info(`Applied ${DAYS.find((d) => d.value === sourceDay)?.label}'s schedule to all days`);
  }, [shifts]);

  const handleSave = useCallback(async () => {
    const activeShifts = shifts.filter((s) => s.isActive);
    for (const s of activeShifts) {
      if (s.startTime >= s.endTime) {
        const dayName = DAYS.find((d) => d.value === s.dayOfWeek)?.label;
        toast.error(`${dayName}: Start time must be before end time`);
        return;
      }
    }

    try {
      const newFee = consultationFee ? Number(consultationFee) : 0;
      const currentFee = profile?.consultationFee ?? 0;
      const newWindow = freeFollowUpDays ? Number(freeFollowUpDays) : 0;
      const currentWindow = profile?.freeFollowUpDays ?? 0;
      if (newFee !== currentFee || newWindow !== currentWindow) {
        await updateProfileMutation.mutateAsync({
          consultationFee: newFee,
          freeFollowUpDays: newWindow || null,
        });
      }
      await updateMutation.mutateAsync(toApi(activeShifts));
      setDirty(false);
      toast.success('Weekly pattern & fee saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    }
  }, [shifts, consultationFee, freeFollowUpDays, profile, updateMutation, updateProfileMutation]);

  const handleRevertOverride = useCallback(async (override: ScheduleOverride) => {
    try {
      await deleteOverrideMutation.mutateAsync(override.id);
      toast.success('Reverted to weekly pattern for this date');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to revert');
    }
  }, [deleteOverrideMutation]);

  // ── Render ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;
  const isCurrentWeek = (() => {
    const today = startOfWeek(new Date());
    return today.getTime() === weekStart.getTime();
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Weekly Schedule
          </h3>
          {doctorName && (
            <p className="text-xs text-muted-foreground mt-0.5">{doctorName}</p>
          )}
        </div>
        {!readOnly && (
          <Button
            onClick={handleSave}
            disabled={!dirty || updateMutation.isPending}
            size="sm"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save Weekly Pattern
          </Button>
        )}
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekAnchor((d) => addDays(d, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isCurrentWeek}
            onClick={() => setWeekAnchor(new Date())}
          >
            This Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekAnchor((d) => addDays(d, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-semibold">{weekLabel}</div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
        <Sparkles className="h-3.5 w-3.5 text-blue-700 mt-0.5 flex-shrink-0" />
        <span className="text-blue-900">
          Editing below updates the <strong>recurring weekly pattern</strong> (applies every week).
          For a one-time change on a specific date, use <strong>Customize this week</strong> — it
          takes precedence over the weekly pattern for that date only.
        </span>
      </div>

      {/* Consultation Fee */}
      {!readOnly && (
        <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-semibold text-foreground">Consultation Fee</span>
            <span className="text-xs text-muted-foreground">(shown to patients during booking)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-muted-foreground">&#8377;</span>
            <Input
              type="number"
              placeholder="0"
              value={consultationFee}
              onChange={(e) => { setConsultationFee(e.target.value); setDirty(true); }}
              className="h-8 w-[100px] text-sm"
              min={0}
            />
          </div>
        </div>
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
          <div>
            <span className="text-sm font-semibold text-foreground">Free follow-up window</span>
            <p className="text-[11px] text-muted-foreground">
              A return visit to you within this many days of a paid consultation carries no
              consultation fee. Leave blank to charge every visit.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              placeholder="0"
              value={freeFollowUpDays}
              onChange={(e) => { setFreeFollowUpDays(e.target.value); setDirty(true); }}
              className="h-8 w-[80px] text-sm"
              min={0}
              max={365}
            />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>
      )}
      {readOnly && (profile?.freeFollowUpDays ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Free follow-up window</span>
          <span className="text-sm font-bold text-foreground">
            {profile?.freeFollowUpDays} days
          </span>
        </div>
      )}
      {readOnly && profile?.consultationFee != null && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Consultation Fee</span>
          <span className="text-sm font-bold text-foreground">&#8377;{Number(profile.consultationFee).toLocaleString('en-IN')}</span>
        </div>
      )}

      {/* Day cards */}
      <div className="space-y-3">
        {DAYS.map((day) => {
          const dayShifts = shifts.filter((s) => s.dayOfWeek === day.value);
          const hasShifts = dayShifts.length > 0;
          const allActive = dayShifts.length > 0 && dayShifts.every((s) => s.isActive);
          const dayDate = weekDatesByDow[day.value];
          const override = overrideByDow[day.value];
          const hasOverride = !!override;

          return (
            <div
              key={day.value}
              className={cn(
                'rounded-xl border bg-card transition-colors',
                hasOverride
                  ? 'border-primary-container/40 bg-primary-container/5'
                  : allActive && hasShifts ? 'border-primary/30' : '',
              )}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-dashed gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  {!readOnly && !hasOverride && (
                    <button
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                        allActive && hasShifts
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted-foreground/30',
                      )}
                    >
                      {allActive && hasShifts && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}
                  <div className="flex flex-col">
                    <span className={cn(
                      'text-sm font-semibold',
                      hasOverride ? 'text-foreground'
                        : allActive && hasShifts ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {day.label}
                    </span>
                    {dayDate && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(dayDate)}
                      </span>
                    )}
                  </div>
                  {hasOverride && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/20 border border-primary-container/40 px-2 py-0.5 text-[10px] font-semibold text-primary-container">
                      <Sparkles className="h-2.5 w-2.5" />
                      {override.isDayOff ? 'Day Off (this week)' : 'Custom (this week)'}
                    </span>
                  )}
                  {!hasOverride && hasShifts && (
                    <span className="text-xs text-muted-foreground">
                      {dayShifts.filter((s) => s.isActive).length} shift{dayShifts.filter((s) => s.isActive).length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hasOverride ? (
                      <>
                        <button
                          onClick={() => dayDate && setEditingDate(toInputDateStr(dayDate))}
                          title="Edit this week's customization"
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleRevertOverride(override)}
                          disabled={deleteOverrideMutation.isPending}
                          title="Remove customization — fall back to weekly pattern"
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-error/40 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Revert to Weekly
                        </button>
                      </>
                    ) : (
                      <>
                        {SHIFT_PRESETS.slice(0, 3).map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => addShift(day.value, preset)}
                            title={`Add ${preset.label} shift (${preset.start} - ${preset.end})`}
                            className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                          >
                            <preset.icon className="h-3 w-3" />
                            {preset.label}
                          </button>
                        ))}
                        <button
                          onClick={() => addShift(day.value)}
                          title="Add custom shift"
                          className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Custom
                        </button>
                        {hasShifts && (
                          <button
                            onClick={() => applyToAll(day.value)}
                            title="Copy this day's schedule to all days"
                            className="text-[10px] font-medium text-primary hover:underline ml-1"
                          >
                            Apply to all
                          </button>
                        )}
                        {dayDate && (
                          <button
                            onClick={() => setEditingDate(toInputDateStr(dayDate))}
                            title="Set a one-off shift or day-off for this specific date"
                            className="flex items-center gap-1 rounded-md border border-primary-container/40 bg-primary-container/10 px-2 py-1 text-[10px] font-semibold text-primary-container hover:bg-primary-container/20 transition-colors ml-1"
                          >
                            <Sparkles className="h-3 w-3" />
                            Customize this week
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Shift rows */}
              {hasOverride ? (
                /* ── Override preview (read-only in this view) ── */
                <div className="px-4 py-3 space-y-2">
                  {override.isDayOff ? (
                    <p className="text-xs text-muted-foreground">
                      Marked as <strong>day off</strong> for {dayDate && formatDate(dayDate)}.
                      {override.note && <span className="italic"> — {override.note}</span>}
                    </p>
                  ) : override.shifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Customized but no shifts set — effectively day off.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {override.shifts.map((s) => (
                        <div key={s.id ?? `${s.startTime}-${s.endTime}`} className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">
                              {parseTime(s.startTime)} – {parseTime(s.endTime)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {s.slotDurationMinutes} min slots
                          </span>
                          {s.maxPatients != null && (
                            <span className="text-xs text-muted-foreground">
                              · max {s.maxPatients} patients
                            </span>
                          )}
                        </div>
                      ))}
                      {override.note && (
                        <p className="text-[11px] text-muted-foreground italic pt-1">
                          Note: {override.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : dayShifts.length === 0 ? (
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground italic">No shifts — day off</p>
                </div>
              ) : (
                <div className="divide-y divide-dashed">
                  {dayShifts.map((shift) => (
                    <div
                      key={shift._key}
                      className={cn(
                        'flex flex-wrap items-center gap-3 px-4 py-2.5 transition-opacity',
                        !shift.isActive && 'opacity-40',
                      )}
                    >
                      {!readOnly && (
                        <button
                          onClick={() => updateShift(shift._key, 'isActive', !shift.isActive)}
                          className={cn(
                            'h-4 w-4 rounded border flex-shrink-0 transition-colors',
                            shift.isActive
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/40',
                          )}
                        />
                      )}

                      <div className="flex-shrink-0">
                        {parseInt(shift.startTime) < 12 ? (
                          <Sun className="h-4 w-4 text-amber-500" />
                        ) : parseInt(shift.startTime) < 18 ? (
                          <Sun className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Moon className="h-4 w-4 text-indigo-500" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">From</label>
                        {readOnly ? (
                          <span className="text-sm font-medium">{shift.startTime}</span>
                        ) : (
                          <Input
                            type="time"
                            value={shift.startTime}
                            onChange={(e) => updateShift(shift._key, 'startTime', e.target.value)}
                            className="h-8 w-[110px] text-sm"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">To</label>
                        {readOnly ? (
                          <span className="text-sm font-medium">{shift.endTime}</span>
                        ) : (
                          <Input
                            type="time"
                            value={shift.endTime}
                            onChange={(e) => updateShift(shift._key, 'endTime', e.target.value)}
                            className="h-8 w-[110px] text-sm"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {readOnly ? (
                          <span className="text-sm font-medium">{shift.slotDurationMinutes} min</span>
                        ) : (
                          <Select
                            value={String(shift.slotDurationMinutes)}
                            onValueChange={(v) => updateShift(shift._key, 'slotDurationMinutes', Number(v))}
                          >
                            <SelectTrigger className="h-8 w-[90px] text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SLOT_DURATIONS.map((d) => (
                                <SelectItem key={d.value} value={String(d.value)}>
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {!readOnly && (
                        <button
                          onClick={() => removeShift(shift._key)}
                          className="ml-auto text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                          title="Remove shift"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {shifts.filter((s) => s.isActive).length > 0 && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {DAYS.filter((d) => shifts.some((s) => s.dayOfWeek === d.value && s.isActive)).length}
            </span>
            {' '}working day{DAYS.filter((d) => shifts.some((s) => s.dayOfWeek === d.value && s.isActive)).length !== 1 ? 's' : ''}
            {' '}&middot;{' '}
            <span className="font-medium text-foreground">
              {shifts.filter((s) => s.isActive).length}
            </span>
            {' '}total shift{shifts.filter((s) => s.isActive).length !== 1 ? 's' : ''}
            {' '}in the recurring pattern
            {overrides.length > 0 && (
              <>
                {' '}&middot;{' '}
                <span className="font-medium text-foreground">
                  {overrides.length}
                </span>
                {' '}customization{overrides.length !== 1 ? 's' : ''} this week
              </>
            )}
          </p>
        </div>
      )}

      {/* Override editor modal */}
      {editingDate && (
        <ScheduleOverrideEditor
          open={true}
          onOpenChange={(v) => { if (!v) setEditingDate(null); }}
          doctorId={doctorId}
          doctorName={doctorName ?? ''}
          date={editingDate}
          existingOverride={
            overrides.find((o) => {
              const od = new Date(o.date);
              const ed = new Date(editingDate);
              return od.getUTCFullYear() === ed.getFullYear()
                && od.getUTCMonth() === ed.getMonth()
                && od.getUTCDate() === ed.getDate();
            }) ?? null
          }
          weeklySchedules={weeklySchedulesForEditor}
        />
      )}
    </div>
  );
}
