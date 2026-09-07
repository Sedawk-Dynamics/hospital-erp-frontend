'use client';

import { type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date-utils';

// ============================================================
// The pieces every GST report shares.
//
// The report chapter of the spec asks for the same five things on all of them —
// a period, an export, drill-through, a provenance footer, and a loud marker
// when figures do not tie. They live here so a report cannot be built without
// them, rather than being remembered separately twenty-one times.
//
// Money is formatted, never recomputed. Every figure on these screens was
// assembled on the server; a browser that re-adds a column is a second opinion,
// and a return carrying two opinions is one nobody can file.
// ============================================================

export const money = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Bare number for a dense table — the column header already says it is money. */
export const plain = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(2)}%`;

export const titleCase = (s: string | null | undefined) =>
  (s ?? '—').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export interface Column<T> {
  key: string;
  label: string;
  align?: 'right' | 'center';
  /** The cell as rendered. */
  cell: (row: T) => ReactNode;
  /** The cell as exported — falls back to the rendered value when a string. */
  csv?: (row: T) => string | number;
}

/**
 * A dense table with a sticky header.
 *
 * Wide reports scroll INSIDE the table rather than pushing the page sideways —
 * the sales register is twenty columns and a horizontally-scrolling page makes
 * the period controls unreachable.
 */
export function ReportTable<T>({
  columns,
  rows,
  empty = 'Nothing in this period.',
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  footer?: ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-max text-sm">
        <thead className="sticky top-0 bg-muted/60">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t hover:bg-muted/30">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`whitespace-nowrap px-3 py-1.5 ${
                    c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : ''
                  }`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot className="border-t-2 bg-muted/40 font-semibold">{footer}</tfoot> : null}
      </table>
    </div>
  );
}

/** The headline figures above a report, so the answer is readable at a glance. */
export function StatStrip({
  stats,
}: {
  stats: Array<{ label: string; value: string; tone?: 'good' | 'warn' | 'bad'; hint?: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              s.tone === 'bad' ? 'text-red-600' : s.tone === 'warn' ? 'text-amber-600' : s.tone === 'good' ? 'text-emerald-600' : ''
            }`}
          >
            {s.value}
          </p>
          {s.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Whether the figures tie back to the register.
 *
 * Shown loudly and shown even when everything agrees: an accountant needs to
 * see that the check RAN. A reconciliation that only appears when it fails is
 * indistinguishable from one nobody wired up.
 */
export function TieBack({ agrees, detail }: { agrees: boolean; detail: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        agrees ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900'
      }`}
    >
      {agrees ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>
        <p className="font-medium">
          {agrees ? 'Ties back to the sales register' : 'Does NOT tie back to the sales register'}
        </p>
        <p className="text-xs">{detail}</p>
      </div>
    </div>
  );
}

/** A note the report itself carries — coverage, a rule, a caveat. */
export function ReportNotes({ notes }: { notes: string[] }) {
  if (!notes?.length) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <ul className="space-y-1 text-xs text-amber-900">
        {notes.map((n, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

/**
 * Export what is on screen.
 *
 * CSV rather than a server round trip: the figures are already here, and a
 * second request could return a different set if a bill were raised between the
 * two — an export that does not match the screen it came from is worse than no
 * export.
 */
export function exportCsv<T>(name: string, columns: Column<T>[], rows: T[], period: { from?: string; to?: string }) {
  const cell = (c: Column<T>, r: T) => {
    const v = c.csv ? c.csv(r) : c.cell(r);
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  };
  const lines = [
    columns.map((c) => `"${c.label}"`).join(','),
    ...rows.map((r) => columns.map((c) => `"${cell(c, r).replace(/"/g, '""')}"`).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_${period.from ?? 'all'}_${period.to ?? 'all'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="mr-1.5 h-4 w-4" /> Export CSV
    </Button>
  );
}

/**
 * Who ran this, when, and for what period.
 *
 * A printed report with no provenance is useless in an audit — it could have
 * been run on any day, over any range, by anyone.
 */
export function Provenance({
  runBy,
  from,
  to,
}: {
  runBy: string | null;
  from?: string;
  to?: string;
}) {
  return (
    <p className="pt-2 text-xs text-muted-foreground">
      Run by {runBy ?? 'unknown user'} on {formatDate(new Date())}
      {from || to ? ` · period ${from ?? '—'} to ${to ?? '—'}` : ' · all periods'}
    </p>
  );
}
