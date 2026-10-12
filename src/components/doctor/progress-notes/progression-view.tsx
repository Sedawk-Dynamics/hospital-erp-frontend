'use client';
import { useMemo, useState } from 'react';
import { Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import type { ProgressNote } from '@/hooks/use-doctor';

type SoapKey = (typeof SOAP_PARTS)[number]['key'];
type SoapFilter = 'all' | SoapKey;

const SOAP_PARTS = [
  { key: 'subjective', label: 'S', hint: 'Subjective' },
  { key: 'objective', label: 'O', hint: 'Objective' },
  { key: 'assessment', label: 'A', hint: 'Assessment' },
  { key: 'plan', label: 'P', hint: 'Plan' },
] as const;

function doctorName(n: ProgressNote): string {
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

export function ProgressionView({ notes }: { notes: ProgressNote[] }) {
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [soapFilter, setSoapFilter] = useState<SoapFilter>('all');

  const ordered = useMemo(
    () => [...notes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [notes],
  );

  const dayOptions = useMemo(() => {
    const seen = new Set<number>();
    for (const n of notes) {
      const d = n.noteDay ?? n.hospitalDay ?? null;
      if (d != null) seen.add(d);
    }
    return Array.from(seen)
      .sort((a, b) => a - b)
      .map((d) => ({ value: String(d), label: `Day ${d}` }));
  }, [notes]);

  const visible = dayFilter === 'all'
    ? ordered
    : ordered.filter((n) => String(n.noteDay ?? n.hospitalDay ?? '') === dayFilter);

  const shownParts = soapFilter === 'all' ? SOAP_PARTS : SOAP_PARTS.filter((p) => p.key === soapFilter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low/40 p-2">
        <div className="w-40">
          <SearchableSelect
            size="sm"
            options={[{ value: 'all', label: 'All days' }, ...dayOptions]}
            value={dayFilter}
            onChange={(v) => setDayFilter(v ?? 'all')}
            placeholder="All days"
            searchPlaceholder="Search day…"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-outline-variant/40 p-0.5">
          {([
            { key: 'all', label: 'ALL 4 Categories' },
            { key: 'subjective', label: 'Subjective (S)' },
            { key: 'objective', label: 'Objective (O)' },
            { key: 'assessment', label: 'Assessment (A)' },
            { key: 'plan', label: 'Plan (P)' },
          ] as const).map((o) => (
            <Button
              key={o.key}
              size="sm"
              type="button"
              variant={soapFilter === o.key ? 'default' : 'ghost'}
              className="h-6 px-2 text-[11px] font-semibold"
              onClick={() => setSoapFilter(o.key)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      {visible.map((n) => {
        const day = n.noteDay ?? n.hospitalDay ?? null;
        const when = formatDateTime(n.noteAt ?? n.createdAt);
        return (
          <div key={n.id} className="overflow-hidden rounded-lg border border-outline-variant/40 bg-card">
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
                'grid gap-2 p-3',
                shownParts.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-4',
              )}
            >
              {shownParts.map((p) => {
                const text = n[p.key]?.free?.trim();
                return (
                  <div key={p.key} className="rounded-md border border-outline-variant/30 bg-surface-container-low/40 p-2">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/15 text-[9px] font-bold text-primary">
                        {p.label}
                      </span>
                      <span className="text-xs font-bold  tracking-wide text-foreground">
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
      })}
    </div>
  );
}
