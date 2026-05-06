'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import {
  useDutyRosters,
  useActiveRoster,
  type DutyRoster,
} from '@/hooks/use-duty-rosters';

const SHIFTS = ['morning', 'afternoon', 'night', 'general'] as const;
type Shift = (typeof SHIFTS)[number];

const SHIFT_LABEL: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
  general: 'General',
};

const SHIFT_CHIP: Record<string, string> = {
  morning: 'bg-amber-100 text-amber-800 border-amber-200',
  afternoon: 'bg-orange-100 text-orange-800 border-orange-200',
  night: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  general: 'bg-slate-100 text-slate-800 border-slate-200',
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  // DutyRoster.startTime / endTime are stored against the 1970-01-01 epoch in
  // UTC, so render those columns in UTC. Plain dates use the local renderer.
  if (d.getUTCFullYear() === 1970) {
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  return format(d, 'HH:mm');
}

function startOfMondayWeek(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export default function NurseSchedulePage() {
  const { user } = useAuthStore();
  const today = useMemo(() => new Date(), []);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfMondayWeek(today));
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = weekDays[6]!;

  // Pull a 4-week window (this week + 3 ahead) so the "Coming up" list at the
  // bottom can show further out without a second request when the user
  // navigates back to this week.
  const fromIso = format(weekStart, 'yyyy-MM-dd');
  const toIso = format(addDays(weekStart, 27), 'yyyy-MM-dd');

  const { data, isLoading } = useDutyRosters({
    userId: user?.id,
    fromDate: fromIso,
    toDate: toIso,
    limit: 200,
  });
  const allEntries = data?.items ?? [];

  // Group by date for the weekly grid.
  const byDate = useMemo(() => {
    const map = new Map<string, DutyRoster[]>();
    for (const r of allEntries) {
      const key = r.shiftDate.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [allEntries]);

  // Live shift for "On duty now" card.
  const { data: activeData } = useActiveRoster(user?.id ? { userId: user.id } : {});
  const liveEntry = activeData?.mine ?? null;

  // Counts for the summary line.
  const weekCount = weekDays.reduce((sum, d) => {
    return sum + (byDate.get(format(d, 'yyyy-MM-dd'))?.length ?? 0);
  }, 0);

  // "Coming up" — next 5 shifts strictly after now, ordered by date+start.
  const upcoming = useMemo(() => {
    const now = Date.now();
    const items = allEntries
      .map((r) => {
        const d = parseISO(r.shiftDate.slice(0, 10));
        const s = new Date(r.startTime);
        const startMs =
          d.getTime() +
          s.getUTCHours() * 60 * 60 * 1000 +
          s.getUTCMinutes() * 60 * 1000;
        return { row: r, startMs };
      })
      .filter((x) => x.startMs > now)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 5)
      .map((x) => x.row);
    return items;
  }, [allEntries]);

  const goPrev = () => setWeekStart((w) => addWeeks(w, -1));
  const goNext = () => setWeekStart((w) => addWeeks(w, 1));
  const goThis = () => setWeekStart(startOfMondayWeek(new Date()));

  return (
    <div className="space-y-4 p-4">
      {/* Title + quick links */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">My Schedule</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/nurse"
            className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted"
          >
            Dashboard
          </Link>
          <Link
            href="/nurse/handover"
            className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted"
          >
            Handover
          </Link>
        </div>
      </div>

      {/* On-duty banner */}
      {liveEntry ? (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  On duty now ·{' '}
                  {SHIFT_LABEL[liveEntry.shiftType] ?? liveEntry.shiftType}{' '}
                  {fmtTime(liveEntry.startTime)}–{fmtTime(liveEntry.endTime)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {liveEntry.ward?.name ? `Ward: ${liveEntry.ward.name}` : 'No specific ward'}
                  {' · '}
                  {liveEntry.department?.name ?? '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="py-2.5 text-xs text-amber-800">
            You&apos;re not on a rostered shift right now. Your weekly schedule is below.
          </CardContent>
        </Card>
      )}

      {/* Weekly grid */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base">My week</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goThis}>
              This week
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-xs text-muted-foreground">
              {format(weekStart, 'dd/MM')} – {format(weekEnd, 'dd/MM/yyyy')} ·{' '}
              {weekCount} shift{weekCount === 1 ? '' : 's'}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading your schedule…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {weekDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const entries = byDate.get(key) ?? [];
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={key}
                    className={`rounded-md border p-2 ${
                      isToday ? 'border-primary bg-primary/5' : 'bg-card'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'dd')}
                      </div>
                    </div>
                    {entries.length === 0 ? (
                      <p className="text-[11px] italic text-muted-foreground">Off</p>
                    ) : (
                      <div className="space-y-1">
                        {entries.map((r) => (
                          <ShiftChip key={r.id} r={r} isLive={r.id === activeData?.mine?.id} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coming up */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coming up</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No upcoming shifts scheduled. Nurse-admin will add your roster when ready.
            </p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((r) => {
                const d = parseISO(r.shiftDate.slice(0, 10));
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-2.5 text-sm"
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      {format(d, 'EEE dd/MM')}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        SHIFT_CHIP[r.shiftType] ?? SHIFT_CHIP.general
                      }`}
                    >
                      {SHIFT_LABEL[r.shiftType] ?? r.shiftType}
                    </span>
                    <span className="font-medium">
                      {fmtTime(r.startTime)} – {fmtTime(r.endTime)}
                    </span>
                    {r.ward?.name ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {r.ward.name}
                      </span>
                    ) : null}
                    <StatusPill status={r.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ShiftChip({ r, isLive }: { r: DutyRoster; isLive?: boolean }) {
  const cls = SHIFT_CHIP[r.shiftType] ?? SHIFT_CHIP.general;
  return (
    <div
      className={`rounded-md border px-1.5 py-1 text-[11px] ${cls} ${
        isLive ? 'ring-1 ring-emerald-500' : ''
      }`}
    >
      <div className="font-semibold">
        {SHIFT_LABEL[r.shiftType] ?? r.shiftType}
        {isLive ? <span className="ml-1 text-[9px] font-bold uppercase">live</span> : null}
      </div>
      <div className="opacity-80">
        {fmtTime(r.startTime)}–{fmtTime(r.endTime)}
      </div>
      {r.ward?.name ? (
        <div className="truncate opacity-70">{r.ward.name}</div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: DutyRoster['status'] }) {
  const styles: Record<DutyRoster['status'], string> = {
    scheduled: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-primary/10 text-primary',
    swapped: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="secondary" className={`ml-auto ${styles[status]}`}>
      {status}
    </Badge>
  );
}
