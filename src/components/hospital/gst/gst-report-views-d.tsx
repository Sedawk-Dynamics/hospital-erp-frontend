'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import {
  Column, ExportButton, Loading, ReportTable, StatStrip,
  exportCsv, exportXlsx, money, plain, titleCase,
} from './gst-report-shell';
import type { EInvoiceApplicability, GstReportQuery, IrnRow } from '@/hooks/use-gst-reports';
import * as R from '@/hooks/use-gst-reports';

// ============================================================
// Group D — e-invoice and e-way bill.
//
// These three screens lead with WHETHER THEY APPLY, before a single row. The
// detailed report tied that to a five-crore turnover; correction 14 rejected
// the wording outright — "Don't make that a permanent hard-coded rule ...
// Applicable where e-invoicing/e-way bill requirements apply to the hospital
// for the relevant period" — so nothing here states a threshold. It states the
// hospital's own setting and links to where that setting is changed.
//
// The other thing these screens do is refuse to let an empty table pass for
// good news. "Nothing needed registering" and "nothing has been sent" produce
// the same blank table and are opposite facts, so the banner says which.
// ============================================================

type Q = GstReportQuery;

/**
 * Does this apply, and who decided.
 *
 * Rendered whether the answer is yes or no. A report hidden from the menu
 * because it does not apply is a report nobody can show an auditor when they
 * ask the hospital to demonstrate that it does not.
 */
function Applicability({ a }: { a: EInvoiceApplicability }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        a.applicable
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-muted/40 text-muted-foreground'
      }`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">{a.statement}</p>
        <p className="text-xs">{a.note}</p>
        <Link
          href={a.settingsPath}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          GST settings <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/** What an empty table means. Said in words, because the table cannot say it. */
function EmptyMeaning({ note, bad }: { note: string; bad?: boolean }) {
  if (!note) return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        bad ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-border bg-card text-muted-foreground'
      }`}
    >
      {bad ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
      <p>{note}</p>
    </div>
  );
}

/** The document's own name for itself — an invoice and a credit note are not the same row. */
const KIND_LABELS: Record<string, string> = {
  invoice: 'Invoice',
  credit_note: 'Credit note',
  debit_note: 'Debit note',
};

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'registered'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : status === 'failed'
        ? 'border-red-300 bg-red-50 text-red-800'
        : status === 'pending'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : status === 'cancelled'
            ? 'border-border bg-muted text-muted-foreground'
            : 'border-amber-300 bg-amber-50 text-amber-900';
  const label = status === 'not_sent' ? 'Not sent' : titleCase(status);
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

/** How long is left, as a phrase rather than a signed number nobody reads twice. */
function deadlineText(days: number | null): string {
  if (days == null) return '—';
  if (days < 0) return `${Math.abs(days)} day(s) overdue`;
  if (days === 0) return 'Due today';
  return `${days} day(s) left`;
}

const irnCols: Column<IrnRow>[] = [
  { key: 'date', label: 'Date', cell: (r) => formatDate(r.documentDate), csv: (r) => formatDate(r.documentDate) },
  { key: 'kind', label: 'Document', cell: (r) => KIND_LABELS[r.kind] ?? titleCase(r.kind), csv: (r) => r.kind },
  { key: 'num', label: 'Number', cell: (r) => <span className="font-mono text-xs">{r.documentNumber}</span>, csv: (r) => r.documentNumber },
  { key: 'to', label: 'Recipient', cell: (r) => r.recipientName ?? '—', csv: (r) => r.recipientName ?? '' },
  { key: 'gstin', label: 'Recipient GSTIN', cell: (r) => <span className="font-mono text-xs">{r.recipientGstin ?? '—'}</span>, csv: (r) => r.recipientGstin ?? '' },
  { key: 'val', label: 'Value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
  { key: 'tax', label: 'Tax', align: 'right', cell: (r) => plain(r.taxAmount), csv: (r) => r.taxAmount },
  { key: 'st', label: 'Status', cell: (r) => <StatusChip status={r.status} />, csv: (r) => r.status },
  {
    key: 'irn',
    label: 'IRN',
    // Truncated on screen because a 64-character hash pushes every other column
    // off the table; the full value goes to the export, which is where anybody
    // who actually needs to copy it is working.
    cell: (r) => (r.irn ? <span className="font-mono text-[11px]" title={r.irn}>{r.irn.slice(0, 12)}…</span> : '—'),
    csv: (r) => r.irn ?? '',
  },
  { key: 'ack', label: 'Ack no.', cell: (r) => <span className="font-mono text-xs">{r.ackNo ?? '—'}</span>, csv: (r) => r.ackNo ?? '' },
  { key: 'ackd', label: 'Ack date', cell: (r) => (r.ackDate ? formatDate(r.ackDate) : '—'), csv: (r) => (r.ackDate ? formatDate(r.ackDate) : '') },
];

/**
 * D-1 — E-invoice (IRN) Register.
 *
 * Only B2B documents appear. A patient's own bill is B2C and needs no IRN at
 * any turnover, so a register listing every hospital bill as "missing its IRN"
 * would be both wrong and alarming — the counts here are meant to be acted on.
 */
export function EInvoiceRegisterView({ q }: { q: Q }) {
  const { data, isLoading } = R.useEInvoiceRegister(q);
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const s = data?.summary;
  const outstanding = (s?.notSent ?? 0) + (s?.failed ?? 0);

  return (
    <div className="space-y-4">
      {data?.applicability ? <Applicability a={data.applicability} /> : null}
      <StatStrip
        stats={[
          { label: 'Needed an IRN', value: String(s?.required ?? 0) },
          { label: 'Registered', value: String(s?.registered ?? 0), tone: 'good' },
          {
            label: 'Outstanding',
            value: String(outstanding),
            tone: outstanding > 0 ? 'bad' : 'good',
            hint: 'Not sent, or refused by the portal',
          },
          { label: 'Document value', value: money(s?.totalValue) },
        ]}
      />
      <EmptyMeaning note={data?.note ?? ''} bad={outstanding > 0} />
      <div className="flex justify-end">
        <ExportButton
          onClick={() => exportCsv('D1-einvoice-register', irnCols, rows, { from: q.from, to: q.to })}
          onExcel={() => exportXlsx('D1-einvoice-register', irnCols, rows, { from: q.from, to: q.to })}
          disabled={!rows.length}
        />
      </div>
      <ReportTable
        columns={irnCols}
        rows={rows}
        empty="No B2B document in this period needed an IRN."
      />
    </div>
  );
}

/**
 * D-2 — Failed IRN Report.
 *
 * Two populations on one screen: what the portal refused, and what was never
 * sent. Both have the same deadline and the same consequence, and the reason
 * column carries the portal's own words rather than a paraphrase — an
 * accountant fixing a rejection needs the error the portal will accept a
 * correction against.
 */
export function FailedIrnView({ q }: { q: Q }) {
  const { data, isLoading } = R.useFailedIrn(q);
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const s = data?.summary;

  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'date', label: 'Date', cell: (r) => formatDate(r.documentDate), csv: (r) => formatDate(r.documentDate) },
    { key: 'kind', label: 'Document', cell: (r) => KIND_LABELS[r.kind] ?? titleCase(r.kind), csv: (r) => r.kind },
    { key: 'num', label: 'Number', cell: (r) => <span className="font-mono text-xs">{r.documentNumber}</span>, csv: (r) => r.documentNumber },
    { key: 'to', label: 'Recipient', cell: (r) => r.recipientName ?? '—', csv: (r) => r.recipientName ?? '' },
    { key: 'val', label: 'Value', align: 'right', cell: (r) => plain(r.totalAmount), csv: (r) => r.totalAmount },
    { key: 'st', label: 'Status', cell: (r) => <StatusChip status={r.status} />, csv: (r) => r.status },
    {
      key: 'why',
      label: 'Why',
      cell: (r) => <span className="text-xs">{r.reason}</span>,
      csv: (r) => r.reason,
    },
    {
      key: 'due',
      label: 'Deadline',
      cell: (r) => (
        <span className={r.overdue ? 'font-medium text-red-600' : ''}>{deadlineText(r.daysToDeadline)}</span>
      ),
      csv: (r) => deadlineText(r.daysToDeadline),
    },
    {
      key: 'try',
      label: 'Last attempt',
      cell: (r) => (r.attemptedAt ? formatDate(r.attemptedAt) : 'Never'),
      csv: (r) => (r.attemptedAt ? formatDate(r.attemptedAt) : 'Never'),
    },
  ];

  return (
    <div className="space-y-4">
      {data?.applicability ? <Applicability a={data.applicability} /> : null}
      <StatStrip
        stats={[
          { label: 'Outstanding', value: String(s?.outstanding ?? 0), tone: (s?.outstanding ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Refused by the portal', value: String(s?.rejected ?? 0), tone: (s?.rejected ?? 0) > 0 ? 'bad' : undefined },
          { label: 'Never sent', value: String(s?.neverSent ?? 0), tone: (s?.neverSent ?? 0) > 0 ? 'warn' : undefined },
          {
            label: 'Past the window',
            value: String(s?.overdue ?? 0),
            tone: (s?.overdue ?? 0) > 0 ? 'bad' : 'good',
            hint: `${data?.uploadDays ?? 30} days, from the hospital's GST settings`,
          },
        ]}
      />
      <EmptyMeaning note={data?.note ?? ''} bad={(s?.outstanding ?? 0) > 0} />
      <div className="flex justify-end">
        <ExportButton
          onClick={() => exportCsv('D2-failed-irn', cols, rows, { from: q.from, to: q.to })}
          onExcel={() => exportXlsx('D2-failed-irn', cols, rows, { from: q.from, to: q.to })}
          disabled={!rows.length}
        />
      </div>
      <ReportTable columns={cols} rows={rows} empty="Nothing is outstanding — every B2B document carries an IRN." />
    </div>
  );
}
