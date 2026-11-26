'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Archive, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  DrillThrough, Loading, ReportNotes, ReportTable, StatStrip, ExportButton, exportAll, formatReturnPeriod, money, plain,
  type Column,
} from './gst-report-shell';
import type { FiledPeriod, FiledPeriodEvent, GstReportQuery } from '@/hooks/use-gst-reports';
import {
  canAmendFiledPeriod, useFilePeriod, useFiledPeriod, useFiledPeriods, useSetPeriodLock,
} from '@/hooks/use-gst-reports';

// ============================================================
// C-6 — the filed period archive.
//
// Every other report on this screen is LIVE. This one is the opposite, and
// that is its whole purpose: a copy of the figures as they were when the
// return went in, so a bill amended afterwards cannot quietly change the answer
// to "what did you file in September".
//
// Gap 281 — the amendment workflow. Reopening a filed period asks for a
// correction reason and is open only to the amendment roles (admin / billing
// admin); re-filing it stores the corrected figures as a new version and keeps
// the original snapshot; the trail of every reopen and correction is shown.
// ============================================================

const errorText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  (err instanceof Error ? err.message : fallback);

const ACTION_LABEL: Record<string, string> = {
  filed: 'Filed (original)',
  unlocked: 'Reopened for correction',
  refiled: 'Correction filed',
  locked: 'Locked again',
};

/** Gap 281: the trail of one period — snapshots and corrections, oldest first. */
const historyCols: Column<FiledPeriodEvent>[] = [
  { key: 'at', label: 'When', cell: (e) => formatDateTime(e.at), csv: (e) => formatDateTime(e.at) },
  {
    key: 'a',
    label: 'What',
    cell: (e) => (
      <span className={e.action === 'unlocked' ? 'font-medium text-amber-700' : undefined}>
        {ACTION_LABEL[e.action] ?? e.action}
      </span>
    ),
    csv: (e) => ACTION_LABEL[e.action] ?? e.action,
  },
  { key: 'v', label: 'Snapshot', cell: (e) => (e.version ? `v${e.version}` : '—'), csv: (e) => (e.version ? `v${e.version}` : '') },
  { key: 'by', label: 'By', cell: (e) => e.by ?? '—', csv: (e) => e.by ?? '' },
  { key: 'r', label: 'Reason', cell: (e) => <span className="text-xs">{e.reason ?? '—'}</span>, csv: (e) => e.reason ?? '' },
  {
    key: 't',
    label: 'Outward tax',
    align: 'right',
    cell: (e) => (e.figures ? plain(e.figures.outwardTax) : '—'),
    csv: (e) => (e.figures ? e.figures.outwardTax : ''),
  },
  {
    key: 'n',
    label: 'Payable',
    align: 'right',
    cell: (e) => (e.figures ? plain(e.figures.netTaxPayable) : '—'),
    csv: (e) => (e.figures ? e.figures.netTaxPayable : ''),
  },
];

/** MMYYYY of a period's first day — the key the server files it under. */
const returnPeriodOf = (from?: string) => {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(from ?? '');
  return m ? `${m[2]}${m[1]}` : null;
};

export function FiledPeriodsView({ q }: { q: GstReportQuery }) {
  const { data, isLoading } = useFiledPeriods();
  const setLock = useSetPeriodLock();
  const file = useFilePeriod();
  const user = useAuthStore((s) => s.user);
  // The server decides (403 otherwise); this only greys the buttons out.
  const mayAmend = canAmendFiledPeriod(
    [...(user?.roles ?? []), user?.role?.slug, user?.role?.name].filter((r): r is string => !!r),
  );
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [fileReason, setFileReason] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  // Gap 281: the reopen dialog — a reason is required before the request goes.
  const [reopening, setReopening] = useState<FiledPeriod | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  // Gap 282: the headline figures open the periods behind them.
  const [focus, setFocus] = useState<string | null>(null);
  const detail = useFiledPeriod(viewing);

  const periods = data?.periods ?? [];
  // Is the period at the top of the screen already filed? Then this is a
  // correction, and the server will want a reason (gap 281).
  const target = returnPeriodOf(q.from);
  const already = target ? periods.find((p) => p.returnPeriod === target) : undefined;

  const doFile = async () => {
    if (!q.from || !q.to) {
      toast.error('Pick a period at the top of the screen first');
      return;
    }
    if (already && !fileReason.trim()) {
      toast.error('Say what is being corrected and why');
      return;
    }
    try {
      const out = await file.mutateAsync({
        from: q.from, to: q.to, note: note.trim() || null, sixDigit: q.sixDigit,
        reason: already ? fileReason.trim() : null,
      });
      toast.success(
        out?.correction
          ? `${formatReturnPeriod(out?.returnPeriod)} correction saved as version ${out.version} and locked — the original filing is kept`
          : `${formatReturnPeriod(out?.returnPeriod)} filed and locked`,
      );
      setOpen(false);
      setNote('');
      setFileReason('');
    } catch (err) {
      toast.error(errorText(err, 'Could not file the period'));
    }
  };

  const doReopen = () => {
    if (!reopening) return;
    const reason = reopenReason.trim();
    if (!reason) {
      toast.error('A correction reason is required to reopen a filed period');
      return;
    }
    setLock.mutate(
      { id: reopening.id, locked: false, reason },
      {
        onSuccess: () => {
          toast.success(`${formatReturnPeriod(reopening.returnPeriod)} reopened for correction — the reason is on record`);
          setReopening(null);
          setReopenReason('');
        },
        onError: (e: unknown) => toast.error(errorText(e, 'Could not reopen the period')),
      },
    );
  };

  if (isLoading) return <Loading />;

  // Gap 282: the snapshot as filed exports like every other table.
  type SnapshotRow = { k: string; v: string };
  const snapshotCols: Column<SnapshotRow>[] = [
    { key: 'k', label: 'As filed', cell: (r) => r.k },
    { key: 'v', label: 'Amount', align: 'right', cell: (r) => r.v },
  ];
  const snap = detail.data?.snapshot;
  const snapshotRows: SnapshotRow[] = detail.data
    ? [
        { k: 'Outward taxable value', v: plain(snap?.gstr3b?.outwardTaxable?.taxableValue) },
        { k: 'Outward tax', v: plain(snap?.gstr3b?.outwardTaxable?.taxAmount) },
        { k: 'Exempt and nil-rated', v: plain(snap?.gstr3b?.outwardExempt) },
        { k: 'Non-GST', v: plain(snap?.gstr3b?.outwardNonGst) },
        { k: 'Input credit, net of reversal', v: plain(snap?.gstr3b?.inputTaxCredit?.net) },
        { k: 'Net tax payable', v: plain(snap?.gstr3b?.netTaxPayable) },
        { k: 'Exempt ratio (Rule 42 E ÷ F)', v: `${snap?.exemptTurnover?.exemptRatio ?? 0}%` },
      ]
    : [];
  const history = detail.data?.history ?? [];

  // Status as the accountant reads it. Filing locks the period (gap item 281);
  // "Filed – Unlocked" only when somebody re-opened it, or it was filed before
  // filing locked the period.
  const statusOf = (r: FiledPeriod) => (r.lockedAt ? 'Filed – Locked' : 'Filed – Unlocked');
  const exportCols: Column<FiledPeriod>[] = [
    { key: 'p', label: 'Return period', cell: (r) => formatReturnPeriod(r.returnPeriod), csv: (r) => formatReturnPeriod(r.returnPeriod) },
    { key: 'f', label: 'Filed', cell: (r) => formatDateTime(r.filedAt), csv: (r) => formatDateTime(r.filedAt) },
    { key: 'b', label: 'By', cell: (r) => r.filedBy ?? '', csv: (r) => r.filedBy ?? '' },
    { key: 's', label: 'Status', cell: statusOf, csv: statusOf },
    { key: 'ver', label: 'Snapshots', align: 'right', cell: (r) => r.versions ?? 1, csv: (r) => r.versions ?? 1 },
    { key: 'rr', label: 'Last reopen reason', cell: (r) => r.lastReopenReason ?? '', csv: (r) => r.lastReopenReason ?? '' },
    { key: 'v', label: 'Outward taxable value', align: 'right', cell: (r) => r.outwardTaxableValue ?? 0, csv: (r) => r.outwardTaxableValue ?? 0 },
    { key: 't', label: 'Outward tax', align: 'right', cell: (r) => r.outwardTax, csv: (r) => r.outwardTax },
    { key: 'n', label: 'Payable', align: 'right', cell: (r) => r.netTaxPayable, csv: (r) => r.netTaxPayable },
    { key: 'e', label: 'Exempt turnover', align: 'right', cell: (r) => r.exemptTurnover, csv: (r) => r.exemptTurnover },
  ];

  const latest = periods[0];
  const reopened = periods.filter((p) => (p.reopenCount ?? 0) > 0 || !p.lockedAt);
  const drills: Record<string, FiledPeriod[]> = {
    'Periods filed': periods,
    'Reopened / corrected': reopened,
    'Not reconciled when filed': periods.filter((p) => !p.reconciled),
  };
  const drillRows = focus ? drills[focus] ?? [] : [];
  const pick = (label: string) => setFocus(focus === label ? null : label);

  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Periods filed', value: String(periods.length), onClick: () => pick('Periods filed'), active: focus === 'Periods filed' },
          {
            label: 'Latest',
            value: latest ? formatReturnPeriod(latest.returnPeriod) : '—',
            onClick: latest ? () => setViewing(latest.id) : undefined,
            hint: latest ? 'open its snapshot' : undefined,
          },
          {
            label: 'Tax filed, latest',
            value: money(latest?.outwardTax),
            onClick: latest ? () => setViewing(latest.id) : undefined,
          },
          {
            label: 'Reconciled when filed',
            value: latest ? (latest.reconciled ? 'Yes' : 'No') : '—',
            tone: latest ? (latest.reconciled ? 'good' : 'bad') : undefined,
            onClick: latest ? () => setViewing(latest.id) : undefined,
          },
          {
            label: 'Reopened / corrected',
            value: String(reopened.length),
            tone: reopened.length ? 'warn' : 'good',
            hint: 'periods with a reopen, or not locked',
            onClick: () => pick('Reopened / corrected'),
            active: focus === 'Reopened / corrected',
          },
          {
            label: 'Not reconciled when filed',
            value: String(periods.filter((p) => !p.reconciled).length),
            tone: periods.some((p) => !p.reconciled) ? 'bad' : 'good',
            onClick: () => pick('Not reconciled when filed'),
            active: focus === 'Not reconciled when filed',
          },
        ]}
      />
      <DrillThrough
        open={!!focus}
        onClose={() => setFocus(null)}
        title={focus ? `${focus} — the periods behind it` : ''}
        subtitle={`${drillRows.length} period(s) · outward tax as filed ${money(drillRows.reduce((t, p) => t + p.outwardTax, 0))}`}
        columns={exportCols}
        rows={drillRows}
      />

      <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="flex items-start gap-2">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Mark the period shown at the top of the screen as filed. Filing saves one copy of the
            figures and LOCKS the period: no invoice, credit note or voucher can then be dated in it.
            Filing a month again is a correction: reopen it first (with a reason), and the corrected
            figures are kept as a new version — the original filing is never replaced.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          disabled={!q.from || !q.to || (!!already && (!!already.lockedAt || !mayAmend))}
          title={
            already?.lockedAt
              ? 'Already filed and locked — reopen it with a reason to file a correction'
              : already && !mayAmend
                ? 'Only a hospital admin or billing admin can file a correction'
                : undefined
          }
        >
          {already ? `File a correction for ${formatReturnPeriod(already.returnPeriod)}` : `Mark ${q.from ?? ''} → ${q.to ?? ''} as filed`}
        </Button>
      </div>
      <div className="flex justify-end">
        <ExportButton {...exportAll('gst-filed-periods', exportCols, periods, {})} disabled={!periods.length} />
      </div>

      <ReportTable
        columns={[
          { key: 'p', label: 'Return period', cell: (r: FiledPeriod) => formatReturnPeriod(r.returnPeriod) },
          { key: 'r', label: 'Covering', cell: (r) => `${formatDate(r.periodFrom)} – ${formatDate(r.periodTo)}` },
          { key: 'f', label: 'Filed', cell: (r) => formatDateTime(r.filedAt) },
          { key: 'b', label: 'By', cell: (r) => r.filedBy ?? '—' },
          { key: 't', label: 'Outward tax', align: 'right', cell: (r) => plain(r.outwardTax) },
          { key: 'n', label: 'Payable', align: 'right', cell: (r) => plain(r.netTaxPayable) },
          { key: 'e', label: 'Exempt turnover', align: 'right', cell: (r) => plain(r.exemptTurnover) },
          {
            key: 'ok',
            label: 'Tied back',
            cell: (r) => (r.reconciled ? <Badge variant="outline">Yes</Badge> : <Badge variant="destructive">No</Badge>),
          },
          {
            key: 'lock',
            label: 'Period',
            cell: (r) =>
              r.lockedAt ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                  Filed – Locked
                </Badge>
              ) : (
                <span className="text-xs text-red-700" title="Not locked — re-opened, or filed before filing locked the period. Bills in it can be changed.">
                  Filed – Unlocked
                </span>
              ),
          },
          {
            key: 'hist',
            label: 'Corrections',
            cell: (r) =>
              (r.versions ?? 1) > 1 || (r.reopenCount ?? 0) > 0 ? (
                <span className="text-xs" title={r.lastReopenReason ? `Last reopen: ${r.lastReopenReason}` : undefined}>
                  {r.reopenCount ?? 0} reopen(s) · {r.versions ?? 1} snapshot(s)
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Original only</span>
              ),
          },
          {
            key: 'v',
            label: '',
            cell: (r) => (
              <div className="flex items-center justify-end gap-1">
                {/* Locking is what makes section 6.10 real. Reopening is an
                    amendment act (gap 281): reason required, amendment roles
                    only, and it is recorded. */}
                {r.lockedAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setLock.isPending || !mayAmend}
                    title={mayAmend ? 'Reopen for correction — a reason is required' : 'Only a hospital admin or billing admin can reopen a filed period'}
                    onClick={() => {
                      setReopenReason('');
                      setReopening(r);
                    }}
                  >
                    Reopen…
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setLock.isPending}
                    onClick={() =>
                      setLock.mutate(
                        { id: r.id, locked: true },
                        {
                          onSuccess: () =>
                            toast.success(`${formatReturnPeriod(r.returnPeriod)} locked — bills in it can no longer be changed`),
                          onError: (e: unknown) => toast.error(errorText(e, 'Could not lock the period')),
                        },
                      )
                    }
                  >
                    Lock
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setViewing(r.id)}>
                  Open
                </Button>
              </div>
            ),
          },
        ]}
        rows={periods}
        empty="No period has been filed yet. Mark one as filed when its return goes in."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {already ? `File a correction for ${formatReturnPeriod(already.returnPeriod)}` : `Mark ${q.from} → ${q.to} as filed`}
            </DialogTitle>
            <DialogDescription>
              {already
                ? 'This period has been filed before. The figures as they stand now are saved as the next version; the original filed snapshot is kept unchanged, the period is locked again, and the differences show as amendments (A-13) in the next open return.'
                : 'Saves one copy of the return figures as they stand now and locks the period: no invoice, credit note or voucher dated inside it can be created or changed afterwards. Corrections go in the current month as a credit note. Only a period that has ended can be filed.'}
            </DialogDescription>
          </DialogHeader>
          {already ? (
            <div className="space-y-1">
              <Label htmlFor="file-reason">Correction reason (required)</Label>
              <Textarea
                id="file-reason"
                value={fileReason}
                onChange={(e) => setFileReason(e.target.value)}
                maxLength={1000}
                placeholder="What was corrected and why — e.g. room rent on IP/123 billed at 12% instead of 5%"
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Filed on the portal, ARN …"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={doFile} disabled={file.isPending || (!!already && !fileReason.trim())}>
              {file.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {already ? 'Save correction and lock' : 'File and lock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gap 281: the reason dialog on unlock. */}
      <Dialog open={!!reopening} onOpenChange={(v) => !v && setReopening(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reopen {formatReturnPeriod(reopening?.returnPeriod)} for correction</DialogTitle>
            <DialogDescription>
              Bills dated in this period become editable again until it is locked. The original filed
              snapshot is kept; anything changed shows as an amendment in the next open return. Your
              name, the time and this reason are recorded in the period&apos;s history and the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="reopen-reason">Correction reason (required)</Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              maxLength={1000}
              placeholder="What has to be corrected and why"
              aria-invalid={!reopenReason.trim()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopening(null)}>Cancel</Button>
            <Button onClick={doReopen} disabled={setLock.isPending || !reopenReason.trim() || !mayAmend}>
              {setLock.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Reopen period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Filed period {formatReturnPeriod(detail.data?.returnPeriod)}
            </DialogTitle>
            <DialogDescription>
              {detail.data
                ? `Filed ${formatDateTime(detail.data.filedAt)}${detail.data.filedBy ? ` by ${detail.data.filedBy}` : ''}${
                    (detail.data.versions ?? 1) > 1 ? ` · ${detail.data.versions} snapshots (original kept)` : ''
                  }`
                : 'Loading…'}
            </DialogDescription>
          </DialogHeader>
          {detail.isLoading ? (
            <Loading />
          ) : detail.data ? (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              {/* The comparison is the point: if the live figure has moved, a
                  bill in a filed month was touched after the return went in. */}
              <div
                className={`rounded-md border p-3 text-sm ${
                  detail.data.drift.moved
                    ? 'border-red-300 bg-red-50 text-red-900'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                }`}
              >
                <p className="font-medium">
                  {detail.data.drift.moved
                    ? 'This month has moved since it was filed'
                    : 'This month still matches what was filed'}
                </p>
                <p className="text-xs">
                  Outward tax as filed {money(detail.data.drift.outwardTaxAsFiled)} · today{' '}
                  {money(detail.data.drift.outwardTaxNow)}
                  {detail.data.drift.moved
                    ? ` · difference ${money(detail.data.drift.difference)}`
                    : ''}
                </p>
              </div>
              <div className="flex justify-end">
                <ExportButton
                  {...exportAll(`gst-filed-period-${detail.data.returnPeriod ?? 'snapshot'}`, snapshotCols, snapshotRows, {})}
                  disabled={!snapshotRows.length}
                />
              </div>
              <ReportTable columns={snapshotCols} rows={snapshotRows} />
              {/* Gap 281: every snapshot and every reopen / correction. */}
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <History className="h-4 w-4" /> Snapshots and corrections
                  </h3>
                  <ExportButton
                    {...exportAll(`gst-filed-period-${detail.data.returnPeriod ?? 'history'}-history`, historyCols, history, {})}
                    disabled={!history.length}
                  />
                </div>
                <ReportTable columns={historyCols} rows={history} empty="Only the original filing." />
              </section>
              {detail.data.note ? (
                <p className="text-xs text-muted-foreground">Note: {detail.data.note}</p>
              ) : null}
              <ReportNotes notes={detail.data.notes ?? []} />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
