'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Column, ExportButton, Loading, ReportNotes, ReportTable, StatStrip, TieBack,
  exportCsv, money, pct, plain,
} from './gst-report-shell';
import type { GstReportQuery, ItcLadderRung } from '@/hooks/use-gst-reports';
import * as R from '@/hooks/use-gst-reports';

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

// ── GSTR-9 ─────────────────────────────────────────────────────────────────

export function Gstr9View() {
  const [fy, setFy] = useState(currentFinancialYear);
  const { data, isLoading } = R.useGstr9(fy);

  if (isLoading) return <Loading />;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <YearPicker value={fy} onChange={setFy} />
        <ExportButton
          disabled={!data}
          onClick={() =>
            exportCsv(
              `gstr9-${fy}`,
              tableCols('taxableValue'),
              [...(data?.tables.table4.rows ?? []), ...(data?.tables.table5.rows ?? [])] as never,
              { from: data?.period.from ?? undefined, to: data?.period.to ?? undefined },
            )
          }
        />
      </div>

      <StatStrip
        stats={[
          { label: 'Total turnover', value: money(data?.turnover.totalTurnover) },
          { label: 'Taxable', value: money(data?.turnover.taxableTurnover) },
          { label: 'Exempt', value: money(data?.turnover.exemptTurnover), hint: `${pct(data?.turnover.exemptRatioPercent)} of turnover` },
          { label: 'Invoices', value: String(data?.documents.invoices ?? 0), hint: `${data?.documents.lines ?? 0} lines` },
        ]}
      />

      {/* The annual view against the register it is folded from. An annual
          figure derived independently is one that will not tie. */}
      <TieBack
        agrees={data?.reconciliation.agrees ?? false}
        detail={`Sum of the treatment buckets ${money(data?.reconciliation.partsTaxableValue)} against the sales register ${money(
          data?.reconciliation.registerTaxableValue,
        )}`}
      />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{data?.tables.table4.label}</h3>
        <ReportTable columns={tableCols('taxableValue')} rows={(data?.tables.table4.rows ?? []) as never} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{data?.tables.table5.label}</h3>
        <ReportTable columns={tableCols('taxableValue')} rows={(data?.tables.table5.rows ?? []) as never} />
        <p className="text-right text-sm font-medium">Total {money(data?.tables.table5.total)}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{data?.tables.table6.label}</h3>
        {data?.tables.table6.ladder ? <Ladder rungs={data.tables.table6.ladder} /> : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{data?.tables.table7.label}</h3>
        <ReportTable columns={tableCols('amount')} rows={(data?.tables.table7.rows ?? []) as never} />
        <p className="text-right text-sm font-medium">Reversed {money(data?.tables.table7.total)}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{data?.tables.table9.label}</h3>
        <StatStrip
          stats={[
            { label: 'Tax payable (computed here)', value: money(data?.tables.table9.taxPayable.taxAmount) },
            { label: 'Tax paid', value: '—', hint: 'declared on the portal' },
          ]}
        />
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

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-6">
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

      <StatStrip
        stats={[
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
        ]}
      />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Table 5 — gross turnover</h3>
        <ReportTable
          columns={[
            { key: 'l', label: 'Adjustment', cell: (r: { label: string }) => r.label, csv: (r: { label: string }) => r.label },
            { key: 'a', label: 'Amount', align: 'right', cell: (r: { amount: number }) => plain(r.amount), csv: (r: { amount: number }) => r.amount },
            { key: 's', label: 'Source', cell: (r: { source: string }) => r.source, csv: (r: { source: string }) => r.source },
          ]}
          rows={data?.turnover.adjustments ?? []}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Table 7 — taxable turnover</h3>
        <ReportTable
          columns={[
            { key: 'k', label: 'Treatment', cell: (r: { k: string }) => r.k, csv: (r: { k: string }) => r.k },
            { key: 'v', label: 'Value', align: 'right', cell: (r: { v: number }) => plain(r.v), csv: (r: { v: number }) => r.v },
          ]}
          rows={Object.entries(data?.taxableTurnover ?? {}).map(([k, v]) => ({ k, v: Number(v) }))}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Table 12 — input tax credit</h3>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButton
          disabled={!data}
          onClick={() => exportCsv('daily-gst-liability', dayCols, data?.byDay ?? [], q)}
        />
      </div>
      <StatStrip
        stats={[
          { label: 'Tax charged', value: money(data?.totals.taxAmount) },
          { label: 'Taxable value', value: money(data?.totals.taxableValue) },
          { label: 'Exempt value', value: money(data?.totals.exemptValue) },
          { label: 'Bills', value: String(data?.totals.bills ?? 0), hint: `${data?.totals.lines ?? 0} lines` },
        ]}
      />
      <ReportNotes notes={[data?.note ?? '']} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By day</h3>
        <ReportTable columns={dayCols} rows={data?.byDay ?? []} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By department</h3>
        <ReportTable
          columns={[
            { key: 'd', label: 'Department', cell: (r: { department: string }) => r.department, csv: (r: { department: string }) => r.department },
            { key: 'b', label: 'Bills', align: 'right', cell: (r: { bills: number }) => r.bills, csv: (r: { bills: number }) => r.bills },
            { key: 'tv', label: 'Taxable', align: 'right', cell: (r: { taxableValue: number }) => plain(r.taxableValue), csv: (r: { taxableValue: number }) => r.taxableValue },
            { key: 'ex', label: 'Exempt', align: 'right', cell: (r: { exemptValue: number }) => plain(r.exemptValue), csv: (r: { exemptValue: number }) => r.exemptValue },
            { key: 't', label: 'Tax', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount), csv: (r: { taxAmount: number }) => r.taxAmount },
          ]}
          rows={data?.byDepartment ?? []}
        />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By who raised it</h3>
        <ReportTable
          columns={[
            { key: 'u', label: 'Raised by', cell: (r: { raisedBy: string }) => r.raisedBy, csv: (r: { raisedBy: string }) => r.raisedBy },
            { key: 'b', label: 'Bills', align: 'right', cell: (r: { bills: number }) => r.bills, csv: (r: { bills: number }) => r.bills },
            { key: 't', label: 'Tax', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount), csv: (r: { taxAmount: number }) => r.taxAmount },
          ]}
          rows={data?.byRaisedBy ?? []}
        />
      </section>
    </div>
  );
}
