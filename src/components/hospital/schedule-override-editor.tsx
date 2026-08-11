'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Sun, Moon, Sparkles, AlertCircle, Calendar as CalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/date-utils';
import type { ScheduleOverride } from '@/hooks/use-schedule-overrides';
import {
  useUpsertScheduleOverride,
  useDeleteScheduleOverride,
} from '@/hooks/use-schedule-overrides';
import type { DoctorScheduleEntry } from '@/hooks/use-doctor-schedule';

const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60];

const SHIFT_PRESETS = [
  { label: 'Morning', start: '09:00', end: '13:00', icon: Sun },
  { label: 'Afternoon', start: '14:00', end: '18:00', icon: Sun },
  { label: 'Evening', start: '18:00', end: '21:00', icon: Moon },
];

interface ShiftDraft {
  _key: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPatients?: number;
}

function makeKey() {
  return Math.random().toString(36).slice(2, 9);
}

function parseUtcTime(value: string | null | undefined): string {
  if (!value) return '09:00';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return '09:00';
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctorId: string;
  doctorName: string;
  /** Pre-selected date (yyyy-MM-dd) */
  date: string;
  /** Existing override for this date, if any */
  existingOverride: ScheduleOverride | null;
  /** Weekly recurring shifts (for "copy from weekly" button) */
  weeklySchedules: DoctorScheduleEntry[];
}

export function ScheduleOverrideEditor({
  open, onOpenChange, doctorId, doctorName, date, existingOverride, weeklySchedules,
}: Props) {
  const [isDayOff, setIsDayOff] = useState(false);
  const [shifts, setShifts] = useState<ShiftDraft[]>([]);
  const [note, setNote] = useState('');

  const upsertMutation = useUpsertScheduleOverride(doctorId);
  const deleteMutation = useDeleteScheduleOverride();

  useEffect(() => {
    if (!open) return;

    if (existingOverride) {
      setIsDayOff(existingOverride.isDayOff);
      setNote(existingOverride.note ?? '');
      setShifts(
        existingOverride.shifts.map((s) => ({
          _key: makeKey(),
          startTime: parseUtcTime(s.startTime),
          endTime: parseUtcTime(s.endTime),
          slotDurationMinutes: s.slotDurationMinutes,
          maxPatients: s.maxPatients ?? undefined,
        })),
      );
    } else {
      setIsDayOff(false);
      setNote('');
      setShifts([]);
    }
  }, [open, existingOverride]);

  const addShift = (preset?: { start: string; end: string }) => {
    setShifts((prev) => [
      ...prev,
      {
        _key: makeKey(),
        startTime: preset?.start ?? '09:00',
        endTime: preset?.end ?? '17:00',
        slotDurationMinutes: 15,
        maxPatients: undefined,
      },
    ]);
  };

  const removeShift = (key: string) =>
    setShifts((prev) => prev.filter((s) => s._key !== key));

  const updateShift = <K extends keyof ShiftDraft>(key: string, field: K, value: ShiftDraft[K]) =>
    setShifts((prev) => prev.map((s) => (s._key === key ? { ...s, [field]: value } : s)));

  const copyFromWeekly = () => {
    const dow = new Date(date).getDay();
    const weekly = weeklySchedules.filter((s) => s.dayOfWeek === dow && s.isActive);
    if (weekly.length === 0) {
      toast.info('No weekly shifts configured for this day of the week');
      return;
    }
    setShifts(
      weekly.map((s) => ({
        _key: makeKey(),
        startTime: parseUtcTime(s.startTime),
        endTime: parseUtcTime(s.endTime),
        slotDurationMinutes: s.slotDurationMinutes ?? 15,
        maxPatients: s.maxPatients ?? undefined,
      })),
    );
    setIsDayOff(false);
  };

  const handleSave = async () => {
    if (!isDayOff && shifts.length === 0) {
      toast.error('Add at least one shift, or mark the day off');
      return;
    }
    for (const s of shifts) {
      if (s.startTime >= s.endTime) {
        toast.error(`Shift ${s.startTime}-${s.endTime}: start time must be before end time`);
        return;
      }
    }
    try {
      await upsertMutation.mutateAsync({
        date,
        isDayOff,
        note: note.trim() || undefined,
        shifts: isDayOff
          ? []
          : shifts.map(({ _key, ...rest }) => ({
              startTime: rest.startTime,
              endTime: rest.endTime,
              slotDurationMinutes: rest.slotDurationMinutes || 15,
              ...(rest.maxPatients && rest.maxPatients > 0 ? { maxPatients: rest.maxPatients } : {}),
            })),
      });
      toast.success('Schedule override saved');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save override');
    }
  };

  const handleRevert = async () => {
    if (!existingOverride) return;
    if (!confirm(`Revert ${formatDate(date)} back to the weekly recurring schedule?`)) return;
    try {
      await deleteMutation.mutateAsync(existingOverride.id);
      toast.success('Reverted to weekly schedule');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to revert');
    }
  };

  const dow = new Date(date).getDay();
  const dayName = new Date(date).toLocaleDateString(undefined, { weekday: 'long' });
  const weeklyForThisDay = weeklySchedules.filter((s) => s.dayOfWeek === dow && s.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            Edit schedule — {formatDate(date)}
          </DialogTitle>
          <DialogDescription>
            {dayName} · {doctorName}. Changes here override the weekly recurring schedule for this date only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Weekly baseline hint */}
          {weeklyForThisDay.length > 0 && !existingOverride && (
            <div className="rounded-lg border border-dashed px-3 py-2 flex items-start gap-2 text-xs">
              <CalIcon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-muted-foreground">
                  Weekly default for {dayName}: {' '}
                  <span className="font-medium text-foreground">
                    {weeklyForThisDay
                      .map((s) => `${parseUtcTime(s.startTime)}–${parseUtcTime(s.endTime)}`)
                      .join(', ')}
                  </span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={copyFromWeekly}>
                Copy weekly
              </Button>
            </div>
          )}

          {/* Day-off toggle */}
          <div className="rounded-lg border px-3 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Mark as Day Off</p>
              <p className="text-xs text-muted-foreground">
                Blocks all patient booking for this date.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDayOff(!isDayOff)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                isDayOff ? 'bg-red-500' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                  isDayOff ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {/* Shifts (hidden when day off) */}
          {!isDayOff && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Shifts for this date</Label>
                <div className="flex items-center gap-1">
                  {SHIFT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => addShift({ start: p.start, end: p.end })}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40"
                    >
                      <p.icon className="h-3 w-3" />
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addShift()}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" /> Custom
                  </button>
                </div>
              </div>

              {shifts.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No shifts yet — add at least one, or mark the day off.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border divide-y">
                  {shifts.map((s) => (
                    <div key={s._key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
                        <Input
                          type="time"
                          value={s.startTime}
                          onChange={(e) => updateShift(s._key, 'startTime', e.target.value)}
                          className="h-8 w-[110px] text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
                        <Input
                          type="time"
                          value={s.endTime}
                          onChange={(e) => updateShift(s._key, 'endTime', e.target.value)}
                          className="h-8 w-[110px] text-sm"
                        />
                      </div>
                      <Select
                        value={String(s.slotDurationMinutes)}
                        onValueChange={(v) => updateShift(s._key, 'slotDurationMinutes', Number(v) || 15)}
                      >
                        <SelectTrigger className="h-8 w-[110px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SLOT_DURATIONS.map((d) => (
                            <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Max pt."
                        value={s.maxPatients ?? ''}
                        onChange={(e) => updateShift(s._key, 'maxPatients', e.target.value ? Number(e.target.value) : undefined)}
                        className="h-8 w-[90px] text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeShift(s._key)}
                        className="ml-auto text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ovr-note">Note (optional)</Label>
            <Textarea
              id="ovr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g. Covering for Dr. Smith, clinic moved to annexe"
              rows={2}
              maxLength={500}
            />
          </div>

          {existingOverride && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2 text-xs">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
              <span className="text-amber-800">
                An override exists for this date. Saving replaces it. Use &quot;Revert to Weekly&quot; to remove the override entirely.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {existingOverride && (
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-700 mr-auto"
              onClick={handleRevert}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reverting…</>
              ) : (
                'Revert to Weekly'
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upsertMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              'Save Override'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
