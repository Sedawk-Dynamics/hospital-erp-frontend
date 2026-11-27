'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { FileJson } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date-utils';
import {
  Column, ExportButton, ExportableTable, Loading, ReportNotes, ReportTable, StatStrip, TieBack,
  DrillThrough, exportCsv, exportXlsx, money, pct, plain, titleCase, exportPdf, exportAll, type Stat,
} from './gst-report-shell';
import type { GstReportQuery } from '@/hooks/use-gst-reports';
import { gstStateName } from '@/lib/gst-states';
import * as R from '@/hooks/use-gst-reports';

// ============================================================
// One view per report.
//
// They deliberately do NOT share a table config: these reports answer different
// questions and a shape that fits all of them fits none. What they share is the
// shell — period, export, tie-back, provenance — which is where the consistency
// the spec asks for actually belongs.
// ============================================================

type Q = GstReportQuery;

/**
 * Gap 282: every headline total opens the rows behind it.
 *
 * One focus per screen. `lines()` builds the drill panel for one figure from
 * rows already on the client (filtered, never re-fetched with other filters),
 * `wire()` makes each stat that has a panel clickable, and `panel()` renders
 * the open one. A stat with no entry in the map (a ratio, a setting, a
 * threshold) stays a plain figure.
 */
export function useStatDrill() {
  const [focus, setFocus] = useState<string | null>(null);
  const close = () => setFocus(null);
  function lines<T>(
    label: string,
    columns: Column<T>[],
    rows: T[],
    opts: { sum?: (r: T) => number; loading?: boolean; note?: string } = {},
  ): ReactNode {
    const total = opts.sum ? Math.round(rows.reduce((t, r) => t + Number(opts.sum!(r) ?? 0), 0) * 100) / 100 : null;
    const subtitle = opts.loading
      ? 'Loading the rows behind this figure…'
      : `${rows.length} row(s)${total != null ? `, adding up to ${money(total)}` : ''}${opts.note ? ` · ${opts.note}` : ''}`;
    return (
      <DrillThrough
        open
        onClose={close}
        title={`${label} — the rows behind it`}
        subtitle={subtitle}
        columns={columns}
        rows={opts.loading ? [] : rows}
      />
    );
  }
  const wire = (stats: Stat[], drills: Record<string, ReactNode>): Stat[] =>
    stats.map((s) =>
      s.label in drills
        ? { ...s, onClick: () => setFocus(focus === s.label ? null : s.label), active: focus === s.label }
        : s,
    );
  const panel = (drills: Record<string, ReactNode>): ReactNode => (focus && focus in drills ? drills[focus] : null);
  return { focus, setFocus, close, lines, wire, panel };
}

/**
 * The headline figures of any set of sales lines, each under its own label —
 * total turnover is NOT taxable value (gap item 278). The same labels go into
 * the PDF export.
 */
function turnoverStats(
  t: R.TurnoverSummary | undefined,
  drill?: { active: string | null; pick: (label: string) => void },
): Stat[] {
  const stats: Stat[] = [
    { label: 'Total turnover', value: money(t?.totalTurnover), hint: 'all supplies, before tax' },
    { label: 'Taxable value', value: money(t?.taxableValue) },
    { label: 'Exempt / nil / non-GST', value: money(t?.exemptNilNonGst) },
    { label: 'CGST', value: money(t?.cgstAmount) },
    { label: 'SGST', value: money(t?.sgstAmount) },
    { label: 'IGST', value: money(t?.igstAmount) },
  ];
  if (!drill) return stats;
  return stats.map((st) => ({ ...st, onClick: () => drill.pick(st.label), active: drill.active === st.label }));
}
const pdfStats = (t: R.TurnoverSummary | undefined) => turnoverStats(t).map(({ label, value }) => ({ label, value }));

/**
 * Gap 278: the export's labelled summary block — the same figures and labels
 * as the screen's header, plus the tax and invoice totals printed under it.
 * Raw numbers, so the spreadsheet can be summed against the lines below.
 */
const turnoverSummaryLines = (t: R.TurnoverSummary | undefined) => [
  { label: 'Total turnover', value: Number(t?.totalTurnover ?? 0) },
  { label: 'Taxable value', value: Number(t?.taxableValue ?? 0) },
  { label: 'Exempt / nil / non-GST value', value: Number(t?.exemptNilNonGst ?? 0) },
  { label: 'CGST', value: Number(t?.cgstAmount ?? 0) },
  { label: 'SGST', value: Number(t?.sgstAmount ?? 0) },
  { label: 'IGST', value: Number(t?.igstAmount ?? 0) },
  { label: 'Total tax', value: Number(t?.taxAmount ?? 0) },
  { label: 'Invoice value', value: Number(t?.invoiceValue ?? 0) },
];

/**
 * The lines behind each headline total (gap 282) — the same partition the
 * server's turnover summary sums, so the drill adds up to the figure clicked.
 */
const TURNOVER_LINES: Record<string, { pick: (l: R.SalesLine) => boolean; sum: (l: R.SalesLine) => number }> = {
  'Total turnover': { pick: () => true, sum: (l) => l.taxableValue },
  'Taxable value': {
    pick: (l) => l.gstTreatment === 'taxable' || l.gstTreatment === 'zero_rated',
    sum: (l) => l.taxableValue,
  },
  'Exempt / nil / non-GST': {
    pick: (l) => l.gstTreatment === 'exempt' || l.gstTreatment === 'nil_rated' || l.gstTreatment === 'non_gst',
    sum: (l) => l.taxableValue,
  },
  CGST: { pick: (l) => Number(l.cgstAmount) !== 0, sum: (l) => l.cgstAmount },
  SGST: { pick: (l) => Number(l.sgstAmount) !== 0, sum: (l) => l.sgstAmount },
  IGST: { pick: (l) => Number(l.igstAmount) !== 0, sum: (l) => l.igstAmount },
};

/** The register lines behind a headline total, and what they add up to. */
function linesBehind(label: string | null, rows: R.SalesLine[]) {
  const f = label ? TURNOVER_LINES[label] : undefined;
  if (!f) return { rows: [] as R.SalesLine[], total: 0 };
  const picked = rows.filter(f.pick);
  return { rows: picked, total: Math.round(picked.reduce((t, l) => t + Number(f.sum(l) ?? 0), 0) * 100) / 100 };
}

const treatmentTone = (t: string | null) =>
  t === 'taxable' ? 'default' : t == null ? 'destructive' : 'secondary';

// ── A-1 ────────────────────────────────────────────────────────────────────

export function SalesRegisterView({ q }: { q: Q }) {
  const { data, isLoading } = R.useSalesRegister(q);
  const rows = data?.rows ?? [];
  // Gap 282: a header total opens the lines behind it.
  const [focus, setFocus] = useState<string | null>(null);

  const columns: Column<R.SalesLine>[] = useMemo(
    () => [
      { key: 'date', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
      { key: 'doc', label: 'Document', cell: (r) => r.invoiceNumber ?? r.billNumber, csv: (r) => r.invoiceNumber ?? r.billNumber },
      { key: 'bill', label: 'Bill No.', cell: (r) => r.billNumber, csv: (r) => r.billNumber },
      { key: 'patient', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
      { key: 'type', label: 'OP/IP', cell: (r) => r.patientType.toUpperCase(), csv: (r) => r.patientType },
      { key: 'dept', label: 'Department', cell: (r) => titleCase(r.department), csv: (r) => r.department },
      { key: 'desc', label: 'Particulars', cell: (r) => r.description, csv: (r) => r.description },
      { key: 'hsn', label: 'HSN/SAC', cell: (r) => r.hsnSac ?? '—', csv: (r) => r.hsnSac ?? '' },
      {
        key: 'treatment',
        label: 'Treatment',
        cell: (r) => (
          <Badge variant={treatmentTone(r.gstTreatment)}>{r.treatmentLabel ?? 'Unclassified'}</Badge>
        ),
        csv: (r) => r.gstTreatment ?? 'unclassified',
      },
      { key: 'qty', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
      { key: 'rate', label: 'Rate', align: 'right', cell: (r) => plain(r.unitPrice), csv: (r) => r.unitPrice },
      // Every line's value before tax — for an exempt line that is not a
      // taxable value, so the column is not called one (gap item 278).
      { key: 'taxable', label: 'Value (before tax)', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
      { key: 'gst', label: 'GST %', align: 'right', cell: (r) => r.taxRatePercent, csv: (r) => r.taxRatePercent },
      { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount },
      { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount },
      { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount },
      { key: 'total', label: 'Amount', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
    ],
    [],
  );

  if (isLoading) return <Loading />;

  const summary = data?.summary;
  const behind = linesBehind(focus, rows);

  return (
    <div className="space-y-4">
      <StatStrip stats={turnoverStats(summary, { active: focus, pick: (l) => setFocus(focus === l ? null : l) })} />
      <DrillThrough
        open={!!focus}
        onClose={() => setFocus(null)}
        title={focus ? `${focus} — the lines behind it` : ''}
        subtitle={`${behind.rows.length} line(s) from this register, adding up to ${money(behind.total)}`}
        columns={columns}
        rows={behind.rows}
      />
      <p className="text-xs text-muted-foreground">
        {rows.length} line(s) · total tax {money(summary?.taxAmount)} · invoice value {money(summary?.invoiceValue)}
        {summary?.unclassifiedValue ? ` · ${money(summary.unclassifiedValue)} carries no treatment` : ''}
      </p>
      <div className="flex justify-end">
        {/* Gap 278: every export carries the header's labelled totals. */}
        <ExportButton
          {...exportAll('gst-sales-register', columns, rows, q, {
            summary: turnoverSummaryLines(summary),
            stats: [
              ...pdfStats(summary),
              { label: 'Total tax', value: money(summary?.taxAmount) },
              { label: 'Invoice value', value: money(summary?.invoiceValue) },
            ],
          })}
          disabled={!rows.length}
        />
      </div>
      <ReportTable columns={columns} rows={rows} />
    </div>
  );
}

// ── A-2 ────────────────────────────────────────────────────────────────────

export function RateSummaryView({ q }: { q: Q }) {
  const { data, isLoading } = R.useRateSummary(q);
  // Section 11.6: "drill-through from any total down to the individual bill
  // lines behind it". A-2 is a fold of A-1, so the lines are one query away and
  // filtered here rather than re-fetched — a drill-down that does not add up to
  // the total it came from is worse than none.
  const register = R.useSalesRegister(q);
  const [drill, setDrill] = useState<{ treatment: string; ratePercent: number; label: string } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  const byRate = data?.byRate ?? [];
  const byDept = data?.byDepartment ?? [];
  const behind = linesBehind(focus, register.data?.rows ?? []);

  const drillRows = drill
    ? (register.data?.rows ?? []).filter(
        (l) =>
          (l.gstTreatment ?? 'unclassified') === drill.treatment &&
          l.taxRatePercent === drill.ratePercent,
      )
    : [];

  /** What a drilled-into figure is made of — one row per bill LINE. */
  const drillCols: Column<R.SalesLine>[] = [
    { key: 'd', label: 'Date', cell: (l) => formatDate(l.billDate), csv: (l) => formatDate(l.billDate) },
    { key: 'inv', label: 'Document', cell: (l) => l.invoiceNumber ?? l.billNumber, csv: (l) => l.invoiceNumber ?? l.billNumber },
    { key: 'p', label: 'Patient', cell: (l) => l.patientName ?? '—', csv: (l) => l.patientName ?? '' },
    { key: 'desc', label: 'Line', cell: (l) => l.description, csv: (l) => l.description },
    { key: 'dep', label: 'Department', cell: (l) => titleCase(l.department), csv: (l) => l.department },
    { key: 'hsn', label: 'HSN / SAC', cell: (l) => l.hsnSac ?? '—', csv: (l) => l.hsnSac ?? '' },
    { key: 'tv', label: 'Taxable value', align: 'right', cell: (l) => plain(l.taxableValue), csv: (l) => l.taxableValue },
    { key: 'tax', label: 'Tax', align: 'right', cell: (l) => plain(l.taxAmount), csv: (l) => l.taxAmount },
    { key: 'src', label: 'Why this rate', cell: (l) => l.rateSource ?? '—', csv: (l) => l.rateSource ?? '' },
  ];

  const rateCols: Column<R.RateSummaryRow>[] = [
    { key: 'rate', label: 'Rate', cell: (r) => (r.treatment === 'taxable' ? `${r.ratePercent}%` : r.label), csv: (r) => (r.treatment === 'taxable' ? `${r.ratePercent}%` : r.label) },
    { key: 'lines', label: 'Lines', align: 'right', cell: (r) => r.count, csv: (r) => r.count },
    // An exempt row's value is not taxable value; the column says what it is.
    { key: 'taxable', label: 'Value of supply', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount },
    { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount },
    { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount },
    { key: 'tax', label: 'Total tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  ];

  return (
    <div className="space-y-6">
      <StatStrip stats={turnoverStats(data?.turnover, { active: focus, pick: (l) => setFocus(focus === l ? null : l) })} />
      <DrillThrough
        open={!!focus}
        onClose={() => setFocus(null)}
        title={focus ? `${focus} — the lines behind it` : ''}
        subtitle={register.isLoading ? 'Loading the register…' : `${behind.rows.length} line(s), adding up to ${money(behind.total)}`}
        columns={drillCols}
        rows={behind.rows}
      />

      {/* The one that gets a return REJECTED rather than merely queried.
          The portal validates every rate against the slabs in force, so a line
          at 2%, 10% or a post-September-2025 12% fails the upload — and this
          hospital's register is full of them. The finalisation gate stops new
          ones; these are already issued and nothing was saying so. */}
      {(data?.illegalRates?.lines ?? 0) > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">
            {data!.illegalRates.lines} line(s) at a rate that was not a legal slab
          </p>
          <p className="mt-1 text-xs">
            {data!.illegalRates.rates.map((r) => `${r}%`).join(', ')} —{' '}
            {money(data!.illegalRates.taxableValue)} of value carrying{' '}
            {money(data!.illegalRates.taxAmount)} of tax. The portal will reject a return
            filed from this register. Correct each with a credit note and a fresh invoice at
            the right rate; the unmapped items report (C-3) lists them.
          </p>
          {data!.illegalRates.bills.length > 0 && (
            <p className="mt-1 font-mono text-[11px]">
              {data!.illegalRates.bills.slice(0, 12).join(', ')}
              {data!.illegalRates.bills.length > 12 ? ' …' : ''}
            </p>
          )}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">By rate — feeds GSTR-3B 3.1(a)</h3>
          <ExportButton onClick={() => exportCsv('gst-rate-summary', rateCols, byRate, q)}
          onExcel={() => exportXlsx('gst-rate-summary', rateCols, byRate, q)} onPdf={() => exportPdf('gst-rate-summary', rateCols, byRate, q, { stats: pdfStats(data?.turnover) })} disabled={!byRate.length} />
        </div>
        <ReportTable
          columns={rateCols}
          rows={byRate}
          onRowClick={(r) =>
            setDrill(
              drill && drill.treatment === r.treatment && drill.ratePercent === r.ratePercent
                ? null
                : { treatment: r.treatment, ratePercent: r.ratePercent, label: r.label },
            )
          }
          rowTitle={() => 'Open the bill lines behind this figure'}
          footer={
            <tr>
              <td className="px-3 py-2">Total turnover</td>
              <td className="px-3 py-2 text-right tabular-nums">{data?.totals.count}</td>
              <td className="px-3 py-2 text-right tabular-nums">{plain(data?.totals.taxableValue)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{plain(data?.totals.cgstAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{plain(data?.totals.sgstAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{plain(data?.totals.igstAmount)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{plain(data?.totals.taxAmount)}</td>
            </tr>
          }
        />
        <DrillThrough
          open={!!drill}
          onClose={() => setDrill(null)}
          title={
            drill
              ? `${drill.treatment === 'taxable' ? `${drill.ratePercent}%` : drill.label} — the lines behind it`
              : ''
          }
          subtitle={
            register.isLoading
              ? 'Loading the register…'
              : `${drillRows.length} line(s) from the sales register`
          }
          columns={drillCols}
          rows={drillRows}
        />
      </section>
      <ExportableTable
        title="By department — where the taxable income comes from"
        name="gst-rate-summary-by-department"
        period={q}
        columns={[
          { key: 'dept', label: 'Department', cell: (d: (typeof byDept)[number]) => titleCase(d.department), csv: (d: (typeof byDept)[number]) => d.department },
          { key: 'lines', label: 'Lines', align: 'right', cell: (d: (typeof byDept)[number]) => d.count },
          { key: 'taxable', label: 'Value of supply', align: 'right', cell: (d: (typeof byDept)[number]) => plain(d.taxableValue), csv: (d: (typeof byDept)[number]) => d.taxableValue },
          { key: 'tax', label: 'Tax', align: 'right', cell: (d: (typeof byDept)[number]) => plain(d.taxAmount), csv: (d: (typeof byDept)[number]) => d.taxAmount },
          { key: 'total', label: 'Amount', align: 'right', cell: (d: (typeof byDept)[number]) => plain(d.totalAmount), csv: (d: (typeof byDept)[number]) => d.totalAmount },
        ]}
        rows={byDept}
      />
    </div>
  );
}

// ── A-3 ────────────────────────────────────────────────────────────────────

export function HsnSummaryView({ q }: { q: Q }) {
  const { data, isLoading } = R.useHsnSummary(q);
  // Gap 282: the uncoded lines are read from A-1, only once a figure is opened.
  const d = useStatDrill();
  const register = R.useSalesRegister({ ...q, sixDigit: undefined }, d.focus != null);
  if (isLoading) return <Loading />;
  const rows = data?.byCode ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'code', label: 'HSN / SAC', cell: (r) => r.hsnSac, csv: (r) => r.hsnSac },
    { key: 'desc', label: 'Description', cell: (r) => r.description, csv: (r) => r.description },
    { key: 'qty', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
    { key: 'rate', label: 'Rate', align: 'right', cell: (r) => `${r.ratePercent}%`, csv: (r) => r.ratePercent },
    { key: 'taxable', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount },
    { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount },
    { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount },
    { key: 'tax', label: 'Total tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  ];
  const uncoded = (register.data?.rows ?? []).filter((l) => !(l.hsnSac ?? '').trim());
  const hsnDrills: Record<string, ReactNode> = {
    'Codes reported': d.lines('Codes reported', cols, rows, { sum: (r) => r.taxableValue }),
    'Taxable value': d.lines('Taxable value', cols, rows, { sum: (r) => r.taxableValue }),
    'Lines with NO code': d.lines('Lines with NO code', lineDrillCols, uncoded, {
      sum: (l) => l.taxableValue, loading: register.isLoading,
    }),
  };
  return (
    <div className="space-y-4">
      {/* Gap 282: 'Reporting digits' is a setting, not a total, so it has no drill. */}
      <StatStrip
        stats={d.wire([
          { label: 'Codes reported', value: String(rows.length) },
          { label: 'Reporting digits', value: `${data?.reportingDigits ?? 4}`, hint: '6 above ₹5 crore turnover' },
          { label: 'Taxable value', value: money(data?.totals.taxableValue) },
          {
            label: 'Lines with NO code',
            value: String(data?.unclassified.count ?? 0),
            tone: (data?.unclassified.count ?? 0) > 0 ? 'bad' : 'good',
            hint: 'Missing from Table 12',
          },
        ], hsnDrills)}
      />
      {d.panel(hsnDrills)}
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-hsn-summary', cols, rows, q)}
          onExcel={() => exportXlsx('gst-hsn-summary', cols, rows, q)} onPdf={() => exportPdf('gst-hsn-summary', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} />
      {(data?.unclassified.count ?? 0) > 0 ? (
        <ReportNotes
          notes={[
            `${data?.unclassified.count} line(s) worth ${money(data?.unclassified.totalAmount)} carry no HSN or SAC and are NOT in the table above. They cannot be reported in Table 12 — fix them in the Unmapped Items report.`,
          ]}
        />
      ) : null}
    </div>
  );
}

// ── A-4 / A-5 ──────────────────────────────────────────────────────────────

export function B2bRegisterView({ q }: { q: Q }) {
  const { data, isLoading } = R.useB2bRegister(q);
  // Gap 282: the B2B lines (the same register query the server folds), read
  // once a header figure is opened.
  const d = useStatDrill();
  const register = R.useSalesRegister({ ...q, customerType: 'b2b' }, d.focus != null);
  if (isLoading) return <Loading />;
  const rows = data?.invoices ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'date', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
    { key: 'inv', label: 'Invoice No.', cell: (r) => r.invoiceNumber ?? r.billNumber, csv: (r) => r.invoiceNumber ?? r.billNumber },
    { key: 'gstin', label: 'Recipient GSTIN', cell: (r) => r.recipientGstin ?? '—', csv: (r) => r.recipientGstin ?? '' },
    { key: 'name', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
    { key: 'pos', label: 'POS', cell: (r) => r.placeOfSupplyStateCode ?? '—', csv: (r) => r.placeOfSupplyStateCode ?? '' },
    { key: 'taxable', label: 'Value (before tax)', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'tax', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'total', label: 'Invoice value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
  ];
  // Same partition as the server's taxableTotals / exemptTotals.
  const b2bLines = register.data?.rows ?? [];
  const b2bDrills: Record<string, ReactNode> = {
    Invoices: d.lines('Invoices', cols, rows, { sum: (r) => r.totalAmount }),
    'Taxable value': d.lines('Taxable value', lineDrillCols, b2bLines.filter((l) => l.gstTreatment === 'taxable'), {
      sum: (l) => l.taxableValue, loading: register.isLoading,
    }),
    'Exempt / nil / non-GST': d.lines('Exempt / nil / non-GST', lineDrillCols, b2bLines.filter((l) => l.gstTreatment !== 'taxable'), {
      sum: (l) => l.taxableValue, loading: register.isLoading,
    }),
    Tax: d.lines('Tax', cols, rows.filter((r) => Number(r.taxAmount) !== 0), { sum: (r) => r.taxAmount }),
  };
  return (
    <div className="space-y-4">
      <StatStrip
        stats={d.wire([
          { label: 'Invoices', value: String(rows.length) },
          { label: 'Taxable value', value: money(data?.taxableTotals?.taxableValue ?? data?.totals.taxableValue), hint: 'GSTR-1 Table 4' },
          { label: 'Exempt / nil / non-GST', value: money(data?.exemptTotals?.taxableValue ?? 0), hint: 'Table 8, not Table 4' },
          { label: 'Tax', value: money(data?.totals.taxAmount) },
        ], b2bDrills)}
      />
      {d.panel(b2bDrills)}
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-b2b-register', cols, rows, q)}
          onExcel={() => exportXlsx('gst-b2b-register', cols, rows, q)} onPdf={() => exportPdf('gst-b2b-register', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} empty="No supplies to a GST-registered recipient in this period." />
    </div>
  );
}

export function B2cSummaryView({ q }: { q: Q }) {
  const { data, isLoading } = R.useB2cSummary(q);
  // Gap 282: the B2C lines behind the turnover figures, read once one is opened.
  const d = useStatDrill();
  const register = R.useSalesRegister({ ...q, customerType: 'b2c' }, d.focus != null);
  if (isLoading) return <Loading />;
  const summary = data?.summary ?? [];
  const large = data?.largeInterState ?? [];
  // Exempt rows are labelled exempt, never "Taxable" (gap item 278).
  const b2cCols: Column<(typeof summary)[number]>[] = [
    { key: 'type', label: 'Supply', cell: (r) => (r.isInterState ? 'Inter-State' : 'Intra-State'), csv: (r) => (r.isInterState ? 'Inter-State' : 'Intra-State') },
    { key: 'pos', label: 'POS', cell: (r) => r.placeOfSupplyStateCode ?? '—', csv: (r) => r.placeOfSupplyStateCode ?? '' },
    { key: 'treat', label: 'Treatment', cell: (r) => r.treatmentLabel ?? titleCase(r.treatment), csv: (r) => r.treatmentLabel ?? r.treatment ?? '' },
    { key: 'rate', label: 'Rate', align: 'right', cell: (r) => `${r.ratePercent}%`, csv: (r) => `${r.ratePercent}%` },
    {
      key: 'taxable', label: 'Value of supply', align: 'right',
      cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue,
    },
    { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount },
    { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount },
    { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount },
  ];
  const b2cLines = register.data?.rows ?? [];
  const turnoverDrill = (label: string) =>
    d.lines(label, lineDrillCols, linesBehind(label, b2cLines).rows, { sum: (l) => l.taxableValue, loading: register.isLoading });
  const largeCols: Column<(typeof large)[number]>[] = [
    { key: 'date', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
    { key: 'inv', label: 'Invoice No.', cell: (r) => r.invoiceNumber ?? r.billNumber, csv: (r) => r.invoiceNumber ?? r.billNumber },
    { key: 'pos', label: 'POS', cell: (r) => r.placeOfSupplyStateCode ?? '—', csv: (r) => r.placeOfSupplyStateCode ?? '' },
    { key: 'taxable', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'tax', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'total', label: 'Invoice value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
  ];
  const b2cDrills: Record<string, ReactNode> = {
    'Total turnover': turnoverDrill('Total turnover'),
    'Taxable value': turnoverDrill('Taxable value'),
    'Exempt / nil / non-GST': turnoverDrill('Exempt / nil / non-GST'),
    Tax: d.lines('Tax', lineDrillCols, b2cLines.filter((l) => Number(l.taxAmount) !== 0), {
      sum: (l) => l.taxAmount, loading: register.isLoading,
    }),
    'Large inter-State': d.lines('Large inter-State', largeCols, large, { sum: (r) => r.totalAmount }),
    'Summary rows': d.lines('Summary rows', b2cCols, summary, { sum: (r) => r.taxableValue }),
  };
  return (
    <div className="space-y-6">
      <StatStrip
        stats={d.wire([
          ...turnoverStats(data?.turnover).slice(0, 3),
          { label: 'Tax', value: money(data?.totals.taxAmount) },
          { label: 'Large inter-State', value: String(large.length), hint: `above ${money(data?.threshold)}` },
          { label: 'Summary rows', value: String(summary.length) },
        ], b2cDrills)}
      />
      {d.panel(b2cDrills)}
      <div className="flex justify-end">
        <ExportButton {...exportAll('gst-b2c-summary', b2cCols, summary, q)} disabled={!summary.length} />
      </div>
      {large.length > 0 ? (
        <ExportableTable
          title="Table 5 — inter-State, reported invoice-wise"
          name="gst-b2c-large-inter-state"
          period={q}
          columns={[
            { key: 'date', label: 'Date', cell: (r: (typeof large)[number]) => formatDate(r.billDate) },
            { key: 'inv', label: 'Invoice No.', cell: (r: (typeof large)[number]) => r.invoiceNumber ?? r.billNumber },
            { key: 'pos', label: 'POS', cell: (r: (typeof large)[number]) => r.placeOfSupplyStateCode ?? '—', csv: (r: (typeof large)[number]) => r.placeOfSupplyStateCode ?? '' },
            { key: 'taxable', label: 'Taxable value', align: 'right', cell: (r: (typeof large)[number]) => plain(r.taxableValue), csv: (r: (typeof large)[number]) => r.taxableValue },
            { key: 'tax', label: 'Tax', align: 'right', cell: (r: (typeof large)[number]) => plain(r.taxAmount), csv: (r: (typeof large)[number]) => r.taxAmount },
            { key: 'total', label: 'Invoice value', align: 'right', cell: (r: (typeof large)[number]) => plain(r.totalAmount), csv: (r: (typeof large)[number]) => r.totalAmount },
          ]}
          rows={large}
        />
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Table 7 — everything else, by place of supply and rate</h3>
        <ReportTable columns={b2cCols} rows={summary} />
      </section>
    </div>
  );
}

// ── A-6 ────────────────────────────────────────────────────────────────────

export function CreditNoteView({ q }: { q: Q }) {
  const { data, isLoading } = R.useCreditNoteRegister(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const cols: Column<R.CreditNoteRow>[] = [
    { key: 'date', label: 'Date', cell: (r) => formatDate(r.issueDate), csv: (r) => formatDate(r.issueDate) },
    { key: 'num', label: 'Credit note', cell: (r) => r.creditNoteNumber, csv: (r) => r.creditNoteNumber },
    {
      key: 'against',
      label: 'Against invoice',
      cell: (r) =>
        r.againstInvoiceNumber ?? (
          <span className="text-red-600">{r.againstBillNumber} · never numbered</span>
        ),
      csv: (r) => r.againstInvoiceNumber ?? `${r.againstBillNumber} (never numbered)`,
    },
    { key: 'patient', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
    { key: 'reason', label: 'Reason', cell: (r) => titleCase(r.reason), csv: (r) => r.reason },
    { key: 'taxable', label: 'Taxable', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'tax', label: 'Tax reversed', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'total', label: 'Value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
    { key: 'by', label: 'Issued by', cell: (r) => r.issuedBy ?? '—', csv: (r) => r.issuedBy ?? '' },
    {
      key: 'ok',
      label: 'Status',
      cell: (r) =>
        !r.reportable ? (
          <Badge variant="destructive">Not filable</Badge>
        ) : !r.withinTimeLimit ? (
          <Badge variant="secondary">Past s.34 deadline</Badge>
        ) : r.originalInRegister === false ? (
          <Badge variant="outline" title="The voided sale is already out of the register, so this note is not netted again">Cancellation — not netted</Badge>
        ) : (
          <Badge variant="outline">Reportable</Badge>
        ),
      csv: (r) => (!r.reportable ? 'not filable' : !r.withinTimeLimit ? 'past deadline'
        : r.originalInRegister === false ? 'cancellation - not netted' : 'reportable'),
    },
  ];
  // Gap 282: each header figure opens the notes it counts or sums.
  const b2bNotes = rows.filter((r) => !!r.recipientGstin);
  const noteDrills: Record<string, ReactNode> = {
    'Credit notes': d.lines('Credit notes', cols, rows, { sum: (r) => r.totalAmount }),
    'Tax reversed': d.lines('Tax reversed', cols, rows.filter((r) => Number(r.taxAmount) !== 0), { sum: (r) => r.taxAmount }),
    'B2B / B2C': d.lines('B2B / B2C', cols, [...b2bNotes, ...rows.filter((r) => !r.recipientGstin)], {
      sum: (r) => r.totalAmount, note: `${b2bNotes.length} B2B first, then ${rows.length - b2bNotes.length} B2C`,
    }),
    'Cannot be filed': d.lines('Cannot be filed', cols, rows.filter((r) => !r.reportable), { sum: (r) => r.totalAmount }),
  };
  const notes: string[] = [];
  if ((data?.summary.notReportable ?? 0) > 0) {
    notes.push(
      `${data?.summary.notReportable} note(s) are against a bill that was never issued a document number. Table 9B keys on the original invoice, so these cannot be filed.`,
    );
  }
  if ((data?.summary.outsideTimeLimit ?? 0) > 0) {
    notes.push(
      `${data?.summary.outsideTimeLimit} note(s) were issued past the section 34 deadline — the money goes back but the tax is NOT reversed, and GSTR-3B excludes them.`,
    );
  }
  return (
    <div className="space-y-4">
      <StatStrip
        stats={d.wire([
          { label: 'Credit notes', value: String(data?.summary.count ?? 0) },
          { label: 'Tax reversed', value: money(data?.summary.taxAmount) },
          { label: 'B2B / B2C', value: `${data?.summary.b2b.count ?? 0} / ${data?.summary.b2c.count ?? 0}` },
          {
            label: 'Cannot be filed',
            value: String(data?.summary.notReportable ?? 0),
            tone: (data?.summary.notReportable ?? 0) > 0 ? 'bad' : 'good',
          },
        ], noteDrills)}
      />
      {d.panel(noteDrills)}
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-credit-notes', cols, rows, q)}
          onExcel={() => exportXlsx('gst-credit-notes', cols, rows, q)} onPdf={() => exportPdf('gst-credit-notes', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} />
      <ReportNotes notes={notes} />
    </div>
  );
}

// ── A-7 ────────────────────────────────────────────────────────────────────

type DeptSplit = { department: string; exempt: number; taxable: number };

export function ExemptTurnoverView({ q }: { q: Q }) {
  const { data, isLoading } = R.useExemptTurnover(q);
  // Gap 282: the register lines behind each figure, read once one is opened.
  const d = useStatDrill();
  const register = R.useSalesRegister(q, d.focus != null);
  if (isLoading) return <Loading />;
  const buckets = [
    { label: 'Taxable', v: data?.taxable },
    { label: 'Exempt', v: data?.exempt },
    { label: 'Nil rated', v: data?.nilRated },
    { label: 'Non-GST', v: data?.nonGst },
    { label: 'Zero rated', v: data?.zeroRated },
    { label: 'Unclassified', v: data?.unclassified },
  ];
  const bucketCols: Column<(typeof buckets)[number]>[] = [
    { key: 'k', label: 'Treatment', cell: (b) => b.label, csv: (b) => b.label },
    { key: 'lines', label: 'Lines', align: 'right', cell: (b) => b.v?.count ?? 0, csv: (b) => b.v?.count ?? 0 },
    { key: 'value', label: 'Turnover', align: 'right', cell: (b) => plain(b.v?.taxableValue), csv: (b) => b.v?.taxableValue ?? 0 },
    { key: 'tax', label: 'Tax', align: 'right', cell: (b) => plain(b.v?.taxAmount), csv: (b) => b.v?.taxAmount ?? 0 },
  ];
  // The server's partition: exempt = exempt + nil + non-GST; total adds
  // taxable and zero-rated; unclassified lines are in neither.
  const reg = register.data?.rows ?? [];
  const lineOpts = { sum: (l: R.SalesLine) => l.taxableValue, loading: register.isLoading };
  const exemptDrills: Record<string, ReactNode> = {
    'Exempt turnover': d.lines('Exempt turnover', lineDrillCols,
      reg.filter((l) => ['exempt', 'nil_rated', 'non_gst'].includes(l.gstTreatment ?? '')), lineOpts),
    'Total turnover': d.lines('Total turnover', lineDrillCols, reg.filter((l) => !!l.gstTreatment), lineOpts),
    'Unclassified lines': d.lines('Unclassified lines', lineDrillCols, reg.filter((l) => !l.gstTreatment), lineOpts),
  };
  return (
    <div className="space-y-4">
      {/* Gap 282: 'Exempt ratio' is the ratio of the two figures beside it, so it has no drill of its own. */}
      <StatStrip
        stats={d.wire([
          { label: 'Exempt turnover', value: money(data?.exemptTurnover) },
          { label: 'Total turnover', value: money(data?.totalTurnover) },
          { label: 'Exempt ratio', value: pct(data?.exemptRatio), hint: 'Rule 42 E ÷ F' },
          {
            label: 'Unclassified lines',
            value: String(data?.unclassified.count ?? 0),
            tone: (data?.unclassified.count ?? 0) > 0 ? 'bad' : 'good',
          },
        ], exemptDrills)}
      />
      {d.panel(exemptDrills)}
      <ReportNotes
        notes={[
          'This ratio is the input to the Rule 42 / 43 reversal in B-3. It decides how much of the month’s input credit the hospital keeps — for a hospital it is the largest number on the sales side.',
        ]}
      />
      <div className="flex justify-end">
        <ExportButton {...exportAll('gst-exempt-turnover', bucketCols, buckets, q)} disabled={!data} />
      </div>
      <ReportTable columns={bucketCols} rows={buckets} />
      <ExportableTable
        title="By department"
        name="gst-exempt-turnover-by-department"
        period={q}
        columns={[
          { key: 'd', label: 'Department', cell: (d: DeptSplit) => titleCase(d.department), csv: (d: DeptSplit) => d.department },
          { key: 'taxable', label: 'Taxable', align: 'right', cell: (d: DeptSplit) => plain(d.taxable), csv: (d: DeptSplit) => d.taxable },
          { key: 'exempt', label: 'Exempt', align: 'right', cell: (d: DeptSplit) => plain(d.exempt), csv: (d: DeptSplit) => d.exempt },
        ]}
        rows={(data?.byDepartment ?? []) as DeptSplit[]}
      />
    </div>
  );
}

// ── A-8 / A-9 ──────────────────────────────────────────────────────────────

type Table12Row = { hsnSac: string; ratePercent: number; quantity: number; taxableValue: number; taxAmount: number };

const hsnColumns: Column<Table12Row>[] = [
  { key: 'c', label: 'HSN / SAC', cell: (r) => r.hsnSac, csv: (r) => r.hsnSac },
  { key: 'r', label: 'Rate', align: 'right', cell: (r) => `${r.ratePercent}%`, csv: (r) => r.ratePercent },
  { key: 'q', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
  { key: 't', label: 'Taxable', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
  { key: 'x', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
];

/** A note netted into a return, as the drill-down shows it. */
const noteDrillCols: Column<R.AppliedNote>[] = [
  { key: 'd', label: 'Date', cell: (n) => formatDate(n.issueDate), csv: (n) => formatDate(n.issueDate) },
  { key: 'n', label: 'Note', cell: (n) => n.creditNoteNumber, csv: (n) => n.creditNoteNumber },
  { key: 't', label: 'Type', cell: (n) => titleCase(n.noteType), csv: (n) => n.noteType },
  { key: 'i', label: 'Against invoice', cell: (n) => n.againstInvoiceNumber ?? '—', csv: (n) => n.againstInvoiceNumber ?? '' },
  { key: 'p', label: 'Patient', cell: (n) => n.patientName ?? '—', csv: (n) => n.patientName ?? '' },
  { key: 'v', label: 'Taxable value', align: 'right', cell: (n) => plain(n.taxableSide ?? n.taxableValue), csv: (n) => n.taxableSide ?? n.taxableValue },
  { key: 'x', label: 'Tax', align: 'right', cell: (n) => plain(n.taxAmount), csv: (n) => n.taxAmount },
];

/** One bill line, as a drill-down from a return total shows it. */
const lineDrillCols: Column<R.SalesLine>[] = [
  { key: 'd', label: 'Date', cell: (l) => formatDate(l.billDate), csv: (l) => formatDate(l.billDate) },
  { key: 'inv', label: 'Document', cell: (l) => l.invoiceNumber ?? l.billNumber, csv: (l) => l.invoiceNumber ?? l.billNumber },
  { key: 'p', label: 'Patient', cell: (l) => l.patientName ?? '—', csv: (l) => l.patientName ?? '' },
  { key: 'g', label: 'Recipient GSTIN', cell: (l) => l.recipientGstin ?? '—', csv: (l) => l.recipientGstin ?? '' },
  { key: 'desc', label: 'Line', cell: (l) => l.description, csv: (l) => l.description },
  { key: 'r', label: 'GST %', align: 'right', cell: (l) => l.taxRatePercent, csv: (l) => l.taxRatePercent },
  { key: 'tv', label: 'Taxable value', align: 'right', cell: (l) => plain(l.taxableValue), csv: (l) => l.taxableValue },
  { key: 'tax', label: 'Tax', align: 'right', cell: (l) => plain(l.taxAmount), csv: (l) => l.taxAmount },
];

type AdvanceRow = NonNullable<ReturnType<typeof R.useAdvancesReport>['data']>['rows'][number];
type PurchaseRow = NonNullable<ReturnType<typeof R.usePurchaseRegister>['data']>['rows'][number];
/** One step of a computed box: what it is made of, and where that comes from. */
type WorkingRow = { label: string; amount: number; source: string };

/** An advance receipt, as the 11A / 11B drill-down shows it (gap 282). */
const advanceDrillCols: Column<AdvanceRow>[] = [
  { key: 'd', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => formatDate(r.date) },
  { key: 'v', label: 'Receipt voucher', cell: (r) => r.voucherNumber ?? '—', csv: (r) => r.voucherNumber ?? '' },
  { key: 'p', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
  { key: 'a', label: 'Received', align: 'right', cell: (r) => plain(r.amount), csv: (r) => r.amount },
  { key: 'tv', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
  { key: 'x', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  { key: 'adj', label: 'Adjusted', align: 'right', cell: (r) => plain(r.adjusted), csv: (r) => r.adjusted },
];

/** A purchase, as the 4(A) drill-down shows it. */
const purchaseDrillCols: Column<PurchaseRow>[] = [
  { key: 'd', label: 'Invoice date', cell: (r) => formatDate(r.invoiceDate), csv: (r) => formatDate(r.invoiceDate) },
  { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
  { key: 'i', label: 'Supplier invoice', cell: (r) => r.invoiceNumber ?? '—', csv: (r) => r.invoiceNumber ?? '' },
  { key: 'n', label: 'Item', cell: (r) => r.drugName, csv: (r) => r.drugName },
  { key: 'tv', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
  { key: 'c', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount ?? 0 },
  { key: 'sg', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount ?? 0 },
  { key: 'ig', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount ?? 0 },
  { key: 'x', label: 'Input tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
];

const workingDrillCols: Column<WorkingRow>[] = [
  { key: 'l', label: 'Step', cell: (r) => r.label, csv: (r) => r.label },
  { key: 'a', label: 'Amount', align: 'right', cell: (r) => plain(r.amount), csv: (r) => r.amount },
  { key: 's', label: 'Source', cell: (r) => r.source, csv: (r) => r.source },
];

type Drill =
  | { kind: 'lines'; title: string; rows: R.SalesLine[] }
  | { kind: 'notes'; title: string; rows: R.AppliedNote[] }
  | { kind: 'advances'; title: string; rows: AdvanceRow[] }
  | { kind: 'purchases'; title: string; rows: PurchaseRow[] }
  | { kind: 'working'; title: string; rows: WorkingRow[] };

function DrillPanel({ drill, loading, onClose }: { drill: Drill | null; loading: boolean; onClose: () => void }) {
  if (!drill) return null;
  const subtitle = loading ? 'Loading…' : `${drill.rows.length} row(s) behind this figure`;
  const common = { open: true, title: drill.title, subtitle, onClose };
  switch (drill.kind) {
    case 'lines':
      return <DrillThrough {...common} columns={lineDrillCols} rows={drill.rows} />;
    case 'notes':
      return <DrillThrough {...common} columns={noteDrillCols} rows={drill.rows} />;
    case 'advances':
      return <DrillThrough {...common} columns={advanceDrillCols} rows={drill.rows} />;
    case 'purchases':
      return <DrillThrough {...common} columns={purchaseDrillCols} rows={drill.rows} />;
    default:
      return <DrillThrough {...common} columns={workingDrillCols} rows={drill.rows} />;
  }
}

export function Gstr1View({ q }: { q: Q }) {
  const { data, isLoading } = R.useGstr1(q);
  const json = R.useGstr1Json(q);
  const register = R.useSalesRegister(q);
  // The open row is kept by key and its lines resolved on every render, so a
  // drill opened before its data arrived fills in rather than staying empty.
  const [drillKey, setDrillKey] = useState<string | null>(null);
  // 11A / 11B drill into the advance receipts — fetched once a row is opened.
  const advances = R.useAdvancesReport(q, drillKey != null);
  if (isLoading) return <Loading />;
  const t = data?.tables;
  const rec = data?.reconciliation;
  const vs3b = rec?.gstr3b;
  const taxableLines = (register.data?.rows ?? []).filter((l) => l.gstTreatment === 'taxable');

  /**
   * The offline-utility file itself (gap item 282). The screen promised it and
   * offered only CSV/PDF buttons for the table above.
   */
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(json.data?.json ?? {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fp = String((json.data?.json as { fp?: string } | undefined)?.fp ?? q.from ?? 'period');
    a.download = `GSTR1_${fp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  type TableRow = { table: string; what: string; taxable: number; tax: number; drill?: () => Drill };
  const tableRows: TableRow[] = [
    {
      table: '4', what: 'B2B — supplies to registered persons', taxable: t?.b2b.taxableValue ?? 0, tax: t?.b2b.taxAmount ?? 0,
      drill: () => ({ kind: 'lines', title: 'Table 4 — the B2B lines behind it', rows: taxableLines.filter((l) => !!l.recipientGstin) }),
    },
    {
      table: '5 & 7', what: 'B2C — supplies to unregistered persons', taxable: t?.b2c.taxableValue ?? 0, tax: t?.b2c.taxAmount ?? 0,
      drill: () => ({ kind: 'lines', title: 'Tables 5 & 7 — the B2C lines behind them', rows: taxableLines.filter((l) => !l.recipientGstin) }),
    },
    {
      table: '8', what: 'Nil-rated, exempt and non-GST outward supplies (net of notes against them)', taxable: t?.exemptTurnover.total ?? 0, tax: 0,
      drill: () => ({
        kind: 'lines', title: 'Table 8 — the exempt, nil-rated and non-GST lines',
        rows: (register.data?.rows ?? []).filter((l) => ['exempt', 'nil_rated', 'non_gst'].includes(l.gstTreatment ?? '')),
      }),
    },
    {
      table: '9B', what: 'Credit and debit notes against taxable supplies', taxable: t?.creditNotes.taxableValue ?? 0, tax: t?.creditNotes.taxAmount ?? 0,
      drill: () => ({ kind: 'notes', title: 'Table 9B — the notes netted', rows: (data?.creditNotesApplied ?? []).filter((n) => (n.taxableSide ?? 0) !== 0) }),
    },
    {
      table: '11A', what: 'Tax on advances received', taxable: t?.advances.received.taxableValue ?? 0, tax: t?.advances.received.taxAmount ?? 0,
      drill: () => ({
        kind: 'advances', title: 'Table 11A — the advances that carried tax',
        rows: (advances.data?.rows ?? []).filter((a) => Number(a.taxAmount) !== 0),
      }),
    },
    {
      table: '11B', what: 'Advances adjusted against invoices', taxable: t?.advances.adjusted.amount ?? 0, tax: 0,
      drill: () => ({
        kind: 'advances', title: 'Table 11B — the advances adjusted against invoices',
        rows: (advances.data?.rows ?? []).filter((a) => Number(a.adjusted) !== 0),
      }),
    },
  ];
  const rowKey = (r: TableRow) => `${r.table}|${r.what}`;
  const openRow = tableRows.find((r) => rowKey(r) === drillKey);
  const drill = openRow?.drill ? openRow.drill() : null;
  const tableCols: Column<TableRow>[] = [
    { key: 'table', label: 'GSTR-1 table', cell: (r) => r.table, csv: (r) => r.table },
    { key: 'what', label: 'What it reports', cell: (r) => r.what, csv: (r) => r.what },
    { key: 'taxable', label: 'Value', align: 'right', cell: (r) => plain(r.taxable), csv: (r) => r.taxable },
    { key: 'tax', label: 'Tax', align: 'right', cell: (r) => plain(r.tax), csv: (r) => r.tax },
  ];
  const excluded = t?.creditNotes.excluded;

  return (
    <div className="space-y-4">
      {rec ? (
        <TieBack
          agrees={rec.register.agrees && rec.taxable.agrees}
          detail={
            rec.register.agrees && rec.taxable.agrees
              ? `Every table adds back to the sales register${rec.unclassifiedLines ? ` · ${rec.unclassifiedLines} line(s) carry no treatment and are reported in none of the tables` : ''}`
              : `Out by ${money(Math.abs(rec.register.taxableValue))} of taxable value and ${money(Math.abs(rec.register.taxAmount))} of tax. Do not file this.`
          }
        />
      ) : null}
      {/* Gap item 274: the two returns must declare the same outward supply. */}
      {vs3b ? (
        <div className={`rounded-md border p-3 text-sm ${vs3b.agrees ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900'}`}>
          <p className="font-medium">
            {vs3b.agrees ? 'GSTR-1 agrees with GSTR-3B 3.1(a)' : 'GSTR-1 does NOT agree with GSTR-3B 3.1(a)'}
          </p>
          <p className="text-xs">
            GSTR-1 (4 + 5/7 + 9B) taxable {money(vs3b.gstr1TaxableValue)}, tax {money(vs3b.gstr1TaxAmount)} · GSTR-3B 3.1(a) taxable{' '}
            {money(vs3b.gstr3bTaxableValue)}, tax {money(vs3b.gstr3bTaxAmount)}
            {vs3b.agrees ? '' : ` · difference ${money(vs3b.taxableValue)} / ${money(vs3b.taxAmount)}`}
          </p>
        </div>
      ) : null}
      <div className="flex justify-end">
        <ExportButton {...exportAll('gstr1-summary', tableCols, tableRows, q)} disabled={!data} />
      </div>
      <ReportTable
        columns={tableCols}
        rows={tableRows}
        onRowClick={(r) => (r.drill ? setDrillKey(drillKey === rowKey(r) ? null : rowKey(r)) : undefined)}
        rowTitle={(r) => (r.drill ? 'Open the lines behind this figure' : '')}
      />
      <DrillPanel
        drill={drill}
        loading={drill?.kind === 'advances' ? advances.isLoading : register.isLoading}
        onClose={() => setDrillKey(null)}
      />
      {excluded && excluded.total > 0 ? (
        <ReportNotes
          notes={[
            ...(excluded.originalNotInRegister
              ? [`${excluded.originalNotInRegister} cancellation note(s) are not in 9B: the voided sale they reverse is already out of the sales register, so it is reversed once, not twice.`]
              : []),
            ...(excluded.outsideTimeLimit
              ? [`${excluded.outsideTimeLimit} note(s) were issued past the section 34 deadline and are not in 9B — the tax on them cannot be reversed.`]
              : []),
          ]}
        />
      ) : null}
      <ExportableTable title="Table 12 — HSN summary" name="gstr1-table12" columns={hsnColumns} rows={t?.hsn ?? []} period={q} />
      <section className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">The file the accountant uploads</h3>
            <p className="text-xs text-muted-foreground">
              GSTR-1 offline utility JSON for this period. Read the warnings below before uploading.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Gap 282: a greyed-out download says why. */}
            {json.isLoading ? (
              <span className="text-xs text-muted-foreground">Preparing the file…</span>
            ) : json.isError || !json.data ? (
              <span className="text-xs text-red-600">The JSON could not be built for this period — check the period and try again.</span>
            ) : null}
            <Button size="sm" onClick={downloadJson} disabled={json.isLoading || !json.data}>
              <FileJson className="mr-1.5 h-4 w-4" /> Download JSON
            </Button>
          </div>
        </div>
        <ReportNotes notes={json.data?.warnings ?? []} />
      </section>
    </div>
  );
}

export function Gstr3bView({ q }: { q: Q }) {
  const { data, isLoading } = R.useGstr3b(q);
  const register = R.useSalesRegister(q);
  const [drillKey, setDrillKey] = useState<string | null>(null);
  // Which headline opened the box, so only that stat shows as active (gap 282).
  const [statOpen, setStatOpen] = useState<string | null>(null);
  // Section 4 drills into the purchases and the Rule 42 working (gap 282) —
  // fetched once a box is opened.
  const purchases = R.usePurchaseRegister(q, drillKey != null);
  const reversal = R.useItcReversal(q, drillKey != null);
  if (isLoading) return <Loading />;

  type BoxRow = { box: string; what: string; value: number; drill?: () => Drill };
  const taxableLines = () => (register.data?.rows ?? []).filter((l) => l.gstTreatment === 'taxable');
  const headLines = (k: 'cgstAmount' | 'sgstAmount' | 'igstAmount') =>
    taxableLines().filter((l) => Number(l[k]) !== 0);
  const itcAvailable = data?.inputTaxCredit.available ?? 0;
  const itcReversed = data?.inputTaxCredit.reversed ?? 0;
  const itcNet = data?.inputTaxCredit.net ?? 0;
  const notesDrill = (): Drill => ({ kind: 'notes', title: '3.1(a) — the credit notes netted off', rows: data?.creditNotesApplied ?? [] });
  const rows: BoxRow[] = [
    {
      box: '3.1(a)', what: 'Outward taxable supplies — taxable value (net of credit notes)', value: data?.outwardTaxable.taxableValue ?? 0,
      drill: () => ({ kind: 'lines', title: '3.1(a) — the taxable lines billed', rows: taxableLines() }),
    },
    {
      box: '3.1(a)', what: 'CGST', value: data?.outwardTaxable.cgstAmount ?? 0,
      drill: () => ({ kind: 'lines', title: '3.1(a) CGST — the lines that carry it (before credit notes)', rows: headLines('cgstAmount') }),
    },
    {
      box: '3.1(a)', what: 'SGST', value: data?.outwardTaxable.sgstAmount ?? 0,
      drill: () => ({ kind: 'lines', title: '3.1(a) SGST — the lines that carry it (before credit notes)', rows: headLines('sgstAmount') }),
    },
    {
      box: '3.1(a)', what: 'IGST', value: data?.outwardTaxable.igstAmount ?? 0,
      drill: () => ({ kind: 'lines', title: '3.1(a) IGST — the lines that carry it (before credit notes)', rows: headLines('igstAmount') }),
    },
    {
      box: '3.1(a)', what: `Credit notes netted off (${data?.creditNotesApplied?.length ?? 0})`,
      value: (data?.creditNotesApplied ?? []).reduce((t, n) => t + n.taxableValue, 0), drill: notesDrill,
    },
    {
      box: '3.1(c)', what: 'Other exempt and nil-rated outward supplies', value: data?.outwardExempt ?? 0,
      drill: () => ({
        kind: 'lines', title: '3.1(c) — the exempt and nil-rated lines',
        rows: (register.data?.rows ?? []).filter((l) => l.gstTreatment === 'exempt' || l.gstTreatment === 'nil_rated'),
      }),
    },
    {
      box: '3.1(e)', what: 'Non-GST outward supplies', value: data?.outwardNonGst ?? 0,
      drill: () => ({
        kind: 'lines', title: '3.1(e) — the non-GST lines',
        rows: (register.data?.rows ?? []).filter((l) => l.gstTreatment === 'non_gst'),
      }),
    },
    // #265: only goods shipped out of the state, and bills issued before it, are here.
    ...(data?.interStateUnregistered ?? []).map((s) => ({
      box: '3.2',
      what: `Inter-State to unregistered persons — place of supply ${gstStateName(s.placeOfSupplyStateCode) ?? s.placeOfSupplyStateCode ?? 'not set'} (IGST ${money(s.igstAmount)})`,
      value: s.taxableValue,
      drill: (): Drill => ({
        kind: 'lines' as const, title: '3.2 — the lines supplied to another state',
        rows: taxableLines().filter((l) => l.isInterState && !l.recipientGstin && l.placeOfSupplyStateCode === s.placeOfSupplyStateCode),
      }),
    })),
    {
      box: '4(A)', what: 'Input tax credit available (blocked credit excluded)', value: itcAvailable,
      drill: () => ({
        kind: 'purchases', title: '4(A) — the purchases the credit comes from (eligible only)',
        rows: (purchases.data?.rows ?? []).filter((p) => (p.itcEligibility ?? 'eligible') === 'eligible'),
      }),
    },
    {
      box: '4(B)', what: 'Credit reversed — Rule 42 / 43', value: itcReversed,
      drill: () => ({
        kind: 'working', title: '4(B) — the Rule 42 / 43 working (B-3)',
        rows: (reversal.data?.working ?? []).map((w) => ({ label: `${w.step} — ${w.label}`, amount: w.amount, source: w.source })),
      }),
    },
    {
      box: '4(C)', what: 'Net input tax credit', value: itcNet,
      drill: () => ({
        kind: 'working', title: '4(C) — how the net credit is reached',
        rows: [
          { label: '4(A) Credit available', amount: itcAvailable, source: 'B-2 / purchase register' },
          { label: 'Less 4(B) credit reversed', amount: -itcReversed, source: 'B-3 Rule 42 / 43 working' },
          { label: '= 4(C) Net input tax credit', amount: itcNet, source: 'GSTR-3B 4(C)' },
        ],
      }),
    },
    {
      box: '6.1', what: 'Payable in cash', value: data?.netTaxPayable ?? 0,
      drill: () => ({
        kind: 'working', title: '6.1 — how the cash payable is reached',
        rows: [
          { label: 'Outward tax liability, 3.1(a)', amount: data?.outwardTaxable.taxAmount ?? 0, source: 'GSTR-3B 3.1(a), net of credit notes' },
          { label: 'Less net input tax credit, 4(C)', amount: -itcNet, source: 'GSTR-3B 4(C)' },
          ...(data?.payableByHead
            ? [
                { label: 'Payable in cash — IGST', amount: data.payableByHead.igst, source: 'after set-off, head by head' },
                { label: 'Payable in cash — CGST', amount: data.payableByHead.cgst, source: 'after set-off, head by head' },
                { label: 'Payable in cash — SGST', amount: data.payableByHead.sgst, source: 'after set-off, head by head' },
              ]
            : []),
          { label: '= 6.1 Payable in cash', amount: data?.netTaxPayable ?? 0, source: 'GSTR-3B 6.1' },
          { label: 'Credit carried forward', amount: data?.creditCarriedForward ?? 0, source: 'unused credit after set-off' },
        ],
      }),
    },
  ];
  const boxKey = (r: BoxRow) => `${r.box}|${r.what}`;
  const openBox = rows.find((r) => boxKey(r) === drillKey);
  const drill = openBox?.drill ? openBox.drill() : null;
  const drillLoading =
    drill?.kind === 'purchases' ? purchases.isLoading : drill?.kind === 'working' ? reversal.isLoading : register.isLoading;
  const cols: Column<BoxRow>[] = [
    { key: 'box', label: 'Box', cell: (r) => r.box, csv: (r) => r.box },
    { key: 'what', label: 'What it reports', cell: (r) => r.what, csv: (r) => r.what },
    { key: 'v', label: 'Amount', align: 'right', cell: (r) => plain(r.value), csv: (r) => r.value },
  ];
  // Gap item 275: only a note past the section 34 deadline is a warning. A
  // same-month cancellation of a voided sale is left out because the sale has
  // already left the register — that is said, but not as a deadline breach.
  const late = data?.creditNotesOutsideTimeLimit ?? 0;
  const voided = data?.creditNotesOriginalNotInRegister ?? 0;
  const notes = [
    ...(late > 0
      ? [`${late} credit note(s) issued past the section 34 deadline are NOT netted off the liability — the money went back but the tax did not.`]
      : []),
    ...(voided > 0
      ? [`${voided} cancellation note(s) are not netted: the voided sale they reverse is already out of the sales register, so it is reversed once, not twice.`]
      : []),
    'Input tax credit covers pharmacy and inventory purchases only. Credit on equipment, rent, utilities and professional services is not recorded in this system and must be added by hand.',
  ];
  const stats = [
    { label: 'Outward tax liability', value: money(data?.outwardTaxable.taxAmount) },
    { label: 'Input credit (net)', value: money(data?.inputTaxCredit.net) },
    { label: 'Payable in cash', value: money(data?.netTaxPayable), tone: 'warn' as const },
    { label: 'Credit carried forward', value: money(data?.creditCarriedForward) },
  ];
  // Gap 282: each headline opens the box it is read from, in the box panel.
  // Outward tax opens the 3.1(a) taxable lines (before credit notes, as the
  // box drill says); the rest open the working that reaches them.
  const statBox: Record<string, string> = {
    'Outward tax liability': '3.1(a)|Outward taxable supplies — taxable value (net of credit notes)',
    'Input credit (net)': '4(C)|Net input tax credit',
    'Payable in cash': '6.1|Payable in cash',
    'Credit carried forward': '6.1|Payable in cash',
  };
  const clickableStats: Stat[] = stats.map((st) => ({
    ...st,
    active: statOpen === st.label && drillKey === statBox[st.label],
    onClick: () => {
      const same = statOpen === st.label && drillKey === statBox[st.label];
      setStatOpen(same ? null : st.label);
      setDrillKey(same ? null : statBox[st.label]);
    },
  }));

  return (
    <div className="space-y-4">
      <StatStrip stats={clickableStats} />
      <div className="flex justify-end">
        <ExportButton
          onClick={() => exportCsv('gstr3b-summary', cols, rows, q)}
          onExcel={() => exportXlsx('gstr3b-summary', cols, rows, q)}
          onPdf={() => exportPdf('gstr3b-summary', cols, rows, q, {
            stats: stats.map(({ label, value }) => ({ label, value })), notes,
          })}
          disabled={!data}
        />
      </div>
      <ReportTable
        columns={cols}
        rows={rows}
        onRowClick={(r) => (r.drill ? setDrillKey(drillKey === boxKey(r) ? null : boxKey(r)) : undefined)}
        rowTitle={(r) => (r.drill ? 'Open what is behind this figure' : '')}
      />
      <DrillPanel drill={drill} loading={drillLoading} onClose={() => setDrillKey(null)} />
      <ReportNotes notes={notes} />
    </div>
  );
}

// ── A-10 ───────────────────────────────────────────────────────────────────

export function AdvancesView({ q }: { q: Q }) {
  const { data, isLoading } = R.useAdvancesReport(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'date', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => formatDate(r.date) },
    { key: 'v', label: 'Receipt voucher', cell: (r) => r.voucherNumber ?? '—', csv: (r) => r.voucherNumber ?? '' },
    { key: 'p', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
    { key: 's', label: 'Source', cell: (r) => titleCase(r.source), csv: (r) => r.source },
    { key: 'a', label: 'Received', align: 'right', cell: (r) => plain(r.amount), csv: (r) => r.amount },
    {
      key: 't',
      label: 'Treatment',
      cell: (r) => <Badge variant={treatmentTone(r.gstTreatment)}>{r.gstTreatment ? titleCase(r.gstTreatment) : 'Unclassified'}</Badge>,
      csv: (r) => r.gstTreatment ?? 'unclassified',
    },
    { key: 'x', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'adj', label: 'Adjusted', align: 'right', cell: (r) => plain(r.adjusted), csv: (r) => r.adjusted },
    { key: 'ref', label: 'Refunded', align: 'right', cell: (r) => plain(r.refunded), csv: (r) => r.refunded },
    { key: 'bal', label: 'Held', align: 'right', cell: (r) => plain(r.balance), csv: (r) => r.balance },
  ];
  // Gap 282: each header figure opens the receipts it sums.
  const advanceDrills: Record<string, ReactNode> = {
    Received: d.lines('Received', cols, rows, { sum: (r) => r.amount }),
    'Tax due on advances': d.lines('Tax due on advances', cols, rows.filter((r) => Number(r.taxAmount) !== 0), { sum: (r) => r.taxAmount }),
    'Adjusted against invoices': d.lines('Adjusted against invoices', cols, rows.filter((r) => Number(r.adjusted) !== 0), { sum: (r) => r.adjusted }),
    'Still held': d.lines('Still held', cols, rows.filter((r) => Number(r.balance) !== 0), { sum: (r) => r.balance }),
  };
  return (
    <div className="space-y-4">
      <StatStrip
        stats={d.wire([
          { label: 'Received', value: money(data?.summary.amountReceived) },
          { label: 'Tax due on advances', value: money(data?.summary.taxDueOnAdvances.taxAmount), hint: 'GSTR-1 Table 11A' },
          { label: 'Adjusted against invoices', value: money(data?.summary.adjustedAgainstInvoices.amount), hint: 'Table 11B' },
          { label: 'Still held', value: money(data?.summary.balanceOutstanding) },
        ], advanceDrills)}
      />
      {d.panel(advanceDrills)}
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-advances', cols, rows, q)}
          onExcel={() => exportXlsx('gst-advances', cols, rows, q)} onPdf={() => exportPdf('gst-advances', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} />
      {(data?.summary.unclassifiedCount ?? 0) > 0 ? (
        <ReportNotes
          notes={[
            `${data?.summary.unclassifiedCount} advance(s) were taken before advances carried a tax position. Their money is counted; their treatment is unknown and is excluded from the tax figures.`,
          ]}
        />
      ) : null}
    </div>
  );
}
