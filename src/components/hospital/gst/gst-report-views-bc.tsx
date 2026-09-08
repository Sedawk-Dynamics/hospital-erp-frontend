'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date-utils';
import {
  Column, ExportButton, Loading, ReportNotes, ReportTable, StatStrip,
  exportCsv, money, pct, plain, titleCase,
} from './gst-report-shell';
import type { GstReportQuery } from '@/hooks/use-gst-reports';
import * as R from '@/hooks/use-gst-reports';

// ============================================================
// Group B — what the hospital can claim back — and group C, the controls that
// are meant to catch a problem during the month rather than on filing day.
// ============================================================

type Q = GstReportQuery;

// ── B-1 ────────────────────────────────────────────────────────────────────

export function PurchaseRegisterView({ q }: { q: Q }) {
  const { data, isLoading } = R.usePurchaseRegister(q);
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'date', label: 'Invoice date', cell: (r) => formatDate(r.invoiceDate), csv: (r) => formatDate(r.invoiceDate) },
    { key: 'sup', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
    { key: 'gstin', label: 'GSTIN', cell: (r) => r.supplierGstin ?? <span className="text-red-600">missing</span>, csv: (r) => r.supplierGstin ?? '' },
    { key: 'inv', label: 'Supplier invoice', cell: (r) => r.invoiceNumber ?? '—', csv: (r) => r.invoiceNumber ?? '' },
    { key: 'item', label: 'Item', cell: (r) => r.drugName, csv: (r) => r.drugName },
    { key: 'hsn', label: 'HSN', cell: (r) => r.hsnCode ?? '—', csv: (r) => r.hsnCode ?? '' },
    { key: 'batch', label: 'Batch', cell: (r) => r.batchNumber, csv: (r) => r.batchNumber },
    { key: 'qty', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
    { key: 'free', label: 'Free', align: 'right', cell: (r) => r.freeQuantity, csv: (r) => r.freeQuantity },
    { key: 'taxable', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'rate', label: 'GST %', align: 'right', cell: (r) => r.gstRatePercent ?? '—', csv: (r) => r.gstRatePercent ?? '' },
    { key: 'tax', label: 'Input tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'total', label: 'Invoice value', align: 'right', cell: (r) => plain(r.landingTotal), csv: (r) => r.landingTotal },
  ];
  const tax = rows.reduce((t, r) => t + r.taxAmount, 0);
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Purchases', value: String(rows.length) },
          { label: 'Taxable value', value: money(rows.reduce((t, r) => t + r.taxableValue, 0)) },
          { label: 'Input tax', value: money(tax) },
          { label: 'Invoice value', value: money(rows.reduce((t, r) => t + r.landingTotal, 0)) },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-purchase-register', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} />
    </div>
  );
}

// ── B-2 ────────────────────────────────────────────────────────────────────

export function ItcSummaryView({ q }: { q: Q }) {
  const { data, isLoading } = R.useItcSummary(q);
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Credit available', value: money(data?.totals.taxAmount), hint: 'BEFORE the Rule 42 reversal' },
          { label: 'Purchase value', value: money(data?.totals.taxableValue) },
          { label: 'Purchases', value: String(data?.totals.count ?? 0) },
          {
            label: 'With no rate',
            value: String(data?.withoutRate ?? 0),
            tone: (data?.withoutRate ?? 0) > 0 ? 'warn' : 'good',
            hint: 'credit cannot be claimed',
          },
        ]}
      />
      {/* The ladder the review document asks for. This report used to stop at
          gross credit, which for a hospital is the rung that flatters it: most
          of that number is reversed again under Rule 42, and the accountant had
          to assemble the real answer from B-2 and B-3 in their head.
          `null` shows as a dash, never a zero — "not recorded here" and
          "nothing was claimed" are very different statements. */}
      {(data?.ladder?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">What the hospital actually keeps</h3>
          <div className="overflow-hidden rounded-lg border border-border">
            {data!.ladder.map((r, i) => (
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
                  {r.amount === null ? (
                    <span className="text-on-surface-variant">—</span>
                  ) : (
                    money(r.amount)
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      <ReportNotes
        notes={[
          'The figures below are credit BEFORE reversal, cut by rate and by supplier. The ladder above is what the hospital actually keeps.',
          data?.coverage ?? '',
        ].filter(Boolean)}
      />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By rate</h3>
        <ReportTable
          columns={[
            { key: 'r', label: 'Rate', cell: (r: { ratePercent: number | null }) => (r.ratePercent == null ? 'Not recorded' : `${r.ratePercent}%`) },
            { key: 'c', label: 'Purchases', align: 'right', cell: (r: { count: number }) => r.count },
            { key: 'v', label: 'Taxable value', align: 'right', cell: (r: { taxableValue: number }) => plain(r.taxableValue) },
            { key: 't', label: 'Input tax', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount) },
          ]}
          rows={data?.byRate ?? []}
        />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">By supplier</h3>
        <ReportTable
          columns={[
            { key: 's', label: 'Supplier', cell: (r: { supplierName: string | null }) => r.supplierName ?? '—' },
            { key: 'g', label: 'GSTIN', cell: (r: { supplierGstin: string | null }) => r.supplierGstin ?? <span className="text-red-600">missing</span> },
            { key: 'c', label: 'Purchases', align: 'right', cell: (r: { count: number }) => r.count },
            { key: 'v', label: 'Taxable value', align: 'right', cell: (r: { taxableValue: number }) => plain(r.taxableValue) },
            { key: 't', label: 'Input tax', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount) },
          ]}
          rows={data?.bySupplier ?? []}
        />
      </section>
    </div>
  );
}

// ── B-3 ────────────────────────────────────────────────────────────────────

export function ItcReversalView({ q }: { q: Q }) {
  const { data, isLoading } = R.useItcReversal(q);
  if (isLoading) return <Loading />;
  const working = data?.working ?? [];
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Credit available', value: money(data?.creditAvailable) },
          { label: 'Exempt ratio', value: pct(data?.exemptRatioPercent), hint: 'E ÷ F' },
          { label: 'Credit REVERSED', value: money(data?.reversal.total), tone: 'bad' },
          { label: 'Credit kept', value: money(data?.netCreditAvailable), tone: 'good' },
        ]}
      />
      <ReportTable
        columns={[
          { key: 'step', label: 'Step', cell: (r: (typeof working)[number]) => <span className="font-mono font-semibold">{r.step}</span> },
          { key: 'label', label: 'What it is', cell: (r) => r.label },
          { key: 'amount', label: 'Amount', align: 'right', cell: (r) => plain(r.amount) },
          { key: 'source', label: 'Where it comes from', cell: (r) => <span className="text-xs text-muted-foreground">{r.source}</span> },
        ]}
        rows={working}
      />
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

// ── B-4 ────────────────────────────────────────────────────────────────────

export function SupplierGstinView({ q }: { q: Q }) {
  const { data, isLoading } = R.useSupplierGstinExceptions(q);
  if (isLoading) return <Loading />;
  const rows = data?.suppliers ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
    { key: 'g', label: 'GSTIN on file', cell: (r) => r.supplierGstin ?? '—', csv: (r) => r.supplierGstin ?? '' },
    { key: 'p', label: 'Problem', cell: (r) => <Badge variant="destructive">{r.problem}</Badge>, csv: (r) => r.problem },
    { key: 'b', label: 'Purchases', align: 'right', cell: (r) => r.batches, csv: (r) => r.batches },
    { key: 'v', label: 'Purchase value', align: 'right', cell: (r) => plain(r.purchaseValue), csv: (r) => r.purchaseValue },
    { key: 't', label: 'Credit at risk', align: 'right', cell: (r) => plain(r.taxAtRisk), csv: (r) => r.taxAtRisk },
  ];
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Suppliers', value: String(data?.totals.suppliers ?? 0), tone: (data?.totals.suppliers ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Purchases affected', value: String(data?.totals.batches ?? 0) },
          { label: 'Credit at risk', value: money(data?.totals.taxAtRisk), tone: 'bad' },
          { label: 'Fix', value: 'Suppliers screen' },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-supplier-gstin-exceptions', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} empty="Every supplier in this period has a valid GSTIN." />
    </div>
  );
}

// ── B-6 ────────────────────────────────────────────────────────────────────

export function PurchaseReturnsView({ q }: { q: Q }) {
  const { data, isLoading } = R.usePurchaseReturns(q);
  if (isLoading) return <Loading />;
  const rows = data?.returns ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'd', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => formatDate(r.date) },
    { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
    { key: 'i', label: 'Item', cell: (r) => r.drugName, csv: (r) => r.drugName },
    { key: 'b', label: 'Batch', cell: (r) => r.batchNumber ?? '—', csv: (r) => r.batchNumber ?? '' },
    { key: 'q', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
    { key: 'pi', label: 'Purchase invoice', cell: (r) => r.purchaseInvoiceNumber ?? '—', csv: (r) => r.purchaseInvoiceNumber ?? '' },
    {
      key: 'cn',
      label: 'Supplier credit note',
      cell: (r) => r.supplierCreditNoteNumber ?? <span className="text-amber-600">not received</span>,
      csv: (r) => r.supplierCreditNoteNumber ?? 'not received',
    },
    { key: 'v', label: 'Value returned', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 't', label: 'Tax to reverse', align: 'right', cell: (r) => plain(r.taxToReverse), csv: (r) => r.taxToReverse },
  ];
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Returns', value: String(data?.totals.returns ?? 0) },
          { label: 'Tax to reverse', value: money(data?.totals.taxToReverse), tone: 'warn' },
          {
            label: 'No credit note',
            value: String(data?.totals.withoutSupplierCreditNote ?? 0),
            tone: (data?.totals.withoutSupplierCreditNote ?? 0) > 0 ? 'bad' : 'good',
            hint: 'chase the supplier',
          },
          { label: 'Expiry write-offs', value: money(data?.totals.expiredValue), hint: `${data?.totals.expiryWriteOffs ?? 0} item(s)` },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-purchase-returns', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} empty="No stock went back to a supplier in this period." />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Expiry write-offs — section 17(5)(h) blocks the credit</h3>
        <ReportTable
          columns={[
            { key: 'd', label: 'Date', cell: (r: { date: string }) => formatDate(r.date) },
            { key: 'i', label: 'Item', cell: (r: { itemName: string }) => r.itemName },
            { key: 'b', label: 'Batch', cell: (r: { batchNumber: string | null }) => r.batchNumber ?? '—' },
            { key: 'e', label: 'Expired', cell: (r: { expiryDate: string | null }) => formatDate(r.expiryDate) },
            { key: 'q', label: 'Qty', align: 'right', cell: (r: { quantity: number }) => r.quantity },
            { key: 'v', label: 'Value', align: 'right', cell: (r: { value: number }) => plain(r.value) },
          ]}
          rows={data?.expiryWriteOffs ?? []}
          empty="Nothing was written off in this period."
        />
      </section>
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

// ── C-1 ────────────────────────────────────────────────────────────────────

export function DailyCollectionView({ q }: { q: Q }) {
  const { data, isLoading } = R.useDailyCollection(q);
  if (isLoading) return <Loading />;
  const cut = (label: string, rows: Array<Record<string, unknown>>, key: string) => (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      <ReportTable
        columns={[
          { key: 'k', label: label, cell: (r: Record<string, unknown>) => titleCase(String(r[key] ?? '')) },
          { key: 'c', label: 'Payments', align: 'right', cell: (r) => String(r.count) },
          { key: 'v', label: 'Collected', align: 'right', cell: (r) => plain(Number(r.collected)) },
          { key: 't', label: 'Tax in it', align: 'right', cell: (r) => plain(Number(r.taxCollected)) },
        ]}
        rows={rows}
      />
    </section>
  );
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Collected', value: money(data?.totals.collected) },
          { label: 'Tax collected', value: money(data?.totals.taxCollected) },
          { label: 'Payments', value: String(data?.totals.count ?? 0) },
          { label: 'Days', value: String(data?.byDay.length ?? 0) },
        ]}
      />
      <ReportNotes notes={[data?.note ?? '']} />
      {cut('By day', data?.byDay ?? [], 'day')}
      {cut('By mode', data?.byMethod ?? [], 'method')}
      {cut('By counter', data?.byCounter ?? [], 'counter')}
      {cut('By cashier', data?.byCashier ?? [], 'cashier')}
    </div>
  );
}

// ── C-2 ────────────────────────────────────────────────────────────────────

export function RevenueMixView({ q }: { q: Q }) {
  const { data, isLoading } = R.useRevenueMix(q);
  if (isLoading) return <Loading />;
  const rows = data?.byMonth ?? [];
  return (
    <div className="space-y-4">
      <ReportNotes
        notes={[
          'A taxable share that drifts upward changes the hospital’s input credit position. Better seen as a trend here than as a surprise in the Rule 42 reversal.',
        ]}
      />
      <ReportTable
        columns={[
          { key: 'm', label: 'Month', cell: (r: (typeof rows)[number]) => r.month },
          { key: 't', label: 'Taxable', align: 'right', cell: (r) => plain(r.taxable) },
          { key: 'e', label: 'Exempt', align: 'right', cell: (r) => plain(r.exempt) },
          { key: 'u', label: 'Unclassified', align: 'right', cell: (r) => plain(r.unclassified) },
          { key: 'v', label: 'Total', align: 'right', cell: (r) => plain(r.total) },
          { key: 's', label: 'Taxable share', align: 'right', cell: (r) => pct(r.taxableSharePercent) },
        ]}
        rows={rows}
      />
    </div>
  );
}

// ── C-3 ────────────────────────────────────────────────────────────────────

function UnmappedBucketTable({ title, why, bucket }: { title: string; why: string; bucket?: R.UnmappedBucket }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">· {bucket?.totals.count ?? 0} line(s)</span>
        </h3>
        <p className="text-xs text-muted-foreground">{why}</p>
      </div>
      <ReportTable
        columns={[
          { key: 'd', label: 'Item', cell: (r: { description: string }) => r.description },
          { key: 'dept', label: 'Department', cell: (r: { department: string }) => titleCase(r.department) },
          { key: 'l', label: 'Lines', align: 'right', cell: (r: { lines: number }) => r.lines },
          { key: 'r', label: 'Rated at', cell: (r: { rates: number[] }) => r.rates.map((x) => `${x}%`).join(', ') },
          { key: 'v', label: 'Value', align: 'right', cell: (r: { value: number }) => plain(r.value) },
        ]}
        rows={bucket?.items ?? []}
        empty="Nothing here — good."
      />
    </section>
  );
}

export function UnmappedItemsView({ q }: { q: Q }) {
  const { data, isLoading } = R.useUnmappedItems(q);
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Lines checked', value: String(data?.totals.linesChecked ?? 0) },
          {
            label: 'Exceptions',
            value: String(data?.totals.exceptions ?? 0),
            tone: (data?.totals.exceptions ?? 0) > 0 ? 'bad' : 'good',
          },
          { label: 'No treatment', value: String(data?.withoutTreatment.totals.count ?? 0) },
          { label: 'Typed rate', value: String(data?.typedRate.totals.count ?? 0), tone: (data?.typedRate.totals.count ?? 0) > 0 ? 'warn' : 'good' },
        ]}
      />
      <UnmappedBucketTable
        title="No tax treatment at all"
        why="A return cannot report these as anything. Fix first."
        bucket={data?.withoutTreatment}
      />
      <UnmappedBucketTable
        title="No HSN or SAC code"
        why="Rule 46 requires the code on the invoice, and Table 12 keys on it."
        bucket={data?.withoutCode}
      />
      <UnmappedBucketTable
        title="A rate somebody typed"
        why="Taxable, on an item nobody approved, with no code behind it — a counter decided the tax."
        bucket={data?.typedRate}
      />
      {(data?.typedRate.lines.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Where the typed rates were used</h3>
          <ReportTable
            columns={[
              { key: 'd', label: 'Date', cell: (r: { billDate: string }) => formatDate(r.billDate) },
              { key: 'b', label: 'Document', cell: (r: { invoiceNumber: string | null; billNumber: string }) => r.invoiceNumber ?? r.billNumber },
              { key: 'i', label: 'Item', cell: (r: { description: string }) => r.description },
              { key: 'r', label: 'Rate', align: 'right', cell: (r: { ratePercent: number }) => `${r.ratePercent}%` },
              { key: 't', label: 'Tax charged', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount) },
            ]}
            rows={data?.typedRate.lines ?? []}
          />
        </section>
      ) : null}
    </div>
  );
}

// ── C-4 ────────────────────────────────────────────────────────────────────

export function SeriesContinuityView({ q }: { q: Q }) {
  const { data, isLoading } = R.useSeriesContinuity(q);
  if (isLoading) return <Loading />;
  const rows = data?.series ?? [];
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Series', value: String(data?.totals.series ?? 0) },
          { label: 'With gaps', value: String(data?.totals.withGaps ?? 0), tone: (data?.totals.withGaps ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'With duplicates', value: String(data?.totals.withDuplicates ?? 0), tone: (data?.totals.withDuplicates ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Numbers burned', value: String(data?.totals.burned ?? 0), tone: (data?.totals.burned ?? 0) > 0 ? 'warn' : 'good' },
        ]}
      />
      <ReportNotes
        notes={[
          'A burned number was allotted inside a transaction that then rolled back. Explainable — but an auditor will ask, so the hospital should hold the answer.',
          'A cancelled invoice KEEPS its number and is reversed by a credit note. That is what keeps the series continuous, so it is listed rather than counted as a gap.',
        ]}
      />
      <ReportTable
        columns={[
          { key: 'd', label: 'Series', cell: (r: (typeof rows)[number]) => titleCase(r.documentType) },
          { key: 'fy', label: 'Year', cell: (r) => r.financialYear },
          { key: 'p', label: 'Prefix', cell: (r) => r.prefix },
          { key: 'range', label: 'First → last', cell: (r) => (r.firstIssued == null ? '—' : `${r.firstIssued} → ${r.lastIssued}`) },
          { key: 'c', label: 'Issued', align: 'right', cell: (r) => r.issuedCount },
          { key: 'counter', label: 'Counter', align: 'right', cell: (r) => r.counter },
          {
            key: 'm',
            label: 'Missing',
            cell: (r) => (r.missing.length ? <span className="text-red-600">{r.missing.join(', ')}</span> : '—'),
          },
          {
            key: 'dup',
            label: 'Duplicated',
            cell: (r) => (r.duplicated.length ? <span className="text-red-600">{r.duplicated.join(', ')}</span> : '—'),
          },
          { key: 'b', label: 'Burned', align: 'right', cell: (r) => (r.burned > 0 ? <span className="text-amber-600">{r.burned}</span> : 0) },
          { key: 'x', label: 'Cancelled', align: 'right', cell: (r) => r.cancelled.length },
          {
            key: 'ok',
            label: 'Continuous',
            cell: (r) => (r.continuous ? <Badge variant="outline">Yes</Badge> : <Badge variant="destructive">No</Badge>),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

// ── C-7 ────────────────────────────────────────────────────────────────────

export function DepartmentGstView({ q }: { q: Q }) {
  const { data, isLoading } = R.useDepartmentGst(q);
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Departments', value: String(data?.departments.length ?? 0) },
          { label: 'Taxable value', value: money(data?.totals.taxableValue) },
          { label: 'Tax', value: money(data?.totals.taxAmount) },
          { label: 'Revenue', value: money(data?.totals.totalAmount) },
        ]}
      />
      <ReportTable
        columns={[
          { key: 'd', label: 'Department', cell: (r: { department: string }) => titleCase(r.department) },
          { key: 'l', label: 'Lines', align: 'right', cell: (r: { count: number }) => r.count },
          { key: 't', label: 'Taxable turnover', align: 'right', cell: (r: { taxableTurnover: number }) => plain(r.taxableTurnover) },
          { key: 'e', label: 'Exempt turnover', align: 'right', cell: (r: { exemptTurnover: number }) => plain(r.exemptTurnover) },
          { key: 'x', label: 'Tax', align: 'right', cell: (r: { taxAmount: number }) => plain(r.taxAmount) },
          { key: 'v', label: 'Revenue', align: 'right', cell: (r: { totalAmount: number }) => plain(r.totalAmount) },
        ]}
        rows={data?.departments ?? []}
      />
    </div>
  );
}

// ── C-9 ────────────────────────────────────────────────────────────────────

export function CancelledInvoicesView({ q }: { q: Q }) {
  const { data, isLoading } = R.useCancelledInvoices(q);
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Cancelled', value: String(data?.totals.count ?? 0) },
          { label: 'Value', value: money(data?.totals.totalAmount) },
          { label: 'Tax on them', value: money(data?.totals.taxAmount) },
          {
            label: 'Never reversed',
            value: String(data?.totals.unreversed ?? 0),
            tone: (data?.totals.unreversed ?? 0) > 0 ? 'bad' : 'good',
            hint: 'issued, cancelled, no credit note',
          },
        ]}
      />
      <ReportTable
        columns={[
          { key: 'd', label: 'Bill date', cell: (r: (typeof rows)[number]) => formatDate(r.billDate) },
          { key: 'i', label: 'Document', cell: (r) => r.invoiceNumber ?? r.billNumber },
          { key: 'p', label: 'Patient', cell: (r) => r.patientName ?? '—' },
          { key: 'v', label: 'Value', align: 'right', cell: (r) => plain(r.totalAmount) },
          { key: 'x', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount) },
          { key: 'w', label: 'Cancelled by', cell: (r) => r.cancelledBy ?? '—' },
          { key: 'r', label: 'Reason', cell: (r) => r.reason ?? '—' },
          {
            key: 'cn',
            label: 'Reversed by',
            cell: (r) =>
              r.creditNotes.length ? (
                r.creditNotes.map((c) => c.creditNoteNumber).join(', ')
              ) : r.unreversed ? (
                <Badge variant="destructive">No credit note</Badge>
              ) : (
                '—'
              ),
          },
        ]}
        rows={rows}
        empty="No invoice was cancelled in this period."
      />
      {(data?.totals.unreversed ?? 0) > 0 ? (
        <ReportNotes
          notes={[
            'An issued invoice that was cancelled with no credit note behind it is still declared in the return: the money came off the bill, the tax did not. Raise a credit note against it.',
          ]}
        />
      ) : null}
    </div>
  );
}

// ── C-5 ────────────────────────────────────────────────────────────────────

export function RateOverridesView({ q }: { q: Q }) {
  const { data, isLoading } = R.useRateOverrides(q);
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'd', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
    { key: 'doc', label: 'Document', cell: (r) => r.document, csv: (r) => r.document },
    { key: 'p', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
    { key: 'dept', label: 'Department', cell: (r) => titleCase(r.department), csv: (r) => r.department },
    { key: 'i', label: 'Item', cell: (r) => r.description, csv: (r) => r.description },
    { key: 'rate', label: 'Rate typed', align: 'right', cell: (r) => `${r.ratePercent}%`, csv: (r) => r.ratePercent },
    { key: 't', label: 'Tax charged', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'v', label: 'Line value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
    { key: 'w', label: 'Raised by', cell: (r) => r.raisedBy ?? <span className="text-muted-foreground">unattributed</span>, csv: (r) => r.raisedBy ?? '' },
  ];
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Lines checked', value: String(data?.totals.linesChecked ?? 0) },
          {
            label: 'Rates typed',
            value: String(data?.totals.overrides ?? 0),
            tone: (data?.totals.overrides ?? 0) > 0 ? 'bad' : 'good',
          },
          { label: 'Tax charged on them', value: money(data?.totals.taxCharged), tone: 'warn' },
          { label: 'Line value', value: money(data?.totals.value) },
        ]}
      />
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-rate-overrides', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable
        columns={cols}
        rows={rows}
        empty="Every rate in this period came from a master. Nothing was typed."
      />
      {(data?.byPerson.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">By who raised the document</h3>
          <ReportTable
            columns={[
              { key: 'p', label: 'Raised by', cell: (r: { person: string }) => titleCase(r.person) },
              { key: 'l', label: 'Lines', align: 'right', cell: (r: { lines: number }) => r.lines },
              { key: 't', label: 'Tax charged', align: 'right', cell: (r: { taxCharged: number }) => plain(r.taxCharged) },
              { key: 'v', label: 'Value', align: 'right', cell: (r: { value: number }) => plain(r.value) },
            ]}
            rows={data?.byPerson ?? []}
          />
        </section>
      ) : null}
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

// ── C-8 ────────────────────────────────────────────────────────────────────

export function RateChangeImpactView({ q }: { q: Q }) {
  const { data, isLoading } = R.useRateChangeImpact(q);
  if (isLoading) return <Loading />;
  const rows = data?.changes ?? [];
  return (
    <div className="space-y-6">
      <StatStrip
        stats={[
          { label: 'Changes', value: String(data?.totals.changes ?? 0) },
          { label: 'Lines touching those codes', value: String(data?.totals.linesAffected ?? 0) },
          {
            label: 'Billed at the old rate after',
            value: String(data?.totals.outOfStep ?? 0),
            tone: (data?.totals.outOfStep ?? 0) > 0 ? 'bad' : 'good',
          },
          { label: 'Scope', value: 'Platform masters' },
        ]}
      />
      <ReportTable
        columns={[
          { key: 'w', label: 'When', cell: (r: (typeof rows)[number]) => formatDate(r.changedAt) },
          { key: 'c', label: 'Code', cell: (r) => `${r.codeType.toUpperCase()} ${r.code}` },
          { key: 'd', label: 'Description', cell: (r) => r.description ?? '—' },
          { key: 'a', label: 'Action', cell: (r) => <Badge variant={r.action === 'deactivate' ? 'destructive' : 'secondary'}>{titleCase(r.action)}</Badge> },
          {
            key: 'r',
            label: 'Rate',
            align: 'right',
            cell: (r) =>
              `${r.previousRate == null ? '—' : `${r.previousRate}%`} → ${r.newRate == null ? '—' : `${r.newRate}%`}`,
          },
          { key: 'by', label: 'Changed by', cell: (r) => r.changedBy ?? '—' },
          { key: 'b', label: 'Lines before', align: 'right', cell: (r) => r.linesBefore.count },
          { key: 'af', label: 'Lines after', align: 'right', cell: (r) => r.linesAfter.count },
          {
            key: 'o',
            label: 'Out of step',
            align: 'right',
            cell: (r) => (r.outOfStep.length ? <span className="text-red-600">{r.outOfStep.length}</span> : 0),
          },
        ]}
        rows={rows}
        empty="Nothing on a tax master changed in this period."
      />
      {rows.some((r) => r.outOfStep.length > 0) ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Billed after a change, still at the old rate
          </h3>
          <ReportTable
            columns={[
              { key: 'b', label: 'Document', cell: (l: { billNumber: string | null }) => l.billNumber ?? '—' },
              { key: 'd', label: 'Billed', cell: (l: { billDate: string | null }) => formatDate(l.billDate) },
              { key: 'i', label: 'Item', cell: (l: { description: string }) => l.description },
              { key: 'r', label: 'Rate used', align: 'right', cell: (l: { ratePercent: number }) => `${l.ratePercent}%` },
              { key: 't', label: 'Tax', align: 'right', cell: (l: { taxAmount: number }) => plain(l.taxAmount) },
            ]}
            rows={rows.flatMap((r) => r.outOfStep)}
          />
        </section>
      ) : null}
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

