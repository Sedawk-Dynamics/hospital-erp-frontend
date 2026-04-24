'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, History, Loader2, User } from 'lucide-react';
import { useProgressNoteAmendments, type ProgressNoteAmendmentEntry } from '@/hooks/use-doctor';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

// Collapsed preview for long field values.
function preview(value: string | null): string {
  if (!value) return '—';
  if (value.length <= 120) return value;
  return `${value.slice(0, 120)}…`;
}

function AmendmentRow({ amendment }: { amendment: ProgressNoteAmendmentEntry }) {
  const editorName = amendment.editor
    ? `${amendment.editor.firstName}${amendment.editor.lastName ? ' ' + amendment.editor.lastName : ''}`
    : 'Unknown';

  return (
    <div className="rounded-lg border p-3 bg-surface-container-lowest">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
          {amendment.fieldName}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {formatDateTime(amendment.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <User className="h-3 w-3" />
          {editorName}
        </span>
      </div>

      {amendment.reason && (
        <p className="text-xs italic text-on-surface-variant mb-2">
          Reason: {amendment.reason}
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] items-center">
        <div className="rounded-md bg-error/5 p-2 text-xs min-h-[2rem]">
          <div className="font-label text-[9px] uppercase tracking-wider text-error mb-0.5">
            Previous
          </div>
          <div className={cn('whitespace-pre-wrap break-words', !amendment.previousValue && 'text-muted-foreground')}>
            {preview(amendment.previousValue)}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block justify-self-center" />
        <div className="rounded-md bg-primary/5 p-2 text-xs min-h-[2rem]">
          <div className="font-label text-[9px] uppercase tracking-wider text-primary mb-0.5">
            New
          </div>
          <div className={cn('whitespace-pre-wrap break-words', !amendment.newValue && 'text-muted-foreground')}>
            {preview(amendment.newValue)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AmendmentHistoryDialog({
  open,
  onOpenChange,
  noteId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string | null;
}) {
  const { data: amendments = [], isLoading } = useProgressNoteAmendments(noteId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Amendment History
          </DialogTitle>
          <DialogDescription>
            Append-only log of every field edited on this note. Entries are never overwritten.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : amendments.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No amendments recorded for this note.
          </div>
        ) : (
          <div className="space-y-2">
            {amendments.map((a) => (
              <AmendmentRow key={a.id} amendment={a} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
