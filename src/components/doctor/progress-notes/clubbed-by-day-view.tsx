'use client';

import { CalendarDays, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProgressNote, Vital } from '@/hooks/use-doctor';
import { NoteVitals } from './note-vitals';
import { SOAP_PARTS,doctorName } from './progression-view';

function noteDate(n: ProgressNote): Date {
  return new Date(n.noteAt ?? n.createdAt);
}

function formatTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

interface DayGroup {
  key: string;
  dayNumber: number | null;
  date: Date;
  notes: ProgressNote[];
}

function groupByDay(notes: ProgressNote[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const n of notes) {
    const day = n.noteDay ?? n.hospitalDay ?? null;
    const date = noteDate(n);
    const key = day != null ? `day-${day}` : `date-${date.toDateString()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.notes.push(n);
    } else {
      groups.set(key, { key, dayNumber: day, date, notes: [n] });
    }
  }
  const ordered = Array.from(groups.values());
  ordered.forEach((g) =>
    g.notes.sort((a, b) => noteDate(a).getTime() - noteDate(b).getTime()),
  );
  ordered.sort((a, b) => {
    if (a.dayNumber != null && b.dayNumber != null) return a.dayNumber - b.dayNumber;
    return a.date.getTime() - b.date.getTime();
  });
  return ordered;
}

export function ClubbedByDayView({
  notes,
  vitalsByNote,
}: {
  notes: ProgressNote[];
  vitalsByNote?: Map<string, Vital>;
}) {
  const days = groupByDay(notes);
  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant/50 py-6 text-center">
        <p className="text-xs text-muted-foreground">No progress notes to group yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {days.map((g) => (
        <div key={g.key} className="overflow-hidden rounded-xl border border-outline-variant/50 shadow-sm">
          {/* Main day header — the dominant divider between days. */}
          <div className="flex items-center gap-2 bg-primary px-3 py-2.5">
            <CalendarDays className="h-4 w-4 text-white" />
            <span className="text-sm font-extrabold text-white">
              {g.dayNumber != null ? `Day ${g.dayNumber}` : formatDate(g.date)}
            </span>
            {g.dayNumber != null && (
              <span className="text-[11px] font-medium text-white/80">{formatDate(g.date)}</span>
            )}
            <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
              {g.notes.length} note{g.notes.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2 bg-surface-container-low/30 p-2">
          {g.notes.map((n) => {
            const when = formatTime(n.noteAt ?? n.createdAt);
            return (
              <div key={n.id} className="overflow-hidden rounded-lg border border-outline-variant/40 bg-card">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-outline-variant/40 bg-surface-container-high px-3 py-2">
                  {n.noteTitle && (
                    <span className="text-xs font-bold text-foreground">{n.noteTitle}</span>
                  )}
                  {n.status === 'finalized' && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">Signed</Badge>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3" /> {doctorName(n)}
                  </span>
                  {when && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {when}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 p-3">
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
                        {p.key === 'objective' && vitalsByNote?.get(n.id) && (
                          <NoteVitals vital={vitalsByNote.get(n.id)!} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ))}
    </div>
  );
}
