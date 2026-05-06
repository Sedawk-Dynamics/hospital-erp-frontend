'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsersList, type UserListItem } from '@/hooks/use-users';
import {
  useNurseAssignments,
  useBulkHandover,
  useHandoverFeed,
  type NurseAssignment,
  type ShiftType,
} from '@/hooks/use-nurse-assignments';
import {
  useDutyRosters,
  useActiveRoster,
  type DutyRoster,
} from '@/hooks/use-duty-rosters';
import { useCreateHandover } from '@/hooks/use-nurse';
import { NursePicker } from '@/components/nurse-admin/nurse-picker';
import { cn } from '@/lib/utils';

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

interface NurseGroup {
  nurseId: string;
  nurse: { id: string; firstName: string; lastName: string | null } | null;
  rows: NurseAssignment[];
  beds: string[];
  patients: string[];
  wardIds: Set<string>;
  wardNames: string[];
  // Status: pending = at least one row still active; done = every row handed over.
  status: 'pending' | 'done';
}

export default function NurseAdminHandoverPage() {
  const [shiftDate, setShiftDate] = useState<string>(todayIso());
  const [fromShift, setFromShift] = useState<ShiftType>('morning');
  const [fromShiftAutoSet, setFromShiftAutoSet] = useState(false);
  const toShift = NEXT_SHIFT[fromShift];
  const toShiftDate = useMemo(() => {
    if (fromShift === 'night' && toShift === 'morning') {
      return format(addDays(parseISO(shiftDate), 1), 'yyyy-MM-dd');
    }
    return shiftDate;
  }, [fromShift, toShift, shiftDate]);

  // Auto-pick from-shift from the live roster (one-time).
  const { data: activeData } = useActiveRoster();
  useEffect(() => {
    if (fromShiftAutoSet) return;
    const types = activeData?.byShiftType ?? {};
    const dominant = (Object.entries(types).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ??
      null) as ShiftType | null;
    if (dominant && dominant !== 'general') {
      setFromShift(dominant);
      setFromShiftAutoSet(true);
    }
  }, [activeData, fromShiftAutoSet]);

  // Hospital-wide active assignments for the selected shift. We don't
  // pre-filter by ward so the admin can see every nurse on duty in one view.
  const { data: assignmentsRes, isLoading: loadingAssignments } = useNurseAssignments({
    shiftDate,
    shiftType: fromShift,
    status: 'active',
    limit: 500,
  });
  const assignments = assignmentsRes?.items ?? [];

  // Roster for the receiving shift — defines who is rostered to take over.
  // Optional ward scoping is unnecessary here since we want the global picture.
  const { data: rosterRes } = useDutyRosters({
    fromDate: toShiftDate,
    toDate: toShiftDate,
    shiftType: toShift,
    role: 'nurse',
    status: 'published',
    limit: 200,
  });
  // userId → roster row, for quick relief lookups.
  const rosterByUserId = useMemo(() => {
    const map = new Map<string, DutyRoster>();
    for (const r of rosterRes?.items ?? []) {
      const id = r.staff?.user?.id;
      if (id && !map.has(id)) map.set(id, r);
    }
    return map;
  }, [rosterRes]);
  const rosteredUserIds = useMemo(() => new Set(rosterByUserId.keys()), [rosterByUserId]);
  // Per-ward, the nurses rostered to cover that ward on the next shift.
  const rosterByWardId = useMemo(() => {
    const map = new Map<string, Array<{ userId: string; name: string }>>();
    for (const r of rosterRes?.items ?? []) {
      const u = r.staff?.user;
      if (!u) continue;
      const wardId = r.ward?.id ?? '__nowhere__';
      const arr = map.get(wardId) ?? [];
      arr.push({
        userId: u.id,
        name: `${u.firstName} ${u.lastName ?? ''}`.trim(),
      });
      map.set(wardId, arr);
    }
    return map;
  }, [rosterRes]);

  // Group active assignments by nurse — one row per nurse in the sidebar.
  const groups = useMemo<NurseGroup[]>(() => {
    const map = new Map<string, NurseGroup>();
    for (const a of assignments) {
      const g = map.get(a.nurseId) ?? {
        nurseId: a.nurseId,
        nurse: a.nurse ?? null,
        rows: [] as NurseAssignment[],
        beds: [] as string[],
        patients: [] as string[],
        wardIds: new Set<string>(),
        wardNames: [] as string[],
        status: 'pending' as const,
      };
      g.rows.push(a);
      if (a.bed?.bedNumber) g.beds.push(a.bed.bedNumber);
      if (a.admission?.patient) {
        const p = a.admission.patient;
        g.patients.push(`${p.firstName} ${p.lastName ?? ''}`.trim());
      }
      if (a.wardId && a.ward?.name && !g.wardIds.has(a.wardId)) {
        g.wardIds.add(a.wardId);
        g.wardNames.push(a.ward.name);
      }
      map.set(a.nurseId, g);
    }
    return Array.from(map.values()).sort((a, b) => {
      const an = `${a.nurse?.firstName ?? ''} ${a.nurse?.lastName ?? ''}`.trim();
      const bn = `${b.nurse?.firstName ?? ''} ${b.nurse?.lastName ?? ''}`.trim();
      return an.localeCompare(bn);
    });
  }, [assignments]);

  // Sidebar search.
  const [search, setSearch] = useState('');
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      const name = `${g.nurse?.firstName ?? ''} ${g.nurse?.lastName ?? ''}`.toLowerCase();
      return name.includes(q) || g.wardNames.join(' ').toLowerCase().includes(q);
    });
  }, [groups, search]);

  // Sidebar selection.
  const [selectedNurseId, setSelectedNurseId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedNurseId && filteredGroups[0]) {
      setSelectedNurseId(filteredGroups[0]!.nurseId);
    }
  }, [filteredGroups, selectedNurseId]);
  const selected = useMemo(
    () => filteredGroups.find((g) => g.nurseId === selectedNurseId) ?? null,
    [filteredGroups, selectedNurseId],
  );

  // Per-nurse override map. Pre-populated with the rostered candidate for
  // each nurse when the roster is unambiguous (one rostered nurse for any of
  // the from-nurse's wards). Admin can override at any time.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Suggest a relief for a given group: prefer rostered nurses on a matching
  // ward; otherwise the first rostered nurse anywhere.
  function suggestReliefFor(g: NurseGroup): string | null {
    for (const wardId of g.wardIds) {
      const candidates = rosterByWardId.get(wardId) ?? [];
      if (candidates.length === 1) return candidates[0]!.userId;
    }
    if (rosteredUserIds.size === 1) return Array.from(rosteredUserIds)[0]!;
    return null;
  }
  useEffect(() => {
    setOverrides((cur) => {
      const next = { ...cur };
      let changed = false;
      for (const g of groups) {
        if (!next[g.nurseId]) {
          const suggestion = suggestReliefFor(g);
          if (suggestion) {
            next[g.nurseId] = suggestion;
            changed = true;
          }
        }
      }
      return changed ? next : cur;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, rosterByWardId, rosteredUserIds]);

  // Optional ward-level note, captured once and linked to every transfer.
  const [note, setNote] = useState('');

  // All rostered users (for the override picker, even if they aren't on the
  // suggested ward).
  const { data: usersRes } = useUsersList({ limit: 500, isActive: 'true' });
  const allNurseUsers = useMemo(() => {
    return ((usersRes?.data ?? []) as UserListItem[]).filter((u) =>
      u.userRoles.some((ur) => /^nurse(_|$)/i.test(ur.role.name)),
    );
  }, [usersRes]);

  const createHandoverNote = useCreateHandover();
  const bulkMut = useBulkHandover();

  // Run handover for one nurse: group that nurse's assignments by ward and
  // call bulkHandover per ward (the bulk endpoint takes a single wardId).
  // Returns the total rows transferred.
  async function handoverOneNurse(g: NurseGroup, toNurseId: string, handoverNoteId?: string) {
    const byWard = new Map<string, NurseAssignment[]>();
    for (const r of g.rows) {
      const arr = byWard.get(r.wardId) ?? [];
      arr.push(r);
      byWard.set(r.wardId, arr);
    }
    let total = 0;
    for (const [wardId] of byWard) {
      const res = await bulkMut.mutateAsync({
        wardId,
        shiftDate,
        fromShiftType: fromShift,
        toShiftType: toShift,
        toShiftDate,
        handoverNoteId,
        mapping: [{ fromNurseId: g.nurseId, toNurseId }],
      });
      total += res.transferred.length;
    }
    return total;
  }

  // Per-nurse transfer (button on the detail panel).
  const [pendingNurseId, setPendingNurseId] = useState<string | null>(null);
  async function handleTransferOne(g: NurseGroup) {
    const target = overrides[g.nurseId];
    if (!target) {
      toast.error('Pick the relief nurse first');
      return;
    }
    setPendingNurseId(g.nurseId);
    try {
      // Save the optional ward note once if provided so it links to the new
      // assignments. Per-nurse transfers reuse the same note id.
      let handoverNoteId: string | undefined;
      const trimmed = note.trim();
      if (trimmed && g.wardIds.size > 0) {
        const wardId = Array.from(g.wardIds)[0]!;
        try {
          const res = (await createHandoverNote.mutateAsync({
            wardId,
            shiftDate,
            shiftType: fromShift,
            content: trimmed,
          })) as { data?: { id?: string } } | undefined;
          handoverNoteId = res?.data?.id;
        } catch {
          // Non-fatal — the assignment transfer still proceeds.
        }
      }
      const total = await handoverOneNurse(g, target, handoverNoteId);
      toast.success(`Handover complete · ${total} bed${total === 1 ? '' : 's'} transferred`);
      // Move selection to next pending nurse so admin can keep going.
      const idx = filteredGroups.findIndex((x) => x.nurseId === g.nurseId);
      const nextPending = filteredGroups
        .slice(idx + 1)
        .find((x) => !overrides[x.nurseId] || overrides[x.nurseId] !== '__skipped__');
      if (nextPending) setSelectedNurseId(nextPending.nurseId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Handover failed';
      toast.error(msg);
    } finally {
      setPendingNurseId(null);
    }
  }

  // Bulk: transfer everyone with a rostered relief in one click.
  const [bulkRunning, setBulkRunning] = useState(false);
  async function handleTransferAllRostered() {
    const ready = groups.filter(
      (g) => overrides[g.nurseId] && rosteredUserIds.has(overrides[g.nurseId] ?? ''),
    );
    if (ready.length === 0) {
      toast.error('Nobody has a rostered relief assigned yet');
      return;
    }
    setBulkRunning(true);
    let nurses = 0;
    let beds = 0;
    let failures = 0;
    for (const g of ready) {
      try {
        const t = await handoverOneNurse(g, overrides[g.nurseId]!);
        nurses += 1;
        beds += t;
      } catch {
        failures += 1;
      }
    }
    setBulkRunning(false);
    if (failures > 0) {
      toast.warning(`Transferred ${nurses} nurses · ${beds} beds. ${failures} failed.`);
    } else {
      toast.success(`Transferred ${nurses} nurses · ${beds} beds. Receiving nurses notified.`);
    }
  }

  const totalReady = groups.filter((g) => overrides[g.nurseId]).length;
  const totalDone = 0; // we re-fetch active assignments after each transfer; "done" = no longer in list.

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shift Handover</h1>
          <p className="text-sm text-muted-foreground">
            Pick a nurse, see who&apos;s rostered to take over, and transfer their patients.
          </p>
        </div>
        <Button
          onClick={handleTransferAllRostered}
          disabled={bulkRunning || totalReady === 0}
          className="gap-2"
        >
          {bulkRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Transfer all rostered ({totalReady})
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs">From shift</Label>
            <Select
              value={fromShift}
              onValueChange={(value) => {
                if (value) {
                  setFromShift(value as ShiftType);
                  setFromShiftAutoSet(true);
                }
              }}
            >
              <SelectTrigger className="mt-1 h-9">
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
            <div className="mt-1 flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                {SHIFT_LABEL[toShift]} · {format(parseISO(toShiftDate), 'dd/MM')}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {rosteredUserIds.size} rostered
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Body: nurse list + detail */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              Nurses on duty ({groups.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or ward…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {loadingAssignments ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {groups.length === 0
                  ? 'No active nurse assignments for this shift.'
                  : 'No matches.'}
              </div>
            ) : (
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                {filteredGroups.map((g) => {
                  const name = `${g.nurse?.firstName ?? ''} ${g.nurse?.lastName ?? ''}`.trim();
                  const isSelected = g.nurseId === selectedNurseId;
                  const reliefId = overrides[g.nurseId];
                  const reliefSet = Boolean(reliefId);
                  return (
                    <li key={g.nurseId}>
                      <button
                        type="button"
                        onClick={() => setSelectedNurseId(g.nurseId)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:bg-muted',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{name || 'Unnamed'}</span>
                          {reliefSet ? (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Ready
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              Needs relief
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {g.rows.length} bed{g.rows.length === 1 ? '' : 's'}
                          {g.wardNames.length > 0 ? ` · ${g.wardNames.join(', ')}` : ''}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <NurseDetailPanel
              key={selected.nurseId}
              group={selected}
              users={allNurseUsers}
              rosterByWardId={rosterByWardId}
              rosteredUserIds={rosteredUserIds}
              overrideId={overrides[selected.nurseId] ?? ''}
              onOverrideChange={(toId) =>
                setOverrides((m) => {
                  const next = { ...m };
                  if (!toId) delete next[selected.nurseId];
                  else next[selected.nurseId] = toId;
                  return next;
                })
              }
              note={note}
              onNoteChange={setNote}
              onTransfer={() => handleTransferOne(selected)}
              isTransferring={pendingNurseId === selected.nurseId}
              shiftDate={shiftDate}
              fromShift={fromShift}
              toShift={toShift}
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Pick a nurse from the list to set their handover.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ────────────────────────────────────────────

interface DetailProps {
  group: NurseGroup;
  users: UserListItem[];
  rosterByWardId: Map<string, Array<{ userId: string; name: string }>>;
  rosteredUserIds: Set<string>;
  overrideId: string;
  onOverrideChange: (toUserId: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  onTransfer: () => void;
  isTransferring: boolean;
  shiftDate: string;
  fromShift: ShiftType;
  toShift: ShiftType;
}

function NurseDetailPanel({
  group,
  users,
  rosterByWardId,
  rosteredUserIds,
  overrideId,
  onOverrideChange,
  note,
  onNoteChange,
  onTransfer,
  isTransferring,
  shiftDate,
  fromShift,
  toShift,
}: DetailProps) {
  const name = `${group.nurse?.firstName ?? ''} ${group.nurse?.lastName ?? ''}`.trim();

  // Rostered relief candidates that match any ward this nurse covers.
  const reliefCandidates = useMemo(() => {
    const seen = new Map<string, { userId: string; name: string }>();
    for (const wardId of group.wardIds) {
      for (const c of rosterByWardId.get(wardId) ?? []) {
        if (!seen.has(c.userId)) seen.set(c.userId, c);
      }
    }
    // Fall back to all rostered nurses if no ward match.
    if (seen.size === 0) {
      for (const wardCandidates of rosterByWardId.values()) {
        for (const c of wardCandidates) {
          if (!seen.has(c.userId)) seen.set(c.userId, c);
        }
      }
    }
    return Array.from(seen.values());
  }, [group.wardIds, rosterByWardId]);

  // Per-nurse handover history (incoming + outgoing).
  const { data: feed } = useHandoverFeed({ userId: group.nurseId, lookbackHours: 72 });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span>{name || 'Unnamed nurse'}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {SHIFT_LABEL[fromShift]} · {format(parseISO(shiftDate), 'dd/MM/yyyy')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <div className="font-medium">
              Holding {group.rows.length} bed{group.rows.length === 1 ? '' : 's'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {group.beds.length > 0 ? `Beds: ${group.beds.join(', ')}` : 'No bed numbers'}
              {group.wardNames.length > 0 ? ` · Wards: ${group.wardNames.join(', ')}` : ''}
            </div>
            {group.patients.length > 0 ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Patients: {group.patients.join(', ')}
              </div>
            ) : null}
          </div>

          {/* Rostered candidates (chips) */}
          <div>
            <Label className="text-xs">
              Rostered for {SHIFT_LABEL[toShift]}
            </Label>
            {reliefCandidates.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {reliefCandidates.map((c) => {
                  const isSelected = c.userId === overrideId;
                  return (
                    <button
                      key={c.userId}
                      type="button"
                      onClick={() => onOverrideChange(c.userId)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400',
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-amber-700">
                No nurse rostered for the next shift on this ward. Pick someone manually below
                or add a roster entry.
              </p>
            )}
          </div>

          {/* Override picker */}
          <div>
            <Label className="text-xs">Override / pick relief manually</Label>
            <NursePicker
              users={users}
              value={overrideId}
              onChange={onOverrideChange}
              placeholder="Pick a nurse"
              rosteredUserIds={rosteredUserIds}
              clearable
              className="mt-1 w-full"
            />
          </div>

          {/* Optional note (used once for the whole transfer batch) */}
          <div>
            <Label className="text-xs">Closing note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Anything the next shift needs to know about this ward — saved as a handover note."
              className="mt-1 min-h-[72px] text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onTransfer}
              disabled={!overrideId || isTransferring}
              className="gap-2"
            >
              {isTransferring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Hand over
            </Button>
            <span className="text-xs text-muted-foreground">
              Receiving nurse will see this immediately on their dashboard.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Recent handover activity for this nurse */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-primary" />
            Recent activity (last 72h)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {feed && (feed.incoming.length > 0 || feed.outgoing.length > 0) ? (
            <>
              {feed.outgoing.length > 0 ? (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                    Outgoing — handed over
                  </div>
                  <ul className="space-y-1">
                    {feed.outgoing.map((row) => {
                      const to = row.toNurse
                        ? `${row.toNurse.firstName} ${row.toNurse.lastName ?? ''}`.trim()
                        : 'Next nurse';
                      const patient = row.admission?.patient;
                      const pName = patient
                        ? `${patient.firstName} ${patient.lastName ?? ''}`.trim()
                        : 'Patient';
                      return (
                        <li
                          key={row.sourceAssignmentId}
                          className="flex flex-wrap items-center gap-2 text-xs"
                        >
                          <span className="font-medium">{name}</span>
                          <ArrowRight className="h-3 w-3 opacity-60" />
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold">
                            {to}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span>{pName}</span>
                          {row.bed?.bedNumber ? (
                            <span className="text-muted-foreground">Bed {row.bed.bedNumber}</span>
                          ) : null}
                          {row.handedOverAt ? (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {format(new Date(row.handedOverAt), 'dd/MM HH:mm')}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {feed.incoming.length > 0 ? (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                    Incoming — received
                  </div>
                  <ul className="space-y-1">
                    {feed.incoming.map((row) => {
                      const from = row.fromNurse
                        ? `${row.fromNurse.firstName} ${row.fromNurse.lastName ?? ''}`.trim()
                        : 'Previous nurse';
                      const patient = row.admission?.patient;
                      const pName = patient
                        ? `${patient.firstName} ${patient.lastName ?? ''}`.trim()
                        : 'Patient';
                      return (
                        <li
                          key={row.sourceAssignmentId}
                          className="flex flex-wrap items-center gap-2 text-xs"
                        >
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold">
                            {from}
                          </span>
                          <ArrowRight className="h-3 w-3 opacity-60" />
                          <span className="font-medium">{name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{pName}</span>
                          {row.bed?.bedNumber ? (
                            <span className="text-muted-foreground">Bed {row.bed.bedNumber}</span>
                          ) : null}
                          {row.handedOverAt ? (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {format(new Date(row.handedOverAt), 'dd/MM HH:mm')}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              No handover activity for this nurse in the last 72 hours.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
