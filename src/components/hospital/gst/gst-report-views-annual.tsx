'use client';

import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/date-utils';
import {
  Column, ExportButton, ExportableTable, Loading, ReportNotes, ReportTable, StatStrip, TieBack,
  exportCsv, exportXlsx, money, pct, plain, exportPdf, exportAll,
} from './gst-report-shell';
import type { GstReportQuery, ItcLadderRung } from '@/hooks/use-gst-reports';
import * as R from '@/hooks/use-gst-reports';
import { useStatDrill } from './gst-report-views';

// ============================================================
// The annual return, and the two reports the review document added after the
// monthly set was built: GSTR-9, the GSTR-9C working, and the liability half
// of C-1.
//
// Nothing here computes a figure. Every number is the monthly report run once
// over a financial year, which is what lets the annual return tie to the twelve
// it summarises — and the tie-back is shown on screen rather than assumed.
// ============================================================

type Q = GstReportQuery;

/** The financial year a date falls in, as "2026-27". April to March. */
function currentFinancialYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function YearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const thisYear = Number(currentFinancialYear().slice(0, 4));
  const years = [0, 1, 2, 3].map((n) => {
    const y = thisYear - n;
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  });
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-on-surface-variant">Financial year</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-surface px-2 text-sm"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One rung of the ITC ladder. `null` is blank, never zero — see the source. */
function Ladder({ rungs }: { rungs: ItcLadderRung[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {rungs.map((r, i) => (
        <div
          key={r.key}
          className={`flex items-start justify-between gap-4 px-3 py-2 ${
            i % 2 ? 'bg-surface-container-lowest' : ''
          } ${r.key === 'eligible' ? 'border-y border-border font-medium' : ''}`}
        >
          <div className="min-w-0">
            <p className="text-sm">{r.label}</p>
            <p className="text-[11px] text-on-surface-variant">{r.source}</p>
          </div>
          <p className="shrink-0 font-label text-sm tabular-nums">
            {r.amount === null ? <span className="text-on-surface-variant">—</span> : money(r.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** The ITC ladder as an exportable table — a blank stays blank (gap 282). */
const ladderCols: Column<ItcLadderRung>[] = [
  { key: 'l', label: 'Step', cell: (r) => r.label, csv: (r) => r.label },
  { key: 'a', label: 'Amount', align: 'right', cell: (r) => (r.amount === null ? '—' : plain(r.amount)), csv: (r) => (r.amount === null ? '' : r.amount) },
  { key: 's', label: 'Source', cell: (r) => r.source, csv: (r) => r.source },
];

/** One line of a working, for the reports whose figures are not one table. */
/** A sales-register line, as the annual / C-1 drill-downs show it (gap 282). */
const lineCols: Column<R.SalesLine>[] = [
  { key: 'd', label: 'Date', cell: (l) => formatDate(l.billDate), csv: (l) => formatDate(l.billDate) },
  { key: 'inv', label: 'Document', cell: (l) => l.invoiceNumber ?? l.billNumber, csv: (l) => l.invoiceNumber ?? l.billNumber },
  { key: 'p', label: 'Patient', cell: (l) => l.patientName ?? '—', csv: (l) => l.patientName ?? '' },
  { key: 'desc', label: 'Line', cell: (l) => l.description, csv: (l) => l.description },
  { key: 'tr', label: 'Treatment', cell: (l) => l.treatmentLabel ?? 'Unclassified', csv: (l) => l.gstTreatment ?? 'unclassified' },
  { key: 'tv', label: 'Value (before tax)', align: 'right', cell: (l) => plain(l.taxableValue), csv: (l) => l.taxableValue },
  { key: 'tax', label: 'Tax', align: 'right', cell: (l) => plain(l.taxAmount), csv: (l) => l.taxAmount },
];
const noteCols: Column<R.AppliedNote>[] = [
  { key: 'd', label: 'Date', cell: (n) => formatDate(n.issueDate), csv: (n) => formatDate(n.issueDate) },
  { key: 'n', label: 'Note', cell: (n) => n.creditNoteNumber, csv: (n) => n.creditNoteNumber },
  { key: 'i', label: 'Against invoice', cell: (n) => n.againstInvoiceNumber ?? '—', csv: (n) => n.againstInvoiceNumber ?? '' },
  { key: 'p', label: 'Patient', cell: (n) => n.patientName ?? '—', csv: (n) => n.patientName ?? '' },
  { key: 'v', label: 'Taxable value', align: 'right', cell: (n) => plain(n.taxableSide ?? n.taxableValue), csv: (n) => n.taxableSide ?? n.taxableValue },
  { key: 'x', label: 'Tax', align: 'right', cell: (n) => plain(n.taxAmount), csv: (n) => n.taxAmount },
];

type WorkingLine = { section: string; label: string; amount: number | null; source: string };
const workingCols: Column<WorkingLine>[] = [
  { key: 'sec', label: 'Table', cell: (r) => r.section, csv: (r) => r.section },
  { key: 'l', label: 'Row', cell: (r) => r.label, csv: (r) => r.label },
  { key: 'a', label: 'Amount', align: 'right', cell: (r) => (r.amount === null ? '—' : plain(r.amount)), csv: (r) => (r.amount === null ? '' : r.amount) },
  { key: 's', label: 'Source', cell: (r) => r.source, csv: (r) => r.source },
];

// ── GSTR-9 ─────────────────────────────────────────────────────────────────

export function Gstr9View() {
  const [fy, setFy] = useState(currentFinancialYear);
  const { data, isLoading } = R.useGstr9(fy);
  // Gap 282: the headline turnover opens the year's register lines — the same
  // A-7 partition the annual figures fold — read once a figure is opened.
  const d = useStatDrill();
  const yearRegister = R.useSalesRegister(
    { from: data?.period.from ?? undefined, to: data?.period.to ?? undefined },
    d.focus != null && !!data?.period.from,
  );

  if (isLoading) return <Loading />;
  const fyPeriod = { from: data?.period.from ?? undefined, to: data?.period.to ?? undefined };
  type MonthlyHeadRow = { h: string; a: number; m: number; f: number | null };

  const tableCols = (valueKey: 'taxableValue' | 'amount'): Column<Record<string, unknown>>[] => [
    { key: 'ref', label: '#', cell: (r) => String(r.ref), csv: (r) => String(r.ref) },
    { key: 'label', label: 'Row', cell: (r) => String(r.label), csv: (r) => String(r.label) },
    {
      key: 'val', label: valueKey === 'amount' ? 'Amount' : 'Taxable value', align: 'right',
      cell: (r) => plain(Number(r[valueKey] ?? 0)), csv: (r) => Number(r[valueKey] ?? 0),
    },
    { key: 'c', label: 'CGST', align: 'right', cell: (r) => plain(Number(r.cgstAmount ?? 0)), csv: (r) => Number(r.cgstAmount ?? 0) },
    { key: 's', label: 'SGST', align: 'right', cell: (r) => plain(Number(r.sgstAmount ?? 0)), csv: (r) => Number(r.sgstAmount ?? 0) },
    { key: 'i', label: 'IGST', align: 'right', cell: (r) => plain(Number(r.igstAmount ?? 0)), csv: (r) => Number(r.igstAmount ?? 0) },
    { key: 'src', label: 'Source', cell: (r) => String(r.source), csv: (r) => String(r.source) },
  ];

  const yl = yearRegister.data?.rows ?? [];
  const lo = { sum: (l: R.SalesLine) => l.taxableValue, loading: yearRegister.isLoading };
  const nineDrills: Record<string, ReactNode> = {
    'Total turnover': d.lines('Total turnover', lineCols, yl.filter((l) => !!l.gstTreatment), lo),
    Taxable: d.lines('Taxable', lineCols, yl.filter((l) => l.gstTreatment === 'taxable'), lo),
    Exempt: d.lines('Exempt', lineCols, yl.filter((l) => ['exempt', 'nil_rated', 'non_gst'].includes(l.gstTreatment ?? '')), lo),
    Invoices: d.lines('Invoices', lineCols, yl, {
      loading: yearRegister.isLoading, note: `${new Set(yl.map((l) => l.billId)).size} invoice(s)`,
    }),
  };
  // Table 9 has no lines of its own in the payload; it opens Table 4, whose
  // head-wise tax it is computed from. 'Tax paid' is declared on the portal.
  const table9Drills: Record<string, ReactNode> = {
    'Tax payable (computed here)': d.lines(
      'Tax payable (computed here)', tableCols('taxableValue'),
      (data?.tables.table4.rows ?? []) as unknown as Array<Record<string, unknown>>,
    ),
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <YearPicker value={fy} onChange={setFy} />
        <ExportButton
          disabled={!data}
          {...exportAll(
            `gstr9-${fy}`,
            tableCols('taxableValue'),
            [...(data?.tables.table4.rows ?? []), ...(data?.tables.table5.rows ?? [])] as never,
            { from: data?.period.from ?? undefined, to: data?.period.to ?? undefined },
          )}
        />
      </div>

      <StatStrip
        stats={d.wire([
          { label: 'Total turnover', value: money(data?.turnover.totalTurnover) },
          { label: 'Taxable', value: money(data?.turnover.taxableTurnover) },
          { label: 'Exempt', value: money(data?.turnover.exemptTurnover), hint: `${pct(data?.turnover.exemptRatioPercent)} of turnover` },
          { label: 'Invoices', value: String(data?.documents.invoices ?? 0), hint: `${data?.documents.lines ?? 0} lines` },
        ], nineDrills)}
      />
      {d.panel(nineDrills)}

      {/* The annual view against the register it is folded from. An annual
          figure derived independently is one that will not tie. */}
      <TieBack
        agrees={data?.reconciliation.agrees ?? false}
        detail={`Sum of the treatment buckets ${money(data?.reconciliation.partsTaxableValue)} against the sales register ${money(
          data?.reconciliation.registerTaxableValue,
        )} — both as invoiced${
          data?.reconciliation.notesTaxableValue
            ? `; credit and debit notes of ${money(data.reconciliation.notesTaxableValue)} are shown in 4I/4J/5H/5I and checked against the months below`
            : ''
        }`}
      />

      <ExportableTable
        title={data?.tables.table4.label}
        name={`gstr9-${fy}-table4`}
        columns={tableCols('taxableValue')}
        rows={(data?.tables.table4.rows ?? []) as never}
        period={fyPeriod}
      />

      {/* Gap item 312: Table 4 against the twelve monthly returns, head by
          head — and CGST against SGST, which must be equal intra-State. */}
      {data?.monthlyCheck ? (
        <section className="space-y-2">
          <TieBack
            agrees={data.monthlyCheck.agrees}
            detail={`${data.monthlyCheck.label}: annual taxable ${money(data.monthlyCheck.annual.taxableValue)} against ${money(
              data.monthlyCheck.sumOfMonths.taxableValue,
            )} summed over ${data.monthlyCheck.months.length} month(s)${
              data.monthlyCheck.cgstSgstGap !== 0
                ? ` · CGST and SGST differ by ${money(data.monthlyCheck.cgstSgstGap)} (rounding on lines billed before both heads used one half-rate figure)`
                : ''
            }`}
          />
          <ExportableTable
            title="Table 4 against the monthly returns, head by head"
            name={`gstr9-${fy}-monthly-check`}
            period={fyPeriod}
            columns={[
              { key: 'h', label: 'Head', cell: (r: MonthlyHeadRow) => r.h },
              { key: 'a', label: 'GSTR-9 Table 4 (net)', align: 'right', cell: (r: MonthlyHeadRow) => plain(r.a), csv: (r: MonthlyHeadRow) => r.a },
              { key: 'm', label: 'Sum of monthly 3.1(a)', align: 'right', cell: (r: MonthlyHeadRow) => plain(r.m), csv: (r: MonthlyHeadRow) => r.m },
              { key: 'd', label: 'Difference', align: 'right', cell: (r: MonthlyHeadRow) => plain(r.a - r.m), csv: (r: MonthlyHeadRow) => Math.round((r.a - r.m) * 100) / 100 },
              {
                key: 'f',
                label: `Filed from this system (${data.monthlyCheck.filed.months} month(s))`,
                align: 'right',
                cell: (r: MonthlyHeadRow) => (r.f == null ? '—' : plain(r.f)),
                csv: (r: MonthlyHeadRow) => (r.f == null ? '' : r.f),
              },
            ]}
            rows={(['taxableValue', 'cgstAmount', 'sgstAmount', 'igstAmount'] as const).map((k) => ({
              h: k === 'taxableValue' ? 'Taxable value' : k.replace('Amount', '').toUpperCase(),
              a: data.monthlyCheck!.annual[k],
              m: data.monthlyCheck!.sumOfMonths[k],
              f: data.monthlyCheck!.filed.months ? Number(data.monthlyCheck!.filed[k] ?? 0) : null,
            }))}
          />
        </section>
      ) : null}

      <section className="space-y-2">
        <ExportableTable
          title={data?.tables.table5.label}
          name={`gstr9-${fy}-table5`}
          columns={tableCols('taxableValue')}
          rows={(data?.tables.table5.rows ?? []) as never}
          period={fyPeriod}
        />
        <p className="text-right text-sm font-medium">Total {money(data?.tables.table5.total)}</p>
        {data?.table5Check ? (
          <TieBack
            agrees={data.table5Check.agrees}
            detail={`${data.table5Check.label}: annual ${money(data.table5Check.annual)} against ${money(
              data.table5Check.sumOfMonths,
            )} summed over ${data.table5Check.months.length} month(s)`}
          />
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{data?.tables.table6.label}</h3>
          <ExportButton
            {...exportAll(`gstr9-${fy}-table6`, ladderCols, data?.tables.table6.ladder ?? [], fyPeriod)}
            disabled={!(data?.tables.table6.ladder ?? []).length}
          />
        </div>
        {data?.tables.table6.ladder ? <Ladder rungs={data.tables.table6.ladder} /> : null}
      </section>

      <section className="space-y-2">
        <ExportableTable
          title={data?.tables.table7.label}
          name={`gstr9-${fy}-table7`}
          columns={tableCols('amount')}
          rows={(data?.tables.table7.rows ?? []) as never}
          period={fyPeriod}
        />
        <p className="text-right text-sm font-medium">Reversed {money(data?.tables.table7.total)}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{data?.tables.table9.label}</h3>
        <StatStrip
          stats={d.wire([
            { label: 'Tax payable (computed here)', value: money(data?.tables.table9.taxPayable.taxAmount) },
            { label: 'Tax paid', value: '—', hint: 'declared on the portal' },
          ], table9Drills)}
        />
        {d.panel(table9Drills)}
        <ReportNotes notes={[data?.tables.table9.note ?? '']} />
      </section>

      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

// ── GSTR-9C ────────────────────────────────────────────────────────────────

export function Gstr9cView() {
  const [fy, setFy] = useState(currentFinancialYear);
  const [audited, setAudited] = useState('');
  const auditedNum = audited.trim() === '' ? undefined : Number(audited);
  const { data, isLoading } = R.useGstr9c({
    financialYear: fy,
    auditedTurnover: Number.isFinite(auditedNum as number) ? auditedNum : undefined,
  });
  // Gap 282: 'Lines examined' opens the year's register lines, read once opened.
  const d = useStatDrill();
  const yearRegister = R.useSalesRegister(
    { from: data?.period.from ?? undefined, to: data?.period.to ?? undefined },
    d.focus === 'Lines examined' && !!data?.period.from,
  );

  if (isLoading) return <Loading />;
  const fyPeriod = { from: data?.period.from ?? undefined, to: data?.period.to ?? undefined };
  type AdjRow = { label: string; amount: number; source: string };
  type TurnoverRow = { k: string; v: number };
  const adjustments: AdjRow[] = data?.turnover.adjustments ?? [];
  const taxableTurnover: TurnoverRow[] = Object.entries(data?.taxableTurnover ?? {}).map(([k, v]) => ({ k, v: Number(v) }));
  const ladder = data?.inputTaxCredit.ladder ?? [];
  // Gap 282: 9C had no export at all. Its figures are three tables, so the
  // primary export is the whole working, one line per figure, in form order.
  const working: WorkingLine[] = data
    ? [
        { section: 'Turnover', label: 'Declared turnover', amount: data.turnover.declaredTurnover, source: data.turnover.declaredTurnoverSource },
        { section: 'Turnover', label: 'Audited turnover', amount: data.turnover.auditedTurnover, source: data.turnover.auditedTurnoverSource },
        ...adjustments.map((a) => ({ section: 'Table 5', label: a.label, amount: a.amount, source: a.source })),
        { section: 'Table 5', label: 'Unreconciled difference', amount: data.turnover.unreconciledDifference, source: 'audited less declared' },
        ...taxableTurnover.map((t) => ({ section: 'Table 7', label: t.k, amount: t.v, source: 'A-7 Exempt, Nil-rated and Non-GST Turnover' })),
        ...ladder.map((r) => ({ section: 'Table 12', label: r.label, amount: r.amount, source: r.source })),
      ]
    : [];

  // Declared turnover and the difference open the Table 5 working that builds
  // them; 'Audited turnover' is the figure typed above, so it has no drill.
  const turnoverWorking = working.filter((w) => w.section === 'Turnover' || w.section === 'Table 5');
  const nineCDrills: Record<string, ReactNode> = {
    'Declared turnover': d.lines('Declared turnover', workingCols, turnoverWorking),
    Unreconciled: d.lines('Unreconciled', workingCols, turnoverWorking),
    'Lines examined': d.lines('Lines examined', lineCols, yearRegister.data?.rows ?? [], {
      sum: (l) => l.taxableValue, loading: yearRegister.isLoading,
    }),
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <YearPicker value={fy} onChange={setFy} />
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-on-surface-variant">
              Audited turnover (₹)
            </label>
            <Input
              value={audited}
              onChange={(e) => setAudited(e.target.value)}
              placeholder="from the financial statements"
              className="mt-1 h-8 w-56 text-sm"
            />
          </div>
        </div>
        <ExportButton {...exportAll(`gstr9c-${fy}`, workingCols, working, fyPeriod, { notes: data?.notes })} disabled={!working.length} />
      </div>

      <StatStrip
        stats={d.wire([
          { label: 'Declared turnover', value: money(data?.turnover.declaredTurnover) },
          {
            label: 'Audited turnover',
            value: data?.turnover.auditedTurnover == null ? '—' : money(data.turnover.auditedTurnover),
            hint: data?.turnover.auditedTurnover == null ? 'not supplied' : undefined,
          },
          {
            label: 'Unreconciled',
            value: data?.turnover.unreconciledDifference == null ? '—' : money(data.turnover.unreconciledDifference),
            tone: (data?.turnover.unreconciledDifference == null
              ? undefined
              : Math.abs(data.turnover.unreconciledDifference) < 1
                ? 'good'
                : 'warn') as 'good' | 'warn' | undefined,
          },
          { label: 'Lines examined', value: String(data?.lines ?? 0) },
        ], nineCDrills)}
      />
      {d.panel(nineCDrills)}

      <ExportableTable
        title="Table 5 — gross turnover"
        name={`gstr9c-${fy}-table5`}
        period={fyPeriod}
        columns={[
          { key: 'l', label: 'Adjustment', cell: (r: AdjRow) => r.label, csv: (r: AdjRow) => r.label },
          { key: 'a', label: 'Amount', align: 'right', cell: (r: AdjRow) => plain(r.amount), csv: (r: AdjRow) => r.amount },
          { key: 's', label: 'Source', cell: (r: AdjRow) => r.source, csv: (r: AdjRow) => r.source },
        ]}
        rows={adjustments}
      />

      <ExportableTable
        title="Table 7 — taxable turnover"
        name={`gstr9c-${fy}-table7`}
        period={fyPeriod}
        columns={[
          { key: 'k', label: 'Treatment', cell: (r: TurnoverRow) => r.k, csv: (r: TurnoverRow) => r.k },
          { key: 'v', label: 'Value', align: 'right', cell: (r: TurnoverRow) => plain(r.v), csv: (r: TurnoverRow) => r.v },
        ]}
        rows={taxableTurnover}
      />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Table 12 — input tax credit</h3>
          <ExportButton {...exportAll(`gstr9c-${fy}-table12`, ladderCols, ladder, fyPeriod)} disabled={!ladder.length} />
        </div>
        {data?.inputTaxCredit.ladder ? <Ladder rungs={data.inputTaxCredit.ladder} /> : null}
        <p className="text-[11px] text-on-surface-variant">{data?.inputTaxCredit.claimedInReturnsSource}</p>
      </section>

      {/* What this system cannot see, said plainly rather than left blank. A
          reconciliation that hides its own blind spots is worse than none. */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Not visible to this system</h3>
        <ul className="list-disc space-y-1 pl-5 text-xs text-on-surface-variant">
          {(data?.unreconciled ?? []).map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </section>

      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

// ── C-1 — what was BILLED ──────────────────────────────────────────────────

export function DailyLiabilityView({ q }: { q: Q }) {
  const { data, isLoading } = R.useDailyLiability(q);
  // Gap 282: the lines and notes behind each headline, read once one is opened.
  const d = useStatDrill();
  const register = R.useSalesRegister(q, d.focus === 'Gross tax billed' || d.focus === 'Exempt value');
  const gstr3b = R.useGstr3b(q, d.focus === 'Credit notes');
  if (isLoading) return <Loading />;

  const dayCols: Column<NonNullable<typeof data>['byDay'][number]>[] = [
    { key: 'd', label: 'Day', cell: (r) => r.day, csv: (r) => r.day },
    { key: 'b', label: 'Bills', align: 'right', cell: (r) => r.bills, csv: (r) => r.bills },
    { key: 'tv', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'ex', label: 'Exempt value', align: 'right', cell: (r) => plain(r.exemptValue), csv: (r) => r.exemptValue },
    { key: 'c', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount },
    { key: 's', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount },
    { key: 'i', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount },
    { key: 't', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  ];

  // Gap item 276: gross billed, the credit notes that reverse it, and the net
  // that GSTR-3B 3.1(a) declares — per rate.
  type RateRow = NonNullable<NonNullable<typeof data>['byRate']>[number];
  const rateCols: Column<RateRow>[] = [
    { key: 'r', label: 'Rate %', align: 'right', cell: (r) => `${r.ratePercent}%`, csv: (r) => r.ratePercent },
    { key: 'gt', label: 'Gross taxable', align: 'right', cell: (r) => plain(r.gross.taxableValue), csv: (r) => r.gross.taxableValue },
    { key: 'gx', label: 'Gross tax', align: 'right', cell: (r) => plain(r.gross.taxAmount), csv: (r) => r.gross.taxAmount },
    { key: 'ct', label: 'Credit notes taxable', align: 'right', cell: (r) => plain(r.creditNotes.taxableValue), csv: (r) => r.creditNotes.taxableValue },
    { key: 'cx', label: 'Credit notes tax', align: 'right', cell: (r) => plain(r.creditNotes.taxAmount), csv: (r) => r.creditNotes.taxAmount },
    { key: 'nt', label: 'Net taxable', align: 'right', cell: (r) => plain(r.net.taxableValue), csv: (r) => r.net.taxableValue },
    { key: 'nc', label: 'Net CGST', align: 'right', cell: (r) => plain(r.net.cgstAmount), csv: (r) => r.net.cgstAmount },
    { key: 'ns', label: 'Net SGST', align: 'right', cell: (r) => plain(r.net.sgstAmount), csv: (r) => r.net.sgstAmount },
    { key: 'ni', label: 'Net IGST', align: 'right', cell: (r) => plain(r.net.igstAmount), csv: (r) => r.net.igstAmount },
    { key: 'nx', label: 'Net tax', align: 'right', cell: (r) => plain(r.net.taxAmount), csv: (r) => r.net.taxAmount },
  ];
  const liab = data?.liability;
  const reg = register.data?.rows ?? [];
  const liabilityDrills: Record<string, ReactNode> = {
    'Gross tax billed': d.lines('Gross tax billed', lineCols, reg.filter((l) => Number(l.taxAmount) !== 0), {
      sum: (l) => l.taxAmount, loading: register.isLoading,
    }),
    // The notes GSTR-3B 3.1(a) nets — the same set this liability agrees with.
    'Credit notes': d.lines('Credit notes', noteCols, gstr3b.data?.creditNotesApplied ?? [], {
      sum: (n) => n.taxAmount, loading: gstr3b.isLoading,
    }),
    'Net output tax': d.lines('Net output tax', rateCols, data?.byRate ?? [], { sum: (r) => r.net.taxAmount }),
    'Exempt value': d.lines('Exempt value', lineCols, reg.filter((l) => !!l.gstTreatment && l.gstTreatment !== 'taxable'), {
      sum: (l) => l.taxableValue, loading: register.isLoading,
    }),
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButton
          disabled={!data}
          onClick={() => exportCsv('daily-gst-liability', dayCols, data?.byDay ?? [], q)}
          onExcel={() => exportXlsx('daily-gst-liability', dayCols, data?.byDay ?? [], q)} onPdf={() => exportPdf('daily-gst-liability', dayCols, data?.byDay ?? [], q)}
        />
      </div>
      <StatStrip
        stats={d.wire([
          { label: 'Gross tax billed', value: money(liab?.gross.taxAmount ?? data?.totals.taxAmount) },
          { label: 'Credit notes', value: money(liab?.creditNotes.taxAmount), hint: `${liab?.notesApplied ?? 0} note(s)` },
          { label: 'Net output tax', value: money(liab?.net.taxAmount ?? data?.totals.taxAmount), hint: 'GSTR-3B 3.1(a)' },
          { label: 'Exempt value', value: money(data?.totals.exemptValue), hint: `${data?.totals.bills ?? 0} bills · ${data?.totals.lines ?? 0} lines` },
        ], liabilityDrills)}
      />
      {d.panel(liabilityDrills)}
      {liab ? (
        <TieBack
          agrees={liab.agreesWithGstr3b}
          detail={`Net output tax ${money(liab.net.taxAmount)} against GSTR-3B 3.1(a) ${money(liab.gstr3bOutwardTax)}${
            liab.notesExcluded.originalNotInRegister
              ? ` · ${liab.notesExcluded.originalNotInRegister} cancellation note(s) not netted — the voided sale is already out of the register`
              : ''
          }${liab.notesExcluded.outsideTimeLimit ? ` · ${liab.notesExcluded.outsideTimeLimit} note(s) past the section 34 deadline` : ''}`}
        />
      ) : null}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">By rate — gross, credit notes and net</h3>
          <ExportButton {...exportAll('gst-liability-by-rate', rateCols, data?.byRate ?? [], q)} disabled={!(data?.byRate ?? []).length} />
        </div>
        <ReportTable columns={rateCols} rows={data?.byRate ?? []} empty="No taxable supplies in this period." />
      </section>
      <ReportNotes notes={[data?.note ?? '']} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By day</h3>
        <ReportTable columns={dayCols} rows={data?.byDay ?? []} />
      </section>
      <ExportableTable
        title="By department"
        name="daily-gst-liability-by-department"
        period={q}
        columns={[
          { key: 'd', label: 'Department', cell: (r: { department: string }) => r.department, csv: (r: { department: string }) => r.department },
          { key: 'b', label: 'Bills', align: 'right', cell: (r: { bills: number }) => r.bills, csv: (r: { bills: number }) => r.bills },
          { key: 'tv', label: 'Taxable', align: 'right', cell: (r: { taxableValue: number }) => plain(r.taxableValue), csv: (r: { taxableValue: number }) => r.taxableValue },
          { key: 'ex', label: 'Exempt', align: 'right', cell: (r: { exemptValue: number }) => plain(r.exemptValue), csv: (r: { exemptValue: number }) => r.exemptValue },
          { key: 't', label: 'Tax', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount), csv: (r: { taxAmount: number }) => r.taxAmount },
        ]}
        rows={data?.byDepartment ?? []}
      />
      <ExportableTable
        title="By who raised it"
        name="daily-gst-liability-by-raised-by"
        period={q}
        columns={[
          { key: 'u', label: 'Raised by', cell: (r: { raisedBy: string }) => r.raisedBy, csv: (r: { raisedBy: string }) => r.raisedBy },
          { key: 'b', label: 'Bills', align: 'right', cell: (r: { bills: number }) => r.bills, csv: (r: { bills: number }) => r.bills },
          { key: 't', label: 'Tax', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount), csv: (r: { taxAmount: number }) => r.taxAmount },
        ]}
        rows={data?.byRaisedBy ?? []}
      />
    </div>
  );
}
