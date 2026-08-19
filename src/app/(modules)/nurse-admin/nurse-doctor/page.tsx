'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, X, Plus, UserCog, Stethoscope, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
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
import { useUsersList, useRolesList, type UserListItem } from '@/hooks/use-users';
import { useDoctorsList } from '@/hooks/use-hospital';
import {
  useNurseDoctorAssignments,
  useCreateNurseDoctorAssignments,
  useEndNurseDoctorAssignment,
  type NurseDoctorAssignment,
} from '@/hooks/use-nurse-doctor-assignments';

export default function NurseDoctorAssignmentPage() {
  const [filterNurseId, setFilterNurseId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'true' | 'false' | 'all'>('true');

  const { data: rolesList } = useRolesList();
  const nurseRoleId = useMemo(
    () => rolesList?.find((r) => r.name === 'nurse')?.id,
    [rolesList],
  );
  const { data: usersRes } = useUsersList({
    limit: 100,
    isActive: 'true',
    ...(nurseRoleId ? { roleId: nurseRoleId } : {}),
  });
  const nurseUsers = useMemo(() => {
    const list = (usersRes?.data ?? []) as UserListItem[];
    if (nurseRoleId) return list;
    // Fallback when roles haven't loaded: filter client-side
    return list.filter((u) =>
      u.userRoles.some((ur) => /^nurse(_|$)/i.test(ur.role.name) && ur.role.name !== 'nurse_admin'),
    );
  }, [usersRes?.data, nurseRoleId]);

  const { data: assignmentsRes, isLoading } = useNurseDoctorAssignments({
    isActive: filterStatus,
    ...(filterNurseId !== 'all' ? { nurseId: filterNurseId } : {}),
    limit: 100,
  });
  const assignments = extractList<NurseDoctorAssignment>(assignmentsRes);

  const grouped = useMemo(() => {
    const map = new Map<string, NurseDoctorAssignment[]>();
    for (const a of assignments) {
      const arr = map.get(a.nurseId) ?? [];
      arr.push(a);
      map.set(a.nurseId, arr);
    }
    return Array.from(map.entries()).map(([nurseId, rows]) => ({
      nurseId,
      nurse: rows[0]?.nurse ?? null,
      rows,
    }));
  }, [assignments]);

  const endMut = useEndNurseDoctorAssignment();

  async function handleEnd(id: string) {
    try {
      await endMut.mutateAsync({ id, reason: 'Removed by nurse admin' });
      toast.success('Assignment ended');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to end assignment';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Nurse ↔ Doctor Assignment</h1>
          <p className="text-sm text-muted-foreground">
            Map each nurse to one or more doctors. Bedside nurses see only patients under their
            assigned doctors.
          </p>
        </div>
        <AssignDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Nurse</Label>
            <Select
              value={filterNurseId}
              onValueChange={(value) => {
                if (value) setFilterNurseId(value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All nurses</SelectItem>
                {nurseUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={filterStatus}
              onValueChange={(value) => {
                if (value) setFilterStatus(value as typeof filterStatus);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Ended</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading assignments…
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No assignments match the current filter. Click <strong>Assign nurse</strong> to
              create one.
            </div>
          ) : filterStatus === 'true' ? (
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.nurseId} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {g.nurse
                        ? `${g.nurse.firstName} ${g.nurse.lastName ?? ''}`
                        : 'Unknown nurse'}
                    </span>
                    <span className="text-xs text-muted-foreground">{g.nurse?.email}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {g.rows.length} doctor{g.rows.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {g.rows.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <Stethoscope className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">
                            Dr. {r.doctor?.user.firstName} {r.doctor?.user.lastName ?? ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.doctor?.specialization || r.doctor?.department?.name || '—'}
                            <span className="ml-2">
                              · since {format(parseISO(r.assignedAt), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleEnd(r.id)}
                          disabled={endMut.isPending}
                          title="End this assignment"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nurse</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {r.nurse ? `${r.nurse.firstName} ${r.nurse.lastName ?? ''}` : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.doctor
                        ? `Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName ?? ''}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          r.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {r.isActive ? 'Active' : 'Ended'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(r.assignedAt), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.endedAt ? format(parseISO(r.endedAt), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.endedReason ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssignDialog() {
  const [open, setOpen] = useState(false);
  const [nurseId, setNurseId] = useState<string>('');
  const [nurseSearch, setNurseSearch] = useState('');
  const [doctorIds, setDoctorIds] = useState<Set<string>>(new Set());
  const [doctorSearch, setDoctorSearch] = useState('');
  const [notes, setNotes] = useState('');

  const { data: rolesList } = useRolesList();
  const nurseRoleId = useMemo(
    () => rolesList?.find((r) => r.name === 'nurse')?.id,
    [rolesList],
  );
  const { data: usersRes } = useUsersList({
    limit: 100,
    isActive: 'true',
    ...(nurseRoleId ? { roleId: nurseRoleId } : {}),
  });
  const nurseUsers = useMemo(() => {
    const list = (usersRes?.data ?? []) as UserListItem[];
    if (nurseRoleId) return list;
    return list.filter((u) =>
      u.userRoles.some((ur) => /^nurse(_|$)/i.test(ur.role.name) && ur.role.name !== 'nurse_admin'),
    );
  }, [usersRes?.data, nurseRoleId]);

  const selectedNurse = useMemo(
    () => nurseUsers.find((u) => u.id === nurseId) ?? null,
    [nurseUsers, nurseId],
  );

  const filteredNurses = useMemo(() => {
    const q = nurseSearch.trim().toLowerCase();
    if (!q) return nurseUsers;
    return nurseUsers.filter((u) => {
      const name = `${u.firstName} ${u.lastName ?? ''}`.toLowerCase();
      const email = (u.email ?? '').toLowerCase();
      const phone = (u.phone ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [nurseUsers, nurseSearch]);

  const { data: doctorsList } = useDoctorsList();
  const doctors = doctorsList ?? [];

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => {
      const name = `dr ${d.user.firstName} ${d.user.lastName ?? ''}`.toLowerCase();
      const spec = (d.specialization ?? '').toLowerCase();
      const dept = (d.department?.name ?? '').toLowerCase();
      return name.includes(q) || spec.includes(q) || dept.includes(q);
    });
  }, [doctors, doctorSearch]);

  const createMut = useCreateNurseDoctorAssignments();

  function toggleDoctor(id: string) {
    setDoctorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!nurseId || doctorIds.size === 0) {
      toast.error('Pick a nurse and at least one doctor');
      return;
    }
    try {
      const result = await createMut.mutateAsync({
        nurseId,
        doctorIds: Array.from(doctorIds),
        notes: notes.trim() || undefined,
      });
      const { created = 0, skipped = 0 } = result.data ?? {};
      toast.success(
        `Assigned ${created} doctor${created === 1 ? '' : 's'}` +
          (skipped > 0 ? ` · skipped ${skipped} already-active` : ''),
      );
      setOpen(false);
      setNurseId('');
      setNurseSearch('');
      setDoctorIds(new Set());
      setDoctorSearch('');
      setNotes('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create assignment';
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1.5 h-4 w-4" />
        Assign nurse
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign nurse to doctor(s)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nurse</Label>
            {selectedNurse ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border bg-primary/5 px-3 py-2">
                <UserCog className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {selectedNurse.firstName} {selectedNurse.lastName ?? ''}
                  </div>
                  <div className="text-xs text-muted-foreground">{selectedNurse.email}</div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setNurseId('');
                    setNurseSearch('');
                  }}
                  title="Change nurse"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={nurseSearch}
                    onChange={(e) => setNurseSearch(e.target.value)}
                    placeholder="Search nurse by name, email, or phone…"
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <div className="mt-1 max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-1">
                  {nurseUsers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No nurses found in this clinic.
                    </div>
                  ) : filteredNurses.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No nurses match “{nurseSearch}”.
                    </div>
                  ) : (
                    filteredNurses.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setNurseId(u.id);
                          setNurseSearch('');
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
                      >
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">
                            {u.firstName} {u.lastName ?? ''}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <Label className="text-xs">Doctors ({doctorIds.size} selected)</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Search doctor by name, specialization, or department…"
                className="pl-8"
              />
            </div>
            <div className="mt-1 max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
              {doctors.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Loading doctors…
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No doctors match “{doctorSearch}”.
                </div>
              ) : (
                filteredDoctors.map((d) => {
                  const checked = doctorIds.has(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 ${
                        checked ? 'bg-primary/5' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-primary"
                        checked={checked}
                        onChange={() => toggleDoctor(d.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          Dr. {d.user.firstName} {d.user.lastName ?? ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.specialization || d.department?.name || '—'}
                        </div>
                      </div>
                      {checked ? <Check className="h-4 w-4 text-primary" /> : null}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. cardiology coverage"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={createMut.isPending || !nurseId || doctorIds.size === 0}
          >
            {createMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              `Assign ${doctorIds.size || ''} doctor${doctorIds.size === 1 ? '' : 's'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractList<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  return [];
}
