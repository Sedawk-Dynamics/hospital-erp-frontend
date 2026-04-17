'use client';

import { useMemo } from 'react';
import { Unlock, Lock, Clock, Loader2, FileText } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useUnlockedProgressNotes,
  useRelockProgressNote,
} from '@/hooks/use-doctor';
import { formatDateTimeAmPm } from '@/lib/date-utils';

interface UnlockedNotesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function remainingLabel(isoUntil: string) {
  const msLeft = new Date(isoUntil).getTime() - Date.now();
  if (msLeft <= 0) return 'expired';
  const mins = Math.floor(msLeft / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m left`;
}

export function UnlockedNotesSheet({ open, onOpenChange }: UnlockedNotesSheetProps) {
  const { data, isLoading, refetch } = useUnlockedProgressNotes(true);
  const relockMutation = useRelockProgressNote();

  const notes = useMemo(() => data ?? [], [data]);

  const handleRelock = async (id: string) => {
    if (!window.confirm('Re-lock this note? It will no longer be editable.')) return;
    try {
      await relockMutation.mutateAsync(id);
      toast.success('Note re-locked');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to re-lock note');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-primary" />
            Unlocked Notes
          </SheetTitle>
          <SheetDescription>
            Progress notes temporarily unlocked for editing. They re-lock automatically when the
            window expires.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No notes currently unlocked.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open any archived / finalized note from the progress-notes page and click
                &ldquo;Unlock&rdquo; to give yourself an editing window.
              </p>
            </div>
          ) : (
            notes.map((n) => {
              const patientName = n.patient
                ? `${n.patient.firstName} ${n.patient.lastName ?? ''}`.trim()
                : '—';
              const label = remainingLabel(n.unlockedUntil);
              const expired = label === 'expired';
              return (
                <div
                  key={n.id}
                  className="rounded-lg border bg-surface-container-lowest p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{patientName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        MRN: {n.patient?.mrn || '-'} · {n.noteType || 'note'} ·{' '}
                        {n.visit?.visitType?.toUpperCase() ?? '—'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        expired
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-secondary/10 text-secondary'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {label}
                    </span>
                  </div>

                  {n.content && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Updated {formatDateTimeAmPm(n.updatedAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => handleRelock(n.id)}
                      disabled={relockMutation.isPending}
                    >
                      <Lock className="h-3 w-3" />
                      Re-lock
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
