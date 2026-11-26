'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date-utils';
import {
  Column, DrillThrough, ExportButton, ExportableTable, Loading, ReportNotes, ReportTable, StatStrip,
  exportCsv, exportXlsx, money, pct, plain, titleCase, exportPdf, exportAll, type Stat,
} from './gst-report-shell';
import type { GstReportQuery } from '@/hooks/use-gst-reports';
import * as R from '@/hooks/use-gst-reports';
import { useStatDrill } from './gst-report-views';

// ============================================================
// Group B — what the hospital can claim back — and group C, the controls that
// are meant to catch a problem during the month rather than on filing day.
// ============================================================

type Q = GstReportQuery;

type PurchaseRow = NonNullable<ReturnType<typeof R.usePurchaseRegister>['data']>['rows'][number];
/** A purchase, as the B-2 / B-3 / B-4 drill-downs show it (gap 282). */
const purchaseLineCols: Column<PurchaseRow>[] = [
  { key: 'd', label: 'Invoice date', cell: (r) => formatDate(r.invoiceDate), csv: (r) => formatDate(r.invoiceDate) },
  { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
  { key: 'g', label: 'GSTIN', cell: (r) => r.supplierGstin ?? '—', csv: (r) => r.supplierGstin ?? '' },
  { key: 'i', label: 'Supplier invoice', cell: (r) => r.invoiceNumber ?? '—', csv: (r) => r.invoiceNumber ?? '' },
  { key: 'n', label: 'Item', cell: (r) => r.drugName, csv: (r) => r.drugName },
  { key: 'b', label: 'Batch', cell: (r) => r.batchNumber, csv: (r) => r.batchNumber },
  { key: 'tv', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
  { key: 'rate', label: 'GST %', align: 'right', cell: (r) => r.gstRatePercent ?? '—', csv: (r) => r.gstRatePercent ?? '' },
  { key: 'c', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount ?? 0 },
  { key: 'sg', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount ?? 0 },
  { key: 'ig', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount ?? 0 },
  { key: 'x', label: 'Input tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  { key: 'e', label: 'ITC', cell: (r) => titleCase(r.itcEligibility ?? 'eligible'), csv: (r) => r.itcEligibility ?? 'eligible' },
];

// ── B-1 ────────────────────────────────────────────────────────────────────

export function PurchaseRegisterView({ q }: { q: Q }) {
  const { data, isLoading } = R.usePurchaseRegister(q);
  const d = useStatDrill();
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
    // Gap 271: the split the stock-in stored — CGST + SGST same-state, IGST
    // inter-state — not just one combined figure.
    { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount ?? 0 },
    { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount ?? 0 },
    { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount ?? 0 },
    { key: 'tax', label: 'Input tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    {
      // Gap item 272: no valid supplier GSTIN means no credit. The totals row
      // an export appends carries no eligibility of its own.
      key: 'itc', label: 'ITC',
      cell: (r) => (r.itcEligibility && r.itcEligibility !== 'eligible' ? (
        <span title={r.itcBlockedReason ?? undefined}><Badge variant="destructive">{titleCase(r.itcEligibility)}</Badge></span>
      ) : <Badge variant="outline">Eligible</Badge>),
      csv: (r) => (r.batchId === TOTAL_ROW_ID ? '' : `${r.itcEligibility ?? 'eligible'}${r.itcBlockedReason ? ` - ${r.itcBlockedReason}` : ''}`),
    },
    { key: 'total', label: 'Invoice value', align: 'right', cell: (r) => plain(r.landingTotal), csv: (r) => r.landingTotal },
  ];
  const sum = (k: 'taxableValue' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'taxAmount' | 'landingTotal') =>
    Math.round(rows.reduce((t, r) => t + Number(r[k] ?? 0), 0) * 100) / 100;
  const tax = sum('taxAmount');
  const blocked = rows.filter((r) => r.itcEligibility && r.itcEligibility !== 'eligible');
  const stats = [
    { label: 'Purchases', value: String(rows.length) },
    { label: 'Taxable value', value: money(sum('taxableValue')) },
    { label: 'CGST', value: money(sum('cgstAmount')) },
    { label: 'SGST', value: money(sum('sgstAmount')) },
    { label: 'IGST', value: money(sum('igstAmount')) },
    { label: 'Input tax', value: money(tax), hint: 'CGST + SGST + IGST' },
    {
      label: 'Not eligible as credit',
      value: money(blocked.reduce((t, r) => t + r.taxAmount, 0)),
      hint: `${blocked.length} purchase(s) — blocked, or supplier without a valid GSTIN`,
      tone: (blocked.length ? 'warn' : 'good') as 'warn' | 'good',
    },
  ];
  // The header's per-head totals, as the last row of every export.
  const totalRow = {
    batchId: TOTAL_ROW_ID, supplierName: 'TOTAL', supplierGstin: '', invoiceNumber: '', invoiceDate: null,
    drugName: '', hsnCode: '', batchNumber: '', quantity: rows.reduce((t, r) => t + r.quantity, 0),
    freeQuantity: rows.reduce((t, r) => t + r.freeQuantity, 0), gstRatePercent: null,
    taxableValue: sum('taxableValue'), cgstAmount: sum('cgstAmount'), sgstAmount: sum('sgstAmount'),
    igstAmount: sum('igstAmount'), taxAmount: tax, landingTotal: sum('landingTotal'),
  } as (typeof rows)[number];
  // Gap 282: every B-1 headline opens the purchases it adds up.
  const b1Drills: Record<string, ReactNode> = {
    Purchases: d.lines('Purchases', cols, rows, { sum: (r) => r.landingTotal }),
    'Taxable value': d.lines('Taxable value', cols, rows, { sum: (r) => r.taxableValue }),
    CGST: d.lines('CGST', cols, rows.filter((r) => Number(r.cgstAmount) !== 0), { sum: (r) => r.cgstAmount }),
    SGST: d.lines('SGST', cols, rows.filter((r) => Number(r.sgstAmount) !== 0), { sum: (r) => r.sgstAmount }),
    IGST: d.lines('IGST', cols, rows.filter((r) => Number(r.igstAmount) !== 0), { sum: (r) => r.igstAmount }),
    'Input tax': d.lines('Input tax', cols, rows.filter((r) => Number(r.taxAmount) !== 0), { sum: (r) => r.taxAmount }),
    'Not eligible as credit': d.lines('Not eligible as credit', cols, blocked, { sum: (r) => r.taxAmount }),
  };
  return (
    <div className="space-y-4">
      <StatStrip stats={d.wire(stats, b1Drills)} />
      {d.panel(b1Drills)}
      <div className="flex justify-end">
        <ExportButton
          {...exportAll('gst-purchase-register', cols, rows, q, { totalRow, stats })}
          disabled={!rows.length}
        />
      </div>
      <ReportTable columns={cols} rows={rows} />
    </div>
  );
}

// ── B-2 ────────────────────────────────────────────────────────────────────

type PersonRow = { person: string; lines: number; taxCharged: number; value: number };
type OutOfStepRow = { billNumber: string | null; billDate: string | null; description: string; ratePercent: number; taxAmount: number };

/** Marks the synthetic totals row an export appends. */
const TOTAL_ROW_ID = '__total__';

// Gap 271: B-2 shows the credit head by head, as the ledgers keep it.
type Heads = { cgstAmount?: number; sgstAmount?: number; igstAmount?: number };
function headCols<T extends Heads>(): Column<T>[] {
  return [
    { key: 'cgst', label: 'CGST', align: 'right', cell: (r) => plain(r.cgstAmount), csv: (r) => r.cgstAmount ?? 0 },
    { key: 'sgst', label: 'SGST', align: 'right', cell: (r) => plain(r.sgstAmount), csv: (r) => r.sgstAmount ?? 0 },
    { key: 'igst', label: 'IGST', align: 'right', cell: (r) => plain(r.igstAmount), csv: (r) => r.igstAmount ?? 0 },
  ];
}

type ItcRateRow = { ratePercent: number | null; count: number; taxableValue: number; taxAmount: number; total?: boolean } & Heads;
const rateLabel = (r: ItcRateRow) => (r.total ? 'TOTAL' : r.ratePercent == null ? 'Not recorded' : `${r.ratePercent}%`);
const itcRateCols: Column<ItcRateRow>[] = [
  { key: 'r', label: 'Rate', cell: rateLabel, csv: rateLabel },
  { key: 'c', label: 'Purchases', align: 'right', cell: (r) => r.count, csv: (r) => r.count },
  { key: 'v', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
  ...headCols<ItcRateRow>(),
  { key: 't', label: 'Input tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
];
type ItcSupplierRow = { supplierName: string | null; supplierGstin: string | null; count: number; taxableValue: number; taxAmount: number; total?: boolean } & Heads;
const itcSupplierCols: Column<ItcSupplierRow>[] = [
  { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
  { key: 'g', label: 'GSTIN', cell: (r) => r.supplierGstin ?? <span className="text-red-600">missing — no credit</span>, csv: (r) => (r.total ? '' : r.supplierGstin ?? 'missing') },
  { key: 'c', label: 'Purchases', align: 'right', cell: (r) => r.count, csv: (r) => r.count },
  { key: 'v', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
  ...headCols<ItcSupplierRow>(),
  { key: 't', label: 'Input tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
];

export function ItcSummaryView({ q }: { q: Q }) {
  const { data, isLoading } = R.useItcSummary(q);
  // Gap 282: B-2 folds B-1, so its headlines open the B-1 purchases — read
  // once a figure is opened.
  const d = useStatDrill();
  const purchases = R.usePurchaseRegister(q, d.focus != null);
  if (isLoading) return <Loading />;
  const t = data?.totals;
  const stats = [
    { label: 'Credit available', value: money(t?.taxAmount), hint: 'BEFORE the Rule 42 reversal' },
    { label: 'CGST', value: money(t?.cgstAmount) },
    { label: 'SGST', value: money(t?.sgstAmount) },
    { label: 'IGST', value: money(t?.igstAmount) },
    { label: 'Purchase value', value: money(t?.taxableValue) },
    { label: 'Purchases', value: String(t?.count ?? 0) },
    {
      label: 'With no rate',
      value: String(data?.withoutRate ?? 0),
      tone: ((data?.withoutRate ?? 0) > 0 ? 'warn' : 'good') as 'warn' | 'good',
      hint: 'credit cannot be claimed',
    },
  ];
  // The header's per-head totals, as the last row of each export.
  const totalHeads = {
    count: t?.count ?? 0, taxableValue: t?.taxableValue ?? 0, taxAmount: t?.taxAmount ?? 0,
    cgstAmount: t?.cgstAmount ?? 0, sgstAmount: t?.sgstAmount ?? 0, igstAmount: t?.igstAmount ?? 0,
    total: true,
  };
  const rateTotal: ItcRateRow = { ratePercent: null, ...totalHeads };
  const supplierTotal: ItcSupplierRow = { supplierName: 'TOTAL', supplierGstin: null, ...totalHeads };
  const pr = purchases.data?.rows ?? [];
  const po = (sum: (r: PurchaseRow) => number) => ({ sum, loading: purchases.isLoading });
  const itcDrills: Record<string, ReactNode> = {
    'Credit available': d.lines('Credit available', purchaseLineCols, pr, po((r) => r.taxAmount)),
    CGST: d.lines('CGST', purchaseLineCols, pr.filter((r) => Number(r.cgstAmount) !== 0), po((r) => r.cgstAmount)),
    SGST: d.lines('SGST', purchaseLineCols, pr.filter((r) => Number(r.sgstAmount) !== 0), po((r) => r.sgstAmount)),
    IGST: d.lines('IGST', purchaseLineCols, pr.filter((r) => Number(r.igstAmount) !== 0), po((r) => r.igstAmount)),
    'Purchase value': d.lines('Purchase value', purchaseLineCols, pr, po((r) => r.taxableValue)),
    Purchases: d.lines('Purchases', purchaseLineCols, pr, po((r) => r.taxableValue)),
    'With no rate': d.lines('With no rate', purchaseLineCols, pr.filter((r) => r.gstRatePercent == null), po((r) => r.taxableValue)),
  };
  return (
    <div className="space-y-6">
      <StatStrip stats={d.wire(stats, itcDrills)} />
      {d.panel(itcDrills)}
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">By rate</h3>
          <ExportButton {...exportAll('gst-itc-by-rate', itcRateCols, data?.byRate ?? [], q, { totalRow: rateTotal, stats })} disabled={!(data?.byRate ?? []).length} />
        </div>
        <ReportTable columns={itcRateCols} rows={data?.byRate ?? []} />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">By supplier</h3>
          <ExportButton {...exportAll('gst-itc-by-supplier', itcSupplierCols, data?.bySupplier ?? [], q, { totalRow: supplierTotal, stats })} disabled={!(data?.bySupplier ?? []).length} />
        </div>
        <ReportTable columns={itcSupplierCols} rows={data?.bySupplier ?? []} />
      </section>
    </div>
  );
}

// ── B-3 ────────────────────────────────────────────────────────────────────

export function ItcReversalView({ q }: { q: Q }) {
  const { data, isLoading } = R.useItcReversal(q);
  // Gap 282: 'Credit available' opens the eligible purchases; the reversal and
  // the credit kept open the working steps that reach them.
  const d = useStatDrill();
  const purchases = R.usePurchaseRegister(q, d.focus === 'Credit available');
  if (isLoading) return <Loading />;
  const working = data?.working ?? [];
  const workCols: Column<(typeof working)[number]>[] = [
    { key: 'step', label: 'Step', cell: (r) => <span className="font-mono font-semibold">{r.step}</span>, csv: (r) => r.step },
    { key: 'label', label: 'What it is', cell: (r) => r.label, csv: (r) => r.label },
    { key: 'amount', label: 'Amount', align: 'right', cell: (r) => plain(r.amount), csv: (r) => r.amount },
    { key: 'source', label: 'Where it comes from', cell: (r) => <span className="text-xs text-muted-foreground">{r.source}</span>, csv: (r) => r.source },
  ];
  const reversalDrills: Record<string, ReactNode> = {
    'Credit available': d.lines(
      'Credit available', purchaseLineCols,
      (purchases.data?.rows ?? []).filter((r) => (r.itcEligibility ?? 'eligible') === 'eligible'),
      { sum: (r) => r.taxAmount, loading: purchases.isLoading, note: 'eligible purchases only' },
    ),
    'Credit REVERSED': d.lines('Credit REVERSED', workCols, working),
    'Credit kept': d.lines('Credit kept', workCols, working),
  };
  return (
    <div className="space-y-4">
      {/* Gap 282: 'Exempt ratio' is a ratio, read from the A-7 turnover — no drill. */}
      <StatStrip
        stats={d.wire([
          { label: 'Credit available', value: money(data?.creditAvailable), hint: data?.blockedCredit?.total ? `after ${money(data.blockedCredit.total)} blocked` : undefined },
          { label: 'Exempt ratio', value: pct(data?.exemptRatioPercent), hint: 'E ÷ F' },
          { label: 'Credit REVERSED', value: money(data?.reversal.total), tone: 'bad' },
          { label: 'Credit kept', value: money(data?.netCreditAvailable), tone: 'good' },
        ], reversalDrills)}
      />
      {d.panel(reversalDrills)}
      <div className="flex justify-end">
        <ExportButton {...exportAll('gst-itc-reversal', workCols, working, q)} disabled={!working.length} />
      </div>
      <ReportTable columns={workCols} rows={working} />
      {(data?.blockedCredit?.fromSuppliersWithoutGstin ?? 0) > 0 ? (
        <ReportNotes
          notes={[
            `${data?.blockedCredit?.fromSuppliersWithoutGstin} purchase(s) are from a supplier with no valid GSTIN. Their tax is in T3 and is not credit: section 16(2) allows credit only on a registered supplier's tax invoice. The Supplier GSTIN Exceptions report (B-4) lists them.`,
          ]}
        />
      ) : null}
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

// ── B-4 ────────────────────────────────────────────────────────────────────

export function SupplierGstinView({ q }: { q: Q }) {
  const { data, isLoading } = R.useSupplierGstinExceptions(q);
  // Gap 282: the affected purchases come from B-1, read once a figure is opened.
  const d = useStatDrill();
  const purchases = R.usePurchaseRegister(q, d.focus != null);
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
  // The same supplier key the server groups on: name plus the GSTIN on file.
  const supKey = (name: string | null, gstin: string | null) => `${name ?? ''}|${(gstin ?? '').trim()}`;
  const flagged = new Set(rows.map((r) => supKey(r.supplierName, r.supplierGstin)));
  const affected = (purchases.data?.rows ?? []).filter((p) => flagged.has(supKey(p.supplierName, p.supplierGstin)));
  const supplierDrills: Record<string, ReactNode> = {
    Suppliers: d.lines('Suppliers', cols, rows, { sum: (r) => r.taxAtRisk }),
    'Purchases affected': d.lines('Purchases affected', purchaseLineCols, affected, { sum: (r) => r.taxAmount, loading: purchases.isLoading }),
    'Credit at risk': d.lines('Credit at risk', purchaseLineCols, affected, { sum: (r) => r.taxAmount, loading: purchases.isLoading }),
  };
  return (
    <div className="space-y-4">
      {/* Gap 282: 'Fix' is a pointer, not a figure — no drill. */}
      <StatStrip
        stats={d.wire([
          { label: 'Suppliers', value: String(data?.totals.suppliers ?? 0), tone: (data?.totals.suppliers ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Purchases affected', value: String(data?.totals.batches ?? 0) },
          { label: 'Credit at risk', value: money(data?.totals.taxAtRisk), tone: 'bad' },
          { label: 'Fix', value: 'Suppliers screen' },
        ], supplierDrills)}
      />
      {d.panel(supplierDrills)}
      <div className="flex justify-end">
        <ExportButton onClick={() => exportCsv('gst-supplier-gstin-exceptions', cols, rows, q)}
          onExcel={() => exportXlsx('gst-supplier-gstin-exceptions', cols, rows, q)} onPdf={() => exportPdf('gst-supplier-gstin-exceptions', cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} empty="Every supplier in this period has a valid GSTIN." />
    </div>
  );
}

// ── B-6 ────────────────────────────────────────────────────────────────────

type ReturnsData = NonNullable<ReturnType<typeof R.usePurchaseReturns>['data']>;
type ReturnRow = ReturnsData['returns'][number];
type WriteOffRow = NonNullable<ReturnsData['pharmacyWriteOffs']>[number];
type ExpiredBatchRow = NonNullable<ReturnsData['expiredPharmacyBatches']>[number];

/**
 * One line behind a B-6 total, whichever table it came from (gap 282), so a
 * headline that adds two sources still opens as one list that sums to it.
 */
type ReversalLine = {
  source: string; date: string | null; item: string; batchNumber: string | null; quantity: number;
  reference: string | null; value: number; cgstAmount: number; sgstAmount: number; igstAmount: number;
  taxToReverse: number;
};
const reversalCols: Column<ReversalLine>[] = [
  { key: 'src', label: 'Source', cell: (r) => r.source, csv: (r) => r.source },
  { key: 'd', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => (r.date ? formatDate(r.date) : '') },
  { key: 'i', label: 'Item', cell: (r) => r.item, csv: (r) => r.item },
  { key: 'b', label: 'Batch', cell: (r) => r.batchNumber ?? '—', csv: (r) => r.batchNumber ?? '' },
  { key: 'q', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
  { key: 'ref', label: 'Purchase invoice', cell: (r) => r.reference ?? '—', csv: (r) => r.reference ?? '' },
  { key: 'v', label: 'Value', align: 'right', cell: (r) => plain(r.value), csv: (r) => r.value },
  ...headCols<ReversalLine>(),
  { key: 't', label: 'Tax to reverse', align: 'right', cell: (r) => plain(r.taxToReverse), csv: (r) => r.taxToReverse },
];
const fromReturn = (r: ReturnRow): ReversalLine => ({
  source: 'Vendor return', date: r.date, item: r.drugName, batchNumber: r.batchNumber, quantity: r.quantity,
  reference: r.purchaseInvoiceNumber, value: r.taxableValue, cgstAmount: r.cgstAmount ?? 0,
  sgstAmount: r.sgstAmount ?? 0, igstAmount: r.igstAmount ?? 0, taxToReverse: r.taxToReverse,
});
const fromWriteOff = (w: WriteOffRow): ReversalLine => ({
  source: `Write-off (${titleCase(w.writeOffType)})`, date: w.date, item: w.drugName, batchNumber: w.batchNumber,
  quantity: w.quantity, reference: w.purchaseInvoiceNumber, value: w.taxableValue, cgstAmount: w.cgstAmount ?? 0,
  sgstAmount: w.sgstAmount ?? 0, igstAmount: w.igstAmount ?? 0, taxToReverse: w.taxToReverse,
});
const fromExpired = (b: ExpiredBatchRow): ReversalLine => ({
  source: 'Expired on shelf', date: b.expiryDate, item: b.drugName, batchNumber: b.batchNumber, quantity: b.quantity,
  reference: b.purchaseInvoiceNumber, value: b.taxableValue, cgstAmount: b.cgstAmount ?? 0,
  sgstAmount: b.sgstAmount ?? 0, igstAmount: b.igstAmount ?? 0, taxToReverse: b.taxToReverse,
});
const round2 = (n: number) => Math.round(n * 100) / 100;
type HeadRow = { taxableValue?: number; value?: number; cgstAmount?: number; sgstAmount?: number; igstAmount?: number; taxToReverse: number };
function sumHeads(rows: HeadRow[]) {
  const s = (f: (r: HeadRow) => number | undefined) => round2(rows.reduce((t, r) => t + Number(f(r) ?? 0), 0));
  return {
    value: s((r) => r.taxableValue ?? r.value), cgstAmount: s((r) => r.cgstAmount), sgstAmount: s((r) => r.sgstAmount),
    igstAmount: s((r) => r.igstAmount), taxToReverse: s((r) => r.taxToReverse),
  };
}

export function PurchaseReturnsView({ q }: { q: Q }) {
  const { data, isLoading } = R.usePurchaseReturns(q);
  // Gap 282: every B-6 headline opens the lines behind it.
  const [focus, setFocus] = useState<string | null>(null);
  if (isLoading) return <Loading />;
  const rows = data?.returns ?? [];
  // Gap 273: damaged / expired pharmacy write-offs were returned by the API and
  // never drawn, so the screen said nothing had been written off.
  const writeOffs = data?.pharmacyWriteOffs ?? [];
  const expiredBatches = data?.expiredPharmacyBatches ?? [];
  const expiry = (data?.expiryWriteOffs ?? []) as ExpiryRow[];

  const cols: Column<ReturnRow>[] = [
    { key: 'd', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => (r.returnId === TOTAL_ROW_ID ? '' : formatDate(r.date)) },
    { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
    { key: 'i', label: 'Item', cell: (r) => r.drugName, csv: (r) => r.drugName },
    { key: 'b', label: 'Batch', cell: (r) => r.batchNumber ?? '—', csv: (r) => r.batchNumber ?? '' },
    { key: 'q', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
    { key: 'pi', label: 'Purchase invoice', cell: (r) => r.purchaseInvoiceNumber ?? '—', csv: (r) => r.purchaseInvoiceNumber ?? '' },
    {
      key: 'cn',
      label: 'Supplier credit note',
      cell: (r) => r.supplierCreditNoteNumber ?? <span className="text-amber-600">not received</span>,
      csv: (r) => (r.returnId === TOTAL_ROW_ID ? '' : r.supplierCreditNoteNumber ?? 'not received'),
    },
    { key: 'v', label: 'Value returned', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'rate', label: 'GST %', align: 'right', cell: (r) => r.gstRatePercent ?? '—', csv: (r) => r.gstRatePercent ?? '' },
    // Gap 273: the CGST / SGST / IGST split taken from the purchase.
    ...headCols<ReturnRow>(),
    { key: 't', label: 'Tax to reverse', align: 'right', cell: (r) => plain(r.taxToReverse), csv: (r) => r.taxToReverse },
  ];
  const rt = sumHeads(rows);
  const returnTotal = {
    returnId: TOTAL_ROW_ID, date: '', supplierName: 'TOTAL', drugName: '', batchNumber: '',
    quantity: rows.reduce((t, r) => t + r.quantity, 0), reason: null, supplierCreditNoteNumber: '',
    supplierCreditAmount: null, purchaseInvoiceNumber: '', taxableValue: rt.value, gstRatePercent: null,
    cgstAmount: rt.cgstAmount, sgstAmount: rt.sgstAmount, igstAmount: rt.igstAmount, taxToReverse: rt.taxToReverse,
  } as ReturnRow;

  const woCols: Column<WriteOffRow>[] = [
    { key: 'd', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => (r.writeOffId === TOTAL_ROW_ID ? '' : formatDate(r.date)) },
    { key: 'ty', label: 'Type', cell: (r) => titleCase(r.writeOffType), csv: (r) => r.writeOffType },
    { key: 'i', label: 'Item', cell: (r) => r.drugName, csv: (r) => r.drugName },
    { key: 'b', label: 'Batch', cell: (r) => r.batchNumber ?? '—', csv: (r) => r.batchNumber ?? '' },
    { key: 'q', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
    { key: 'pi', label: 'Purchase invoice', cell: (r) => r.purchaseInvoiceNumber ?? '—', csv: (r) => r.purchaseInvoiceNumber ?? '' },
    { key: 'r', label: 'Reason', cell: (r) => r.reason ?? '—', csv: (r) => r.reason ?? '' },
    { key: 'v', label: 'Value written off', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'rate', label: 'GST %', align: 'right', cell: (r) => r.gstRatePercent ?? '—', csv: (r) => r.gstRatePercent ?? '' },
    ...headCols<WriteOffRow>(),
    { key: 't', label: 'Tax to reverse', align: 'right', cell: (r) => plain(r.taxToReverse), csv: (r) => r.taxToReverse },
  ];
  const wt = sumHeads(writeOffs);
  const woTotal = {
    writeOffId: TOTAL_ROW_ID, date: '', writeOffType: 'TOTAL', drugName: '', batchNumber: '',
    quantity: writeOffs.reduce((t, r) => t + r.quantity, 0), reason: '', purchaseInvoiceNumber: '',
    taxableValue: wt.value, gstRatePercent: null, cgstAmount: wt.cgstAmount, sgstAmount: wt.sgstAmount,
    igstAmount: wt.igstAmount, taxToReverse: wt.taxToReverse,
  } as WriteOffRow;

  const exCols: Column<ExpiredBatchRow>[] = [
    { key: 'e', label: 'Expired', cell: (r) => formatDate(r.expiryDate), csv: (r) => (r.batchId === TOTAL_ROW_ID ? 'TOTAL' : formatDate(r.expiryDate)) },
    { key: 'i', label: 'Item', cell: (r) => r.drugName, csv: (r) => r.drugName },
    { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
    { key: 'b', label: 'Batch', cell: (r) => r.batchNumber ?? '—', csv: (r) => r.batchNumber ?? '' },
    { key: 'q', label: 'Qty in stock', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
    { key: 'pi', label: 'Purchase invoice', cell: (r) => r.purchaseInvoiceNumber ?? '—', csv: (r) => r.purchaseInvoiceNumber ?? '' },
    { key: 'v', label: 'Value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue },
    { key: 'rate', label: 'GST %', align: 'right', cell: (r) => r.gstRatePercent ?? '—', csv: (r) => r.gstRatePercent ?? '' },
    ...headCols<ExpiredBatchRow>(),
    { key: 't', label: 'Tax to reverse', align: 'right', cell: (r) => plain(r.taxToReverse), csv: (r) => r.taxToReverse },
  ];
  const et = sumHeads(expiredBatches);
  const exTotal = {
    batchId: TOTAL_ROW_ID, date: null, drugName: '', supplierName: '', batchNumber: '', expiryDate: null,
    quantity: expiredBatches.reduce((t, r) => t + r.quantity, 0), purchaseInvoiceNumber: '', taxableValue: et.value,
    gstRatePercent: null, cgstAmount: et.cgstAmount, sgstAmount: et.sgstAmount, igstAmount: et.igstAmount,
    taxToReverse: et.taxToReverse,
  } as ExpiredBatchRow;

  // Every reversal in one list, for the combined headline (gap 273).
  const allLines = [...rows.map(fromReturn), ...writeOffs.map(fromWriteOff), ...expiredBatches.map(fromExpired)];
  const all = sumHeads(allLines);
  const totals = data?.totals;
  const totalTax = totals?.totalTaxToReverse ?? all.taxToReverse;

  // The lines behind each headline (gap 282). Each list sums to its figure.
  const drills: Record<string, { lines?: ReversalLine[]; expiry?: ExpiryRow[] }> = {
    Returns: { lines: rows.map(fromReturn) },
    'Value returned': { lines: rows.map(fromReturn) },
    'Returns — tax to reverse': { lines: rows.map(fromReturn) },
    'No credit note': { lines: rows.filter((r) => !r.supplierCreditNoteNumber).map(fromReturn) },
    'Pharmacy write-offs': { lines: writeOffs.map(fromWriteOff) },
    'Expired on shelf': { lines: expiredBatches.map(fromExpired) },
    'Total tax to reverse': { lines: allLines },
    CGST: { lines: allLines.filter((l) => l.cgstAmount !== 0) },
    SGST: { lines: allLines.filter((l) => l.sgstAmount !== 0) },
    IGST: { lines: allLines.filter((l) => l.igstAmount !== 0) },
    'Inventory expiry write-offs': { expiry },
  };
  const pick = (label: string) => setFocus(focus === label ? null : label);
  const base: Stat[] = [
    { label: 'Returns', value: String(totals?.returns ?? rows.length) },
    { label: 'Value returned', value: money(totals?.returnedValue ?? rt.value) },
    { label: 'Returns — tax to reverse', value: money(totals?.taxToReverse ?? rt.taxToReverse), tone: 'warn' },
    {
      label: 'No credit note',
      value: String(totals?.withoutSupplierCreditNote ?? 0),
      tone: (totals?.withoutSupplierCreditNote ?? 0) > 0 ? 'bad' : 'good',
      hint: 'chase the supplier',
    },
    {
      label: 'Pharmacy write-offs',
      value: money(totals?.pharmacyWriteOffTaxToReverse ?? wt.taxToReverse),
      hint: `tax to reverse on ${writeOffs.length} damaged / expired write-off(s), value ${money(totals?.pharmacyWriteOffValue ?? wt.value)}`,
      tone: writeOffs.length ? 'warn' : undefined,
    },
    {
      label: 'Expired on shelf',
      value: money(totals?.expiredPharmacyTaxToReverse ?? et.taxToReverse),
      hint: `tax to reverse on ${expiredBatches.length} expired pharmacy batch(es) still in stock`,
    },
    { label: 'Total tax to reverse', value: money(totalTax), tone: 'warn', hint: 'returns + write-offs + expired stock' },
    { label: 'CGST', value: money(all.cgstAmount) },
    { label: 'SGST', value: money(all.sgstAmount) },
    { label: 'IGST', value: money(all.igstAmount) },
    {
      label: 'Inventory expiry write-offs',
      value: money(totals?.expiredValue),
      hint: `${totals?.expiryWriteOffs ?? 0} item(s) — no tax rate on record`,
    },
  ];
  const stats = base.map((st) => ({ ...st, onClick: () => pick(st.label), active: focus === st.label }));
  const pdfStatsB6 = base.map(({ label, value }) => ({ label, value }));
  const drill = focus ? drills[focus] : undefined;
  const drillLines = drill?.lines ?? [];
  const drillSum = sumHeads(drillLines);
  const allTotal: ReversalLine = {
    source: 'TOTAL', date: null, item: '', batchNumber: '', quantity: allLines.reduce((t, l) => t + l.quantity, 0),
    reference: '', ...all,
  };

  return (
    <div className="space-y-6">
      <StatStrip stats={stats} />
      {drill?.lines ? (
        <DrillThrough
          open={!!focus}
          onClose={() => setFocus(null)}
          title={`${focus} — the lines behind it`}
          subtitle={`${drillLines.length} line(s) · value ${money(drillSum.value)} · tax to reverse ${money(drillSum.taxToReverse)}`}
          columns={reversalCols}
          rows={drillLines}
        />
      ) : drill?.expiry ? (
        <DrillThrough
          open={!!focus}
          onClose={() => setFocus(null)}
          title={`${focus} — the lines behind it`}
          subtitle={`${drill.expiry.length} line(s) adding up to ${money(drill.expiry.reduce((t, r) => t + r.value, 0))}`}
          columns={expiryCols}
          rows={drill.expiry}
        />
      ) : null}
      <ExportableTable
        title="Vendor returns — input tax to reverse"
        name="gst-purchase-returns"
        period={q}
        columns={cols}
        rows={rows}
        totalRow={rows.length ? returnTotal : undefined}
        empty="No stock went back to a supplier in this period."
      />
      <ExportableTable
        title="Damaged / expired pharmacy stock written off — section 17(5)(h) reversal"
        name="gst-pharmacy-write-offs"
        period={q}
        columns={woCols}
        rows={writeOffs}
        totalRow={writeOffs.length ? woTotal : undefined}
        empty="No pharmacy stock was written off in this period."
      />
      <ExportableTable
        title="Expired pharmacy batches still in stock — section 17(5)(h)"
        name="gst-expired-pharmacy-batches"
        period={q}
        columns={exCols}
        rows={expiredBatches}
        totalRow={expiredBatches.length ? exTotal : undefined}
        empty="No expired pharmacy batch is still in stock for this period."
      />
      <ExportableTable
        title="General inventory expiry write-offs — section 17(5)(h) blocks the credit"
        name="gst-expiry-write-offs"
        period={q}
        columns={expiryCols}
        rows={expiry}
        empty="No general inventory stock was written off for expiry in this period."
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Every reversal in one file, with the header totals:</span>
        <ExportButton
          {...exportAll('gst-returns-and-write-offs', reversalCols, allLines, q, {
            stats: pdfStatsB6,
            totalRow: allLines.length ? allTotal : undefined,
          })}
          disabled={!allLines.length}
        />
      </div>
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

type ExpiryRow = {
  date: string; itemName: string; supplierName: string | null; batchNumber: string | null;
  expiryDate: string | null; quantity: number; value: number;
};
const expiryCols: Column<ExpiryRow>[] = [
  { key: 'd', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => formatDate(r.date) },
  { key: 'i', label: 'Item', cell: (r) => r.itemName, csv: (r) => r.itemName },
  { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
  { key: 'b', label: 'Batch', cell: (r) => r.batchNumber ?? '—', csv: (r) => r.batchNumber ?? '' },
  { key: 'e', label: 'Expired', cell: (r) => formatDate(r.expiryDate), csv: (r) => formatDate(r.expiryDate) },
  { key: 'q', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
  { key: 'v', label: 'Value', align: 'right', cell: (r) => plain(r.value), csv: (r) => r.value },
];

// ── C-1 ────────────────────────────────────────────────────────────────────

export function DailyCollectionView({ q }: { q: Q }) {
  const { data, isLoading } = R.useDailyCollection(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const MODE_LABEL: Record<string, string> = {
    cash: 'Cash', card: 'Card (credit + debit)', upi: 'UPI', net_banking: 'Net banking',
    cheque: 'Cheque', insurance: 'Insurance', advance: 'Advance', other: 'Other',
  };
  const cut = (label: string, rows: Array<Record<string, unknown>>, key: string) => {
    const name = (r: Record<string, unknown>) =>
      key === 'mode' ? (MODE_LABEL[String(r[key])] ?? titleCase(String(r[key] ?? ''))) : titleCase(String(r[key] ?? ''));
    const cols: Column<Record<string, unknown>>[] = [
      { key: 'k', label: label, cell: name, csv: name },
      { key: 'c', label: 'Payments', align: 'right', cell: (r) => String(r.count), csv: (r) => Number(r.count) },
      { key: 'v', label: 'Collected', align: 'right', cell: (r) => plain(Number(r.collected)), csv: (r) => Number(r.collected) },
      { key: 't', label: 'Tax in it', align: 'right', cell: (r) => plain(Number(r.taxCollected)), csv: (r) => Number(r.taxCollected) },
    ];
    return (
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{label}</h3>
          <ExportButton {...exportAll(`gst-collected-${key}`, cols, rows, q)} disabled={!rows.length} />
        </div>
        <ReportTable columns={cols} rows={rows} />
      </section>
    );
  };
  // Gap 282: the report carries no payment-level rows, so each headline opens
  // the day-by-day rows that add up to it (the finest cut the API returns).
  const days = (data?.byDay ?? []) as Array<Record<string, unknown>>;
  const dayName = (r: Record<string, unknown>) => titleCase(String(r.day ?? ''));
  const dayCols: Column<Record<string, unknown>>[] = [
    { key: 'k', label: 'Day', cell: dayName, csv: dayName },
    { key: 'c', label: 'Payments', align: 'right', cell: (r) => String(r.count), csv: (r) => Number(r.count) },
    { key: 'v', label: 'Collected', align: 'right', cell: (r) => plain(Number(r.collected)), csv: (r) => Number(r.collected) },
    { key: 't', label: 'Tax in it', align: 'right', cell: (r) => plain(Number(r.taxCollected)), csv: (r) => Number(r.taxCollected) },
  ];
  const collectionDrills: Record<string, ReactNode> = {
    Collected: d.lines('Collected', dayCols, days, { sum: (r) => Number(r.collected) }),
    'Tax collected': d.lines('Tax collected', dayCols, days.filter((r) => Number(r.taxCollected) !== 0), { sum: (r) => Number(r.taxCollected) }),
    Payments: d.lines('Payments', dayCols, days, { note: `${days.reduce((t, r) => t + Number(r.count ?? 0), 0)} payment(s)` }),
    Days: d.lines('Days', dayCols, days, { sum: (r) => Number(r.collected) }),
  };
  return (
    <div className="space-y-6">
      <StatStrip
        stats={d.wire([
          { label: 'Collected', value: money(data?.totals.collected) },
          { label: 'Tax collected', value: money(data?.totals.taxCollected) },
          { label: 'Payments', value: String(data?.totals.count ?? 0) },
          { label: 'Days', value: String(data?.byDay.length ?? 0) },
        ], collectionDrills)}
      />
      {d.panel(collectionDrills)}
      <ReportNotes notes={[data?.note ?? '']} />
      {cut('By day', data?.byDay ?? [], 'day')}
      {/* Gap item 280: read from each saved payment row; card is its own mode,
          and a bill paid in two tenders splits its tax by amount. */}
      {data?.byMode ? cut('By mode', data.byMode, 'mode') : cut('By mode', data?.byMethod ?? [], 'method')}
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
  const mixCols: Column<(typeof rows)[number]>[] = [
    { key: 'm', label: 'Month', cell: (r) => r.month, csv: (r) => r.month },
    { key: 't', label: 'Taxable', align: 'right', cell: (r) => plain(r.taxable), csv: (r) => r.taxable },
    { key: 'e', label: 'Exempt', align: 'right', cell: (r) => plain(r.exempt), csv: (r) => r.exempt },
    { key: 'u', label: 'Unclassified', align: 'right', cell: (r) => plain(r.unclassified), csv: (r) => r.unclassified },
    { key: 'v', label: 'Total turnover', align: 'right', cell: (r) => plain(r.total), csv: (r) => r.total },
    { key: 's', label: 'Taxable share %', align: 'right', cell: (r) => pct(r.taxableSharePercent), csv: (r) => r.taxableSharePercent },
  ];
  return (
    <div className="space-y-4">
      <ReportNotes
        notes={[
          'A taxable share that drifts upward changes the hospital’s input credit position. Better seen as a trend here than as a surprise in the Rule 42 reversal.',
        ]}
      />
      <div className="flex justify-end">
        <ExportButton {...exportAll('gst-revenue-mix', mixCols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={mixCols} rows={rows} />
    </div>
  );
}

// ── C-3 ────────────────────────────────────────────────────────────────────

type UnmappedRow = R.UnmappedBucket['items'][number];
const unmappedCols: Column<UnmappedRow>[] = [
  { key: 'd', label: 'Item', cell: (r) => r.description, csv: (r) => r.description },
  { key: 'dept', label: 'Department', cell: (r) => titleCase(r.department), csv: (r) => r.department },
  { key: 'l', label: 'Lines', align: 'right', cell: (r) => r.lines, csv: (r) => r.lines },
  { key: 'r', label: 'Rated at', cell: (r) => r.rates.map((x) => `${x}%`).join(', '), csv: (r) => r.rates.map((x) => `${x}%`).join(', ') },
  { key: 'v', label: 'Value', align: 'right', cell: (r) => plain(r.value), csv: (r) => r.value },
];

function UnmappedBucketTable({ title, why, bucket, q }: { title: string; why: string; bucket?: R.UnmappedBucket; q: Q }) {
  const rows = bucket?.items ?? [];
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {title} <span className="font-normal text-muted-foreground">· {bucket?.totals.count ?? 0} line(s)</span>
          </h3>
          <p className="text-xs text-muted-foreground">{why}</p>
        </div>
        <ExportButton {...exportAll(`gst-unmapped-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`, unmappedCols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={unmappedCols} rows={rows} empty="Nothing here — good." />
    </section>
  );
}

export function UnmappedItemsView({ q }: { q: Q }) {
  const { data, isLoading } = R.useUnmappedItems(q);
  // Gap 282: 'Lines checked' opens the A-1 lines checked, read once opened.
  const d = useStatDrill();
  const register = R.useSalesRegister(q, d.focus === 'Lines checked');
  if (isLoading) return <Loading />;
  const typedLines = (data?.typedRate.lines ?? []) as TypedLine[];
  const exceptionItems = [
    ...(data?.withoutTreatment.items ?? []), ...(data?.withoutCode.items ?? []), ...(data?.typedRate.items ?? []),
  ];
  const unmappedDrills: Record<string, ReactNode> = {
    'Lines checked': d.lines('Lines checked', registerLineCols, register.data?.rows ?? [], {
      sum: (l) => l.taxableValue, loading: register.isLoading,
    }),
    Exceptions: d.lines('Exceptions', unmappedCols, exceptionItems, {
      sum: (r) => r.value, note: 'items from all three lists below, with their line counts',
    }),
    'No treatment': d.lines('No treatment', unmappedCols, data?.withoutTreatment.items ?? [], { sum: (r) => r.value }),
    'Typed rate': d.lines('Typed rate', typedLineCols, typedLines, { sum: (r) => r.taxAmount }),
  };
  return (
    <div className="space-y-6">
      <StatStrip
        stats={d.wire([
          { label: 'Lines checked', value: String(data?.totals.linesChecked ?? 0) },
          {
            label: 'Exceptions',
            value: String(data?.totals.exceptions ?? 0),
            tone: (data?.totals.exceptions ?? 0) > 0 ? 'bad' : 'good',
          },
          { label: 'No treatment', value: String(data?.withoutTreatment.totals.count ?? 0) },
          { label: 'Typed rate', value: String(data?.typedRate.totals.count ?? 0), tone: (data?.typedRate.totals.count ?? 0) > 0 ? 'warn' : 'good' },
        ], unmappedDrills)}
      />
      {d.panel(unmappedDrills)}
      <UnmappedBucketTable
        title="No tax treatment at all"
        why="A return cannot report these as anything. Fix first."
        bucket={data?.withoutTreatment}
        q={q}
      />
      <UnmappedBucketTable
        title="No HSN or SAC code"
        why="Rule 46 requires the code on the invoice, and Table 12 keys on it."
        bucket={data?.withoutCode}
        q={q}
      />
      <UnmappedBucketTable
        title="A rate somebody typed"
        why="Taxable, on an item nobody approved, with no code behind it — a counter decided the tax."
        bucket={data?.typedRate}
        q={q}
      />
      {(data?.typedRate.lines.length ?? 0) > 0 ? (
        <ExportableTable
          title="Where the typed rates were used"
          name="gst-typed-rate-lines"
          period={q}
          columns={[
            { key: 'd', label: 'Date', cell: (r: TypedLine) => formatDate(r.billDate) },
            { key: 'b', label: 'Document', cell: (r: TypedLine) => r.invoiceNumber ?? r.billNumber },
            { key: 'i', label: 'Item', cell: (r: TypedLine) => r.description },
            { key: 'r', label: 'Rate', align: 'right', cell: (r: TypedLine) => `${r.ratePercent}%`, csv: (r: TypedLine) => r.ratePercent },
            { key: 't', label: 'Tax charged', align: 'right', cell: (r: TypedLine) => plain(r.taxAmount), csv: (r: TypedLine) => r.taxAmount },
          ]}
          rows={(data?.typedRate.lines ?? []) as TypedLine[]}
        />
      ) : null}
    </div>
  );
}

type TypedLine = { billDate: string; invoiceNumber: string | null; billNumber: string; description: string; ratePercent: number; taxAmount: number };
const typedLineCols: Column<TypedLine>[] = [
  { key: 'd', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
  { key: 'b', label: 'Document', cell: (r) => r.invoiceNumber ?? r.billNumber, csv: (r) => r.invoiceNumber ?? r.billNumber },
  { key: 'i', label: 'Item', cell: (r) => r.description, csv: (r) => r.description },
  { key: 'r', label: 'Rate', align: 'right', cell: (r) => `${r.ratePercent}%`, csv: (r) => r.ratePercent },
  { key: 't', label: 'Tax charged', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
];
/** A sales-register line, as the C-3 / C-7 drill-downs show it (gap 282). */
const registerLineCols: Column<R.SalesLine>[] = [
  { key: 'd', label: 'Date', cell: (l) => formatDate(l.billDate), csv: (l) => formatDate(l.billDate) },
  { key: 'inv', label: 'Document', cell: (l) => l.invoiceNumber ?? l.billNumber, csv: (l) => l.invoiceNumber ?? l.billNumber },
  { key: 'desc', label: 'Line', cell: (l) => l.description, csv: (l) => l.description },
  { key: 'dep', label: 'Department', cell: (l) => titleCase(l.department), csv: (l) => l.department },
  { key: 'tr', label: 'Treatment', cell: (l) => l.treatmentLabel ?? 'Unclassified', csv: (l) => l.gstTreatment ?? 'unclassified' },
  { key: 'tv', label: 'Value (before tax)', align: 'right', cell: (l) => plain(l.taxableValue), csv: (l) => l.taxableValue },
  { key: 'tax', label: 'Tax', align: 'right', cell: (l) => plain(l.taxAmount), csv: (l) => l.taxAmount },
  { key: 'tot', label: 'Amount', align: 'right', cell: (l) => plain(l.totalAmount), csv: (l) => l.totalAmount },
];

// ── C-4 ────────────────────────────────────────────────────────────────────

export function SeriesContinuityView({ q }: { q: Q }) {
  const { data, isLoading } = R.useSeriesContinuity(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.series ?? [];
  type SeriesRow = (typeof rows)[number];
  const seriesCols: Column<SeriesRow>[] = [
    { key: 'd', label: 'Series', cell: (r) => titleCase(r.documentType), csv: (r) => r.documentType },
    { key: 'fy', label: 'Year', cell: (r) => r.financialYear, csv: (r) => r.financialYear },
    { key: 'p', label: 'Prefix', cell: (r) => r.prefix, csv: (r) => r.prefix },
    { key: 'c', label: 'Issued count', align: 'right', cell: (r) => r.issuedCount, csv: (r) => r.issuedCount },
    { key: 'm', label: 'Missing', cell: (r) => r.missing.join(', ') || '—', csv: (r) => r.missing.join(' ') },
    { key: 'dup', label: 'Duplicated', cell: (r) => r.duplicated.join(', ') || '—', csv: (r) => r.duplicated.join(' ') },
    { key: 'b', label: 'Burned count', align: 'right', cell: (r) => r.burned, csv: (r) => r.burned },
  ];
  // Gap 282: each count opens the series it counts.
  const seriesDrills: Record<string, ReactNode> = {
    Series: d.lines('Series', seriesCols, rows),
    'With gaps': d.lines('With gaps', seriesCols, rows.filter((r) => r.missing.length > 0)),
    'With duplicates': d.lines('With duplicates', seriesCols, rows.filter((r) => r.duplicated.length > 0)),
    'Numbers burned': d.lines('Numbers burned', seriesCols, rows.filter((r) => r.burned > 0), {
      note: `${rows.reduce((t, r) => t + r.burned, 0)} number(s) burned`,
    }),
  };
  return (
    <div className="space-y-4">
      <StatStrip
        stats={d.wire([
          { label: 'Series', value: String(data?.totals.series ?? 0) },
          { label: 'With gaps', value: String(data?.totals.withGaps ?? 0), tone: (data?.totals.withGaps ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'With duplicates', value: String(data?.totals.withDuplicates ?? 0), tone: (data?.totals.withDuplicates ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Numbers burned', value: String(data?.totals.burned ?? 0), tone: (data?.totals.burned ?? 0) > 0 ? 'warn' : 'good' },
        ], seriesDrills)}
      />
      {d.panel(seriesDrills)}
      <ReportNotes
        notes={[
          'A burned number was allotted inside a transaction that then rolled back. Explainable — but an auditor will ask, so the hospital should hold the answer.',
          'A cancelled invoice KEEPS its number and is reversed by a credit note. That is what keeps the series continuous, so it is listed rather than counted as a gap.',
        ]}
      />
      <div className="flex justify-end">
        <ExportButton
          {...exportAll('gst-series-continuity', [
            { key: 'd', label: 'Series', cell: (r: (typeof rows)[number]) => titleCase(r.documentType), csv: (r: (typeof rows)[number]) => r.documentType },
            { key: 'fy', label: 'Year', cell: (r: (typeof rows)[number]) => r.financialYear, csv: (r: (typeof rows)[number]) => r.financialYear },
            { key: 'p', label: 'Prefix', cell: (r: (typeof rows)[number]) => r.prefix, csv: (r: (typeof rows)[number]) => r.prefix },
            { key: 'f', label: 'First', align: 'right', cell: (r: (typeof rows)[number]) => r.firstIssued ?? '', csv: (r: (typeof rows)[number]) => r.firstIssued ?? '' },
            { key: 'l', label: 'Last', align: 'right', cell: (r: (typeof rows)[number]) => r.lastIssued ?? '', csv: (r: (typeof rows)[number]) => r.lastIssued ?? '' },
            { key: 'c', label: 'Issued count', align: 'right', cell: (r: (typeof rows)[number]) => r.issuedCount, csv: (r: (typeof rows)[number]) => r.issuedCount },
            { key: 'm', label: 'Missing', cell: (r: (typeof rows)[number]) => r.missing.join(' '), csv: (r: (typeof rows)[number]) => r.missing.join(' ') },
            { key: 'dup', label: 'Duplicated', cell: (r: (typeof rows)[number]) => r.duplicated.join(' '), csv: (r: (typeof rows)[number]) => r.duplicated.join(' ') },
            { key: 'b', label: 'Burned count', align: 'right', cell: (r: (typeof rows)[number]) => r.burned, csv: (r: (typeof rows)[number]) => r.burned },
          ], rows, {})}
          disabled={!rows.length}
        />
      </div>
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
  // Gap 282: C-7 folds A-1, so the money headlines open the register lines.
  const d = useStatDrill();
  const register = R.useSalesRegister(q, d.focus != null && d.focus !== 'Departments');
  if (isLoading) return <Loading />;
  type DeptRow = NonNullable<typeof data>['departments'][number];
  const deptCols: Column<DeptRow>[] = [
    { key: 'd', label: 'Department', cell: (r) => titleCase(r.department), csv: (r) => r.department },
    { key: 'l', label: 'Lines', align: 'right', cell: (r) => r.count, csv: (r) => r.count },
    { key: 't', label: 'Taxable turnover', align: 'right', cell: (r) => plain(r.taxableTurnover), csv: (r) => r.taxableTurnover },
    { key: 'e', label: 'Exempt turnover', align: 'right', cell: (r) => plain(r.exemptTurnover), csv: (r) => r.exemptTurnover },
    { key: 'x', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'v', label: 'Revenue', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
  ];
  const lines = register.data?.rows ?? [];
  const lo = (sum: (l: R.SalesLine) => number) => ({ sum, loading: register.isLoading });
  const deptDrills: Record<string, ReactNode> = {
    Departments: d.lines('Departments', deptCols, data?.departments ?? [], { sum: (r) => r.totalAmount }),
    'Total turnover': d.lines('Total turnover', registerLineCols, lines, lo((l) => l.taxableValue)),
    Tax: d.lines('Tax', registerLineCols, lines.filter((l) => Number(l.taxAmount) !== 0), lo((l) => l.taxAmount)),
    Revenue: d.lines('Revenue', registerLineCols, lines, lo((l) => l.totalAmount)),
  };
  return (
    <div className="space-y-4">
      <StatStrip
        stats={d.wire([
          { label: 'Departments', value: String(data?.departments.length ?? 0) },
          { label: 'Total turnover', value: money(data?.totals.taxableValue), hint: 'taxable + exempt, before tax' },
          { label: 'Tax', value: money(data?.totals.taxAmount) },
          { label: 'Revenue', value: money(data?.totals.totalAmount) },
        ], deptDrills)}
      />
      {d.panel(deptDrills)}
      <div className="flex justify-end">
        <ExportButton {...exportAll('gst-department', deptCols, data?.departments ?? [], q)} disabled={!(data?.departments ?? []).length} />
      </div>
      <ReportTable columns={deptCols} rows={data?.departments ?? []} />
    </div>
  );
}

// ── C-9 ────────────────────────────────────────────────────────────────────

type CancelledRow = R.CancelledInvoiceRow;
const reversedBy = (r: CancelledRow) => r.creditNotes.map((c) => c.creditNoteNumber).join(', ');
// One column set for the screen and all three exports, so they cannot drift.
const cancelledCols: Column<CancelledRow>[] = [
  { key: 'd', label: 'Bill date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
  { key: 'c', label: 'Cancelled', cell: (r) => formatDate(r.cancelledAt), csv: (r) => formatDate(r.cancelledAt) },
  { key: 'i', label: 'Document', cell: (r) => r.invoiceNumber ?? r.billNumber, csv: (r) => r.invoiceNumber ?? r.billNumber },
  { key: 'p', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
  { key: 'tv', label: 'Taxable value', align: 'right', cell: (r) => plain(r.taxableValue), csv: (r) => r.taxableValue ?? 0 },
  { key: 'x', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  {
    key: 'v', label: 'Value', align: 'right',
    // Gap 268: a voided pharmacy sale is zeroed, so its value is the credit note's.
    cell: (r) => (
      <span title={r.valueSource === 'credit_note' ? 'The bill was zeroed when voided — value taken from its credit note' : undefined}>
        {plain(r.totalAmount)}
        {r.valueSource === 'credit_note' ? <span className="ml-1 text-[10px] text-on-surface-variant">(CN)</span> : null}
      </span>
    ),
    csv: (r) => r.totalAmount,
  },
  { key: 'w', label: 'Cancelled by', cell: (r) => r.cancelledBy ?? '—', csv: (r) => r.cancelledBy ?? '' },
  { key: 'r', label: 'Reason', cell: (r) => r.reason ?? '—', csv: (r) => r.reason ?? '' },
  {
    key: 'cn',
    label: 'Reversed by',
    cell: (r) =>
      r.creditNotes.length ? reversedBy(r) : r.unreversed ? <Badge variant="destructive">No credit note</Badge> : '—',
    csv: (r) => reversedBy(r) || (r.unreversed ? 'NO CREDIT NOTE' : ''),
  },
];

export function CancelledInvoicesView({ q }: { q: Q }) {
  const { data, isLoading } = R.useCancelledInvoices(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const stats = [
    { label: 'Cancelled', value: String(data?.totals.count ?? 0) },
    { label: 'Taxable value', value: money(data?.totals.taxableValue) },
    { label: 'Tax on them', value: money(data?.totals.taxAmount) },
    { label: 'Value', value: money(data?.totals.totalAmount) },
    {
      label: 'Never reversed',
      value: String(data?.totals.unreversed ?? 0),
      tone: ((data?.totals.unreversed ?? 0) > 0 ? 'bad' : 'good') as 'bad' | 'good',
      hint: 'issued, cancelled, no credit note',
    },
  ];
  // Gap 282: each headline opens the cancelled documents it adds up.
  const cancelledDrills: Record<string, ReactNode> = {
    Cancelled: d.lines('Cancelled', cancelledCols, rows, { sum: (r) => r.totalAmount }),
    'Taxable value': d.lines('Taxable value', cancelledCols, rows, { sum: (r) => Number(r.taxableValue ?? 0) }),
    'Tax on them': d.lines('Tax on them', cancelledCols, rows.filter((r) => Number(r.taxAmount) !== 0), { sum: (r) => r.taxAmount }),
    Value: d.lines('Value', cancelledCols, rows, { sum: (r) => r.totalAmount }),
    'Never reversed': d.lines('Never reversed', cancelledCols, rows.filter((r) => r.unreversed), { sum: (r) => r.totalAmount }),
  };
  return (
    <div className="space-y-4">
      <StatStrip stats={d.wire(stats, cancelledDrills)} />
      {d.panel(cancelledDrills)}
      <div className="flex justify-end">
        <ExportButton {...exportAll('gst-cancelled-invoices', cancelledCols, rows, q, { stats })} disabled={!rows.length} />
      </div>
      <ReportTable columns={cancelledCols} rows={rows} empty="No invoice was cancelled in this period." />
      {rows.some((r) => r.valueSource === 'credit_note') ? (
        <ReportNotes
          notes={[
            'Rows marked (CN) are voided counter sales: voiding zeroes the bill, so the value and tax shown are those of the credit note that reversed it.',
          ]}
        />
      ) : null}
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

const outOfStepCols: Column<OutOfStepRow>[] = [
  { key: 'b', label: 'Document', cell: (l) => l.billNumber ?? '—', csv: (l) => l.billNumber ?? '' },
  { key: 'd', label: 'Billed', cell: (l) => formatDate(l.billDate), csv: (l) => formatDate(l.billDate) },
  { key: 'i', label: 'Item', cell: (l) => l.description, csv: (l) => l.description },
  { key: 'r', label: 'Rate used', align: 'right', cell: (l) => `${l.ratePercent}%`, csv: (l) => l.ratePercent },
  { key: 't', label: 'Tax', align: 'right', cell: (l) => plain(l.taxAmount), csv: (l) => l.taxAmount },
];

// Gap item 279: the item-level change log and the two differences C-5 and
// C-8 are built from, as flat exportable tables.
const fmtRate = (v: number | null) => (v == null ? '—' : `${v}%`);
const itemChangeCols: Column<R.ItemRateChange>[] = [
  { key: 'w', label: 'When', cell: (r) => formatDate(r.changedAt), csv: (r) => r.changedAt },
  { key: 'k', label: 'Item type', cell: (r) => titleCase(r.itemType), csv: (r) => r.itemType },
  { key: 'n', label: 'Item', cell: (r) => r.itemName ?? '—', csv: (r) => r.itemName ?? '' },
  { key: 'r', label: 'Rate', cell: (r) => `${fmtRate(r.previousRate)} → ${fmtRate(r.newRate)}`, csv: (r) => `${fmtRate(r.previousRate)} -> ${fmtRate(r.newRate)}` },
  { key: 'c', label: 'HSN / SAC', cell: (r) => `${r.previousCode ?? '—'} → ${r.newCode ?? '—'}`, csv: (r) => `${r.previousCode ?? ''} -> ${r.newCode ?? ''}` },
  { key: 't', label: 'Treatment', cell: (r) => `${titleCase(r.previousTreatment)} → ${titleCase(r.newTreatment)}`, csv: (r) => `${r.previousTreatment ?? ''} -> ${r.newTreatment ?? ''}` },
  { key: 'by', label: 'Changed by', cell: (r) => r.changedBy ?? '—', csv: (r) => r.changedBy ?? '' },
  { key: 'why', label: 'Reason', cell: (r) => r.reason ?? '—', csv: (r) => r.reason ?? '' },
];
const itemVsMasterCols: Column<R.ItemVsMaster>[] = [
  { key: 'k', label: 'Item type', cell: (r) => titleCase(r.itemType), csv: (r) => r.itemType },
  { key: 'n', label: 'Item', cell: (r) => r.itemName, csv: (r) => r.itemName },
  { key: 'c', label: 'Item code', cell: (r) => r.code ?? '—', csv: (r) => r.code ?? '' },
  { key: 'm', label: 'Master code', cell: (r) => r.masterCode, csv: (r) => r.masterCode },
  { key: 'ir', label: 'Item rate %', align: 'right', cell: (r) => `${r.itemRate}%`, csv: (r) => r.itemRate },
  { key: 'mr', label: 'Master rate %', align: 'right', cell: (r) => `${r.masterRate}%`, csv: (r) => r.masterRate },
  { key: 'it', label: 'Item treatment', cell: (r) => titleCase(r.itemTreatment), csv: (r) => r.itemTreatment ?? '' },
  { key: 'mt', label: 'Master treatment', cell: (r) => titleCase(r.masterTreatment), csv: (r) => r.masterTreatment ?? '' },
  { key: 'a', label: 'Approved', cell: (r) => (r.approved ? 'Yes' : 'No'), csv: (r) => (r.approved ? 'yes' : 'no') },
];

// ── C-5 ────────────────────────────────────────────────────────────────────

export function RateOverridesView({ q }: { q: Q }) {
  const { data, isLoading } = R.useRateOverrides(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'd', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
    { key: 'doc', label: 'Document', cell: (r) => r.document, csv: (r) => r.document },
    { key: 'p', label: 'Patient', cell: (r) => r.patientName ?? '—', csv: (r) => r.patientName ?? '' },
    { key: 'dept', label: 'Department', cell: (r) => titleCase(r.department), csv: (r) => r.department },
    { key: 'i', label: 'Item', cell: (r) => r.description, csv: (r) => r.description },
    { key: 'rate', label: 'Rate typed %', align: 'right', cell: (r) => `${r.ratePercent}%`, csv: (r) => r.ratePercent },
    { key: 't', label: 'Tax charged', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 'v', label: 'Line value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
    { key: 'w', label: 'Raised by', cell: (r) => r.raisedBy ?? <span className="text-muted-foreground">unattributed</span>, csv: (r) => r.raisedBy ?? '' },
  ];
  const billed = data?.billedVsItem ?? [];
  type BilledRow = (typeof billed)[number];
  const billedCols: Column<BilledRow>[] = [
    { key: 'd', label: 'Date', cell: (r) => formatDate(r.billDate), csv: (r) => formatDate(r.billDate) },
    { key: 'doc', label: 'Document', cell: (r) => r.invoiceNumber ?? r.billNumber, csv: (r) => r.invoiceNumber ?? r.billNumber },
    { key: 'i', label: 'Line', cell: (r) => r.description, csv: (r) => r.description },
    { key: 'k', label: 'Item type', cell: (r) => titleCase(r.itemType), csv: (r) => r.itemType },
    { key: 'b', label: 'Billed rate %', align: 'right', cell: (r) => `${r.billedRate}%`, csv: (r) => r.billedRate },
    { key: 'ir', label: 'Item rate %', align: 'right', cell: (r) => `${r.itemRate}%`, csv: (r) => r.itemRate },
    { key: 'bt', label: 'Billed treatment', cell: (r) => titleCase(r.billedTreatment), csv: (r) => r.billedTreatment ?? '' },
    { key: 't', label: 'Tax charged', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
    { key: 's', label: 'Why this rate', cell: (r) => r.rateSource ?? '—', csv: (r) => r.rateSource ?? '' },
    { key: 'w', label: 'Raised by', cell: (r) => r.raisedBy ?? '—', csv: (r) => r.raisedBy ?? '' },
  ];
  const changes = data?.itemChanges ?? [];
  const vsMaster = data?.itemVsMaster ?? [];
  // Gap 282: each count opens the rows it counts.
  const overrideDrills: Record<string, ReactNode> = {
    'Rates typed (legacy)': d.lines('Rates typed (legacy)', cols, rows, { sum: (r) => r.taxAmount }),
    'Item rate changes': d.lines('Item rate changes', itemChangeCols, changes),
    'Items off their master': d.lines('Items off their master', itemVsMasterCols, vsMaster),
    'Lines billed off the item rate': d.lines('Lines billed off the item rate', billedCols, billed, { sum: (r) => r.taxAmount }),
  };
  return (
    <div className="space-y-6">
      <StatStrip
        stats={d.wire([
          { label: 'Rates typed (legacy)', value: String(data?.totals.overrides ?? 0), tone: (data?.totals.overrides ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Item rate changes', value: String(data?.totals.itemChanges ?? changes.length), hint: 'in this period' },
          { label: 'Items off their master', value: String(data?.totals.itemVsMaster ?? vsMaster.length), tone: vsMaster.length ? 'warn' : 'good' },
          { label: 'Lines billed off the item rate', value: String(data?.totals.billedVsItem ?? billed.length), tone: billed.length ? 'warn' : 'good' },
        ], overrideDrills)}
      />
      {d.panel(overrideDrills)}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Item GST changes — who, when and why</h3>
          <ExportButton {...exportAll('gst-item-rate-changes', itemChangeCols, changes, q)} disabled={!changes.length} />
        </div>
        <ReportTable columns={itemChangeCols} rows={changes} empty="No item's GST rate, code or treatment changed in this period." />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lines billed at a rate different from the item</h3>
          <ExportButton {...exportAll('gst-billed-vs-item', billedCols, billed, q)} disabled={!billed.length} />
        </div>
        <ReportTable columns={billedCols} rows={billed} empty="Every line was billed at its item's rate." />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Items whose rate differs from their HSN / SAC master</h3>
          <ExportButton {...exportAll('gst-item-vs-master', itemVsMasterCols, vsMaster, {})} disabled={!vsMaster.length} />
        </div>
        <ReportTable columns={itemVsMasterCols} rows={vsMaster} empty="Every item matches its master." />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Rates typed at the counter</h3>
          <ExportButton onClick={() => exportCsv('gst-rate-overrides', cols, rows, q)}
            onExcel={() => exportXlsx('gst-rate-overrides', cols, rows, q)} onPdf={() => exportPdf('gst-rate-overrides', cols, rows, q)} disabled={!rows.length} />
        </div>
        <ReportTable columns={cols} rows={rows} empty="No line in this period carries a typed rate." />
      </section>
      {(data?.byPerson.length ?? 0) > 0 ? (
        <ExportableTable
          title="Typed rates, by who raised the document"
          name="gst-rate-overrides-by-person"
          period={q}
          columns={[
            { key: 'p', label: 'Raised by', cell: (r: PersonRow) => titleCase(r.person) },
            { key: 'l', label: 'Lines', align: 'right', cell: (r: PersonRow) => r.lines },
            { key: 't', label: 'Tax charged', align: 'right', cell: (r: PersonRow) => plain(r.taxCharged), csv: (r: PersonRow) => r.taxCharged },
            { key: 'v', label: 'Value', align: 'right', cell: (r: PersonRow) => plain(r.value), csv: (r: PersonRow) => r.value },
          ]}
          rows={(data?.byPerson ?? []) as PersonRow[]}
        />
      ) : null}
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

// ── C-8 ────────────────────────────────────────────────────────────────────

export function RateChangeImpactView({ q }: { q: Q }) {
  const { data, isLoading } = R.useRateChangeImpact(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.changes ?? [];
  const items = data?.itemChanges ?? [];
  const vsMaster = data?.itemVsMaster ?? [];
  type ItemImpact = (typeof items)[number];
  const itemImpactCols: Column<ItemImpact>[] = [
    ...(itemChangeCols as unknown as Column<ItemImpact>[]),
    { key: 'lb', label: 'Lines before', align: 'right', cell: (r) => r.linesBefore.count, csv: (r) => r.linesBefore.count },
    { key: 'la', label: 'Lines after', align: 'right', cell: (r) => r.linesAfter.count, csv: (r) => r.linesAfter.count },
    {
      key: 'o', label: 'Out of step', align: 'right',
      cell: (r) => (r.outOfStep.length ? <span className="text-red-600">{r.outOfStep.length}</span> : 0),
      csv: (r) => r.outOfStep.length,
    },
  ];
  type MasterRow = (typeof rows)[number];
  const masterCols: Column<MasterRow>[] = [
    { key: 'w', label: 'When', cell: (r) => formatDate(r.changedAt), csv: (r) => r.changedAt },
    { key: 'c', label: 'Code', cell: (r) => `${r.codeType.toUpperCase()} ${r.code}`, csv: (r) => `${r.codeType.toUpperCase()} ${r.code}` },
    { key: 'd', label: 'Description', cell: (r) => r.description ?? '—', csv: (r) => r.description ?? '' },
    { key: 'a', label: 'Action', cell: (r) => <Badge variant={r.action === 'deactivate' ? 'destructive' : 'secondary'}>{titleCase(r.action)}</Badge>, csv: (r) => r.action },
    { key: 'r', label: 'Rate', align: 'right', cell: (r) => `${fmtRate(r.previousRate)} → ${fmtRate(r.newRate)}`, csv: (r) => `${fmtRate(r.previousRate)} -> ${fmtRate(r.newRate)}` },
    { key: 'by', label: 'Changed by', cell: (r) => r.changedBy ?? '—', csv: (r) => r.changedBy ?? '' },
    { key: 'b', label: 'Lines before', align: 'right', cell: (r) => r.linesBefore.count, csv: (r) => r.linesBefore.count },
    { key: 'af', label: 'Lines after', align: 'right', cell: (r) => r.linesAfter.count, csv: (r) => r.linesAfter.count },
    {
      key: 'o', label: 'Out of step', align: 'right',
      cell: (r) => (r.outOfStep.length ? <span className="text-red-600">{r.outOfStep.length}</span> : 0),
      csv: (r) => r.outOfStep.length,
    },
  ];
  const outOfStep = [...rows.flatMap((r) => r.outOfStep), ...items.flatMap((r) => r.outOfStep)];
  // Gap 282: 'Lines either side' is counted per change, so it opens the
  // changes with their before / after line counts.
  type SideRow = { source: string; what: string; when: string; before: number; after: number };
  const sideRows: SideRow[] = [
    ...items.map((r) => ({ source: 'Item', what: r.itemName ?? '—', when: r.changedAt, before: r.linesBefore.count, after: r.linesAfter.count })),
    ...rows.map((r) => ({ source: 'Master', what: `${r.codeType.toUpperCase()} ${r.code}`, when: r.changedAt, before: r.linesBefore.count, after: r.linesAfter.count })),
  ];
  const sideCols: Column<SideRow>[] = [
    { key: 's', label: 'Change to', cell: (r) => r.source, csv: (r) => r.source },
    { key: 'w', label: 'What', cell: (r) => r.what, csv: (r) => r.what },
    { key: 'd', label: 'When', cell: (r) => formatDate(r.when), csv: (r) => r.when },
    { key: 'b', label: 'Lines before', align: 'right', cell: (r) => r.before, csv: (r) => r.before },
    { key: 'a', label: 'Lines after', align: 'right', cell: (r) => r.after, csv: (r) => r.after },
  ];
  const impactDrills: Record<string, ReactNode> = {
    'Master changes': d.lines('Master changes', masterCols, rows),
    'Item changes': d.lines('Item changes', itemImpactCols, items),
    'Lines either side': d.lines('Lines either side', sideCols, sideRows, {
      note: `${sideRows.reduce((t, r) => t + r.before + r.after, 0)} line(s) before + after`,
    }),
    'Billed at the old rate after': d.lines('Billed at the old rate after', outOfStepCols, outOfStep as OutOfStepRow[], {
      sum: (l) => l.taxAmount,
    }),
  };
  return (
    <div className="space-y-6">
      <StatStrip
        stats={d.wire([
          { label: 'Master changes', value: String(data?.totals.changes ?? 0) },
          { label: 'Item changes', value: String(data?.totals.itemChanges ?? items.length) },
          { label: 'Lines either side', value: String(data?.totals.linesAffected ?? 0) },
          {
            label: 'Billed at the old rate after',
            value: String(data?.totals.outOfStep ?? 0),
            tone: (data?.totals.outOfStep ?? 0) > 0 ? 'bad' : 'good',
          },
        ], impactDrills)}
      />
      {d.panel(impactDrills)}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Hospital items — rate, code or treatment changed</h3>
          <ExportButton {...exportAll('gst-item-change-impact', itemImpactCols, items, q)} disabled={!items.length} />
        </div>
        <ReportTable columns={itemImpactCols} rows={items} empty="No item's GST rate, code or treatment changed in this period." />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Platform HSN / SAC masters</h3>
          <ExportButton {...exportAll('gst-master-rate-changes', masterCols, rows, q)} disabled={!rows.length} />
        </div>
        <ReportTable columns={masterCols} rows={rows} empty="Nothing on a tax master changed in this period." />
      </section>
      {outOfStep.length > 0 ? (
        <ExportableTable
          title="Billed after a change, still at the old rate"
          name="gst-billed-at-old-rate"
          period={q}
          columns={[
            { key: 'b', label: 'Document', cell: (l: OutOfStepRow) => l.billNumber ?? '—', csv: (l: OutOfStepRow) => l.billNumber ?? '' },
            { key: 'd', label: 'Billed', cell: (l: OutOfStepRow) => formatDate(l.billDate) },
            { key: 'i', label: 'Item', cell: (l: OutOfStepRow) => l.description },
            { key: 'r', label: 'Rate used', align: 'right', cell: (l: OutOfStepRow) => `${l.ratePercent}%`, csv: (l: OutOfStepRow) => l.ratePercent },
            { key: 't', label: 'Tax', align: 'right', cell: (l: OutOfStepRow) => plain(l.taxAmount), csv: (l: OutOfStepRow) => l.taxAmount },
          ]}
          rows={outOfStep as OutOfStepRow[]}
        />
      ) : null}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Items whose rate differs from their HSN / SAC master today</h3>
          <ExportButton {...exportAll('gst-item-vs-master', itemVsMasterCols, vsMaster, {})} disabled={!vsMaster.length} />
        </div>
        <ReportTable columns={itemVsMasterCols} rows={vsMaster} empty="Every item matches its master." />
      </section>
      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}
