'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';
import {
  Column, ExportButton, Loading, ReportTable, StatStrip,
  exportCsv, exportXlsx, money, plain, titleCase, exportPdf
} from './gst-report-shell';
import type { EInvoiceApplicability, EwayRow, GstReportQuery, IrnRow } from '@/hooks/use-gst-reports';
import * as R from '@/hooks/use-gst-reports';
import { useStatDrill } from './gst-report-views';
import { EwayRowAction, IntegrationBanner, IrnRowActions, ewayStatusOf } from './gst-einvoice-actions';

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

function StatusChip({ status, label: override }: { status: string; label?: string }) {
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
  const label = override ?? (status === 'not_sent' ? 'Not sent' : titleCase(status));
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
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const s = data?.summary;
  const outstanding = (s?.notSent ?? 0) + (s?.failed ?? 0);
  // Gap 282: each count opens the documents it counts.
  const irnDrills: Record<string, ReactNode> = {
    'Needed an IRN': d.lines('Needed an IRN', irnCols, rows, { sum: (r) => Math.abs(r.totalAmount) }),
    Registered: d.lines('Registered', irnCols, rows.filter((r) => r.status === 'registered'), { sum: (r) => Math.abs(r.totalAmount) }),
    Outstanding: d.lines('Outstanding', irnCols, rows.filter((r) => r.status === 'not_sent' || r.status === 'failed'), {
      sum: (r) => Math.abs(r.totalAmount),
    }),
    'Document value': d.lines('Document value', irnCols, rows, { sum: (r) => Math.abs(r.totalAmount) }),
  };

  return (
    <div className="space-y-4">
      {data?.applicability ? <Applicability a={data.applicability} /> : null}
      <IntegrationBanner integration={data?.integration} what="IRN" />
      <StatStrip
        stats={d.wire([
          { label: 'Needed an IRN', value: String(s?.required ?? 0) },
          { label: 'Registered', value: String(s?.registered ?? 0), tone: 'good' },
          {
            label: 'Outstanding',
            value: String(outstanding),
            tone: outstanding > 0 ? 'bad' : 'good',
            hint: 'Not sent, or refused by the portal',
          },
          { label: 'Document value', value: money(s?.totalValue) },
        ], irnDrills)}
      />
      {d.panel(irnDrills)}
      <EmptyMeaning note={data?.note ?? ''} bad={outstanding > 0} />
      <div className="flex justify-end">
        <ExportButton
          onClick={() => exportCsv('D1-einvoice-register', irnCols, rows, { from: q.from, to: q.to })}
          onExcel={() => exportXlsx('D1-einvoice-register', irnCols, rows, { from: q.from, to: q.to })} onPdf={() => exportPdf('D1-einvoice-register', irnCols, rows, { from: q.from, to: q.to })}
          disabled={!rows.length}
        />
      </div>
      {/* G-5 (gap #266): screen-only action column — never exported. */}
      <ReportTable
        columns={[
          ...irnCols,
          { key: 'act', label: '', cell: (r) => <IrnRowActions row={r} integration={data?.integration} /> },
        ]}
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
  const d = useStatDrill();
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

  // Gap 282: each count opens the documents it counts.
  const failedDrills: Record<string, ReactNode> = {
    Outstanding: d.lines('Outstanding', cols, rows, { sum: (r) => r.totalAmount }),
    'Refused by the portal': d.lines('Refused by the portal', cols, rows.filter((r) => r.status === 'failed'), { sum: (r) => r.totalAmount }),
    'Never sent': d.lines('Never sent', cols, rows.filter((r) => r.status === 'not_sent'), { sum: (r) => r.totalAmount }),
    'Past the window': d.lines('Past the window', cols, rows.filter((r) => r.overdue), { sum: (r) => r.totalAmount }),
  };
  return (
    <div className="space-y-4">
      {data?.applicability ? <Applicability a={data.applicability} /> : null}
      <IntegrationBanner integration={data?.integration} what="IRN" />
      <StatStrip
        stats={d.wire([
          { label: 'Outstanding', value: String(s?.outstanding ?? 0), tone: (s?.outstanding ?? 0) > 0 ? 'bad' : 'good' },
          { label: 'Refused by the portal', value: String(s?.rejected ?? 0), tone: (s?.rejected ?? 0) > 0 ? 'bad' : undefined },
          { label: 'Never sent', value: String(s?.neverSent ?? 0), tone: (s?.neverSent ?? 0) > 0 ? 'warn' : undefined },
          {
            label: 'Past the window',
            value: String(s?.overdue ?? 0),
            tone: (s?.overdue ?? 0) > 0 ? 'bad' : 'good',
            hint: `${data?.uploadDays ?? 30} days, from the hospital's GST settings`,
          },
        ], failedDrills)}
      />
      {d.panel(failedDrills)}
      <EmptyMeaning note={data?.note ?? ''} bad={(s?.outstanding ?? 0) > 0} />
      <div className="flex justify-end">
        <ExportButton
          onClick={() => exportCsv('D2-failed-irn', cols, rows, { from: q.from, to: q.to })}
          onExcel={() => exportXlsx('D2-failed-irn', cols, rows, { from: q.from, to: q.to })} onPdf={() => exportPdf('D2-failed-irn', cols, rows, { from: q.from, to: q.to })}
          disabled={!rows.length}
        />
      </div>
      {/* G-5 (gap #266): Generate / Retry beside the portal's reason — screen only, never exported. */}
      <ReportTable
        columns={[...cols, { key: 'act', label: '', cell: (r) => <IrnRowActions row={r} integration={data?.integration} /> }]}
        rows={rows}
        empty="Nothing is outstanding — every B2B document carries an IRN."
      />
    </div>
  );
}

const ewayCols: Column<EwayRow>[] = [
  { key: 'date', label: 'Date', cell: (r) => formatDate(r.date), csv: (r) => formatDate(r.date) },
  { key: 'num', label: 'Return', cell: (r) => <span className="font-mono text-xs">{r.documentNumber || '—'}</span>, csv: (r) => r.documentNumber },
  { key: 'item', label: 'Item', cell: (r) => r.itemName || '—', csv: (r) => r.itemName },
  { key: 'hsn', label: 'HSN', cell: (r) => <span className="font-mono text-xs">{r.hsnCode ?? '—'}</span>, csv: (r) => r.hsnCode ?? '' },
  { key: 'qty', label: 'Qty', align: 'right', cell: (r) => r.quantity, csv: (r) => r.quantity },
  { key: 'val', label: 'Consignment value', align: 'right', cell: (r) => plain(r.consignmentValue), csv: (r) => r.consignmentValue },
  { key: 'to', label: 'Consignee', cell: (r) => r.supplierName ?? '—', csv: (r) => r.supplierName ?? '' },
  { key: 'gstin', label: 'Consignee GSTIN', cell: (r) => <span className="font-mono text-xs">{r.supplierGstin ?? '—'}</span>, csv: (r) => r.supplierGstin ?? '' },
  {
    key: 'ewb',
    label: 'E-way bill',
    // #266: the ACTIVE number. A cancelled one is in the history column.
    cell: (r) =>
      activeEway(r) ? (
        <span className="font-mono text-xs">{activeEway(r)}</span>
      ) : (
        <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
          Not recorded
        </span>
      ),
    csv: (r) => activeEway(r) ?? '',
  },
  {
    key: 'ewbd', label: 'Bill date',
    cell: (r) => (activeEway(r) && r.ewayBillDate ? formatDate(r.ewayBillDate) : '—'),
    csv: (r) => (activeEway(r) && r.ewayBillDate ? formatDate(r.ewayBillDate) : ''),
  },
  {
    // G-5 (gap #266): the portal state, with the portal's own words on a
    // refusal and the reason on a cancellation.
    key: 'ewst',
    label: 'Status',
    cell: (r) => {
      const st = ewayStatusOf(r);
      const detail = st === 'failed' ? r.ewayError : st === 'cancelled' ? r.ewayCancelReason : null;
      return (
        <div className="space-y-0.5">
          <EwayStatusChip status={st} />
          {detail ? <p className="max-w-[18rem] text-[11px] text-muted-foreground">{detail}</p> : null}
          {st === 'failed' && r.ewayAttemptedAt ? (
            <p className="text-[11px] text-muted-foreground">Last attempt {formatDate(r.ewayAttemptedAt)}</p>
          ) : null}
        </div>
      );
    },
    csv: (r) => {
      const st = ewayStatusOf(r);
      const detail = st === 'failed' ? r.ewayError : st === 'cancelled' ? r.ewayCancelReason : null;
      return detail ? `${st}: ${detail}` : st;
    },
  },
  {
    // #266: every cancelled e-way bill of this return, with when and why.
    key: 'ewhist',
    label: 'Cancelled before',
    cell: (r) => {
      const past = pastEway(r);
      return past.length ? (
        <ul className="space-y-0.5">
          {past.map((h) => (
            <li key={h.ewayBillNumber} className="max-w-[18rem] text-[11px] text-muted-foreground">
              <span className="font-mono line-through">{h.ewayBillNumber}</span>
              {h.ewayBillDate ? ` · ${formatDate(h.ewayBillDate)}` : ''}
              {h.cancelledAt ? ` · cancelled ${formatDate(h.cancelledAt)}` : ' · cancelled'}
              {h.reason ? ` — ${h.reason}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        '—'
      );
    },
    csv: (r) =>
      pastEway(r)
        .map((h) =>
          [h.ewayBillNumber, h.ewayBillDate ? formatDate(h.ewayBillDate) : null, h.cancelledAt ? `cancelled ${formatDate(h.cancelledAt)}` : 'cancelled', h.reason]
            .filter(Boolean)
            .join(' '),
        )
        .join('; '),
  },
];

/** The return's live e-way bill number; a cancelled one covers no goods. */
function activeEway(r: EwayRow): string | null {
  return ewayStatusOf(r) === 'cancelled' ? null : r.ewayBillNumber;
}

/** The history, plus the number cancelled last while no new one has replaced it. */
function pastEway(r: EwayRow): NonNullable<EwayRow['ewayHistory']> {
  const past = r.ewayHistory ?? [];
  return ewayStatusOf(r) === 'cancelled' && r.ewayBillNumber
    ? [
        ...past,
        {
          ewayBillNumber: r.ewayBillNumber, ewayBillDate: r.ewayBillDate, validUpto: r.ewayValidUpto ?? null, status: 'cancelled',
          cancelledAt: r.ewayCancelledAt ?? null, reason: r.ewayCancelReason ?? null,
        },
      ]
    : past;
}

function EwayStatusChip({ status }: { status: string }) {
  if (status === 'not_generated') {
    return <StatusChip status="not_sent" />;
  }
  return <StatusChip status={status === 'generated' ? 'registered' : status} label={status === 'generated' ? 'Generated' : undefined} />;
}

/**
 * D-3 — E-way Bill Register.
 *
 * Almost nothing a hospital does moves goods on a public road: a ward transfer
 * and a pharmacy issue stay inside the building, and a patient carries their
 * own medicines out. Stock going BACK to a supplier is the exception, and that
 * is what this lists — against the hospital's own consignment threshold rather
 * than a figure written into the screen.
 */
export function EwayBillView({ q }: { q: Q }) {
  const { data, isLoading } = R.useEwayBills(q);
  const d = useStatDrill();
  if (isLoading) return <Loading />;
  const rows = data?.rows ?? [];
  const s = data?.summary;
  // Gap 282: each count opens the consignments it counts. The API returns
  // only consignments above the threshold, so 'Goods movements' opens those
  // and says how many below it are not listed.
  const below = Math.max(0, (s?.movements ?? 0) - rows.length);
  const ewayDrills: Record<string, ReactNode> = {
    'Goods movements': d.lines('Goods movements', ewayCols, rows, {
      sum: (r) => r.consignmentValue, note: below ? `${below} movement(s) below the threshold are not listed` : undefined,
    }),
    'Above the threshold': d.lines('Above the threshold', ewayCols, rows, { sum: (r) => r.consignmentValue }),
    'With an e-way bill': d.lines('With an e-way bill', ewayCols, rows.filter((r) => !!activeEway(r)), { sum: (r) => r.consignmentValue }),
    'Without one': d.lines('Without one', ewayCols, rows.filter((r) => !activeEway(r)), { sum: (r) => r.consignmentValue }),
  };

  return (
    <div className="space-y-4">
      {data?.applicability ? <Applicability a={data.applicability} /> : null}
      <IntegrationBanner integration={data?.integration} what="E-way bill" />
      <StatStrip
        stats={d.wire([
          { label: 'Goods movements', value: String(s?.movements ?? 0), hint: 'Stock returned to a supplier' },
          {
            label: 'Above the threshold',
            value: String(s?.aboveThreshold ?? 0),
            hint: `Over ${money(data?.threshold)} per consignment`,
          },
          { label: 'With an e-way bill', value: String(s?.withBill ?? 0), tone: 'good' },
          {
            label: 'Without one',
            value: String(s?.missingBill ?? 0),
            tone: (s?.missingBill ?? 0) > 0 ? 'bad' : 'good',
          },
        ], ewayDrills)}
      />
      {d.panel(ewayDrills)}
      <EmptyMeaning note={data?.note ?? ''} bad={(s?.missingBill ?? 0) > 0} />
      <div className="flex justify-end">
        <ExportButton
          onClick={() => exportCsv('D3-eway-bills', ewayCols, rows, { from: q.from, to: q.to })}
          onExcel={() => exportXlsx('D3-eway-bills', ewayCols, rows, { from: q.from, to: q.to })} onPdf={() => exportPdf('D3-eway-bills', ewayCols, rows, { from: q.from, to: q.to })}
          disabled={!rows.length}
        />
      </div>
      <ReportTable
        columns={[
          ...ewayCols,
          { key: 'act', label: '', cell: (r) => <EwayRowAction row={r} integration={data?.integration} /> },
        ]}
        rows={rows}
        empty="No goods movement in this period crossed the consignment threshold."
      />
    </div>
  );
}
