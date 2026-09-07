'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileJson, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import {
  Column, ExportButton, Loading, ReportNotes, ReportTable, StatStrip,
  exportCsv, money, plain,
} from './gst-report-shell';
import type { GstReportQuery, ReconRow } from '@/hooks/use-gst-reports';
import { useGstr2bReconciliation, useImportGstr2b } from '@/hooks/use-gst-reports';

// ============================================================
// B-5 — our purchase register against what the portal says our suppliers filed.
//
// The four buckets are not four flavours of the same thing. Each is a different
// person's next action, so each gets its own table with its own heading saying
// what to do about it — a single table with a status column would let the one
// that costs money hide among the ones that do not.
// ============================================================

const bucketNote = {
  matched: 'Both agree. Claim it.',
  mismatched: 'Both have the invoice; the figures differ. Reconcile before claiming.',
  inBooksOnly:
    'We recorded the purchase and the supplier has NOT declared it. The credit cannot be claimed until they file — chase them.',
  inPortalOnly:
    'The supplier declared it and our books have no purchase against it. Either a goods receipt was never entered, or it is not ours.',
};

export function Gstr2bReconciliationView({ q }: { q: GstReportQuery }) {
  const { data, isLoading } = useGstr2bReconciliation(q);
  const importer = useImportGstr2b();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // A .json download that is not JSON is almost always the wrong file —
        // saying so beats a parser error from four layers down.
        throw new Error('That file is not JSON. Download the GSTR-2B JSON for the period from the portal.');
      }
      const out = await importer.mutateAsync({ file: parsed, fileName: file.name });
      toast.success(`GSTR-2B for ${out?.returnPeriod} imported — ${out?.documents} document(s)`);
      for (const w of out?.warnings ?? []) toast.warning(w, { duration: 8000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import that statement');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  if (isLoading) return <Loading />;

  const t = data?.totals;
  const bookCols: Column<ReconRow>[] = [
    { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? r.supplierGstin ?? '—', csv: (r) => r.supplierName ?? '' },
    { key: 'g', label: 'GSTIN', cell: (r) => r.supplierGstin ?? '—', csv: (r) => r.supplierGstin ?? '' },
    { key: 'i', label: 'Invoice', cell: (r) => r.invoiceNumber, csv: (r) => r.invoiceNumber },
    { key: 'd', label: 'Dated', cell: (r) => formatDate(r.invoiceDate), csv: (r) => formatDate(r.invoiceDate) },
    { key: 'l', label: 'Lines', align: 'right', cell: (r) => r.lines ?? 1, csv: (r) => r.lines ?? 1 },
    { key: 'v', label: 'Taxable', align: 'right', cell: (r) => plain(r.booksTaxableValue ?? r.taxableValue), csv: (r) => r.booksTaxableValue ?? r.taxableValue ?? 0 },
    { key: 't', label: 'Tax', align: 'right', cell: (r) => plain(r.booksTaxAmount ?? r.taxAmount), csv: (r) => r.booksTaxAmount ?? r.taxAmount ?? 0 },
  ];

  const compareCols: Column<ReconRow>[] = [
    { key: 's', label: 'Supplier', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
    { key: 'i', label: 'Our invoice', cell: (r) => r.invoiceNumber, csv: (r) => r.invoiceNumber },
    { key: 'pi', label: 'On the portal', cell: (r) => r.portalInvoiceNumber ?? '—', csv: (r) => r.portalInvoiceNumber ?? '' },
    { key: 'bt', label: 'Our tax', align: 'right', cell: (r) => plain(r.booksTaxAmount), csv: (r) => r.booksTaxAmount ?? 0 },
    { key: 'pt', label: 'Portal tax', align: 'right', cell: (r) => plain(r.portalTaxAmount), csv: (r) => r.portalTaxAmount ?? 0 },
    {
      key: 'df',
      label: 'Difference',
      align: 'right',
      cell: (r) =>
        r.taxDifference ? <span className="text-red-600">{plain(r.taxDifference)}</span> : plain(0),
      csv: (r) => r.taxDifference ?? 0,
    },
    {
      key: 'itc',
      label: 'Portal allows',
      cell: (r) =>
        r.itcAvailable === false ? (
          <Badge variant="destructive" title={r.itcBlockedReason ?? undefined}>Blocked</Badge>
        ) : (
          <Badge variant="outline">Yes</Badge>
        ),
      csv: (r) => (r.itcAvailable === false ? `blocked: ${r.itcBlockedReason ?? ''}` : 'yes'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* The statement, or the fact that there isn't one. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="flex items-start gap-2">
          <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-xs">
            {data?.statement ? (
              <>
                <p className="font-medium">
                  GSTR-2B for {data.returnPeriod}
                  {data.statement.fileName ? ` · ${data.statement.fileName}` : ''}
                </p>
                <p className="text-muted-foreground">
                  {data.statement.invoiceCount} document(s) · imported{' '}
                  {formatDateTime(data.statement.importedAt)}
                  {data.statement.importedBy ? ` by ${data.statement.importedBy}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">No GSTR-2B imported for {data?.returnPeriod}</p>
                <p className="text-muted-foreground">
                  Until one is, every purchase in the period shows as not declared by its supplier.
                </p>
              </>
            )}
          </div>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            Import GSTR-2B JSON
          </Button>
        </div>
      </div>

      <StatStrip
        stats={[
          { label: 'Matched', value: String(t?.matched.count ?? 0), tone: 'good', hint: money(t?.matched.taxAmount) },
          {
            label: 'Mismatched',
            value: String(t?.mismatched.count ?? 0),
            tone: (t?.mismatched.count ?? 0) > 0 ? 'warn' : 'good',
          },
          {
            label: 'Credit at risk',
            value: money(t?.creditAtRisk),
            tone: (t?.creditAtRisk ?? 0) > 0 ? 'bad' : 'good',
            hint: `${t?.inBooksOnly.count ?? 0} invoice(s) the supplier has not filed`,
          },
          { label: 'Claimable', value: money(t?.claimable), hint: 'portal figures, net of notes' },
        ]}
      />

      {(t?.creditAtRisk ?? 0) > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {money(t?.creditAtRisk)} of input credit is recorded in our books against invoices no
            supplier has declared. It cannot be claimed until they file.
          </p>
        </div>
      ) : data?.statement ? (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Every purchase in this period has been declared by its supplier.</p>
        </div>
      ) : null}

      <Bucket
        title={`Credit at risk — the supplier has not filed (${t?.inBooksOnly.count ?? 0})`}
        note={bucketNote.inBooksOnly}
        cols={bookCols}
        rows={data?.inBooksOnly ?? []}
        name="gstr2b-in-books-only"
        q={q}
        empty="Nothing. Every purchase we recorded appears on the portal."
      />

      <Bucket
        title={`Figures differ (${t?.mismatched.count ?? 0})`}
        note={bucketNote.mismatched}
        cols={compareCols}
        rows={data?.mismatched ?? []}
        name="gstr2b-mismatched"
        q={q}
        empty="Nothing. Where both have the invoice, both agree."
      />

      <Bucket
        title={`On the portal, not in our books (${t?.inPortalOnly.count ?? 0})`}
        note={bucketNote.inPortalOnly}
        cols={bookCols}
        rows={data?.inPortalOnly ?? []}
        name="gstr2b-in-portal-only"
        q={q}
        empty="Nothing. Every invoice the portal has is in our books."
      />

      <Bucket
        title={`Matched (${t?.matched.count ?? 0})`}
        note={bucketNote.matched}
        cols={compareCols}
        rows={data?.matched ?? []}
        name="gstr2b-matched"
        q={q}
        empty="Nothing matched."
      />

      {(data?.supplierNotes.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Supplier credit and debit notes ({data?.supplierNotes.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            A credit note takes credit away and is carried negative; a debit note adds to it.
            Neither has a goods receipt behind it, so neither is matched to a purchase.
          </p>
          <ReportTable
            columns={[
              { key: 's', label: 'Supplier', cell: (n: { supplierName: string | null }) => n.supplierName ?? '—' },
              { key: 't', label: 'Type', cell: (n: { documentType: string }) => (n.documentType === 'credit_note' ? 'Credit note' : 'Debit note') },
              { key: 'n', label: 'Number', cell: (n: { documentNumber: string }) => n.documentNumber },
              { key: 'd', label: 'Dated', cell: (n: { documentDate: string | null }) => formatDate(n.documentDate) },
              { key: 'v', label: 'Taxable', align: 'right', cell: (n: { taxableValue: number }) => plain(n.taxableValue) },
              { key: 'x', label: 'Effect on credit', align: 'right', cell: (n: { taxAmount: number }) => plain(n.taxAmount) },
            ]}
            rows={data?.supplierNotes ?? []}
          />
        </section>
      ) : null}

      {(data?.unmatchable.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Cannot be matched at all ({data?.unmatchable.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            No supplier GSTIN or no invoice number recorded on our side, so there is nothing to match
            on. Fix these at inward, not on the portal.
          </p>
          <ReportTable
            columns={[
              { key: 's', label: 'Supplier', cell: (u: { supplierName: string | null }) => u.supplierName ?? '—' },
              { key: 'i', label: 'Item', cell: (u: { drugName: string }) => u.drugName },
              { key: 'n', label: 'Invoice', cell: (u: { invoiceNumber: string | null }) => u.invoiceNumber ?? '—' },
              { key: 'p', label: 'Problem', cell: (u: { problem: string }) => <Badge variant="secondary">{u.problem}</Badge> },
              { key: 't', label: 'Tax', align: 'right', cell: (u: { taxAmount: number }) => plain(u.taxAmount) },
            ]}
            rows={data?.unmatchable ?? []}
          />
        </section>
      ) : null}

      <ReportNotes notes={data?.notes ?? []} />
    </div>
  );
}

function Bucket({
  title, note, cols, rows, name, q, empty,
}: {
  title: string;
  note: string;
  cols: Column<ReconRow>[];
  rows: ReconRow[];
  name: string;
  q: GstReportQuery;
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{note}</p>
        </div>
        <ExportButton onClick={() => exportCsv(name, cols, rows, q)} disabled={!rows.length} />
      </div>
      <ReportTable columns={cols} rows={rows} empty={empty} />
    </section>
  );
}
