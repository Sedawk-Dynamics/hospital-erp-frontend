'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Archive, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { Loading, ReportNotes, ReportTable, StatStrip, money, plain } from './gst-report-shell';
import type { GstReportQuery } from '@/hooks/use-gst-reports';
import {
  useFilePeriod, useFiledPeriod, useFiledPeriods, useSetPeriodLock,
} from '@/hooks/use-gst-reports';

// ============================================================
// C-6 — the filed period archive.
//
// Every other report on this screen is LIVE. This one is the opposite, and
// that is its whole purpose: a copy of the figures as they were when the
// return went in, so a bill amended afterwards cannot quietly change the answer
// to "what did you file in September".
// ============================================================

export function FiledPeriodsView({ q }: { q: GstReportQuery }) {
  const { data, isLoading } = useFiledPeriods();
  const setLock = useSetPeriodLock();
  const file = useFilePeriod();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  const detail = useFiledPeriod(viewing);

  const periods = data?.periods ?? [];

  const doFile = async () => {
    if (!q.from || !q.to) {
      toast.error('Pick a period at the top of the screen first');
      return;
    }
    try {
      const out = await file.mutateAsync({ from: q.from, to: q.to, note: note.trim() || null, sixDigit: q.sixDigit });
      toast.success(`Period ${out?.returnPeriod} archived as filed`);
      setOpen(false);
      setNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not archive the period');
    }
  };

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <StatStrip
        stats={[
          { label: 'Periods filed', value: String(periods.length) },
          { label: 'Latest', value: periods[0]?.returnPeriod ?? '—' },
          { label: 'Tax filed, latest', value: money(periods[0]?.outwardTax) },
          {
            label: 'Reconciled when filed',
            value: periods[0] ? (periods[0].reconciled ? 'Yes' : 'No') : '—',
            tone: periods[0] ? (periods[0].reconciled ? 'good' : 'bad') : undefined,
          },
        ]}
      />

      <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="flex items-start gap-2">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Archive the period shown at the top of the screen. Filing the same month again
            replaces the copy — there is only one answer to what was filed.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!q.from || !q.to}>
          Archive {q.from ?? ''} → {q.to ?? ''}
        </Button>
      </div>

      <ReportTable
        columns={[
          { key: 'p', label: 'Return period', cell: (r: (typeof periods)[number]) => r.returnPeriod },
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
                  Locked
                </Badge>
              ) : (
                <span className="text-xs text-on-surface-variant">Open</span>
              ),
          },
          {
            key: 'v',
            label: '',
            cell: (r) => (
              <div className="flex items-center justify-end gap-1">
                {/* Locking is what makes section 6.10 real: every bill dated
                    inside the period becomes read-only and a correction has to
                    go through a credit note in the current period. Filing on
                    its own only archives the figures, so this is deliberately a
                    second, separate action. */}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={setLock.isPending}
                  onClick={() =>
                    setLock.mutate(
                      { id: r.id, locked: !r.lockedAt },
                      {
                        onSuccess: () =>
                          toast.success(
                            r.lockedAt
                              ? `Period ${r.returnPeriod} reopened`
                              : `Period ${r.returnPeriod} locked — bills in it can no longer be changed`,
                          ),
                        onError: (e: unknown) => toast.error((e as Error)?.message || 'Could not change the lock'),
                      },
                    )
                  }
                >
                  {r.lockedAt ? 'Reopen' : 'Lock'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setViewing(r.id)}>
                  Open
                </Button>
              </div>
            ),
          },
        ]}
        rows={periods}
        empty="No period has been archived yet. Archive one when its return goes in."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive {q.from} → {q.to} as filed</DialogTitle>
            <DialogDescription>
              Takes a copy of the return figures as they stand now. It does not lock the
              period — bills in it can still be edited, which is exactly why the copy matters.
            </DialogDescription>
          </DialogHeader>
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
            <Button onClick={doFile} disabled={file.isPending}>
              {file.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Filed period {detail.data?.returnPeriod ?? ''}
            </DialogTitle>
            <DialogDescription>
              {detail.data
                ? `Filed ${formatDateTime(detail.data.filedAt)}${detail.data.filedBy ? ` by ${detail.data.filedBy}` : ''}`
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
              <ReportTable
                columns={[
                  { key: 'k', label: 'As filed', cell: (r: { k: string; v: string }) => r.k },
                  { key: 'v', label: 'Amount', align: 'right', cell: (r) => r.v },
                ]}
                rows={[
                  { k: 'Outward taxable value', v: plain(detail.data.snapshot?.gstr3b?.outwardTaxable?.taxableValue) },
                  { k: 'Outward tax', v: plain(detail.data.snapshot?.gstr3b?.outwardTaxable?.taxAmount) },
                  { k: 'Exempt and nil-rated', v: plain(detail.data.snapshot?.gstr3b?.outwardExempt) },
                  { k: 'Non-GST', v: plain(detail.data.snapshot?.gstr3b?.outwardNonGst) },
                  { k: 'Input credit, net of reversal', v: plain(detail.data.snapshot?.gstr3b?.inputTaxCredit?.net) },
                  { k: 'Net tax payable', v: plain(detail.data.snapshot?.gstr3b?.netTaxPayable) },
                  { k: 'Exempt ratio (Rule 42 E ÷ F)', v: `${detail.data.snapshot?.exemptTurnover?.exemptRatio ?? 0}%` },
                ]}
              />
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
