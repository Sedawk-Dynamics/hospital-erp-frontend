'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  ArrowRightLeft,
  BedDouble,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useNurseAssignments,
  type NurseAssignment,
  type ShiftType,
} from '@/hooks/use-nurse-assignments';

type Variant = 'panel' | 'compact';

interface MyShiftAssignmentsProps {
  shiftDate: string;
  shiftType: ShiftType;
  variant?: Variant;
}

// "Just received" window — assignments created within the last 4 hours read as
// fresh handovers. Long enough that a nurse coming on after a 30-min handover
// huddle still sees the highlight; short enough that yesterday's assignments
// don't carry the badge.
const FRESH_WINDOW_MS = 4 * 60 * 60 * 1000;

export function MyShiftAssignments({
  shiftDate,
  shiftType,
  variant = 'panel',
}: MyShiftAssignmentsProps) {
  const { user } = useAuthStore();

  const { data, isLoading } = useNurseAssignments({
    nurseId: user?.id,
    shiftDate,
    shiftType,
    status: 'active',
    limit: 200,
  });

  const items = useMemo(() => {
    const raw = data?.items ?? [];
    return raw.slice().sort((a, b) => {
      const aw = a.ward?.name ?? '';
      const bw = b.ward?.name ?? '';
      if (aw !== bw) return aw.localeCompare(bw);
      const ab = a.bed?.bedNumber ?? '';
      const bb = b.bed?.bedNumber ?? '';
      return ab.localeCompare(bb);
    });
  }, [data]);

  const freshCount = useMemo(() => {
    const now = Date.now();
    return items.filter((a) => {
      const t = new Date(a.assignedAt).getTime();
      return Number.isFinite(t) && now - t < FRESH_WINDOW_MS;
    }).length;
  }, [items]);

  if (variant === 'compact') {
    return (
      <CompactCard items={items} freshCount={freshCount} isLoading={isLoading} />
    );
  }

  return (
    <PanelCard
      items={items}
      freshCount={freshCount}
      isLoading={isLoading}
      shiftDate={shiftDate}
      shiftType={shiftType}
    />
  );
}

function CompactCard({
  items,
  freshCount,
  isLoading,
}: {
  items: NurseAssignment[];
  freshCount: number;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-headline text-sm font-bold">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          My Shift Assignments
        </h2>
        <Link
          href="/nurse/handover"
          className="text-[10px] font-medium text-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          You have no active assignments for the current shift. Nurse admin will assign your beds
          via shift handover.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Stat label="Beds" value={items.length} />
            <Stat label="Wards" value={new Set(items.map((i) => i.wardId)).size} />
            {freshCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Sparkles className="h-3 w-3" />
                {freshCount} just received
              </span>
            ) : null}
          </div>
          <ul className="max-h-[180px] space-y-1.5 overflow-y-auto">
            {items.slice(0, 6).map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-md bg-surface-container-low px-2 py-1.5 text-[11px]"
              >
                <BedDouble className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">
                  {patientName(a)}
                </span>
                <span className="ml-auto truncate text-[10px] text-muted-foreground">
                  {bedLabel(a)} · {a.ward?.name ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          {items.length > 6 ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              +{items.length - 6} more — see Shift Handover for the full list.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function PanelCard({
  items,
  freshCount,
  isLoading,
  shiftDate,
  shiftType,
}: {
  items: NurseAssignment[];
  freshCount: number;
  isLoading: boolean;
  shiftDate: string;
  shiftType: ShiftType;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { wardName: string; rows: NurseAssignment[] }>();
    for (const a of items) {
      const key = a.wardId;
      const entry = map.get(key) ?? { wardName: a.ward?.name ?? '—', rows: [] };
      entry.rows.push(a);
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-headline text-sm font-bold">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            My Shift Assignments
          </h2>
          <p className="font-label text-[11px] text-on-surface-variant">
            Beds assigned to you for this shift via the shift handover. No setup needed —
            assignments appear here automatically once nurse admin transfers them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Stat label="Beds" value={items.length} />
          <Stat label="Wards" value={grouped.length} />
          {freshCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Sparkles className="h-3 w-3" />
              {freshCount} just received
            </span>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading assignments…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-low/40 py-8 text-xs text-muted-foreground">
          <Users className="h-5 w-5 text-muted-foreground/60" />
          You have no active assignments for{' '}
          <span className="font-medium">{prettyShift(shiftType)}</span> on{' '}
          <span className="font-medium">{format(parseISO(shiftDate), 'dd/MM/yyyy')}</span>.
          <span>Nurse admin will hand over patients to you once the shift is set.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.wardName} className="rounded-lg border border-outline-variant/20 p-2">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground">{g.wardName}</span>
                <span className="text-muted-foreground">
                  {g.rows.length} bed{g.rows.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="space-y-1">
                {g.rows.map((a) => {
                  const fresh =
                    Date.now() - new Date(a.assignedAt).getTime() < FRESH_WINDOW_MS;
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-1.5 text-xs',
                        fresh
                          ? 'border border-emerald-200 bg-emerald-50/60'
                          : 'bg-surface-container-low/60',
                      )}
                    >
                      <BedDouble className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">
                          {patientName(a)}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {bedLabel(a)}
                          {a.admission?.patient?.mrn
                            ? ` · MRN ${a.admission.patient.mrn}`
                            : ''}
                          {' · assigned '}
                          {format(new Date(a.assignedAt), 'dd/MM HH:mm')}
                        </div>
                      </div>
                      {fresh ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <Sparkles className="h-2.5 w-2.5" />
                          Just received
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
      {value} {label}
    </span>
  );
}

function patientName(a: NurseAssignment): string {
  const p = a.admission?.patient;
  if (!p) return 'Patient';
  return `${p.firstName} ${p.lastName ?? ''}`.trim() || 'Patient';
}

function bedLabel(a: NurseAssignment): string {
  return a.bed?.bedNumber ? `Bed ${a.bed.bedNumber}` : 'No bed';
}

function prettyShift(s: ShiftType): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
