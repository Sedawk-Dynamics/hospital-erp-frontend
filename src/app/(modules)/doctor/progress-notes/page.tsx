'use client';

// The standalone Progress Notes page was replaced by the consultation
// page, which is now the single entry point for recording + editing
// progress notes (it creates + edits the underlying ProgressNote row on
// Finish Consultation). This page now serves as a read-only history of
// past SOAP notes across all patients the logged-in doctor has seen —
// useful for cross-patient review without leaving the Doctor module.

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import {
  useProgressNotes,
  type ProgressNote,
} from '@/hooks/use-doctor';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  Clock,
  FileText,
  History,
  Loader2,
  Lock,
  Pin,
  Search,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmendmentHistoryDialog } from '@/components/doctor/progress-notes-amendment-history';
import { IpAdmissionTimeline } from '@/components/doctor/progress-notes-ip-timeline';

const STATUS_FILTERS = ['all', 'active', 'signed'] as const;

function truncate(content: string | undefined | null, max = 200): string {
  if (!content) return '';
  const clean = content.replace(/\*\*/g, '');
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function patientName(note: ProgressNote): string {
  if (!note.patient) return 'Unknown';
  return (
    `${note.patient.firstName ?? ''} ${note.patient.lastName ?? ''}`.trim().toUpperCase() ||
    'Unknown'
  );
}

export default function ProgressNotesHistoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [page, setPage] = useState(1);

  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const [amendmentNoteId, setAmendmentNoteId] = useState<string | null>(null);

  const { data: notesData, isLoading } = useProgressNotes({
    page,
    limit: 30,
    search: search || undefined,
  });

  const notes = notesData?.data ?? [];
  const meta = notesData?.meta;

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return notes;
    if (statusFilter === 'signed') return notes.filter((n) => n.status === 'finalized');
    return notes.filter((n) => n.status !== 'finalized');
  }, [notes, statusFilter]);

  const openConsultation = useCallback(
    (note: ProgressNote) => {
      // The note is authored inside the patient's consultation page;
      // we deep-link there so doctors can jump straight from history
      // to the owning visit.
      if (!note.patient?.id) return;
      router.push(`/doctor/consultation/${note.patient.id}`);
    },
    [router],
  );

  const openAmendments = (note: ProgressNote) => {
    setAmendmentNoteId(note.id);
    setAmendmentOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold">Progress Notes — History</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Read-only archive of SOAP notes across your patients. New notes are authored inside
            each patient&apos;s <em>Consultation</em> page.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f}
              variant={statusFilter === f ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => {
                setStatusFilter(f);
                setPage(1);
              }}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Signed'}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('timeline')}
          >
            IP Timeline
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes by content..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-xs w-[240px]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading notes…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No progress notes found.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Notes are created when you finish a consultation. Open a patient&apos;s appointment to start
            one.
          </p>
        </div>
      ) : viewMode === 'timeline' ? (
        <IpAdmissionTimeline
          notes={filtered}
          currentUserId={user?.id}
          onEdit={openConsultation}
          onShowAmendments={openAmendments}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => {
            const isSigned = note.status === 'finalized';
            const pinCount = note.pins?.length ?? (note.pinToDischargeSummary ? 1 : 0);
            const amendmentCount = note._count?.amendments ?? note.amendments?.length ?? 0;
            return (
              <div
                key={note.id}
                className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{patientName(note)}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        MRN: {note.patient?.mrn ?? '-'} · {formatDateTime(note.createdAt)}
                        {note.doctor?.user && (
                          <>
                            {' · '}
                            <Stethoscope className="inline h-2.5 w-2.5" /> Dr.{' '}
                            {note.doctor.user.firstName} {note.doctor.user.lastName ?? ''}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSigned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                        <Lock className="h-2 w-2" />
                        Signed
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-secondary/10 text-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                        <Clock className="h-2 w-2 mr-0.5" />
                        Active
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
                        onClick={() => openAmendments(note)}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                      >
                        <History className="h-2 w-2" />
                        {amendmentCount}
                      </button>
                    )}
                  </div>
                </div>

                <p className={cn('text-xs text-on-surface-variant whitespace-pre-line leading-snug line-clamp-3')}>
                  {truncate(note.content)}
                </p>

                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => openConsultation(note)}
                  >
                    Open consultation →
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest shadow-sanctuary px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Showing {filtered.length} of {meta.total} notes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {meta.totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AmendmentHistoryDialog
        open={amendmentOpen}
        onOpenChange={(o) => {
          setAmendmentOpen(o);
          if (!o) setAmendmentNoteId(null);
        }}
        noteId={amendmentNoteId}
      />
    </div>
  );
}
