'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date-utils';
import {
  Column, ExportButton, Loading, ReportNotes, ReportTable, StatStrip, TieBack,
  DrillThrough, exportCsv, exportXlsx, money, pct, plain, titleCase,
} from './gst-report-shell';
import type { GstReportQuery } from '@/hooks/use-gst-reports';
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

const treatmentTone = (t: string | null) =>
  t === 'taxable' ? 'default' : t == null ? 'destructive' : 'secondary';

// ── A-1 ────────────────────────────────────────────────────────────────────

export function SalesRegisterView({ q }: { q: Q }) {
  const { data, isLoading } = R.useSalesRegister(q);
  const rows = data?.rows ?? [];

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
      { key: 'taxable', label: 'Taxable', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
      { key: 'gst', label: 'GST %', align: 'right', cell: (r) => r.taxRatePercent, csv: (r) => r.taxRatePercent },
      { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount },
      { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount },
      { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount },
      { key: 'total', label: 'Amount', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
    ],
    [],
  );

  if (isLoading) return <Loading />;

  const sum = (pick: (l: R.SalesLine) => number) => rows.reduce((t, l) => t + pick(l), 0);

  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Lines', value: String(rows.length) },
          { label: 'Taxable value', value: money(sum((l) => l.taxableValue)) },
          { label: 'Tax', value: money(sum((l) => l.taxAmount)) },
          { label: 'Invoice value', value: money(sum((l) => l.totalAmount)) },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-sales-register', columns, rows, q)}
          onExcel={() => exportXlsx('gst-sales-register', columns, rows, q)} disabled={!rows.length} />
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

  if (isLoading) return <Loading />;
  const byRate = data?.byRate ?? [];
  const byDept = data?.byDepartment ?? [];

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
    { key: 'taxable', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount },
    { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount },
    { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount },
    { key: 'tax', label: 'Total tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  ];

  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Taxable value', value: money(data?.totals.taxableValue) },
          { label: 'Tax payable', value: money(data?.totals.taxAmount) },
          { label: 'Invoice value', value: money(data?.totals.totalAmount) },
          { label: 'Lines', value: String(data?.totals.count ?? 0) },
        ]}
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
          onExcel={() => exportXlsx('gst-rate-summary', rateCols, byRate, q)} disabled={!byRate.length} />
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
              <td className="px-3 py-2">Total</td>
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
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By department — where the taxable income comes from</h3>
        <ReportTable
          columns={[
            { key: 'dept', label: 'Department', cell: (d) => titleCase(d.department) },
            { key: 'lines', label: 'Lines', align: 'right', cell: (d) => d.count },
            { key: 'taxable', label: 'Taxable value', align: 'right', cell: (d) => plain(d.taxableValue) },
            { key: 'tax', label: 'Tax', align: 'right', cell: (d) => plain(d.taxAmount) },
            { key: 'total', label: 'Amount', align: 'right', cell: (d) => plain(d.totalAmount) },
          ]}
          rows={byDept}
        />
      </section>
    </div>
  );
}

// ── A-3 ────────────────────────────────────────────────────────────────────

export function HsnSummaryView({ q }: { q: Q }) {
  const { data, isLoading } = R.useHsnSummary(q);
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
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Codes reported', value: String(rows.length) },
          { label: 'Reporting digits', value: `${data?.reportingDigits ?? 4}`, hint: '6 above ₹5 crore turnover' },
          { label: 'Taxable value', value: money(data?.totals.taxableValue) },
          {
            label: 'Lines with NO code',
            value: String(data?.unclassified.count ?? 0),
            tone: (data?.unclassified.count ?? 0) > 0 ? 'bad' : 'good',
            hint: 'Missing from Table 12',
          },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-hsn-summary', cols, rows, q)}
          onExcel={() => exportXlsx('gst-hsn-summary', cols, rows, q)} disabled={!rows.length} />
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
  if (isLoading) return <Loading />;
  const rows = data?.invoices ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'date', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
    { key: 'inv', label: 'Invoice No.', cell: (r) => r.invoiceNumber ?? r.billNumber, csv: (r) => r.invoiceNumber ?? r.billNumber },
    { key: 'gstin', label: 'Recipient GSTIN', cell: (r) => r.recipientGstin ?? '—', csv: (r) => r.recipientGstin ?? '' },
    { key: 'name', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
    { key: 'pos', label: 'POS', cell: (r) => r.placeOfSupplyStateCode ?? '—', csv: (r) => r.placeOfSupplyStateCode ?? '' },
    { key: 'taxable', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'tax', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'total', label: 'Invoice value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
  ];
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Invoices', value: String(rows.length) },
          { label: 'Taxable value', value: money(data?.totals.taxableValue) },
          { label: 'Tax', value: money(data?.totals.taxAmount) },
          { label: 'Feeds', value: 'GSTR-1 Table 4' },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-b2b-register', cols, rows, q)}
          onExcel={() => exportXlsx('gst-b2b-register', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} empty="No supplies to a GST-registered recipient in this period." />
    </div>
  );
}

export function B2cSummaryView({ q }: { q: Q }) {
  const { data, isLoading } = R.useB2cSummary(q);
  if (isLoading) return <Loading />;
  const summary = data?.summary ?? [];
  const large = data?.largeInterState ?? [];
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Taxable value', value: money(data?.totals.taxableValue) },
          { label: 'Tax', value: money(data?.totals.taxAmount) },
          { label: 'Large inter-State', value: String(large.length), hint: `above ${money(data?.threshold)}` },
          { label: 'Summary rows', value: String(summary.length) },
        ]}
      />
      {large.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Table 5 — inter-State, reported invoice-wise</h3>
          <ReportTable
            columns={[
              { key: 'date', label: 'Date', cell: (r) => formatDate(r.billDate) },
              { key: 'inv', label: 'Invoice No.', cell: (r) => r.invoiceNumber ?? r.billNumber },
              { key: 'pos', label: 'POS', cell: (r) => r.placeOfSupplyStateCode ?? '—' },
              { key: 'taxable', label: 'Taxable', align: 'right', cell: (r) => plain(r.taxableValue) },
              { key: 'tax', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount) },
              { key: 'total', label: 'Value', align: 'right', cell: (r) => plain(r.totalAmount) },
            ]}
            rows={large}
          />
        </section>
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Table 7 — everything else, by place of supply and rate</h3>
        <ReportTable
          columns={[
            { key: 'type', label: 'Supply', cell: (r) => (r.isInterState ? 'Inter-State' : 'Intra-State') },
            { key: 'pos', label: 'POS', cell: (r) => r.placeOfSupplyStateCode ?? '—' },
            { key: 'rate', label: 'Rate', align: 'right', cell: (r) => `${r.ratePercent}%` },
            { key: 'taxable', label: 'Taxable', align: 'right', cell: (r) => plain(r.taxableValue) },
            { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount) },
            { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount) },
            { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount) },
          ]}
          rows={summary}
        />
      </section>
    </div>
  );
}

// ── A-6 ────────────────────────────────────────────────────────────────────

export function CreditNoteView({ q }: { q: Q }) {
  const { data, isLoading } = R.useCreditNoteRegister(q);
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
        ) : (
          <Badge variant="outline">Reportable</Badge>
        ),
      csv: (r) => (!r.reportable ? 'not filable' : !r.withinTimeLimit ? 'past deadline' : 'reportable'),
    },
  ];
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
        stats={[
          { label: 'Credit notes', value: String(data?.summary.count ?? 0) },
          { label: 'Tax reversed', value: money(data?.summary.taxAmount) },
          { label: 'B2B / B2C', value: `${data?.summary.b2b.count ?? 0} / ${data?.summary.b2c.count ?? 0}` },
          {
            label: 'Cannot be filed',
            value: String(data?.summary.notReportable ?? 0),
            tone: (data?.summary.notReportable ?? 0) > 0 ? 'bad' : 'good',
          },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-credit-notes', cols, rows, q)}
          onExcel={() => exportXlsx('gst-credit-notes', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} />
      <ReportNotes notes={notes} />
    </div>
  );
}

// ── A-7 ────────────────────────────────────────────────────────────────────

export function ExemptTurnoverView({ q }: { q: Q }) {
  const { data, isLoading } = R.useExemptTurnover(q);
  if (isLoading) return <Loading />;
  const buckets = [
    { label: 'Taxable', v: data?.taxable },
    { label: 'Exempt', v: data?.exempt },
    { label: 'Nil rated', v: data?.nilRated },
    { label: 'Non-GST', v: data?.nonGst },
    { label: 'Zero rated', v: data?.zeroRated },
    { label: 'Unclassified', v: data?.unclassified },
  ];
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Exempt turnover', value: money(data?.exemptTurnover) },
          { label: 'Total turnover', value: money(data?.totalTurnover) },
          { label: 'Exempt ratio', value: pct(data?.exemptRatio), hint: 'Rule 42 E ÷ F' },
          {
            label: 'Unclassified lines',
            value: String(data?.unclassified.count ?? 0),
            tone: (data?.unclassified.count ?? 0) > 0 ? 'bad' : 'good',
          },
        ]}
      />
      <ReportNotes
        notes={[
          'This ratio is the input to the Rule 42 / 43 reversal in B-3. It decides how much of the month’s input credit the hospital keeps — for a hospital it is the largest number on the sales side.',
        ]}
      />
      <ReportTable
        columns={[
          { key: 'k', label: 'Treatment', cell: (b: (typeof buckets)[number]) => b.label },
          { key: 'lines', label: 'Lines', align: 'right', cell: (b) => b.v?.count ?? 0 },
          { key: 'value', label: 'Turnover', align: 'right', cell: (b) => plain(b.v?.taxableValue) },
          { key: 'tax', label: 'Tax', align: 'right', cell: (b) => plain(b.v?.taxAmount) },
        ]}
        rows={buckets}
      />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By department</h3>
        <ReportTable
          columns={[
            { key: 'd', label: 'Department', cell: (d: { department: string; exempt: number; taxable: number }) => titleCase(d.department) },
            { key: 'taxable', label: 'Taxable', align: 'right', cell: (d) => plain(d.taxable) },
            { key: 'exempt', label: 'Exempt', align: 'right', cell: (d) => plain(d.exempt) },
          ]}
          rows={data?.byDepartment ?? []}
        />
      </section>
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

export function Gstr1View({ q }: { q: Q }) {
  const { data, isLoading } = R.useGstr1(q);
  const json = R.useGstr1Json(q);
  if (isLoading) return <Loading />;
  const t = data?.tables;
  const rec = data?.reconciliation;

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(json.data?.json ?? {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${q.from ?? 'period'}_${q.to ?? ''}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      <ReportTable
        columns={[
          { key: 'table', label: 'GSTR-1 table', cell: (r: { table: string; what: string; taxable: number; tax: number }) => r.table },
          { key: 'what', label: 'What it reports', cell: (r) => r.what },
          { key: 'taxable', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxable) },
          { key: 'tax', label: 'Tax', align: 'right', cell: (r) => plain(r.tax) },
        ]}
        rows={[
          { table: '4', what: 'B2B — supplies to registered persons', taxable: t?.b2b.taxableValue ?? 0, tax: t?.b2b.taxAmount ?? 0 },
          { table: '5 & 7', what: 'B2C — supplies to unregistered persons', taxable: t?.b2c.taxableValue ?? 0, tax: t?.b2c.taxAmount ?? 0 },
          { table: '8', what: 'Nil-rated, exempt and non-GST outward supplies', taxable: t?.exemptTurnover.total ?? 0, tax: 0 },
          { table: '9B', what: 'Credit and debit notes', taxable: t?.creditNotes.taxableValue ?? 0, tax: t?.creditNotes.taxAmount ?? 0 },
          { table: '11A', what: 'Tax on advances received', taxable: t?.advances.received.taxableValue ?? 0, tax: t?.advances.received.taxAmount ?? 0 },
          { table: '11B', what: 'Advances adjusted against invoices', taxable: t?.advances.adjusted.amount ?? 0, tax: 0 },
        ]}
      />
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Table 12 — HSN summary</h3>
          <ExportButton
            onClick={() => exportCsv('gstr1-table12', hsnColumns, t?.hsn ?? [], q)}
          onExcel={() => exportXlsx('gstr1-table12', hsnColumns, t?.hsn ?? [], q)}
            disabled={!(t?.hsn ?? []).length}
          />
        </div>
        <ReportTable columns={hsnColumns} rows={t?.hsn ?? []} />
      </section>
      <section className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">The file the accountant uploads</h3>
            <p className="text-xs text-muted-foreground">
              GSTR-1 offline utility JSON for this period.
            </p>
          </div>
          <ExportButton onClick={downloadJson} disabled={json.isLoading || !json.data} />
        </div>
        <ReportNotes notes={json.data?.warnings ?? []} />
      </section>
    </div>
  );
}

export function Gstr3bView({ q }: { q: Q }) {
  const { data, isLoading } = R.useGstr3b(q);
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Outward tax liability', value: money(data?.outwardTaxable.taxAmount) },
          { label: 'Input credit (net)', value: money(data?.inputTaxCredit.net) },
          { label: 'Payable in cash', value: money(data?.netTaxPayable), tone: 'warn' },
          { label: 'Credit carried forward', value: money(data?.creditCarriedForward) },
        ]}
      />
      <ReportTable
        columns={[
          { key: 'box', label: 'Box', cell: (r: { box: string; what: string; value: string }) => r.box },
          { key: 'what', label: 'What it reports', cell: (r) => r.what },
          { key: 'v', label: 'Amount', align: 'right', cell: (r) => r.value },
        ]}
        rows={[
          { box: '3.1(a)', what: 'Outward taxable supplies — taxable value', value: plain(data?.outwardTaxable.taxableValue) },
          { box: '3.1(a)', what: 'CGST', value: plain(data?.outwardTaxable.cgstAmount) },
          { box: '3.1(a)', what: 'SGST', value: plain(data?.outwardTaxable.sgstAmount) },
          { box: '3.1(a)', what: 'IGST', value: plain(data?.outwardTaxable.igstAmount) },
          { box: '3.1(c)', what: 'Other exempt and nil-rated outward supplies', value: plain(data?.outwardExempt) },
          { box: '3.1(e)', what: 'Non-GST outward supplies', value: plain(data?.outwardNonGst) },
          { box: '4(A)', what: 'Input tax credit available', value: plain(data?.inputTaxCredit.available) },
          { box: '4(B)', what: 'Credit reversed — Rule 42 / 43', value: plain(data?.inputTaxCredit.reversed) },
          { box: '4(C)', what: 'Net input tax credit', value: plain(data?.inputTaxCredit.net) },
        ]}
      />
      <ReportNotes
        notes={[
          ...((data?.creditNotesExcluded ?? 0) > 0
            ? [`${data?.creditNotesExcluded} credit note(s) issued past the section 34 deadline are NOT netted off the liability — the money went back but the tax did not.`]
            : []),
          'Input tax credit covers pharmacy and inventory purchases only. Credit on equipment, rent, utilities and professional services is not recorded in this system and must be added by hand.',
        ]}
      />
    </div>
  );
}

// ── A-10 ───────────────────────────────────────────────────────────────────

export function AdvancesView({ q }: { q: Q }) {
  const { data, isLoading } = R.useAdvancesReport(q);
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
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Received', value: money(data?.summary.amountReceived) },
          { label: 'Tax due on advances', value: money(data?.summary.taxDueOnAdvances.taxAmount), hint: 'GSTR-1 Table 11A' },
          { label: 'Adjusted against invoices', value: money(data?.summary.adjustedAgainstInvoices.amount), hint: 'Table 11B' },
          { label: 'Still held', value: money(data?.summary.balanceOutstanding) },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-advances', cols, rows, q)}
          onExcel={() => exportXlsx('gst-advances', cols, rows, q)} disabled={!rows.length} />
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
