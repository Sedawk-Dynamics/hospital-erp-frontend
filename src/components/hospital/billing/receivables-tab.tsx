'use client';

// ────────────────────────────────────────────────────────────────────────
// Receivables — who owes the hospital money, grouped by who pays.
//
// The Pending List already answers "which BILLS are unpaid". It cannot answer
// "how much does Company X owe us", which is the question someone chasing
// payment actually has — one insurer or employer covers many patients, and the
// chase is one phone call, not fifteen.
//
// Lives as a tab here rather than as its own sidebar page: the standalone
// Credit Settlement page was removed in July when its IP work moved into
// Hospital Billing → IP Patients, and that consolidation stands. This is the
// payer-wise collections view that never existed anywhere, wired to the
// endpoints that were left behind.
// ────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  Building2, ShieldCheck, User, Loader2, Search, ChevronRight, Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useCreditSettlementList,
  useCreditSettlementBills,
  useSettleCredit,
  useReceivableLines,
  type CreditSettlementRow,
  type ReceivableFigure,
} from '@/hooks/use-hospital';
import { fullName } from '@/lib/person-name';
import { formatINR } from '@/lib/money';

const fmt = (n: number) => formatINR(n);

const TYPES = [
  { key: 'all', label: 'All payers', icon: Building2 },
  { key: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'corporate', label: 'Corporate / TPA', icon: Building2 },
  { key: 'patient', label: 'Self-pay', icon: User },
] as const;

type PayerType = (typeof TYPES)[number]['key'];

/** Age buckets read as risk, so colour them like it. */
function ageTone(days: number): string {
  if (days <= 30) return 'bg-primary/10 text-primary';
  if (days <= 60) return 'bg-secondary/10 text-secondary';
  if (days <= 90) return 'bg-tertiary/10 text-tertiary';
  return 'bg-error-container text-on-error-container';
}

/**
 * Gap 287: what each headline means. The approved / awaiting definitions are
 * Insurance's own, so "Approved receivable" here is Insurance → Outstanding.
 */
const FIGURES: Record<ReceivableFigure, { label: string; hint: string }> = {
  billed: { label: 'Billed to credit', hint: 'Bill total after concessions, for every open bill share still owed by someone.' },
  received: { label: 'Received', hint: 'Money actually received against those shares (patient and insurer, net of refunds).' },
  adjusted: { label: 'Advance adjusted', hint: 'Deposits / advances moved onto the bills.' },
  disallowed: { label: 'Disallowed', hint: 'What the payer refused at settlement.' },
  writtenOff: { label: 'Written off', hint: 'Approved claim write-offs.' },
  outstanding: { label: 'Outstanding', hint: 'Billed − received − adjusted − disallowed − written off. Patient share + payer share.' },
  patientOutstanding: { label: 'Patient share outstanding', hint: 'What patients still owe on their own share of open bills.' },
  approvedReceivable: {
    label: 'Approved receivable',
    hint: 'Payer has approved the claim (in full or in part) and not yet paid: approved − received − write-offs per claim. The same definition and figure as Insurance → Outstanding.',
  },
  awaitingDecision: {
    label: 'Awaiting payer decision',
    hint: 'Claimed amount of claims still with the payer (submitted, under review, query raised or response sent). Not yet a receivable — Insurance → Outstanding leaves it out.',
  },
  otherPayer: {
    label: 'Other payer balance',
    hint: 'Payer share on open bills not explained by an approved or pending claim (e.g. a settled claim with a balance left on the bill, or a claim figure that differs from the bill share).',
  },
};

type Drill = { figure: ReceivableFigure; title: string } | null;

/** A figure in the reconciliation line that opens the bills behind it (gap 287). */
function Fig({ f, value, onOpen }: { f: ReceivableFigure; value?: number; onOpen: (f: ReceivableFigure) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(f)}
      title={FIGURES[f].hint}
      className="font-semibold text-on-surface underline decoration-dotted underline-offset-2 hover:text-primary"
    >
      {fmt(value ?? 0)}
    </button>
  );
}

export function ReceivablesTab() {
  const [type, setType] = useState<PayerType>('all');
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<CreditSettlementRow | null>(null);
  const [figure, setFigure] = useState<Drill>(null);

  const filters = {
    ...(type === 'all' ? {} : { type }),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const { data, isLoading } = useCreditSettlementList({ ...filters, limit: 100 });

  const rows = data?.settlements ?? [];
  const stats = data?.stats;
  const open = (f: ReceivableFigure) => setFigure({ figure: f, title: FIGURES[f].label });
  const otherPayer = stats?.totalOtherPayer ?? 0;
  const approvedVsInsurance =
    stats?.insuranceOutstanding != null && stats?.totalApprovedReceivable != null
      ? Math.round((stats.insuranceOutstanding - stats.totalApprovedReceivable) * 100) / 100
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Payers" value={String(stats?.totalProviders ?? 0)} />
        <Stat label={FIGURES.billed.label} hint={FIGURES.billed.hint} value={fmt(stats?.totalClaim ?? 0)} onClick={() => open('billed')} />
        <Stat label={FIGURES.received.label} hint={FIGURES.received.hint} value={fmt(stats?.totalReceived ?? 0)} tone="ok" onClick={() => open('received')} />
        <Stat label={FIGURES.outstanding.label} hint={FIGURES.outstanding.hint} value={fmt(stats?.totalOutstanding ?? 0)} tone="error" strong onClick={() => open('outstanding')} />
      </div>

      {/* Gap 287: the outstanding split by who owes it and where the claim
          stands. "Approved receivable" uses Insurance's definition, so it is
          the figure Insurance → Outstanding shows; "Awaiting decision" is kept
          apart because the payer has not agreed to pay it yet. */}
      <div className={cn('grid grid-cols-1 gap-3', otherPayer !== 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
        <Stat
          label={FIGURES.patientOutstanding.label}
          hint={FIGURES.patientOutstanding.hint}
          value={fmt(stats?.totalPatientOutstanding ?? 0)}
          onClick={() => open('patientOutstanding')}
        />
        <Stat
          label={FIGURES.approvedReceivable.label}
          hint={FIGURES.approvedReceivable.hint}
          value={fmt(stats?.totalApprovedReceivable ?? 0)}
          tone="error"
          sub="Payer approved, not yet paid"
          onClick={() => open('approvedReceivable')}
        />
        <Stat
          label={FIGURES.awaitingDecision.label}
          hint={FIGURES.awaitingDecision.hint}
          value={fmt(stats?.totalAwaitingDecision ?? 0)}
          tone="warn"
          sub="Claimed, payer yet to decide"
          onClick={() => open('awaitingDecision')}
        />
        {otherPayer !== 0 && (
          <Stat
            label={FIGURES.otherPayer.label}
            hint={FIGURES.otherPayer.hint}
            value={fmt(otherPayer)}
            onClick={() => open('otherPayer')}
          />
        )}
      </div>

      {/* Every figure has one definition on the server, so the totals tie out
          to the rupee and the lines below show how (gap item 287). Each amount
          opens the bills behind it. Cancelled bills are not receivables and
          sit outside it. */}
      {stats && (
        <div className="space-y-1 rounded-lg border border-surface-container bg-surface-container-low px-3 py-2 font-label text-[11px] text-on-surface-variant">
          <p>
            Billed <Fig f="billed" value={stats.totalClaim} onOpen={open} /> − received <Fig f="received" value={stats.totalReceived} onOpen={open} />{' '}
            − advance adjusted <Fig f="adjusted" value={stats.totalAdjusted} onOpen={open} /> − disallowed{' '}
            <Fig f="disallowed" value={stats.totalDisallowed} onOpen={open} /> − written off <Fig f="writtenOff" value={stats.totalWrittenOff} onOpen={open} /> ={' '}
            <strong className="text-on-surface">
              outstanding <Fig f="outstanding" value={stats.totalOutstanding} onOpen={open} />
            </strong>
            {Math.abs(stats.reconciliationDifference ?? 0) >= 0.01 && (
              <span className="ml-1 text-error">(difference {fmt(stats.reconciliationDifference ?? 0)})</span>
            )}
          </p>
          <p>
            Outstanding = patient share <Fig f="patientOutstanding" value={stats.totalPatientOutstanding} onOpen={open} /> + approved
            receivable <Fig f="approvedReceivable" value={stats.totalApprovedReceivable} onOpen={open} /> + awaiting payer decision{' '}
            <Fig f="awaitingDecision" value={stats.totalAwaitingDecision} onOpen={open} />
            {otherPayer !== 0 && (
              <>
                {' '}+ other payer balance <Fig f="otherPayer" value={otherPayer} onOpen={open} />
              </>
            )}
            {Math.abs(stats.payerReconciliationDifference ?? 0) >= 0.01 && (
              <span className="ml-1 text-error">(difference {fmt(stats.payerReconciliationDifference ?? 0)})</span>
            )}
          </p>
          {approvedVsInsurance != null && type !== 'patient' && (
            <p>
              {Math.abs(approvedVsInsurance) < 0.01 ? (
                <>Approved receivable matches Insurance → Outstanding ({fmt(stats.insuranceOutstanding ?? 0)}).</>
              ) : (
                <>
                  Insurance → Outstanding is {fmt(stats.insuranceOutstanding ?? 0)} across all live claims; the{' '}
                  {fmt(approvedVsInsurance)} difference is on claims outside this view
                  {type !== 'all' || search.trim() ? ' (payer filter or search applied)' : ' (their bill is no longer open)'}.
                </>
              )}
            </p>
          )}
          {(stats.cancelledCount ?? 0) > 0 && (
            <p>
              Excluded: {stats.cancelledCount} cancelled bill{stats.cancelledCount === 1 ? '' : 's'} ({fmt(stats.totalCancelled ?? 0)}).
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors',
              type === t.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container',
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder="Search payer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                {[
                  { h: 'Payer' },
                  { h: 'Type' },
                  { h: 'Bills', right: true },
                  { h: 'Billed', right: true, hint: FIGURES.billed.hint },
                  { h: 'Received', right: true, hint: FIGURES.received.hint },
                  { h: 'Outstanding', right: true, hint: FIGURES.outstanding.hint },
                  { h: 'Approved receivable', right: true, hint: FIGURES.approvedReceivable.hint },
                  { h: 'Awaiting decision', right: true, hint: FIGURES.awaitingDecision.hint },
                  { h: 'Oldest' },
                  { h: '' },
                ].map((c, i) => (
                  <th
                    key={c.h || i}
                    title={c.hint}
                    className={cn(
                      'px-4 pb-4 pt-5 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest',
                      c.right ? 'text-right' : 'text-left',
                    )}
                  >
                    {c.h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center font-label text-on-surface-variant">
                    Nothing outstanding{type === 'all' ? '' : ` from ${type} payers`} — everything
                    billed has been collected.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isPayer = r.providerType !== 'patient';
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setDrill(r)}
                      className="group cursor-pointer hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.providerName}</div>
                        {r.providerContact && (
                          <div className="font-label text-[10px] text-on-surface-variant">
                            {r.providerContact}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant capitalize">
                          {r.providerType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{r.totalAdmissions}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.claimAmount)}</td>
                      <td className="px-4 py-3 text-right text-primary">{fmt(r.receivedAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-error">
                        {fmt(r.outstandingAmount)}
                        {isPayer && Math.abs(r.otherPayerAmount ?? 0) >= 0.01 && (
                          <div className="font-label text-[10px] font-normal text-on-surface-variant" title={FIGURES.otherPayer.hint}>
                            incl. {fmt(r.otherPayerAmount ?? 0)} other payer balance
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPayer ? fmt(r.approvedReceivableAmount ?? 0) : <span className="text-on-surface-variant">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant">
                        {isPayer ? fmt(r.awaitingDecisionAmount ?? 0) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 font-label text-[10px]',
                            ageTone(r.ageDays),
                          )}
                        >
                          {r.ageDays}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PayerBillsDialog payer={drill} onClose={() => setDrill(null)} />
      <FigureBillsDialog drill={figure} filters={filters} onClose={() => setFigure(null)} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  strong,
  hint,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'error' | 'warn';
  strong?: boolean;
  hint?: string;
  sub?: string;
  /** Opens the bills behind the figure (gap 287). */
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
        {hint && <Info className="h-3 w-3" aria-label={hint} />}
      </p>
      <p
        className={cn(
          'mt-1 font-bold',
          strong ? 'text-xl' : 'text-lg',
          tone === 'error' && 'text-error',
          tone === 'ok' && 'text-primary',
          tone === 'warn' && 'text-tertiary',
          onClick && 'underline decoration-dotted underline-offset-4',
        )}
      >
        {value}
      </p>
      {sub && <p className="font-label text-[10px] text-on-surface-variant">{sub}</p>}
    </>
  );
  const cls = cn(
    'bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 text-left',
    tone === 'error' ? 'border-error' : tone === 'ok' ? 'border-primary' : tone === 'warn' ? 'border-tertiary' : 'border-outline',
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={hint} className={cn(cls, 'transition-shadow hover:shadow-md')}>
      {body}
    </button>
  ) : (
    <div className={cls} title={hint}>
      {body}
    </div>
  );
}

/**
 * Gap 287: the bills behind one headline figure, fetched with the same payer
 * type and search as the list — so the dialog's total is the headline.
 */
function FigureBillsDialog({
  drill,
  filters,
  onClose,
}: {
  drill: Drill;
  filters: { type?: 'insurance' | 'corporate' | 'patient'; search?: string };
  onClose: () => void;
}) {
  const { data, isLoading } = useReceivableLines(drill?.figure ?? null, filters);
  const lines = data?.lines ?? [];

  return (
    <Dialog open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{drill?.title}</DialogTitle>
          <DialogDescription>
            {drill ? FIGURES[drill.figure].hint : ''}
            {data ? ` ${data.count} bill share${data.count === 1 ? '' : 's'} · total ${fmt(data.total)}.` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-on-surface-variant">No bills behind this figure.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {['Bill #', 'Patient', 'Owed by', 'Claim', 'Amount', 'Age'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground',
                        i === 4 ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={`${l.billId}:${l.providerKey}`} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      {l.billNumber}
                      <div className="font-sans text-[10px] text-muted-foreground">{formatDate(l.billDate)}</div>
                    </td>
                    <td className="px-3 py-2">
                      {l.patient ? fullName(l.patient) : '—'}
                      {l.patient?.mrn && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{l.patient.mrn}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.providerName}
                      <div className="text-[10px] capitalize text-muted-foreground">{l.providerType}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {l.claimNumber ?? (l.providerType === 'patient' ? '—' : 'No claim no.')}
                      {l.claimStatus && (
                        <div className="text-[10px] capitalize text-muted-foreground">{l.claimStatus.replace(/_/g, ' ')}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(l.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px]', ageTone(l.ageDays))}>{l.ageDays}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-bold">
                  <td className="px-3 py-2" colSpan={4}>Total</td>
                  <td className="px-3 py-2 text-right">{fmt(data?.total ?? 0)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The bills behind one payer's outstanding figure — what the chase is about. */
function PayerBillsDialog({
  payer,
  onClose,
}: {
  payer: CreditSettlementRow | null;
  onClose: () => void;
}) {
  const { data: bills, isLoading } = useCreditSettlementBills(payer?.id ?? null);

  return (
    <Dialog open={!!payer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payer?.providerName}</DialogTitle>
          <DialogDescription>
            {payer ? `${fmt(payer.outstandingAmount)} outstanding across ${payer.totalAdmissions} bill${payer.totalAdmissions === 1 ? '' : 's'}` : ''}
            {/* Gap 287: the same approved / awaiting split as the list. */}
            {payer && payer.providerType !== 'patient'
              ? ` — ${fmt(payer.approvedReceivableAmount ?? 0)} approved receivable, ${fmt(payer.awaitingDecisionAmount ?? 0)} awaiting payer decision${
                  Math.abs(payer.otherPayerAmount ?? 0) >= 0.01 ? `, ${fmt(payer.otherPayerAmount ?? 0)} other` : ''
                }`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (bills?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-on-surface-variant">
            No open bills for this payer.
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {['Bill #', 'Patient', 'Total', 'Paid', 'Balance', 'Age'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground',
                        i >= 2 && i <= 4 ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills!.map((b) => (
                  <tr key={b.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{b.billNumber}</td>
                    <td className="px-3 py-2">
                      {b.patient ? fullName(b.patient) : '—'}
                      {b.patient?.mrn && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {b.patient.mrn}
                        </span>
                      )}
                      <div className="text-[10px] text-muted-foreground">
                        {formatDate(b.createdAt)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(b.totalAmount)}</td>
                    <td className="px-3 py-2 text-right text-primary">{fmt(b.amountPaid)}</td>
                    <td className="px-3 py-2 text-right font-bold text-error">
                      {/* A payer is chasing everything still unpaid on the bill;
                          a self-pay row only the patient's share (gap 287). */}
                      {fmt(
                        payer?.providerType === 'patient'
                          ? (b.balanceBreakdown?.balance ?? b.balanceDue)
                          : (b.balanceBreakdown?.totalOutstanding ?? b.balanceDue),
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px]', ageTone(b.ageDays))}>
                        {b.ageDays}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {payer && (payer.outstandingAmount ?? 0) > 0 && (
          <RecordSettlement payer={payer} onDone={onClose} />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Record what a payer has actually paid.
 *
 * The money is applied to that payer's oldest open bills first, which is how a
 * remittance against a statement is normally allocated — and, since the backend
 * now scopes by payer, only ever to bills that are genuinely theirs.
 */
function RecordSettlement({
  payer,
  onDone,
}: {
  payer: CreditSettlementRow;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');
  const settle = useSettleCredit();

  const tooMuch = amount > payer.outstandingAmount;

  const submit = () => {
    settle.mutate(
      { id: payer.id, data: { amount, method, notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success(`${fmt(amount)} settled against ${payer.providerName}`);
          onDone();
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not record the settlement')),
      },
    );
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="font-label text-[10px] uppercase tracking-widest text-muted-foreground">
        Record a settlement
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="settle-amount" className="text-xs">Amount received</Label>
          <NumberInput
            value={amount}
            onValueChange={(v) => setAmount(v ?? 0)}
            min={0}
            max={payer.outstandingAmount}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="settle-method" className="text-xs">Mode</Label>
          <select
            id="settle-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label htmlFor="settle-notes" className="text-xs">Reference / notes</Label>
          <Input
            id="settle-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="UTR, cheque no…"
          />
        </div>
        <Button onClick={submit} disabled={settle.isPending || amount <= 0 || tooMuch}>
          {settle.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Settle
        </Button>
      </div>
      {tooMuch && (
        <p className="text-xs text-error">
          {payer.providerName} owes {fmt(payer.outstandingAmount)} — a larger amount would land on
          bills that are not theirs.
        </p>
      )}
      <p className="font-label text-[10px] text-muted-foreground">
        Applied to this payer&apos;s oldest open bills first. Each bill settled gets its own
        receipt.
      </p>
    </div>
  );
}
