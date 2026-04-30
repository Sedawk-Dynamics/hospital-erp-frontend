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
  usePublishDutyRoster,
  type DutyRoster,
  type DutyRosterStatus,
} from '@/hooks/use-duty-rosters';
import { useUsersList, type UserListItem } from '@/hooks/use-users';

const SHIFTS = ['morning', 'afternoon', 'night'] as const;
type Shift = (typeof SHIFTS)[number];

export default function RosterPlanningPage() {
  const [weekStartIso, setWeekStartIso] = useState<string>(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  );

  const weekStart = parseISO(weekStartIso);
  const weekEnd = addDays(weekStart, 6);
  const fromDate = format(weekStart, 'yyyy-MM-dd');
  const toDate = format(weekEnd, 'yyyy-MM-dd');

  const { data, isLoading } = useDutyRosters({
    fromDate,
    toDate,
    role: 'nurse',
    limit: 500,
  });
  const rosters = (data?.items ?? (data as any)?.data ?? []) as DutyRoster[];

  const publishMut = usePublishDutyRoster();

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

  async function handlePublish(id: string) {
    try {
      await publishMut.mutateAsync(id);
      toast.success('Roster published');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Roster Planning</h1>
          <p className="text-sm text-muted-foreground">
            Weekly nursing roster. Add entries then publish to release them to bedside nurses.
          </p>
        </div>
        <CreateRosterDialog />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="week" className="text-xs font-medium text-muted-foreground">
              Week starting
            </Label>
            <Input
              id="week"
              type="date"
              value={weekStartIso}
              onChange={(e) => setWeekStartIso(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="text-xs text-muted-foreground">
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
                                  <RosterChip key={r.id} r={r} onPublish={handlePublish} />
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
                <TableHead>Ward</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
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
                    ? `${r.staff.user.firstName} ${r.staff.user.lastName ?? ''}`
                    : '—';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{format(parseISO(r.shiftDate), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-sm capitalize">{r.shiftType}</TableCell>
                      <TableCell className="text-sm">{staffName}</TableCell>
                      <TableCell className="text-sm">{r.ward?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{r.role ?? '—'}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'scheduled' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePublish(r.id)}
                            disabled={publishMut.isPending}
                          >
                            Publish
                          </Button>
                        ) : null}
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

function RosterChip({ r, onPublish }: { r: DutyRoster; onPublish: (id: string) => void }) {
  const staffName = r.staff?.user
    ? `${r.staff.user.firstName} ${r.staff.user.lastName ?? ''}`
    : 'Staff';
  return (
    <div
      className={`rounded-md border px-1.5 py-1 text-xs ${
        r.status === 'published'
          ? 'border-emerald-200 bg-emerald-50'
          : r.status === 'scheduled'
            ? 'border-amber-200 bg-amber-50'
            : 'border-muted bg-muted/40'
      }`}
    >
      <div className="font-medium">{staffName}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {r.ward?.name ?? '—'}
        {r.role ? ` · ${r.role}` : ''}
      </div>
      {r.status === 'scheduled' ? (
        <button
          className="mt-0.5 text-[10px] font-medium text-primary hover:underline"
          onClick={() => onPublish(r.id)}
        >
          Publish
        </button>
      ) : null}
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

function CreateRosterDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    staffId: '',
    departmentId: '',
    wardId: '',
    role: 'nurse',
    shiftDate: format(new Date(), 'yyyy-MM-dd'),
    shiftType: 'morning' as Shift,
    startTime: '07:00',
    endTime: '15:00',
  });

  const { data: usersRes } = useUsersList({ limit: 500, isActive: 'true' });
  const staffUsers = (usersRes?.data ?? []) as UserListItem[];

  const createMut = useCreateDutyRoster();

  async function handleSave() {
    if (!form.staffId || !form.departmentId) {
      toast.error('Staff and department are required');
      return;
    }
    try {
      await createMut.mutateAsync({
        staffId: form.staffId,
        departmentId: form.departmentId,
        wardId: form.wardId || undefined,
        role: form.role || undefined,
        shiftDate: form.shiftDate,
        shiftType: form.shiftType,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      toast.success('Roster entry added');
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create roster entry';
      toast.error(msg);
    }
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
              value={form.staffId}
              onValueChange={(value) => {
                if (value) setForm((f) => ({ ...f, staffId: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Department ID</Label>
            <Input
              placeholder="UUID"
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">Ward ID (optional)</Label>
            <Input
              placeholder="UUID"
              value={form.wardId}
              onChange={(e) => setForm((f) => ({ ...f, wardId: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">Role tag</Label>
            <Select
              value={form.role}
              onValueChange={(value) => {
                if (value) setForm((f) => ({ ...f, role: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nurse">nurse</SelectItem>
                <SelectItem value="nurse_admin">nurse_admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={form.shiftDate}
              onChange={(e) => setForm((f) => ({ ...f, shiftDate: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs">Shift</Label>
            <Select
              value={form.shiftType}
              onValueChange={(value) => {
                if (value) setForm((f) => ({ ...f, shiftType: value as Shift }));
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
            <Label className="text-xs">Start time (HH:mm)</Label>
            <Input
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              placeholder="07:00"
            />
          </div>
          <div>
            <Label className="text-xs">End time (HH:mm)</Label>
            <Input
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              placeholder="15:00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createMut.isPending}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
