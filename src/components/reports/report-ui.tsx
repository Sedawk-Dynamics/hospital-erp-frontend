'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { downloadCsv, type CsvRow } from '@/lib/csv';

/** Indian-format rupee. */
export const inr = (n: number | null | undefined) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Compact number (1.2K / 3.4L). */
export const compact = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const TONES: Record<string, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
};

export function StatCard({
  label, value, sub, tone = 'default',
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className="rounded-xl border bg-surface-container-lowest p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', TONES[tone])}>{value}</p>
      {sub != null && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ReportSection({
  title, description, csv, right, children,
}: {
  title: string;
  description?: string;
  csv?: { filename: string; rows: CsvRow[] };
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-sm font-bold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {right}
          {csv && csv.rows.length > 0 && (
            <Button variant="outline" size="xs" className="gap-1" onClick={() => downloadCsv(csv.filename, csv.rows)}>
              <Download className="h-3 w-3" /> CSV
            </Button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A labelled horizontal bar (share / value distribution). */
export function BarRow({
  label, value, max, valueLabel, tone = 'primary',
}: { label: React.ReactNode; value: number; max: number; valueLabel?: React.ReactNode; tone?: 'primary' | 'emerald' | 'amber' | 'red' | 'blue' }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const bg: Record<string, string> = {
    primary: 'bg-primary', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500',
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 truncate text-muted-foreground" title={typeof label === 'string' ? label : undefined}>{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted/40">
        <div className={cn('h-full rounded', bg[tone])} style={{ width: `${w}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right font-medium tabular-nums">{valueLabel}</span>
    </div>
  );
}

/** Vertical mini bar chart for a daily trend (no chart lib). */
export function TrendBars({
  data, valueKey, height = 64, tone = 'primary',
}: { data: { date: string; [k: string]: any }[]; valueKey: string; height?: number; tone?: 'primary' | 'emerald' }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  const bg = tone === 'emerald' ? 'bg-emerald-500/80' : 'bg-primary/80';
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const h = Math.round((v / max) * height);
        return (
          <div
            key={i}
            className={cn('flex-1 rounded-t transition-colors hover:bg-primary', bg)}
            style={{ height: Math.max(1, h) }}
            title={`${d.date}: ${v.toLocaleString('en-IN')}`}
          />
        );
      })}
    </div>
  );
}

/** Simple table primitives kept lightweight + consistent across reports. */
export function RTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border sanctuary-scrollbar">
      <table className="w-full text-xs">{children}</table>
    </div>
  );
}
export function RHead({ cols }: { cols: { label: string; align?: 'left' | 'right' }[] }) {
  return (
    <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
      <tr>
        {cols.map((c, i) => (
          <th key={i} className={cn('px-2.5 py-1.5 font-semibold', c.align === 'right' ? 'text-right' : 'text-left')}>{c.label}</th>
        ))}
      </tr>
    </thead>
  );
}
