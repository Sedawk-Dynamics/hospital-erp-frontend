'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useDoctorProfileWithSchedules,
  useUpdateDoctorSchedule,
  useUpdateDoctorProfile,
  type DoctorScheduleEntry,
} from '@/hooks/use-doctor-schedule';

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

/**
 * Parse a time value from the API.
 * Prisma @db.Time() serializes as "1970-01-01T09:00:00.000Z".
 * We need "HH:MM" for <input type="time">.
 */
function parseTime(value: string): string {
  if (!value) return '09:00';
  // Already HH:MM
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  // ISO datetime — extract UTC hours/minutes
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
    maxPatients: e.maxPatients ?? undefined, // Prisma returns null → convert to undefined
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

  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [consultationFee, setConsultationFee] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  // Sync from API on load
  useEffect(() => {
    if (profile?.schedules) {
      setShifts(fromApi(profile.schedules));
      setDirty(false);
    }
    if (profile?.consultationFee !== undefined) {
      setConsultationFee(profile.consultationFee != null ? String(profile.consultationFee) : '');
    }
  }, [profile]);

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
      // Toggle all shifts for this day
      const allActive = dayShifts.every((s) => s.isActive);
      setShifts((prev) =>
        prev.map((s) =>
          s.dayOfWeek === dayOfWeek ? { ...s, isActive: !allActive } : s,
        ),
      );
    } else {
      // Add a default shift for this day
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

    // Validate
    for (const s of activeShifts) {
      if (s.startTime >= s.endTime) {
        const dayName = DAYS.find((d) => d.value === s.dayOfWeek)?.label;
        toast.error(`${dayName}: Start time must be before end time`);
        return;
      }
    }

    try {
      // Save fee if changed
      const newFee = consultationFee ? Number(consultationFee) : 0;
      const currentFee = profile?.consultationFee ?? 0;
      if (newFee !== currentFee) {
        await updateProfileMutation.mutateAsync({ consultationFee: newFee });
      }

      // Save schedule
      await updateMutation.mutateAsync(toApi(activeShifts));
      setDirty(false);
      toast.success('Schedule & fee saved successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    }
  }, [shifts, consultationFee, profile, updateMutation, updateProfileMutation]);

  // ── Render ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            Save Schedule
          </Button>
        )}
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

          return (
            <div
              key={day.value}
              className={cn(
                'rounded-xl border bg-card transition-colors',
                allActive && hasShifts ? 'border-primary/30' : '',
              )}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-dashed">
                <div className="flex items-center gap-3">
                  {!readOnly && (
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
                  <span className={cn(
                    'text-sm font-semibold',
                    allActive && hasShifts ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {day.label}
                  </span>
                  {hasShifts && (
                    <span className="text-xs text-muted-foreground">
                      {dayShifts.filter((s) => s.isActive).length} shift{dayShifts.filter((s) => s.isActive).length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1.5">
                    {/* Shift presets */}
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
                    {hasShifts && dayShifts.length > 0 && (
                      <button
                        onClick={() => applyToAll(day.value)}
                        title="Copy this day's schedule to all days"
                        className="text-[10px] font-medium text-primary hover:underline ml-1"
                      >
                        Apply to all
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Shift rows */}
              {dayShifts.length === 0 ? (
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
                      {/* Active toggle */}
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

                      {/* Shift icon */}
                      <div className="flex-shrink-0">
                        {parseInt(shift.startTime) < 12 ? (
                          <Sun className="h-4 w-4 text-amber-500" />
                        ) : parseInt(shift.startTime) < 18 ? (
                          <Sun className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Moon className="h-4 w-4 text-indigo-500" />
                        )}
                      </div>

                      {/* Start time */}
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

                      {/* End time */}
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

                      {/* Slot duration */}
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

                      {/* Remove */}
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
          </p>
        </div>
      )}
    </div>
  );
}
