'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ArrowRight, CalendarClock, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsersList, type UserListItem } from '@/hooks/use-users';
import { useWards } from '@/hooks/use-clinical';
import {
  useNurseAssignments,
  useBulkHandover,
  type NurseAssignment,
  type ShiftType,
} from '@/hooks/use-nurse-assignments';
import { useDutyRosters } from '@/hooks/use-duty-rosters';
import { useCreateHandover } from '@/hooks/use-nurse';

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

const SHIFT_LABEL: Record<ShiftType, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
};

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

export default function NurseAdminHandoverPage() {
  const [shiftDate, setShiftDate] = useState<string>(todayIso());
  const [fromShift, setFromShift] = useState<ShiftType>('morning');
  const toShift = NEXT_SHIFT[fromShift];
  // Night → next-day morning. All other transitions stay on the same date.
  const toShiftDate = useMemo(() => {
    if (fromShift === 'night' && toShift === 'morning') {
      return format(addDays(parseISO(shiftDate), 1), 'yyyy-MM-dd');
    }
    return shiftDate;
  }, [fromShift, toShift, shiftDate]);
  const [wardId, setWardId] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const { data: wards = [] } = useWards();

  const { data: assignmentsRes, isLoading } = useNurseAssignments({
    shiftDate,
    shiftType: fromShift,
    status: 'active',
    ...(wardId ? { wardId } : {}),
    limit: 500,
  });
  const assignments = extractList<NurseAssignment>(assignmentsRes);

  // Reset mapping when filters change so stale picks don't carry over.
  useEffect(() => {
    setMapping({});
  }, [shiftDate, fromShift, wardId]);

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
      u.userRoles.some((ur) => /^nurse(_|$)/i.test(ur.role.name)),
    );
  }, [usersRes]);

  // Pull the published roster for the receiving shift on the chosen ward so we
  // can mark candidates as "Rostered" in the dropdown and auto-prefill the
  // mapping when there's an unambiguous match.
  const { data: rosterRes } = useDutyRosters({
    fromDate: toShiftDate,
    toDate: toShiftDate,
    shiftType: toShift,
    role: 'nurse',
    wardId: wardId || undefined,
    status: 'published',
    limit: 100,
  });
  const rosteredUserIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of rosterRes?.items ?? []) {
      const id = r.staff?.user?.id;
      if (id) set.add(id);
    }
    return set;
  }, [rosterRes]);

  // Build the dropdown list: rostered nurses first (with a badge), everyone
  // else after — keeps the common case fast while still allowing override.
  const sortedNurses = useMemo(() => {
    return nurseUsers.slice().sort((a, b) => {
      const ar = rosteredUserIds.has(a.id) ? 0 : 1;
      const br = rosteredUserIds.has(b.id) ? 0 : 1;
      if (ar !== br) return ar - br;
      return `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`);
    });
  }, [nurseUsers, rosteredUserIds]);

  // Optional ward-level summary that becomes a ShiftHandoverNote, linked to
  // every new assignment via handoverNoteId. Keeping it inline (instead of
  // sending nurses to a second screen) is the whole point of this connection.
  const [handoverSummary, setHandoverSummary] = useState('');

  // Prefill mapping when the roster gives an unambiguous answer:
  // - Exactly one rostered nurse → map every from-nurse to that nurse.
  // - No mapping yet for a from-nurse and only one rostered candidate (after
  //   excluding the from-nurse themselves) → suggest them.
  useEffect(() => {
    if (rosteredUserIds.size === 0) return;
    setMapping((current) => {
      // Don't clobber explicit user picks.
      if (Object.values(current).some(Boolean)) return current;
      if (rosteredUserIds.size === 1) {
        const only = Array.from(rosteredUserIds)[0]!;
        const next: Record<string, string> = { ...current };
        for (const g of assignmentsByNurse) next[g.nurseId] = only;
        return next;
      }
      return current;
    });
  }, [rosteredUserIds, assignmentsByNurse]);

  const createHandoverNote = useCreateHandover();
  const bulkMut = useBulkHandover();

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const totalGroups = assignmentsByNurse.length;

  function applySameNurse(nurseId: string) {
    if (!nurseId) return;
    setMapping((m) => {
      const next = { ...m };
      for (const g of assignmentsByNurse) {
        if (g.nurseId !== nurseId) next[g.nurseId] = nurseId;
      }
      return next;
    });
  }

  function applyContinue() {
    // Each nurse continues on the next shift themselves (default if you just
    // want to roll the same staff into the next shift).
    setMapping((m) => {
      const next = { ...m };
      for (const g of assignmentsByNurse) next[g.nurseId] = g.nurseId;
      return next;
    });
  }

  function clearMapping() {
    setMapping({});
  }

  async function handleSubmit() {
    if (!wardId) {
      toast.error('Pick a ward to hand over');
      return;
    }
    if (mappedCount === 0) {
      toast.error('Pick at least one next-shift nurse before transferring');
      return;
    }
    const entries = assignmentsByNurse
      .map((g) => ({ fromNurseId: g.nurseId, toNurseId: mapping[g.nurseId] ?? '' }))
      .filter((e) => Boolean(e.toNurseId));
    try {
      // If the admin captured a ward-level summary, persist it as a
      // ShiftHandoverNote first and link the resulting id into every new
      // assignment so receiving nurses see the narrative alongside their
      // beds. Failing to create the note shouldn't block the transfer —
      // the assignments themselves are the operationally critical bit.
      let handoverNoteId: string | undefined;
      const summary = handoverSummary.trim();
      if (summary) {
        try {
          // useCreateHandover returns the full ApiResponse envelope, so the
          // newly-created note's id lives at `.data.id`.
          const res = (await createHandoverNote.mutateAsync({
            wardId,
            shiftDate,
            shiftType: fromShift,
            content: summary,
          })) as { data?: { id?: string } } | undefined;
          handoverNoteId = res?.data?.id;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not save handover note';
          toast.warning(`${msg} — continuing with assignment transfer`);
        }
      }

      const result = await bulkMut.mutateAsync({
        wardId,
        shiftDate,
        fromShiftType: fromShift,
        toShiftType: toShift,
        toShiftDate,
        handoverNoteId,
        mapping: entries,
      });
      const transferred = result.transferred.length;
      const unassigned = result.unassigned.length;
      toast.success(
        unassigned > 0
          ? `Handover complete — ${transferred} transferred, ${unassigned} skipped`
          : `Handover complete — ${transferred} transferred`,
      );
      setMapping({});
      setHandoverSummary('');
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
          Transfer each current-shift nurse&apos;s patients to the nurse coming on for the next
          shift. Transfers are atomic — partial mappings move only the nurses you map.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shift</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">From shift</Label>
            <Select
              value={fromShift}
              onValueChange={(value) => {
                if (value) setFromShift(value as ShiftType);
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value) => SHIFT_LABEL[(value as ShiftType) ?? 'morning']}
                </SelectValue>
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
            <Label className="text-xs">To shift</Label>
            <Input value={`${SHIFT_LABEL[toShift]} · ${toShiftDate}`} disabled />
          </div>
          <div>
            <Label className="text-xs">Ward</Label>
            <Select
              value={wardId || null}
              onValueChange={(value) => {
                setWardId(value ?? '');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a ward">
                  {(value) => {
                    if (!value) return 'Select a ward';
                    const w = wards.find((x) => x.id === value);
                    return w ? w.name : 'Select a ward';
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {wards.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No wards configured
                  </div>
                ) : (
                  wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Roster &amp; ward note
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">
              Rostered for {SHIFT_LABEL[toShift]} · {format(parseISO(toShiftDate), 'dd/MM/yyyy')}
            </Label>
            <div className="mt-1 min-h-[64px] rounded-md border bg-muted/30 p-2 text-xs">
              {!wardId ? (
                <span className="italic text-muted-foreground">
                  Pick a ward to see who&apos;s rostered.
                </span>
              ) : rosterRes?.items?.length ? (
                <div className="flex flex-wrap gap-1">
                  {rosterRes.items.map((r) => {
                    const u = r.staff?.user;
                    if (!u) return null;
                    return (
                      <span
                        key={r.id}
                        className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                      >
                        {u.firstName} {u.lastName ?? ''}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="italic text-muted-foreground">
                  No nurse is rostered for this ward + shift. Mappings will fall back to all
                  nursing staff.
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Source: published duty roster. Nurses listed here will appear marked
              &quot;Rostered&quot; in the dropdowns below.
            </p>
          </div>
          <div>
            <Label className="text-xs">Ward handover summary (optional)</Label>
            <Textarea
              value={handoverSummary}
              onChange={(e) => setHandoverSummary(e.target.value)}
              placeholder="What does the next shift need to know about this ward? Saved as a shift handover note and linked to every transferred assignment."
              className="mt-1 min-h-[88px] text-sm"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Handover mapping</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              {totalGroups === 0
                ? 'Pick a ward with active assignments to begin.'
                : `${mappedCount} of ${totalGroups} mapped — pick the next-shift nurse for each row, or use the shortcuts on the right.`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalGroups > 0 ? (
              <>
                <Button variant="outline" size="sm" onClick={applyContinue}>
                  Same nurses continue
                </Button>
                <Button variant="outline" size="sm" onClick={clearMapping}>
                  Clear
                </Button>
              </>
            ) : null}
            <Button
              disabled={!wardId || mappedCount === 0 || bulkMut.isPending}
              onClick={handleSubmit}
            >
              {bulkMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring…
                </>
              ) : (
                <>
                  Transfer {mappedCount > 0 ? `${mappedCount} ` : ''}
                  {mappedCount === 1 ? 'nurse' : 'nurses'}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!wardId ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              Pick a ward above to load active assignments for the {SHIFT_LABEL[fromShift]}{' '}
              shift.
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading current shift…
            </div>
          ) : assignmentsByNurse.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No active nurse assignments in this ward for the{' '}
              {SHIFT_LABEL[fromShift]} shift on{' '}
              {format(parseISO(shiftDate), 'dd/MM/yyyy')}.
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentsByNurse.map((group) => {
                const beds = group.rows
                  .map((r) => r.bed?.bedNumber)
                  .filter(Boolean)
                  .join(', ');
                const patients = group.rows
                  .map((r) =>
                    r.admission?.patient
                      ? `${r.admission.patient.firstName} ${r.admission.patient.lastName ?? ''}`.trim()
                      : null,
                  )
                  .filter(Boolean) as string[];
                const selectedTo = mapping[group.nurseId] ?? '';
                return (
                  <div
                    key={group.nurseId}
                    className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {group.nurse
                          ? `${group.nurse.firstName} ${group.nurse.lastName ?? ''}`.trim()
                          : 'Unknown nurse'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Holding {group.rows.length} bed{group.rows.length === 1 ? '' : 's'}
                        {beds ? ` · ${beds}` : ''}
                      </div>
                      {patients.length > 0 ? (
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          Patients: {patients.join(', ')}
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                    <div className="flex items-center gap-2 md:w-72">
                      <Select
                        value={selectedTo || null}
                        onValueChange={(value) => {
                          setMapping((m) => {
                            const next = { ...m };
                            if (!value) delete next[group.nurseId];
                            else next[group.nurseId] = value;
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 flex-1">
                          <SelectValue placeholder="Skip / pick next-shift nurse">
                            {(value) => {
                              if (!value) return 'Skip / pick next-shift nurse';
                              const u = sortedNurses.find((x) => x.id === value);
                              if (!u) return 'Skip / pick next-shift nurse';
                              const name = `${u.firstName} ${u.lastName ?? ''}`.trim();
                              return rosteredUserIds.has(u.id)
                                ? `${name} · Rostered`
                                : name;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Skip (no transfer)</SelectItem>
                          {sortedNurses.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No nursing users available
                            </div>
                          ) : (
                            sortedNurses.map((u) => {
                              const isRostered = rosteredUserIds.has(u.id);
                              return (
                                <SelectItem key={u.id} value={u.id}>
                                  <div className="flex w-full items-center justify-between gap-2">
                                    <span>
                                      {u.firstName} {u.lastName ?? ''}
                                      {u.id === group.nurseId ? ' (continue)' : ''}
                                    </span>
                                    {isRostered ? (
                                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        Rostered
                                      </span>
                                    ) : null}
                                  </div>
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applySameNurse(group.nurseId)}
                        title="Apply this nurse to all rows"
                      >
                        Apply ↓
                      </Button>
                    </div>
                    {selectedTo ? (
                      selectedTo === group.nurseId ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          Continues
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          Ready
                        </Badge>
                      )
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        Skip
                      </Badge>
                    )}
                  </div>
                );
              })}
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
