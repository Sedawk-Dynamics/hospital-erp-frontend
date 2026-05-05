'use client';

import { useMemo, useState } from 'react';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  useCreateDutyRoster,
  useCreateDutyRostersBulk,
  type CreateRosterInput,
  type DutyRoster,
  type DutyRosterStatus,
} from '@/hooks/use-duty-rosters';
import { useWards } from '@/hooks/use-clinical';
import { useUsersList, type UserListItem } from '@/hooks/use-users';

const SHIFTS = ['morning', 'afternoon', 'night', 'general'] as const;
type Shift = (typeof SHIFTS)[number];

// Nurse-admin scope: this page only schedules nursing staff. Other roles'
// rosters live in the HR module.
const NURSE_ROLES = ['nurse', 'nurse_admin'] as const;
type NurseRole = (typeof NURSE_ROLES)[number];

const ROLE_LABEL: Record<string, string> = {
  nurse: 'Nurse',
  nurse_admin: 'Nurse admin',
};

const SHIFT_DEFAULT_TIMES: Record<Shift, { start: string; end: string }> = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
  general: { start: '09:00', end: '17:00' },
};

// Date.getDay(): 0 = Sunday … 6 = Saturday. Stored as a Set of numbers.
const WEEKDAY_LABELS: { day: number; short: string }[] = [
  { day: 1, short: 'Mon' },
  { day: 2, short: 'Tue' },
  { day: 3, short: 'Wed' },
  { day: 4, short: 'Thu' },
  { day: 5, short: 'Fri' },
  { day: 6, short: 'Sat' },
  { day: 0, short: 'Sun' },
];

function expandDates(fromIso: string, toIso: string, weekdays: Set<number>): string[] {
  const start = parseISO(fromIso);
  const end = parseISO(toIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (weekdays.has(d.getDay())) {
      dates.push(format(d, 'yyyy-MM-dd'));
    }
  }
  return dates;
}

function roleLabel(role?: string | null) {
  if (!role) return '—';
  return ROLE_LABEL[role] ?? role;
}


export default function RosterPlanningPage() {
  const [weekStartIso, setWeekStartIso] = useState<string>(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  );
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const weekStart = parseISO(weekStartIso);
  const weekEnd = addDays(weekStart, 6);
  const fromDate = format(weekStart, 'yyyy-MM-dd');
  const toDate = format(weekEnd, 'yyyy-MM-dd');

  const { data, isLoading } = useDutyRosters({
    fromDate,
    toDate,
    role: roleFilter === 'all' ? undefined : roleFilter,
    limit: 500,
  });
  // Nurse-admin only owns nursing rosters; ignore any rows tagged with other
  // roles even if they leak through the unfiltered query.
  const rosters = useMemo(() => {
    const items = data?.items ?? [];
    if (roleFilter !== 'all') return items;
    return items.filter((r) => !r.role || (NURSE_ROLES as readonly string[]).includes(r.role));
  }, [data, roleFilter]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Nursing Roster Planning</h1>
          <p className="text-sm text-muted-foreground">
            Weekly nursing shift roster. Entries are published immediately and visible to bedside
            nurses. Other roles' rosters are managed in HR.
          </p>
        </div>
        <CreateRosterDialog />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="week" className="text-xs font-medium text-muted-foreground">
              Week starting
            </Label>
            <Input
              id="week"
              type="date"
              value={weekStartIso}
              onChange={(e) => setWeekStartIso(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Role</Label>
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                if (value) setRoleFilter(value);
              }}
            >
              <SelectTrigger className="mt-1 w-48">
                <SelectValue>
                  {(value) => {
                    if (!value || value === 'all') return 'All nursing';
                    return ROLE_LABEL[value as string] ?? (value as string);
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All nursing</SelectItem>
                {NURSE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {format(weekStart, 'dd/MM')} – {format(weekEnd, 'dd/MM/yyyy')}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading rosters…
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
                      <td className="p-2 text-xs font-medium capitalize text-muted-foreground">
                        {s}
                      </td>
                      {days.map((d) => {
                        const key = `${format(d, 'yyyy-MM-dd')}|${s}`;
                        const entries = byDateAndShift.get(key) ?? [];
                        return (
                          <td key={key} className="min-w-40 p-2">
                            {entries.length === 0 ? (
                              <div className="text-xs italic text-muted-foreground">—</div>
                            ) : (
                              <div className="space-y-1">
                                {entries.map((r) => (
                                  <RosterChip key={r.id} r={r} />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All entries this week</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rosters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No rosters yet for this week.
                  </TableCell>
                </TableRow>
              ) : (
                rosters.map((r) => {
                  const staffName = r.staff?.user
                    ? `${r.staff.user.firstName} ${r.staff.user.lastName ?? ''}`.trim()
                    : '—';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {format(parseISO(r.shiftDate), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{r.shiftType}</TableCell>
                      <TableCell className="text-sm">{staffName}</TableCell>
                      <TableCell className="text-sm">{roleLabel(r.role)}</TableCell>
                      <TableCell className="text-sm">{r.department?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{r.ward?.name ?? '—'}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RosterChip({ r }: { r: DutyRoster }) {
  const staffName = r.staff?.user
    ? `${r.staff.user.firstName} ${r.staff.user.lastName ?? ''}`.trim()
    : 'Staff';
  return (
    <div
      className={`rounded-md border px-1.5 py-1 text-xs ${
        r.status === 'cancelled'
          ? 'border-muted bg-muted/40'
          : r.status === 'completed'
            ? 'border-primary/20 bg-primary/10'
            : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <div className="font-medium">{staffName}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {roleLabel(r.role)}
        {r.ward?.name ? ` · ${r.ward.name}` : ''}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DutyRosterStatus }) {
  const styles: Record<DutyRosterStatus, string> = {
    scheduled: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-primary/10 text-primary',
    swapped: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="secondary" className={styles[status]}>
      {status}
    </Badge>
  );
}

function primaryNursingRoleOf(u: UserListItem): NurseRole | undefined {
  const names = u.userRoles?.map((r) => r.role.name) ?? [];
  return NURSE_ROLES.find((opt) => names.includes(opt));
}

function isNursingUser(u: UserListItem): boolean {
  return primaryNursingRoleOf(u) !== undefined;
}

function CreateRosterDialog() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [form, setForm] = useState({
    userId: '',
    wardId: '',
    role: 'nurse',
    shiftDate: today,
    rangeFrom: today,
    rangeTo: format(addDays(new Date(), 6), 'yyyy-MM-dd'),
    weekdays: new Set<number>([1, 2, 3, 4, 5, 6, 0]),
    shiftType: 'morning' as Shift,
    startTime: SHIFT_DEFAULT_TIMES.morning.start,
    endTime: SHIFT_DEFAULT_TIMES.morning.end,
  });

  const { data: usersRes, isLoading: usersLoading } = useUsersList({
    limit: 500,
    isActive: 'true',
  });
  const users = useMemo(
    () => ((usersRes?.data ?? []) as UserListItem[]).filter(isNursingUser),
    [usersRes],
  );
  const { data: wards = [] } = useWards();

  const createMut = useCreateDutyRoster();
  const bulkMut = useCreateDutyRostersBulk();
  const isPending = createMut.isPending || bulkMut.isPending;

  const expandedDates = useMemo(
    () => (mode === 'range' ? expandDates(form.rangeFrom, form.rangeTo, form.weekdays) : []),
    [mode, form.rangeFrom, form.rangeTo, form.weekdays],
  );

  function toggleWeekday(day: number) {
    setForm((f) => {
      const next = new Set(f.weekdays);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...f, weekdays: next };
    });
  }

  function resetForm() {
    setForm((f) => ({ ...f, userId: '', wardId: '' }));
  }

  async function handleSave() {
    if (!form.userId) {
      toast.error('Please select a staff member');
      return;
    }

    const baseEntry: Omit<CreateRosterInput, 'shiftDate'> = {
      userId: form.userId,
      wardId: form.wardId || undefined,
      role: form.role || undefined,
      shiftType: form.shiftType,
      startTime: form.startTime,
      endTime: form.endTime,
    };

    try {
      if (mode === 'single') {
        await createMut.mutateAsync({ ...baseEntry, shiftDate: form.shiftDate });
        toast.success('Roster entry added');
      } else {
        if (form.weekdays.size === 0) {
          toast.error('Pick at least one weekday');
          return;
        }
        if (expandedDates.length === 0) {
          toast.error('Date range produced no shifts — check the dates and weekdays');
          return;
        }
        const entries = expandedDates.map((d) => ({ ...baseEntry, shiftDate: d }));
        const result = await bulkMut.mutateAsync(entries);
        const created = result?.created?.length ?? 0;
        const skipped = result?.skipped?.length ?? 0;
        toast.success(
          skipped > 0
            ? `Created ${created} roster entries (${skipped} skipped — likely duplicates)`
            : `Created ${created} roster entries`,
        );
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create roster entry';
      toast.error(msg);
    }
  }

  function onUserChange(userId: string) {
    const u = users.find((x) => x.id === userId);
    const inferredRole = u ? primaryNursingRoleOf(u) : undefined;
    setForm((f) => ({
      ...f,
      userId,
      role: inferredRole ?? 'nurse',
    }));
  }

  function onShiftChange(value: Shift) {
    const def = SHIFT_DEFAULT_TIMES[value];
    setForm((f) => ({ ...f, shiftType: value, startTime: def.start, endTime: def.end }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add roster entry
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add roster entry</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Staff</Label>
            <Select
              value={form.userId || null}
              onValueChange={(value) => {
                if (value) onUserChange(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={usersLoading ? 'Loading staff…' : 'Select staff'}>
                  {(value) => {
                    const u = users.find((x) => x.id === value);
                    if (!u) return usersLoading ? 'Loading staff…' : 'Select staff';
                    const name = `${u.firstName} ${u.lastName ?? ''}`.trim();
                    const role = primaryNursingRoleOf(u);
                    const tail = role ? ` · ${ROLE_LABEL[role] ?? role}` : '';
                    return `${name}${tail}`;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No active nursing staff. Assign the nurse or nurse_admin role to users in
                    Settings → Users first.
                  </div>
                ) : (
                  users.map((u) => {
                    const name = `${u.firstName} ${u.lastName ?? ''}`.trim();
                    const role = primaryNursingRoleOf(u);
                    const sub = role ? ROLE_LABEL[role] ?? role : '';
                    return (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex flex-col">
                          <span>{name}</span>
                          {sub ? (
                            <span className="text-[10px] text-muted-foreground">{sub}</span>
                          ) : null}
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Role tag</Label>
            <Select
              value={form.role || null}
              onValueChange={(value) => {
                if (value) setForm((f) => ({ ...f, role: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value) =>
                    typeof value === 'string' && value ? (ROLE_LABEL[value] ?? value) : 'Select role'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {NURSE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Ward (optional)</Label>
            <Select
              value={form.wardId || null}
              onValueChange={(value) => {
                setForm((f) => ({ ...f, wardId: value ?? '' }));
              }}
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

          <div className="col-span-2">
            <Label className="text-xs">Repeat</Label>
            <div className="mt-1 inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`rounded-sm px-3 py-1 ${
                  mode === 'single' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Single day
              </button>
              <button
                type="button"
                onClick={() => setMode('range')}
                className={`rounded-sm px-3 py-1 ${
                  mode === 'range' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Date range
              </button>
            </div>
          </div>

          {mode === 'single' ? (
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.shiftDate}
                onChange={(e) => setForm((f) => ({ ...f, shiftDate: e.target.value }))}
              />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={form.rangeFrom}
                  onChange={(e) => setForm((f) => ({ ...f, rangeFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={form.rangeTo}
                  onChange={(e) => setForm((f) => ({ ...f, rangeTo: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Days of week</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {WEEKDAY_LABELS.map(({ day, short }) => {
                    const active = form.weekdays.has(day);
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
                  {expandedDates.length} shift{expandedDates.length === 1 ? '' : 's'} will be
                  created. Existing entries on the same date/shift are skipped.
                </p>
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Shift</Label>
            <Select
              value={form.shiftType}
              onValueChange={(value) => {
                if (value) onShiftChange(value as Shift);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Start time</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>

          <div>
            <Label className="text-xs">End time</Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {mode === 'range' && expandedDates.length > 0
              ? `Add ${expandedDates.length} shifts`
              : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
