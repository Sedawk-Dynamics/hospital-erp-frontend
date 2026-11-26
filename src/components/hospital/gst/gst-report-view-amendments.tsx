'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, History, Info, Lock } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import {
  Column, DrillThrough, ExportButton, Loading, ReportTable, StatStrip,
  exportAll, money, plain, formatReturnPeriod,
} from './gst-report-shell';
import type { AmendmentRow, GstReportQuery } from '@/hooks/use-gst-reports';
import * as R from '@/hooks/use-gst-reports';

// ============================================================
// A-13 — GSTR-1 amendments: tables 9A, 9C and 10.
//
// The screen has one job that no other report has: to make the reader
// understand that an amendment is not an edit. What is listed here is declared
// in the CURRENT return against the original document's number and period; the
// original invoice is never touched. The wording says so in the places somebody
// might otherwise reach for the wrong tool.
//
// The period picker at the top of the reports page is deliberately ignored.
// An amendment belongs to the month being filed and corrects an earlier one, so
// "what happened in March" is the wrong question — the right one is "what has
// moved since I filed anything".
// ============================================================

/** MMYYYY shown the way a person reads it — the one shared formatter (gap item 310). */
const periodLabel = (mmyyyy: string) => formatReturnPeriod(mmyyyy);

const TABLE_HINTS: Record<string, string> = {
  '9A': 'B2B invoice — amended against its own number',
  '9C': 'Credit or debit note',
  '10': 'B2C — the corrected total for the state and rate, not the bills',
};

function ChangeChip({ change }: { change: string }) {
  const tone =
    change === 'added'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : change === 'removed'
        ? 'border-red-300 bg-red-50 text-red-800'
        : 'border-primary/30 bg-primary/10 text-primary';
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {change === 'added' ? 'Missing from the return' : change === 'removed' ? 'Gone' : 'Changed'}
    </span>
  );
}

const cols: Column<AmendmentRow>[] = [
  {
    key: 'tbl',
    label: 'Table',
    cell: (r) => (
      <span className="font-mono text-xs font-semibold" title={TABLE_HINTS[r.table]}>
        {r.table}
      </span>
    ),
    csv: (r) => r.table,
  },
  { key: 'per', label: 'Original period', cell: (r) => periodLabel(r.originalPeriod), csv: (r) => periodLabel(r.originalPeriod) },
  {
    key: 'num',
    label: 'Original document',
    cell: (r) => <span className="font-mono text-xs">{r.originalNumber}</span>,
    csv: (r) => r.originalNumber,
  },
  { key: 'dt', label: 'Original date', cell: (r) => (r.originalDate ? r.originalDate : '—'), csv: (r) => r.originalDate ?? '' },
  { key: 'ch', label: 'Change', cell: (r) => <ChangeChip change={r.change} />, csv: (r) => r.change },
  {
    key: 'gstin',
    label: 'Recipient GSTIN',
    cell: (r) => <span className="font-mono text-xs">{r.recipientGstin ?? '—'}</span>,
    csv: (r) => r.recipientGstin ?? '',
  },
  { key: 'was', label: 'As filed', align: 'right', cell: (r) => (r.filedValue == null ? '—' : plain(r.filedValue)), csv: (r) => r.filedValue ?? '' },
  { key: 'now', label: 'Today', align: 'right', cell: (r) => (r.currentValue == null ? '—' : plain(r.currentValue)), csv: (r) => r.currentValue ?? '' },
  {
    key: 'diff',
    label: 'Difference',
    align: 'right',
    cell: (r) => (
      <span className={r.difference < 0 ? 'font-medium text-red-600' : 'font-medium text-emerald-700'}>
        {r.difference > 0 ? '+' : ''}
        {plain(r.difference)}
      </span>
    ),
    csv: (r) => r.difference,
  },
  { key: 'taxwas', label: 'Tax as filed', align: 'right', cell: (r) => (r.filedTax == null ? '—' : plain(r.filedTax)), csv: (r) => r.filedTax ?? '' },
  { key: 'taxnow', label: 'Tax today', align: 'right', cell: (r) => (r.currentTax == null ? '—' : plain(r.currentTax)), csv: (r) => r.currentTax ?? '' },
  { key: 'why', label: 'Why', cell: (r) => <span className="text-xs">{r.reason}</span>, csv: (r) => r.reason },
];

type CorrectionRow = {
  returnPeriod: string; action: string; version: number | null; reason: string | null; at: string; by?: string | null;
};
const CORRECTION_LABEL: Record<string, string> = {
  unlocked: 'Reopened for correction',
  refiled: 'Correction filed',
  locked: 'Locked again',
};
/** Gap 281: the reopen / correction trail across every filed period. */
const correctionCols: Column<CorrectionRow>[] = [
  { key: 'p', label: 'Period', cell: (c) => periodLabel(c.returnPeriod), csv: (c) => periodLabel(c.returnPeriod) },
  { key: 'at', label: 'When', cell: (c) => formatDateTime(c.at), csv: (c) => formatDateTime(c.at) },
  { key: 'a', label: 'What', cell: (c) => CORRECTION_LABEL[c.action] ?? c.action, csv: (c) => CORRECTION_LABEL[c.action] ?? c.action },
  { key: 'v', label: 'Snapshot', cell: (c) => (c.version ? `v${c.version}` : '—'), csv: (c) => (c.version ? `v${c.version}` : '') },
  { key: 'by', label: 'By', cell: (c) => c.by ?? '—', csv: (c) => c.by ?? '' },
  { key: 'r', label: 'Reason', cell: (c) => <span className="text-xs">{c.reason ?? '—'}</span>, csv: (c) => c.reason ?? '' },
];

export function AmendmentsView({ q }: { q: GstReportQuery }) {
  // The shared period is not passed through — see the file header.
  void q;
  const { data, isLoading } = R.useGstr1Amendments({});
  // Gap 282: every headline figure opens the amendment rows behind it.
  const [focus, setFocus] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const s = data?.summary;
  const periods = data?.periods ?? [];
  const clean = (s?.amendments ?? 0) === 0;
  const drills: Record<string, AmendmentRow[]> = {
    Amendments: rows,
    'Table 9A': rows.filter((r) => r.table === '9A'),
    'Table 9C': rows.filter((r) => r.table === '9C'),
    'Table 10': rows.filter((r) => r.table === '10'),
    'Net value change': rows.filter((r) => r.difference !== 0),
  };
  const drillRows = focus ? drills[focus] ?? [] : [];
  const pick = (label: string) => setFocus(focus === label ? null : label);
  const corrections: CorrectionRow[] = periods.flatMap((p) =>
    (p.corrections ?? []).map((c) => ({ ...c, returnPeriod: p.returnPeriod })),
  );
  const statOf = (label: string) => ({ onClick: () => pick(label), active: focus === label });

  return (
    <div className="space-y-4">
      {/* Said before the figures, because reaching for the wrong tool here is
          how a hospital ends up editing a filed invoice. */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          An amendment is not an edit. Everything listed here is declared in the{' '}
          <strong>current</strong> return, against the original document&apos;s number and period —
          the original invoice is never changed.
        </p>
      </div>

      <StatStrip
        stats={[
          {
            label: 'Filed periods',
            value: String(s?.filedPeriods ?? 0),
            hint: `${s?.comparablePeriods ?? 0} comparable — listed below`,
          },
          {
            label: 'Amendments',
            value: String(s?.amendments ?? 0),
            tone: clean ? 'good' : 'warn',
            ...statOf('Amendments'),
          },
          { label: 'Table 9A', value: String(s?.table9A ?? 0), hint: 'B2B invoices', ...statOf('Table 9A') },
          { label: 'Table 9C', value: String(s?.table9C ?? 0), hint: 'credit / debit notes', ...statOf('Table 9C') },
          { label: 'Table 10', value: String(s?.table10 ?? 0), hint: 'B2C totals', ...statOf('Table 10') },
          {
            label: 'Net value change',
            value: money(s?.netValueChange),
            tone: (s?.netValueChange ?? 0) === 0 ? 'good' : 'warn',
            hint: 'Signed — this one nets off, because that is what is being declared',
            ...statOf('Net value change'),
          },
        ]}
      />
      <DrillThrough
        open={!!focus}
        onClose={() => setFocus(null)}
        title={focus ? `${focus} — the documents behind it` : ''}
        subtitle={`${drillRows.length} row(s) · net difference ${money(drillRows.reduce((t, r) => t + r.difference, 0))}`}
        columns={cols}
        rows={drillRows}
      />

      <div
        className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
          clean ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'
        }`}
      >
        {clean ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <p>{data?.note}</p>
      </div>

      {/* Every filed period and whether it can be compared at all. A period
          filed before the snapshot carried document detail reports nothing —
          which is not the same as reporting no amendments, and the difference
          is the whole value of this report. */}
      {periods.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {periods.map((p) => (
            <div
              key={p.returnPeriod}
              className="flex items-start justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{periodLabel(p.returnPeriod)}</span>
                {p.locked ? (
                  <span title="Locked — bills in this period cannot be edited">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  filed {formatDate(p.filedAt)}
                  {p.status ? ` · ${p.status === 'filed_locked' ? 'Filed – Locked' : 'Filed – Unlocked'}` : ''}
                  {/* The same as-filed figures C-6 shows, from the same snapshot (gap item 281). */}
                  {p.filed ? ` · outward tax as filed ${money(p.filed.outwardTax)} on ${money(p.filed.outwardTaxableValue)}` : ''}
                </span>
              </div>
              <div className="max-w-[60%] space-y-1 text-right">
                <p
                  className={`text-xs ${
                    !p.comparable ? 'text-amber-700' : p.amendments > 0 ? 'text-amber-700' : 'text-muted-foreground'
                  }`}
                >
                  {p.note}
                </p>
                {/* Gap 281: what this period is compared against. */}
                <p className="text-[11px] text-muted-foreground">
                  Compared with{' '}
                  {p.baseline?.kind === 'declared' && p.baseline.inPeriod
                    ? `the amendments already declared in the ${periodLabel(p.baseline.inPeriod)} return`
                    : 'the original filed snapshot'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Gap 281: every reopen and correction of a filed period — who, when, why. */}
      {corrections.length > 0 ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <History className="h-4 w-4" /> Reopens and corrections of filed periods
            </h3>
            <ExportButton {...exportAll('A13-period-corrections', correctionCols, corrections, {})} />
          </div>
          <ReportTable columns={correctionCols} rows={corrections} />
        </section>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="flex justify-end">
            <ExportButton
              {...exportAll('A13-gstr1-amendments', cols, rows, {}, {
                stats: [
                  { label: 'Amendments', value: String(s?.amendments ?? 0) },
                  { label: 'Table 9A', value: String(s?.table9A ?? 0) },
                  { label: 'Table 9C', value: String(s?.table9C ?? 0) },
                  { label: 'Table 10', value: String(s?.table10 ?? 0) },
                  { label: 'Net value change', value: money(s?.netValueChange) },
                ],
              })}
            />
          </div>
          <ReportTable columns={cols} rows={rows} />
        </>
      ) : null}
    </div>
  );
}
