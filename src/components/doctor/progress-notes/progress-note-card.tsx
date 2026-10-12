'use client';

// One progress note rendered as an always-expanded card: a tinted heading bar
// (day · title · doctor · time) over the four SOAP parts. Shared by every view
// so the note always looks the same; only `soapColumns` differs — the
// progression view lays S/O/A/P across 4 columns, the day view stacks them.

import { Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProgressNote } from '@/hooks/use-doctor';

export const SOAP_PARTS = [
  { key: 'subjective', label: 'S', hint: 'Subjective' },
  { key: 'objective', label: 'O', hint: 'Objective' },
  { key: 'assessment', label: 'A', hint: 'Assessment' },
  { key: 'plan', label: 'P', hint: 'Plan' },
] as const;

export function doctorName(n: ProgressNote): string {
  const u = n.doctor?.user;
  const full = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim();
  return full ? `Dr. ${full}` : 'Doctor';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProgressNoteCard({
  note
}: {
  note: ProgressNote;
}) {
  const n = note;
  const day = n.noteDay ?? n.hospitalDay ?? null;
  const when = formatDateTime(n.noteAt ?? n.createdAt);
  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-card">
      {/* Heading bar — tinted so each note reads as a distinct block. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-outline-variant/40 bg-primary px-3 py-2">
        {day != null && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
            D{day}
          </span>
        )}
        {n.noteTitle && (
          <span className="text-xs font-extrabold text-white">{n.noteTitle}</span>
        )}
        {n.status === 'finalized' && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">Signed</Badge>
        )}
        <span className="flex items-center gap-1 text-[10px] text-white/80">
          <User className="h-3 w-3" /> {doctorName(n)}
        </span>
        {when && (
          <span className="flex items-center gap-1 text-[10px] text-white/80">
            <Clock className="h-3 w-3" /> {when}
          </span>
        )}
      </div>

      <div
        className={cn(
          'grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4' 
        )}
      >
        {SOAP_PARTS.map((p) => {
          const text = n[p.key]?.free?.trim();
          return (
            <div key={p.key} className="rounded-md border border-outline-variant/30 bg-surface-container-low/40 p-2">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/15 text-[9px] font-bold text-primary">
                  {p.label}
                </span>
                <span className="text-xs font-bold tracking-wide text-foreground">
                  {p.hint}
                </span>
              </div>
              <p className={cn('whitespace-pre-wrap text-xs', text ? 'text-foreground' : 'text-muted-foreground')}>
                {text || '—'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
