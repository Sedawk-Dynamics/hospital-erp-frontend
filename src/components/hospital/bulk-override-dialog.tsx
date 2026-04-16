'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Sun, Moon, Calendar as CalIcon } from 'lucide-react';
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
import { toInputDateStr } from '@/lib/date-utils';
import { useBulkApplyOverrides } from '@/hooks/use-schedule-overrides';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const SHIFT_PRESETS = [
  { label: 'Morning', start: '09:00', end: '13:00', icon: Sun },
  { label: 'Afternoon', start: '14:00', end: '18:00', icon: Sun },
  { label: 'Evening', start: '18:00', end: '21:00', icon: Moon },
];

const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60];

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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctorId: string;
  doctorName: string;
  defaultRange?: { fromDate: string; toDate: string };
}

export function BulkOverrideDialog({ open, onOpenChange, doctorId, doctorName, defaultRange }: Props) {
  const today = toInputDateStr();
  const [fromDate, setFromDate] = useState(defaultRange?.fromDate ?? today);
  const [toDate, setToDate] = useState(defaultRange?.toDate ?? today);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [isDayOff, setIsDayOff] = useState(false);
  const [shifts, setShifts] = useState<ShiftDraft[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);
  const [note, setNote] = useState('');

  const bulkMutation = useBulkApplyOverrides(doctorId);

  const toggleDay = (d: number) =>
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const addShift = (preset?: { start: string; end: string }) => {
    setShifts((prev) => [
      ...prev,
      {
        _key: makeKey(),
        startTime: preset?.start ?? '09:00',
        endTime: preset?.end ?? '17:00',
        slotDurationMinutes: 15,
      },
    ]);
  };

  const removeShift = (key: string) => setShifts((p) => p.filter((s) => s._key !== key));
  const updateShift = <K extends keyof ShiftDraft>(k: string, f: K, v: ShiftDraft[K]) =>
    setShifts((p) => p.map((s) => (s._key === k ? { ...s, [f]: v } : s)));

  const handleApply = async () => {
    if (toDate < fromDate) {
      toast.error('End date must be on or after start date');
      return;
    }
    if (!isDayOff && shifts.length === 0) {
      toast.error('Add at least one shift, or mark the range as day-off');
      return;
    }
    for (const s of shifts) {
      if (s.startTime >= s.endTime) {
        toast.error(`Shift ${s.startTime}-${s.endTime}: start must be before end`);
        return;
      }
    }

    try {
      const result = await bulkMutation.mutateAsync({
        fromDate,
        toDate,
        daysOfWeek: selectedDays.length === 7 ? undefined : selectedDays,
        isDayOff,
        note: note.trim() || undefined,
        skipExisting,
        shifts: isDayOff
          ? []
          : shifts.map(({ _key, maxPatients, ...rest }) => ({
              ...rest,
              slotDurationMinutes: rest.slotDurationMinutes || 15,
              ...(maxPatients && maxPatients > 0 ? { maxPatients } : {}),
            })),
      });
      const { created, updated, skipped, totalDates } = result as any;
      toast.success(
        `Applied to ${totalDates ?? created + updated} dates — created ${created}, updated ${updated}${skipped ? `, skipped ${skipped}` : ''}`,
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Bulk apply failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Apply Schedule</DialogTitle>
          <DialogDescription>
            Apply the same schedule (or mark day-off) across a date range. Affects {doctorName} only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-from">From</Label>
              <Input
                id="bulk-from"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value > toDate) setToDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-to">To</Label>
              <Input
                id="bulk-to"
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* Day-of-week filter */}
          <div className="space-y-1.5">
            <Label>Apply to days of week</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    selectedDays.includes(d.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {selectedDays.length === 0
                ? 'Select at least one day.'
                : selectedDays.length === 7
                  ? 'All days selected.'
                  : `${selectedDays.length} day(s) selected — applies only on these days.`}
            </p>
          </div>

          {/* Day-off toggle */}
          <div className="rounded-lg border px-3 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Mark all matching dates as Day Off</p>
              <p className="text-xs text-muted-foreground">No shifts are generated.</p>
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

          {/* Shifts */}
          {!isDayOff && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Shifts</Label>
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
                  <p className="text-xs text-muted-foreground">Add shifts with the buttons above.</p>
                </div>
              ) : (
                <div className="rounded-lg border divide-y">
                  {shifts.map((s) => (
                    <div key={s._key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <Input
                        type="time"
                        value={s.startTime}
                        onChange={(e) => updateShift(s._key, 'startTime', e.target.value)}
                        className="h-8 w-[110px] text-sm"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={s.endTime}
                        onChange={(e) => updateShift(s._key, 'endTime', e.target.value)}
                        className="h-8 w-[110px] text-sm"
                      />
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

          {/* Skip existing */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm">Skip dates that already have a custom override</p>
              <p className="text-[11px] text-muted-foreground">
                Uncheck to overwrite existing overrides in the range.
              </p>
            </div>
          </label>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-note">Note (optional)</Label>
            <Textarea
              id="bulk-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bulkMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={bulkMutation.isPending || selectedDays.length === 0}>
            {bulkMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…</>
            ) : (
              <><CalIcon className="mr-2 h-4 w-4" /> Apply to Range</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
