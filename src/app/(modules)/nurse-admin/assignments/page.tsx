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
import { NursePicker } from '@/components/nurse-admin/nurse-picker';

const SHIFTS: Array<{ value: ShiftType; label: string; hours: string }> = [
  { value: 'morning', label: 'Morning', hours: '07:00 – 15:00' },
  { value: 'afternoon', label: 'Afternoon', hours: '15:00 – 23:00' },
  { value: 'night', label: 'Night', hours: '23:00 – 07:00' },
];

const SHIFT_LABEL: Record<ShiftType, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
};

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

  // Fetch ALL active assignments for the admitted patients — not just the selected
  // shift/date. The shift filter only drives the *new assignment* action; the
  // "currently assigned nurse" column needs to show whoever is on the patient
  // right now regardless of which shift the admin happens to be filtering on.
  const { data: assignmentsRes, isLoading: assignmentsLoading } = useNurseAssignments({
    status: 'active',
    ...(wardId !== 'all' ? { wardId } : {}),
    limit: 500,
  });
  const assignments = extractList<NurseAssignment>(assignmentsRes);

  // admissionId → all active assignments (one per shift). Sorted newest first
  // so [0] is the latest-assigned, which we surface as the headline row.
  const assignmentsByAdmission = useMemo(() => {
    const map = new Map<string, NurseAssignment[]>();
    for (const a of assignments) {
      const list = map.get(a.admissionId) ?? [];
      list.push(a);
      map.set(a.admissionId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
      );
    }
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

  // "Needs coverage" = no assignment at all on the *currently selected* shift.
  // The badge is about staffing the chosen shift, not whether the patient has
  // any nurse at all (they might have one on a different shift).
  const unassignedCount = useMemo(() => {
    return filteredAdmissions.filter((a) => {
      const list = assignmentsByAdmission.get(a.id) ?? [];
      return !list.some(
        (x) =>
          x.shiftType === shiftType &&
          isSameYmd(x.shiftDate, shiftDate),
      );
    }).length;
  }, [filteredAdmissions, assignmentsByAdmission, shiftType, shiftDate]);

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
            Assign a nurse to every occupied IPD bed. The shift filter below
            controls which shift a new assignment is created for.
          </p>
        </div>
        {unassignedCount > 0 ? (
          <Badge variant="secondary" className="gap-1 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {unassignedCount} bed{unassignedCount === 1 ? '' : 's'} need coverage on {SHIFT_LABEL[shiftType]}
          </Badge>
        ) : admissions.length > 0 ? (
          <Badge variant="secondary" className="gap-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {SHIFT_LABEL[shiftType]} fully covered
          </Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign for shift</CardTitle>
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
                  <TableHead>Currently assigned</TableHead>
                  <TableHead>Assign for {SHIFT_LABEL[shiftType]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmissions.map((adm) => {
                  const allActive = assignmentsByAdmission.get(adm.id) ?? [];
                  // Match the assignment for the selected shift+date so we can
                  // hide the picker when one already exists for that slot.
                  const sameSlot =
                    allActive.find(
                      (x) =>
                        x.shiftType === shiftType &&
                        isSameYmd(x.shiftDate, shiftDate),
                    ) ?? null;
                  return (
                    <AssignmentRow
                      key={adm.id}
                      admission={adm}
                      activeAssignments={allActive}
                      sameSlotAssignment={sameSlot}
                      shiftLabel={SHIFT_LABEL[shiftType]}
                      nurseOptions={nurseUsers}
                      nurseOptionsLoading={usersLoading}
                      onAssign={(nurseId) => handleAssign(adm.id, nurseId)}
                      onUnassign={(assignmentId) => handleUnassign(assignmentId)}
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
  activeAssignments,
  sameSlotAssignment,
  shiftLabel,
  nurseOptions,
  nurseOptionsLoading,
  onAssign,
  onUnassign,
  busy,
}: {
  admission: NurseAdmission;
  activeAssignments: NurseAssignment[];
  sameSlotAssignment: NurseAssignment | null;
  shiftLabel: string;
  nurseOptions: UserListItem[];
  nurseOptionsLoading: boolean;
  onAssign: (nurseId: string) => void;
  onUnassign: (assignmentId: string) => void;
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
        {activeAssignments.length === 0 ? (
          <span className="text-xs text-muted-foreground">No nurse assigned</span>
        ) : (
          <div className="space-y-1.5">
            {activeAssignments.map((a) => {
              const nurseLabel = a.nurse
                ? `${a.nurse.firstName} ${a.nurse.lastName ?? ''}`.trim()
                : 'Unknown nurse';
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2 text-sm"
                  title={`Assigned ${format(parseISO(a.assignedAt), 'dd/MM HH:mm')} IST`}
                >
                  <span className="font-medium">{nurseLabel}</span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                    {SHIFT_LABEL[a.shiftType]} · {fmtShiftDate(a.shiftDate)}
                  </Badge>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onUnassign(a.id)}
                    disabled={busy}
                    title="End this assignment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </TableCell>
      <TableCell>
        {sameSlotAssignment ? (
          <span className="text-xs text-muted-foreground">
            Already covered for {shiftLabel}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <NursePicker
              users={nurseOptions}
              value={picked}
              onChange={(id) => setPicked(id)}
              placeholder={nurseOptionsLoading ? 'Loading…' : 'Pick a nurse'}
              triggerSize="sm"
              rolesShown={['nurse']}
              clearable
              className="w-48"
            />
            <Button
              size="sm"
              disabled={!picked || busy}
              onClick={() => {
                if (!picked) return;
                onAssign(picked);
                setPicked('');
              }}
            >
              Assign
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// `shiftDate` from the API is an ISO string like "2026-05-09T00:00:00.000Z"
// (or just a date for `@db.Date` columns). Compare on the YYYY-MM-DD prefix
// so timezone offsets on the wire don't break filter equality.
function isSameYmd(apiDate: string, ymd: string): boolean {
  if (!apiDate) return false;
  return apiDate.slice(0, 10) === ymd;
}

function fmtShiftDate(apiDate: string): string {
  if (!apiDate) return '';
  const ymd = apiDate.slice(0, 10);
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}`;
}

function extractList<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  return [];
}
