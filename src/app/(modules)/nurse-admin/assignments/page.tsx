'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { useNurseAdmissions, type NurseAdmission } from '@/hooks/use-nurse';
import { useUsersList, type UserListItem } from '@/hooks/use-users';
import {
  useNurseAssignments,
  useCreateNurseAssignment,
  useEndNurseAssignment,
  type NurseAssignment,
  type ShiftType,
} from '@/hooks/use-nurse-assignments';

const SHIFTS: Array<{ value: ShiftType; label: string; hours: string }> = [
  { value: 'morning', label: 'Morning', hours: '07:00 – 15:00' },
  { value: 'afternoon', label: 'Afternoon', hours: '15:00 – 23:00' },
  { value: 'night', label: 'Night', hours: '23:00 – 07:00' },
];

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

export default function NurseAdminAssignmentsPage() {
  const [shiftDate, setShiftDate] = useState<string>(todayIso());
  const [shiftType, setShiftType] = useState<ShiftType>('morning');
  const [wardId, setWardId] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: admissionsRes, isLoading: admissionsLoading } = useNurseAdmissions({
    status: 'admitted',
    limit: 200,
    ...(wardId !== 'all' ? { wardId } : {}),
  });
  const admissions = extractList<NurseAdmission>(admissionsRes);

  const { data: assignmentsRes, isLoading: assignmentsLoading } = useNurseAssignments({
    shiftDate,
    shiftType,
    status: 'active',
    ...(wardId !== 'all' ? { wardId } : {}),
    limit: 500,
  });
  const assignments = extractList<NurseAssignment>(assignmentsRes);
  const assignmentsByAdmission = useMemo(() => {
    const map = new Map<string, NurseAssignment>();
    for (const a of assignments) map.set(a.admissionId, a);
    return map;
  }, [assignments]);

  const { data: usersRes, isLoading: usersLoading } = useUsersList({
    limit: 500,
    isActive: 'true',
  });
  const nurseUsers = useMemo(() => {
    const items = (usersRes?.data ?? []) as UserListItem[];
    return items.filter((u) =>
      u.userRoles.some((ur) => /^nurse(_|$)/i.test(ur.role.name)),
    );
  }, [usersRes]);

  const wards = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of admissions) {
      if (a.ward?.id && a.ward?.name) map.set(a.ward.id, a.ward.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [admissions]);

  const createMut = useCreateNurseAssignment();
  const endMut = useEndNurseAssignment();

  const filteredAdmissions = useMemo(() => {
    if (!search.trim()) return admissions;
    const q = search.toLowerCase();
    return admissions.filter((a) => {
      const name = `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`.toLowerCase();
      return (
        name.includes(q) ||
        (a.patient?.mrn ?? '').toLowerCase().includes(q) ||
        (a.bed?.bedNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [admissions, search]);

  const unassignedCount = filteredAdmissions.filter((a) => !assignmentsByAdmission.has(a.id)).length;

  async function handleAssign(admissionId: string, nurseId: string) {
    try {
      await createMut.mutateAsync({
        admissionId,
        nurseId,
        shiftDate,
        shiftType,
      });
      toast.success('Nurse assigned');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to assign nurse';
      toast.error(msg);
    }
  }

  async function handleUnassign(assignmentId: string) {
    try {
      await endMut.mutateAsync({ id: assignmentId, reason: 'Removed by nurse admin' });
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
          <h1 className="text-2xl font-semibold">Patient Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Assign a nurse to every occupied IPD bed for the selected shift.
          </p>
        </div>
        {unassignedCount > 0 ? (
          <Badge variant="secondary" className="gap-1 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {unassignedCount} bed{unassignedCount === 1 ? '' : 's'} need coverage
          </Badge>
        ) : admissions.length > 0 ? (
          <Badge variant="secondary" className="gap-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Shift fully covered
          </Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Shift date</label>
            <Input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Shift</label>
            <Select
              value={shiftType}
              onValueChange={(value) => {
                if (value) setShiftType(value as ShiftType);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} <span className="text-muted-foreground">({s.hours})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ward</label>
            <Select
              value={wardId}
              onValueChange={(value) => {
                if (value) setWardId(value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wards</SelectItem>
                {wards.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Patient, MRN, bed..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {admissionsLoading || assignmentsLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading admissions…
            </div>
          ) : filteredAdmissions.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No admitted patients match the current filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>MRN</TableHead>
                  <TableHead>Ward / Bed</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Assigned nurse</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmissions.map((adm) => {
                  const current = assignmentsByAdmission.get(adm.id) ?? null;
                  return (
                    <AssignmentRow
                      key={adm.id}
                      admission={adm}
                      currentAssignment={current}
                      nurseOptions={nurseUsers}
                      nurseOptionsLoading={usersLoading}
                      onAssign={(nurseId) => handleAssign(adm.id, nurseId)}
                      onUnassign={current ? () => handleUnassign(current.id) : null}
                      busy={createMut.isPending || endMut.isPending}
                    />
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssignmentRow({
  admission,
  currentAssignment,
  nurseOptions,
  nurseOptionsLoading,
  onAssign,
  onUnassign,
  busy,
}: {
  admission: NurseAdmission;
  currentAssignment: NurseAssignment | null;
  nurseOptions: UserListItem[];
  nurseOptionsLoading: boolean;
  onAssign: (nurseId: string) => void;
  onUnassign: (() => void) | null;
  busy: boolean;
}) {
  const [picked, setPicked] = useState<string>('');
  const patient = admission.patient;
  const patientName = `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim() || 'Unnamed';
  const doctor = admission.doctor?.user
    ? `Dr. ${admission.doctor.user.firstName} ${admission.doctor.user.lastName}`
    : '—';

  return (
    <TableRow>
      <TableCell className="font-medium">{patientName}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{patient?.mrn ?? '—'}</TableCell>
      <TableCell>
        <div className="text-sm">{admission.ward?.name ?? '—'}</div>
        <div className="text-xs text-muted-foreground">
          Bed {admission.bed?.bedNumber ?? '—'}
        </div>
      </TableCell>
      <TableCell className="text-sm">{doctor}</TableCell>
      <TableCell>
        {currentAssignment ? (
          <div className="flex items-center gap-2">
            <div>
              <div className="text-sm font-medium">
                {currentAssignment.nurse
                  ? `${currentAssignment.nurse.firstName} ${currentAssignment.nurse.lastName ?? ''}`
                  : 'Unknown'}
              </div>
              <div className="text-xs text-muted-foreground">
                Since {format(parseISO(currentAssignment.assignedAt), 'dd/MM HH:mm')} IST
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={picked}
              onValueChange={(value) => {
                if (value) setPicked(value);
              }}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder={nurseOptionsLoading ? 'Loading…' : 'Pick a nurse'} />
              </SelectTrigger>
              <SelectContent>
                {nurseOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName ?? ''}
                    <span className="ml-1 text-xs text-muted-foreground">({primaryRole(u)})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!picked || busy}
              onClick={() => picked && onAssign(picked)}
            >
              Assign
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        {currentAssignment && onUnassign ? (
          <Button size="icon-sm" variant="ghost" onClick={onUnassign} disabled={busy} title="End assignment">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function primaryRole(u: UserListItem): string {
  const nurseRole = u.userRoles.find((ur) => /^nurse(_|$)/i.test(ur.role.name));
  return nurseRole?.role.name ?? u.userRoles[0]?.role.name ?? '';
}

function extractList<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  return [];
}
