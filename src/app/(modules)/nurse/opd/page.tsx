'use client';

// OPD Queue — today's outpatients under the nurse's assigned doctors.
//
// Checking whether a patient had arrived, or whose vitals were still
// outstanding, meant opening Patient Vitals, switching to the OPD tab and
// picking a patient one at a time — three steps to answer a question the ward
// asks constantly. The data was already there; there was simply no list.
//
// This is that list: who is here, where they are in the queue, and who still
// needs vitals — with vitals reachable in one click from the row.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Search,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/date-utils';
import { useMyPatients, type MyPatientRecord } from '@/hooks/use-nurse-doctor-assignments';
import { useVitalsToday } from '@/hooks/use-nurse';

/** Where the patient is in the OPD journey, in ward language. */
const STATUS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: 'Expected', tone: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  checked_in: { label: 'Arrived', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  waiting: { label: 'Waiting', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  in_consultation: { label: 'With doctor', tone: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  completed: { label: 'Done', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
};

/** Vitals matter once the patient is physically here — not while merely expected. */
const ARRIVED = new Set(['checked_in', 'waiting', 'in_consultation']);

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NurseOpdQueuePage() {
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);

  const { data: opd, isLoading } = useMyPatients({ type: 'op', limit: 200 });
  // One request for the whole queue's vitals status rather than one per row.
  const { data: vitalsToday } = useVitalsToday(todayStr());

  const withVitals = useMemo(
    () => new Set((vitalsToday ?? []).map((v) => v.patientId)),
    [vitalsToday],
  );

  const rows = useMemo(() => {
    let list = (opd?.data ?? []) as MyPatientRecord[];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const name = `${r.patient.firstName} ${r.patient.lastName ?? ''}`.toLowerCase();
        return name.includes(q) || (r.patient.mrn ?? '').toLowerCase().includes(q);
      });
    }
    if (onlyPending) {
      list = list.filter((r) => ARRIVED.has(r.status) && !withVitals.has(r.patientId));
    }
    // Arrived-and-waiting first: those are the ones the nurse can act on now.
    return [...list].sort((a, b) => {
      const rank = (r: MyPatientRecord) =>
        !ARRIVED.has(r.status) ? 2 : withVitals.has(r.patientId) ? 1 : 0;
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
  }, [opd, search, onlyPending, withVitals]);

  const pendingCount = useMemo(
    () =>
      ((opd?.data ?? []) as MyPatientRecord[]).filter(
        (r) => ARRIVED.has(r.status) && !withVitals.has(r.patientId),
      ).length,
    [opd, withVitals],
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">OPD Queue</h1>
          <p className="text-sm text-muted-foreground">
            Today&rsquo;s outpatients under your doctors — who has arrived, and who still needs
            vitals.
          </p>
        </div>
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={() => setOnlyPending((v) => !v)}
            className={cn(
              'rounded-xl border px-3 py-2 text-left transition-colors',
              onlyPending
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : 'border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-50',
            )}
          >
            <span className="block font-display text-lg font-bold leading-none">
              {pendingCount}
            </span>
            <span className="text-[11px]">
              waiting on vitals{onlyPending ? ' · showing only these' : ' · tap to filter'}
            </span>
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name or MRN"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            onlyPending
              ? 'No one is waiting on vitals'
              : search
                ? 'Nothing matches'
                : 'No OPD patients today'
          }
          description={
            onlyPending
              ? 'Every patient who has arrived has had their vitals taken.'
              : search
                ? 'Try a different name or MRN.'
                : 'Patients appear here once the front desk confirms an appointment with one of your doctors.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vitals</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const done = withVitals.has(r.patientId);
                const arrived = ARRIVED.has(r.status);
                const st = STATUS[r.status] ?? {
                  label: r.status.replace(/_/g, ' '),
                  tone: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
                };
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {r.patient.firstName} {r.patient.lastName ?? ''}
                          </div>
                          {r.patient.mrn && (
                            <div className="text-[11px] text-muted-foreground">{r.patient.mrn}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope className="h-3 w-3 text-muted-foreground" />
                        {r.doctor.user.firstName} {r.doctor.user.lastName ?? ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.startTime ? formatTime(r.startTime) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border', st.tone)}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Recorded
                        </span>
                      ) : arrived ? (
                        <span className="text-xs font-medium text-amber-700">Due</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Straight into the vitals screen with this patient already
                          selected — the three-step hunt is the whole complaint. */}
                      <Button
                        size="sm"
                        variant={done ? 'outline' : 'default'}
                        className="h-8 gap-1.5"
                        render={
                          <Link
                            href={`/nurse/vitals?patientId=${r.patientId}&kind=opd`}
                          />
                        }
                      >
                        <HeartPulse className="h-3.5 w-3.5" />
                        {done ? 'View' : 'Record vitals'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
