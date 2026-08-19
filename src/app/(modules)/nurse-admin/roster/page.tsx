'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useDutyRosters,
  useCreateDutyRostersBulk,
  useUpdateDutyRoster,
  useRosterCoverage,
  useActiveRoster,
  type DutyRoster,
} from '@/hooks/use-duty-rosters';
import { useWards } from '@/hooks/use-clinical';
import { useUsersList, type UserListItem } from '@/hooks/use-users';
import { NursePicker } from '@/components/nurse-admin/nurse-picker';

const SHIFTS = ['morning', 'afternoon', 'night'] as const;
type Shift = (typeof SHIFTS)[number];

const NURSE_ROLES = ['nurse', 'nurse_admin'] as const;

const SHIFT_TIMES: Record<Shift, { start: string; end: string; label: string }> = {
  morning: { start: '07:00', end: '15:00', label: 'Morning' },
  afternoon: { start: '15:00', end: '23:00', label: 'Afternoon' },
  night: { start: '23:00', end: '07:00', label: 'Night' },
};

function isNursingUser(u: UserListItem): boolean {
  const names = u.userRoles?.map((r) => r.role.name) ?? [];
  return NURSE_ROLES.some((r) => (names as string[]).includes(r));
}

function expandDates(fromIso: string, toIso: string, weekdays: Set<number>): string[] {
  const start = parseISO(fromIso);
  const end = parseISO(toIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (weekdays.has(d.getDay())) dates.push(format(d, 'yyyy-MM-dd'));
  }
  return dates;
}

const WEEKDAY_LABELS: { day: number; short: string }[] = [
  { day: 1, short: 'Mon' },
  { day: 2, short: 'Tue' },
  { day: 3, short: 'Wed' },
  { day: 4, short: 'Thu' },
  { day: 5, short: 'Fri' },
  { day: 6, short: 'Sat' },
  { day: 0, short: 'Sun' },
];

export default function RosterPlanningPage() {
  const [weekStartIso, setWeekStartIso] = useState<string>(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  );
  const [staffFilterUserId, setStaffFilterUserId] = useState<string>('');

  const weekStart = parseISO(weekStartIso);
  const weekEnd = addDays(weekStart, 6);
  const fromDate = format(weekStart, 'yyyy-MM-dd');
  const toDate = format(weekEnd, 'yyyy-MM-dd');

  const { data, isLoading } = useDutyRosters({
    fromDate,
    toDate,
    userId: staffFilterUserId || undefined,
    limit: 500,
  });
  // Only nursing rosters belong here. Cancelled shifts are filtered out so
  // the grid matches the coverage rollup (which also excludes cancelled).
  const rosters = useMemo(() => {
    return (data?.items ?? []).filter(
      (r) =>
        r.status !== 'cancelled' &&
        (!r.role || (NURSE_ROLES as readonly string[]).includes(r.role)),
    );
  }, [data]);

  // Currently-being-edited shift (clicking a chip opens the edit dialog).
  const [editTarget, setEditTarget] = useState<DutyRoster | null>(null);

  const byDateAndShift = useMemo(() => {
    const map = new Map<string, DutyRoster[]>();
    for (const r of rosters) {
      const key = `${r.shiftDate.slice(0, 10)}|${r.shiftType}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [rosters]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Coverage rollup for the visible week (count distinct staff per cell).
  const { data: coverageData } = useRosterCoverage({ fromDate, toDate });
  const coverageMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of coverageData?.coverage ?? []) {
      map.set(`${c.shiftDate}|${c.shiftType}`, c.rostered);
    }
    return map;
  }, [coverageData]);

  // Live shift highlight.
  const { data: activeData } = useActiveRoster();
  const activeKey = useMemo(() => {
    const e = activeData?.entries?.[0];
    return e ? `${e.shiftDate.slice(0, 10)}|${e.shiftType}` : null;
  }, [activeData]);

  // Cells with zero coverage — surfaced as a callout.
  const gaps = useMemo(() => {
    const out: { dateIso: string; shift: Shift }[] = [];
    for (const d of days) {
      const dateIso = format(d, 'yyyy-MM-dd');
      for (const s of SHIFTS) {
        const count = coverageMap.get(`${dateIso}|${s}`) ?? 0;
        if (count === 0) out.push({ dateIso, shift: s });
      }
    }
    return out;
  }, [coverageMap, days]);

  // Picker source.
  const { data: usersRes } = useUsersList({ limit: 500, isActive: 'true' });
  const nursingUsers = useMemo(
    () => ((usersRes?.data ?? []) as UserListItem[]).filter(isNursingUser),
    [usersRes],
  );

  const goPrevWeek = () => setWeekStartIso(format(addDays(weekStart, -7), 'yyyy-MM-dd'));
  const goNextWeek = () => setWeekStartIso(format(addDays(weekStart, 7), 'yyyy-MM-dd'));
  const goThisWeek = () =>
    setWeekStartIso(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Nursing Roster</h1>
          <p className="text-sm text-muted-foreground">
            Plan nurses by shift. Entries publish instantly and drive nurses&apos; dashboards
            and handover flow.
          </p>
        </div>
        <AddRosterDialog users={nursingUsers} />
      </div>

      {gaps.length > 0 && !staffFilterUserId ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span className="font-medium">Coverage gaps ({gaps.length})</span> — no nurses for:{' '}
          {gaps.slice(0, 6).map((g, i) => (
            <span key={`${g.dateIso}-${g.shift}`} className="whitespace-nowrap">
              {format(parseISO(g.dateIso), 'EEE dd/MM')} {g.shift}
              {i < Math.min(gaps.length, 6) - 1 ? ', ' : ''}
            </span>
          ))}
          {gaps.length > 6 ? <> +{gaps.length - 6} more</> : null}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goThisWeek}>
              This week
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Week starting</Label>
            <Input
              type="date"
              value={weekStartIso}
              onChange={(e) => setWeekStartIso(e.target.value)}
              className="mt-1 h-8 w-40 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Filter by nurse</Label>
            <NursePicker
              users={nursingUsers}
              value={staffFilterUserId}
              onChange={setStaffFilterUserId}
              placeholder="All nurses"
              clearable
              className="mt-1 w-56"
              triggerSize="sm"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {format(weekStart, 'dd/MM')} – {format(weekEnd, 'dd/MM/yyyy')}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading roster…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="p-2 text-left font-medium">Shift</th>
                    {days.map((d) => (
                      <th key={d.toISOString()} className="p-2 text-left font-medium">
                        {format(d, 'EEE dd/MM')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHIFTS.map((s) => (
                    <tr key={s} className="border-b align-top">
                      <td className="w-28 p-2 text-xs font-medium text-muted-foreground">
                        <div className="capitalize">{SHIFT_TIMES[s].label}</div>
                        <div className="text-[10px] opacity-70">
                          {SHIFT_TIMES[s].start}–{SHIFT_TIMES[s].end}
                        </div>
                      </td>
                      {days.map((d) => {
                        const key = `${format(d, 'yyyy-MM-dd')}|${s}`;
                        const entries = byDateAndShift.get(key) ?? [];
                        const rostered = coverageMap.get(key) ?? 0;
                        const isActive = activeKey === key;
                        return (
                          <td
                            key={key}
                            className={`min-w-36 p-2 ${
                              entries.length === 0
                                ? 'bg-rose-50/40'
                                : isActive
                                  ? 'bg-emerald-50/60 ring-1 ring-emerald-200'
                                  : ''
                            }`}
                          >
                            {entries.length === 0 ? (
                              <div className="text-[11px] italic text-rose-700">No coverage</div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {rostered} rostered
                                  {isActive ? (
                                    <span className="ml-1 rounded bg-emerald-200/70 px-1 py-0.5 text-[9px] font-semibold text-emerald-800">
                                      LIVE
                                    </span>
                                  ) : null}
                                </div>
                                {entries.map((r) => (
                                  <RosterChip
                                    key={r.id}
                                    r={r}
                                    onClick={() => setEditTarget(r)}
                                  />
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog opens when admin clicks a chip on the grid. */}
      <EditShiftDialog target={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}

function RosterChip({ r, onClick }: { r: DutyRoster; onClick: () => void }) {
  const name = r.staff?.user
    ? `${r.staff.user.firstName} ${r.staff.user.lastName ?? ''}`.trim()
    : 'Staff';
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-left text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-100"
      title="Click to edit or cancel this shift"
    >
      <div className="font-medium">{name}</div>
      {r.ward?.name ? (
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {r.ward.name}
        </div>
      ) : null}
    </button>
  );
}

// ── Add Roster Dialog ─────────────────────────────────────────

function AddRosterDialog({ users }: { users: UserListItem[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [wardId, setWardId] = useState('');
  const [shift, setShift] = useState<Shift>('morning');
  const [startTime, setStartTime] = useState(SHIFT_TIMES.morning.start);
  const [endTime, setEndTime] = useState(SHIFT_TIMES.morning.end);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 0]));

  const { data: wards = [] } = useWards();
  const bulkMut = useCreateDutyRostersBulk();

  const dates = useMemo(
    () => expandDates(fromDate, toDate, weekdays),
    [fromDate, toDate, weekdays],
  );
  const isRange = fromDate !== toDate;

  function changeShift(value: Shift) {
    setShift(value);
    setStartTime(SHIFT_TIMES[value].start);
    setEndTime(SHIFT_TIMES[value].end);
  }

  function toggleWeekday(day: number) {
    setWeekdays((cur) => {
      const next = new Set(cur);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function reset() {
    setUserId('');
    setWardId('');
    setShift('morning');
    setStartTime(SHIFT_TIMES.morning.start);
    setEndTime(SHIFT_TIMES.morning.end);
    setFromDate(today);
    setToDate(today);
    setWeekdays(new Set([1, 2, 3, 4, 5, 6, 0]));
  }

  async function handleSave() {
    if (!userId) {
      toast.error('Pick a nurse first');
      return;
    }
    if (dates.length === 0) {
      toast.error('Pick a date (or range with at least one matching weekday)');
      return;
    }
    try {
      const entries = dates.map((shiftDate) => ({
        userId,
        wardId: wardId || undefined,
        shiftDate,
        shiftType: shift,
        startTime,
        endTime,
      }));
      const res = await bulkMut.mutateAsync(entries);
      const created = res?.created?.length ?? 0;
      const skipped = res?.skipped?.length ?? 0;
      toast.success(
        skipped > 0
          ? `Added ${created} shifts (${skipped} duplicates skipped)`
          : `Added ${created} shift${created === 1 ? '' : 's'}`,
      );
      setOpen(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add';
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add shift
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add nursing shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nurse *</Label>
            <NursePicker
              users={users}
              value={userId}
              onChange={setUserId}
              placeholder="Search nurse"
              rolesShown={NURSE_ROLES as unknown as string[]}
              clearable
              className="mt-1 w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  // Keep "to" sane.
                  if (parseISO(e.target.value) > parseISO(toDate)) setToDate(e.target.value);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {isRange ? (
            <div>
              <Label className="text-xs">Days of week</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {WEEKDAY_LABELS.map(({ day, short }) => {
                  const active = weekdays.has(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`rounded-md border px-2.5 py-1 text-xs ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {dates.length} shift{dates.length === 1 ? '' : 's'} will be created. Duplicates
                are skipped.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Shift</Label>
              <Select
                value={shift}
                onValueChange={(value) => {
                  if (value) changeShift(value as Shift);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SHIFT_TIMES[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Start</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Ward (optional)</Label>
            <Select
              value={wardId || null}
              onValueChange={(value) => setWardId(value ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="No ward">
                  {(value) => {
                    if (!value) return 'No ward';
                    const w = wards.find((x) => x.id === value);
                    return w ? w.name : 'No ward';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No ward</SelectItem>
                {wards.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={bulkMut.isPending || !userId || dates.length === 0}>
            {bulkMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {dates.length > 1 ? `Add ${dates.length} shifts` : 'Add shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Shift Dialog ─────────────────────────────────────────

function fmtTimeFromIso(iso: string): string {
  // Roster time columns are stored against 1970-01-01 in UTC.
  const d = new Date(iso);
  if (d.getUTCFullYear() === 1970) {
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  return format(d, 'HH:mm');
}

function EditShiftDialog({
  target,
  onClose,
}: {
  target: DutyRoster | null;
  onClose: () => void;
}) {
  const updateMut = useUpdateDutyRoster();
  const { data: wards = [] } = useWards();

  const [shift, setShift] = useState<Shift>('morning');
  const [shiftDate, setShiftDate] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [wardId, setWardId] = useState<string>('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Reload form fields whenever a new chip is opened.
  useEffect(() => {
    if (!target) return;
    const t = (SHIFTS as readonly string[]).includes(target.shiftType)
      ? (target.shiftType as Shift)
      : 'morning';
    setShift(t);
    setShiftDate(target.shiftDate.slice(0, 10));
    setStartTime(fmtTimeFromIso(target.startTime));
    setEndTime(fmtTimeFromIso(target.endTime));
    setWardId(target.wardId ?? '');
    setConfirmCancel(false);
  }, [target]);

  function changeShift(value: Shift) {
    setShift(value);
    // Don't auto-overwrite start/end here — the admin may have already set
    // custom times. Suggest defaults via placeholder behaviour instead.
  }

  async function handleSave() {
    if (!target) return;
    try {
      await updateMut.mutateAsync({
        id: target.id,
        shiftDate,
        shiftType: shift,
        startTime,
        endTime,
        wardId: wardId || undefined,
      });
      toast.success('Shift updated');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    }
  }

  async function handleCancelShift() {
    if (!target) return;
    try {
      await updateMut.mutateAsync({ id: target.id, status: 'cancelled' });
      toast.success('Shift cancelled');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel';
      toast.error(msg);
    }
  }

  const open = target !== null;
  const staffName = target?.staff?.user
    ? `${target.staff.user.firstName} ${target.staff.user.lastName ?? ''}`.trim()
    : 'Nurse';

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit shift · {staffName}</DialogTitle>
        </DialogHeader>
        {target ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Shift</Label>
                <Select
                  value={shift}
                  onValueChange={(value) => {
                    if (value) changeShift(value as Shift);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SHIFT_TIMES[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">End</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Ward (optional)</Label>
              <Select
                value={wardId || null}
                onValueChange={(value) => setWardId(value ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No ward">
                    {(value) => {
                      if (!value) return 'No ward';
                      const w = wards.find((x) => x.id === value);
                      return w ? w.name : 'No ward';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No ward</SelectItem>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {confirmCancel ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                Cancelling removes this shift from the roster. The nurse will no longer see it
                on their schedule.
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmCancel(false)}
                    disabled={updateMut.isPending}
                  >
                    Keep shift
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleCancelShift}
                    disabled={updateMut.isPending}
                  >
                    {updateMut.isPending ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Confirm cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          {!confirmCancel ? (
            <Button
              variant="outline"
              className="mr-auto gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() => setConfirmCancel(true)}
              disabled={updateMut.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Cancel shift
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={updateMut.isPending}>
            Close
          </Button>
          {!confirmCancel ? (
            <Button onClick={handleSave} disabled={updateMut.isPending}>
              {updateMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
