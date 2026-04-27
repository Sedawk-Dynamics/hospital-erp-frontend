'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { useUsersList, type UserListItem } from '@/hooks/use-users';
import { useNurseAdmissions } from '@/hooks/use-nurse';
import {
  useNurseAssignments,
  useBulkHandover,
  type NurseAssignment,
  type ShiftType,
} from '@/hooks/use-nurse-assignments';

const SHIFTS: Array<{ value: ShiftType; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'night', label: 'Night' },
];

const NEXT_SHIFT: Record<ShiftType, ShiftType> = {
  morning: 'afternoon',
  afternoon: 'night',
  night: 'morning',
  general: 'general',
};

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

export default function NurseInchargeHandoverPage() {
  const [shiftDate, setShiftDate] = useState<string>(todayIso());
  const [fromShift, setFromShift] = useState<ShiftType>('morning');
  const toShift = NEXT_SHIFT[fromShift];
  const [wardId, setWardId] = useState<string>('all');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const { data: admissionsRes } = useNurseAdmissions({
    status: 'admitted',
    limit: 200,
    ...(wardId !== 'all' ? { wardId } : {}),
  });
  const admissions = extractList<any>(admissionsRes);
  const wards = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of admissions) {
      if (a.ward?.id && a.ward?.name) map.set(a.ward.id, a.ward.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [admissions]);

  const { data: assignmentsRes, isLoading } = useNurseAssignments({
    shiftDate,
    shiftType: fromShift,
    status: 'active',
    ...(wardId !== 'all' ? { wardId } : {}),
    limit: 500,
  });
  const assignments = extractList<NurseAssignment>(assignmentsRes);

  const assignmentsByNurse = useMemo(() => {
    const map = new Map<string, NurseAssignment[]>();
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

  const { data: usersRes } = useUsersList({ limit: 500, isActive: 'true' });
  const nurseUsers = useMemo(() => {
    const items = (usersRes?.data ?? []) as UserListItem[];
    return items.filter((u) =>
      u.userRoles.some((ur) => /^nurse(_|$)/i.test(ur.role.name) || ur.role.name === 'nurse_incharge'),
    );
  }, [usersRes]);

  const bulkMut = useBulkHandover();

  // Single ward required to call bulk-handover (schema requires wardId). If
  // "all" is selected, we disable the action so the user picks one explicitly.
  const canSubmit =
    wardId !== 'all' &&
    assignmentsByNurse.length > 0 &&
    assignmentsByNurse.every((group) => mapping[group.nurseId]);

  async function handleSubmit() {
    if (wardId === 'all') {
      toast.error('Select a specific ward before handover');
      return;
    }
    try {
      const result = await bulkMut.mutateAsync({
        wardId,
        shiftDate,
        fromShiftType: fromShift,
        toShiftType: toShift,
        mapping: assignmentsByNurse.map((g) => ({
          fromNurseId: g.nurseId,
          toNurseId: mapping[g.nurseId]!,
        })),
      });
      toast.success(
        `Handover complete — ${result.transferred.length} transferred, ${result.unassigned.length} skipped`,
      );
      setMapping({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Handover failed';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Shift Handover</h1>
        <p className="text-sm text-muted-foreground">
          Map each current-shift nurse to the next-shift nurse taking over their patients. Transfer
          happens atomically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current shift</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">From shift</label>
            <Select
              value={fromShift}
              onValueChange={(value) => {
                if (value) setFromShift(value as ShiftType);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">To shift</label>
            <Input value={toShift} disabled />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Handover mapping</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Pick the next-shift nurse who will take over each current-shift nurse&apos;s beds.
            </div>
          </div>
          <Button
            disabled={!canSubmit || bulkMut.isPending}
            onClick={handleSubmit}
          >
            {bulkMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring…
              </>
            ) : (
              'Transfer all'
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading current shift…
            </div>
          ) : assignmentsByNurse.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No active assignments for the selected shift.
              {wardId === 'all' ? ' Pick a ward to begin handover.' : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentsByNurse.map((group) => (
                <div
                  key={group.nurseId}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {group.nurse
                        ? `${group.nurse.firstName} ${group.nurse.lastName ?? ''}`
                        : 'Unknown nurse'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Holding {group.rows.length} bed{group.rows.length === 1 ? '' : 's'}
                      {group.rows.length > 0
                        ? ` · ${group.rows
                            .map((r) => r.bed?.bedNumber)
                            .filter(Boolean)
                            .join(', ')}`
                        : ''}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="w-60">
                    <Select
                      value={mapping[group.nurseId] ?? ''}
                      onValueChange={(value) => {
                        if (value) setMapping((m) => ({ ...m, [group.nurseId]: value }));
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pick next-shift nurse" />
                      </SelectTrigger>
                      <SelectContent>
                        {nurseUsers
                          .filter((u) => u.id !== group.nurseId)
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.firstName} {u.lastName ?? ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {mapping[group.nurseId] ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      Pending
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function extractList<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  return [];
}
