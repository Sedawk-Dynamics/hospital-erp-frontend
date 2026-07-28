'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { format, parseISO, addDays } from 'date-fns';
import { toInputDateStr, formatDateTime } from '@/lib/date-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useHandovers,
  useCreateHandover,
  useAcknowledgeHandover,
  type ShiftHandover,
} from '@/hooks/use-nurse';
import { useNurseAssignments } from '@/hooks/use-nurse-assignments';
import { useDutyRosters, useActiveRoster } from '@/hooks/use-duty-rosters';
import { AdminHandoverBanner } from '@/components/nurse/admin-handover-banner';
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
  ClipboardList,
  CalendarClock,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────

const SHIFT_CONFIG = {
  morning: {
    label: 'Morning',
    icon: Sun,
    start: '06:00',
    end: '14:00',
    color: 'bg-amber-100 text-amber-700',
  },
  afternoon: {
    label: 'Afternoon',
    icon: Sunset,
    start: '14:00',
    end: '22:00',
    color: 'bg-orange-100 text-orange-700',
  },
  night: {
    label: 'Night',
    icon: Moon,
    start: '22:00',
    end: '06:00',
    color: 'bg-indigo-100 text-indigo-700',
  },
  general: {
    label: 'General',
    icon: Clock,
    start: '09:00',
    end: '17:00',
    color: 'bg-sky-100 text-sky-700',
  },
} as const;

type ShiftType = keyof typeof SHIFT_CONFIG;

// Cycle: morning → afternoon → night → (next-day) morning. General shifts
// don't form a cycle — pair against themselves so the form still has a
// sensible "next shift" target.
const NEXT_SHIFT: Record<ShiftType, ShiftType> = {
  morning: 'afternoon',
  afternoon: 'night',
  night: 'morning',
  general: 'general',
};

function detectCurrentShift(): ShiftType {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

function nextShiftDate(fromShift: ShiftType, fromDateIso: string): string {
  // Night → next-day morning. All other transitions stay on the same date.
  if (fromShift === 'night') {
    return format(addDays(parseISO(fromDateIso), 1), 'yyyy-MM-dd');
  }
  return fromDateIso;
}

// ── Page ─────────────────────────────────────────────────────

export default function ShiftHandoverPage() {
  // Source of truth: the logged-in nurse's active roster row. Falls back to
  // clock-based detection only when off-duty so the page still renders.
  const { user } = useAuthStore();
  const { data: myActive } = useActiveRoster(
    user?.id ? { userId: user.id } : {},
  );
  const rosteredShift = (myActive?.mine?.shiftType ?? null) as ShiftType | null;
  const currentShift = useMemo<ShiftType>(() => {
    if (rosteredShift && rosteredShift in SHIFT_CONFIG) return rosteredShift;
    return detectCurrentShift();
  }, [rosteredShift]);
  const isRostered = Boolean(myActive?.mine);
  // Pull the actual rostered start/end (stored against 1970-01-01 UTC) so the
  // chip shows the nurse's real times, not the SHIFT_CONFIG default.
  const shiftTimes = useMemo(() => {
    const fallback = SHIFT_CONFIG[currentShift];
    if (!isRostered || !myActive?.mine) {
      return { start: fallback.start, end: fallback.end };
    }
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return `${d.getUTCHours().toString().padStart(2, '0')}:${d
        .getUTCMinutes()
        .toString()
        .padStart(2, '0')}`;
    };
    return { start: fmt(myActive.mine.startTime), end: fmt(myActive.mine.endTime) };
  }, [isRostered, myActive, currentShift]);
  const shiftCfg = SHIFT_CONFIG[currentShift];
  return (
    <div className="space-y-4 p-4">
      {/* Title + Schedule link */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="font-headline text-lg font-bold">Shift Handover</h1>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              shiftCfg.color,
            )}
          >
            {shiftCfg.label} · {shiftTimes.start}–{shiftTimes.end}
          </span>
          {isRostered ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              On Duty
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              Off Duty
            </span>
          )}
        </div>
        <Link
          href="/nurse/schedule"
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          My Schedule
        </Link>
      </div>

      {/* Roster-driven banner: who am I receiving from / handing off to. */}
      <AdminHandoverBanner showEmpty />

      {/* Add a closing note */}
      <CreateHandoverForm currentShift={currentShift} />

      {/* Today's submitted handovers (acknowledge if I'm the recipient) */}
      <HandoverHistoryList />
    </div>
  );
}

// ── Create Handover Form ─────────────────────────────────────

function CreateHandoverForm({ currentShift }: { currentShift: ShiftType }) {
  const { user } = useAuthStore();
  const [shiftType, setShiftType] = useState<ShiftType>(currentShift);
  const [wardId, setWardId] = useState('');
  const [toNurseId, setToNurseId] = useState('');
  const [content, setContent] = useState('');

  const todayIso = toInputDateStr();
  const toShift = NEXT_SHIFT[shiftType];
  const toShiftDateIso = nextShiftDate(shiftType, todayIso);

  // Wards I'm currently covering — pre-fills the picker.
  const { data: myAssignments } = useNurseAssignments({
    nurseId: user?.id,
    shiftDate: todayIso,
    shiftType,
    status: 'active',
    limit: 200,
  });
  const myWards = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of myAssignments?.items ?? []) {
      if (a.wardId && a.ward?.name) map.set(a.wardId, a.ward.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [myAssignments]);

  // Nurses rostered to take the next shift on the selected ward.
  const { data: rosterRes } = useDutyRosters({
    fromDate: toShiftDateIso,
    toDate: toShiftDateIso,
    shiftType: toShift,
    role: 'nurse',
    wardId: wardId || undefined,
    status: 'published',
    limit: 50,
  });
  const incomingNurses = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const r of rosterRes?.items ?? []) {
      const u = r.staff?.user;
      if (!u?.id) continue;
      const name = `${u.firstName} ${u.lastName ?? ''}`.trim();
      if (!seen.has(u.id)) seen.set(u.id, { id: u.id, name });
    }
    return Array.from(seen.values());
  }, [rosterRes]);

  // Auto-pick a sensible default ward + receiving nurse when possible.
  useEffect(() => {
    if (myWards.length === 0) return;
    if (wardId && !myWards.some((w) => w.id === wardId)) {
      setWardId(myWards[0]!.id);
      return;
    }
    if (!wardId) setWardId(myWards[0]!.id);
  }, [myWards, wardId]);
  useEffect(() => {
    if (!toNurseId && incomingNurses.length === 1) {
      setToNurseId(incomingNurses[0]!.id);
    }
  }, [incomingNurses, toNurseId]);

  const createHandover = useCreateHandover();

  const handleSubmit = useCallback(async () => {
    if (!wardId) {
      toast.error('Pick a ward first');
      return;
    }
    if (!content.trim()) {
      toast.error('Write a closing note for the next shift');
      return;
    }
    try {
      // The handover model only knows morning/afternoon/night. A nurse on a
      // 'general' roster hands over at whatever part of day it is now — map it
      // to a valid handover shift so the submit doesn't 400.
      const hour = new Date().getHours();
      const handoverShift =
        shiftType === 'general'
          ? hour < 12
            ? 'morning'
            : hour < 18
              ? 'afternoon'
              : 'night'
          : shiftType;
      await createHandover.mutateAsync({
        wardId,
        toNurseId: toNurseId || undefined,
        shiftDate: todayIso,
        shiftType: handoverShift,
        content: content.trim(),
      });
      toast.success('Handover note sent to next shift');
      setContent('');
      setToNurseId('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit';
      toast.error(msg);
    }
  }, [wardId, toNurseId, todayIso, shiftType, content, createHandover]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Send className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">Send a closing note to the next shift</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            My Shift
          </label>
          <Select
            value={shiftType}
            onValueChange={(value) => {
              if (value) setShiftType(value as ShiftType);
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning · 06:00–14:00</SelectItem>
              <SelectItem value="afternoon">Afternoon · 14:00–22:00</SelectItem>
              <SelectItem value="night">Night · 22:00–06:00</SelectItem>
              <SelectItem value="general">General · 09:00–17:00</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Ward *
          </label>
          <Select value={wardId || null} onValueChange={(value) => setWardId(value ?? '')}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue
                placeholder={myWards.length === 0 ? 'No active assignments' : 'Select ward'}
              >
                {(value) => {
                  if (!value)
                    return myWards.length === 0 ? 'No active assignments' : 'Select ward';
                  return myWards.find((w) => w.id === value)?.name ?? 'Selected ward';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {myWards.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  You aren&apos;t assigned to any ward this shift.
                </div>
              ) : (
                myWards.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            To · {SHIFT_CONFIG[toShift].label}
          </label>
          <Select value={toNurseId || null} onValueChange={(value) => setToNurseId(value ?? '')}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Anyone on next shift">
                {(value) => {
                  if (!value) return 'Anyone on next shift';
                  return incomingNurses.find((n) => n.id === value)?.name ?? 'Selected nurse';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Anyone on next shift</SelectItem>
              {incomingNurses.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No nurse rostered for {SHIFT_CONFIG[toShift].label} on this ward yet.
                </div>
              ) : (
                incomingNurses.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Closing note *
        </label>
        <Textarea
          placeholder="Anything the next nurse needs to know — outstanding tasks, alerts, follow-ups…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[96px] resize-none text-sm"
          rows={4}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Patient transfers are already handled by nurse-admin&apos;s roster &amp; handover —
          this is just the narrative for the next shift.
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={createHandover.isPending || !content.trim()}
          className="gap-2"
        >
          {createHandover.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send note
        </Button>
      </div>
    </div>
  );
}

// ── Handover History ─────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-emerald-100 text-emerald-700',
};

function HandoverHistoryList() {
  const { user } = useAuthStore();
  const today = toInputDateStr();
  const { data: handovers, isLoading } = useHandovers({ shiftDate: today });
  const acknowledgeHandover = useAcknowledgeHandover();

  const handleAcknowledge = useCallback(
    async (id: string) => {
      try {
        await acknowledgeHandover.mutateAsync(id);
        toast.success('Acknowledged');
      } catch {
        toast.error('Failed to acknowledge');
      }
    },
    [acknowledgeHandover],
  );

  // `useHandovers` returns the raw API envelope { data, meta }; the list lives
  // at `.data`. Checking the envelope itself was always non-array → empty feed.
  const list = Array.isArray(handovers?.data) ? handovers.data : [];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold">Today&apos;s notes</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center">
          <ClipboardList className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No handover notes for today yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((h) => (
            <HandoverRow
              key={h.id}
              handover={h}
              currentUserId={user?.id}
              onAcknowledge={handleAcknowledge}
              isAcknowledging={acknowledgeHandover.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HandoverRow({
  handover,
  currentUserId,
  onAcknowledge,
  isAcknowledging,
}: {
  handover: ShiftHandover;
  currentUserId?: string;
  onAcknowledge: (id: string) => void;
  isAcknowledging: boolean;
}) {
  const cfg = SHIFT_CONFIG[handover.shiftType as ShiftType] ?? SHIFT_CONFIG.morning;
  const Icon = cfg.icon;
  const fromName = handover.fromUser
    ? `${handover.fromUser.firstName} ${handover.fromUser.lastName}`
    : 'Unknown';
  const toName = handover.toUser
    ? `${handover.toUser.firstName} ${handover.toUser.lastName}`
    : 'Anyone';
  const canAck =
    handover.status === 'submitted' &&
    currentUserId &&
    handover.toUserId === currentUserId &&
    handover.toUserId !== handover.fromUserId;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', cfg.color)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-sm font-medium">
              {fromName} <span className="text-muted-foreground">→</span> {toName}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {cfg.label} · {handover.ward?.name ?? 'No ward'} ·{' '}
              {formatDateTime(handover.createdAt)}
            </div>
          </div>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
            STATUS_BADGE[handover.status] ?? STATUS_BADGE.draft,
          )}
        >
          {handover.status}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm text-foreground">{handover.summary}</p>

      {canAck ? (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-emerald-300 text-xs text-emerald-700 hover:bg-emerald-50"
            onClick={() => onAcknowledge(handover.id)}
            disabled={isAcknowledging}
          >
            {isAcknowledging ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Acknowledge
          </Button>
        </div>
      ) : null}

      {handover.status === 'acknowledged' && handover.acknowledgedAt ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Acknowledged at {formatDateTime(handover.acknowledgedAt)}
        </div>
      ) : null}
    </div>
  );
}
