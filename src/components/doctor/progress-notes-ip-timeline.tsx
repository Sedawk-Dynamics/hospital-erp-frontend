'use client';

import { useMemo } from 'react';
import {
  Clock,
  History,
  Lock,
  Pencil,
  Pin,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import type { ProgressNote } from '@/hooks/use-doctor';

// Same colours the round composer uses for its picker, so a condition reads
// identically whether it is being chosen or looked back at.
const CONDITION_TONE: Record<string, string> = {
  improving: 'bg-emerald-100 text-emerald-700',
  stable: 'bg-sky-100 text-sky-700',
  unchanged: 'bg-slate-100 text-slate-700',
  deteriorating: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-700',
};

function getPatientName(note: ProgressNote): string {
  if (!note.patient) return 'Unknown';
  return `${note.patient.firstName || ''} ${note.patient.lastName || ''}`.trim() || 'Unknown';
}

interface AdmissionGroup {
  admissionId: string;
  patientLabel: string;
  mrn: string;
  firstNoteAt: string;
  lastNoteAt: string;
  notes: ProgressNote[];
}

function groupByAdmission(notes: ProgressNote[]): AdmissionGroup[] {
  const buckets = new Map<string, AdmissionGroup>();
  for (const n of notes) {
    if (!n.admissionId) continue;
    let bucket = buckets.get(n.admissionId);
    if (!bucket) {
      bucket = {
        admissionId: n.admissionId,
        patientLabel: getPatientName(n),
        mrn: n.patient?.mrn || '-',
        firstNoteAt: n.createdAt,
        lastNoteAt: n.createdAt,
        notes: [],
      };
      buckets.set(n.admissionId, bucket);
    }
    bucket.notes.push(n);
    if (new Date(n.createdAt) < new Date(bucket.firstNoteAt)) {
      bucket.firstNoteAt = n.createdAt;
    }
    if (new Date(n.createdAt) > new Date(bucket.lastNoteAt)) {
      bucket.lastNoteAt = n.createdAt;
    }
  }
  // Sort each bucket newest→oldest, then sort buckets by most-recent activity.
  const groups = [...buckets.values()];
  for (const g of groups) {
    g.notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  groups.sort((a, b) => new Date(b.lastNoteAt).getTime() - new Date(a.lastNoteAt).getTime());
  return groups;
}

function TimelineEntry({
  note,
  isAuthor,
  onEdit,
  onShowAmendments,
}: {
  note: ProgressNote;
  isAuthor: boolean;
  onEdit: (note: ProgressNote) => void;
  onShowAmendments: (note: ProgressNote) => void;
}) {
  const isSigned = note.status === 'finalized';
  const amendmentCount = note._count?.amendments ?? note.amendments?.length ?? 0;
  const pinCount = note.pins?.length ?? (note.pinToDischargeSummary ? 1 : 0);

  return (
    <div className="relative pl-6">
      {/* Timeline dot */}
      <span
        className={cn(
          'absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-background',
          isSigned ? 'bg-primary' : 'bg-secondary',
        )}
      />

      <div className="rounded-lg bg-surface-container-lowest shadow-sanctuary p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-on-surface">
            {formatDateTime(note.createdAt)}
          </span>
          {note.doctor?.user && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Stethoscope className="h-2.5 w-2.5" />
              {note.doctor.user.firstName} {note.doctor.user.lastName ?? ''}
            </span>
          )}
          {isSigned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
              <Lock className="h-2 w-2" />
              Signed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-secondary/10 text-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
              Draft
            </span>
          )}
          {pinCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
              <Pin className="h-2 w-2" />
              {pinCount}
            </span>
          )}
          {amendmentCount > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              onClick={() => onShowAmendments(note)}
            >
              <History className="h-2 w-2" />
              {amendmentCount}
            </button>
          )}
          {!isAuthor && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-2 w-2" />
              Read-only
            </span>
          )}
          {isAuthor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 ml-auto"
              onClick={() => onEdit(note)}
            >
              <Pencil className="h-2.5 w-2.5" />
              {isSigned ? 'Amend' : 'Edit'}
            </Button>
          )}
        </div>

        {(note as { generalCondition?: string | null }).generalCondition && (
          <span
            className={cn(
              'mb-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
              CONDITION_TONE[(note as { generalCondition?: string }).generalCondition!] ??
                'bg-slate-100 text-slate-700',
            )}
          >
            {(note as { generalCondition?: string }).generalCondition}
          </span>
        )}

        {note.content && (
          <p className="text-[11px] text-on-surface-variant whitespace-pre-line line-clamp-6">
            {note.content.replace(/\*\*/g, '')}
          </p>
        )}
      </div>
    </div>
  );
}

export function IpAdmissionTimeline({
  notes,
  currentUserId,
  onEdit,
  onShowAmendments,
}: {
  notes: ProgressNote[];
  currentUserId?: string;
  onEdit: (note: ProgressNote) => void;
  onShowAmendments: (note: ProgressNote) => void;
}) {
  const groups = useMemo(() => groupByAdmission(notes), [notes]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-12 text-center">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          No IP admissions found in the current page. Switch to Grid view to see OP notes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        // Figure out whether the admission is still active. We treat an
        // admission as active when the latest note is still unsigned and
        // no "Active until discharge" signal is missing. A more precise
        // check lives in the IP module itself; the list here is best-effort.
        const hasActiveNote = group.notes.some((n) => n.status !== 'finalized');

        return (
          <section key={group.admissionId} className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl bg-surface-container-lowest shadow-sanctuary p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-headline text-sm font-semibold">{group.patientLabel}</span>
                  <span className="text-[10px] text-muted-foreground">MRN: {group.mrn}</span>
                  {hasActiveNote ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/10 text-primary-container px-2 py-0.5 text-[10px] font-semibold">
                      <Clock className="h-2.5 w-2.5" />
                      Active — timeline open
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                      <Lock className="h-2.5 w-2.5" />
                      All entries signed
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  First entry {formatDate(group.firstNoteAt)} · Last entry{' '}
                  {formatDate(group.lastNoteAt)} · {group.notes.length} progress{' '}
                  {group.notes.length === 1 ? 'entry' : 'entries'}
                </p>
              </div>
            </div>

            <div className="relative ml-5 border-l border-border/60 pl-1 space-y-3">
              {group.notes.map((n) => {
                const isAuthor =
                  !currentUserId ||
                  !n.doctor ||
                  !(n.doctor as any).userId ||
                  (n.doctor as any).userId === currentUserId;
                return (
                  <TimelineEntry
                    key={n.id}
                    note={n}
                    isAuthor={isAuthor}
                    onEdit={onEdit}
                    onShowAmendments={onShowAmendments}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
