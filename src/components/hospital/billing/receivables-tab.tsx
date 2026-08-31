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
  Building2, ShieldCheck, User, Loader2, Search, ChevronRight,
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
  type CreditSettlementRow,
} from '@/hooks/use-hospital';
import { fullName } from '@/lib/person-name';

const fmt = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

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

export function ReceivablesTab() {
  const [type, setType] = useState<PayerType>('all');
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<CreditSettlementRow | null>(null);

  const { data, isLoading } = useCreditSettlementList({
    ...(type === 'all' ? {} : { type }),
    ...(search.trim() ? { search: search.trim() } : {}),
    limit: 100,
  });

  const rows = data?.settlements ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Payers" value={String(stats?.totalProviders ?? 0)} />
        <Stat label="Billed to credit" value={fmt(stats?.totalClaim ?? 0)} />
        <Stat label="Received" value={fmt(stats?.totalReceived ?? 0)} tone="ok" />
        <Stat label="Outstanding" value={fmt(stats?.totalOutstanding ?? 0)} tone="error" strong />
      </div>

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
                {['Payer', 'Type', 'Bills', 'Billed', 'Received', 'Outstanding', 'Oldest', ''].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      className={cn(
                        'px-4 pb-4 pt-5 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest',
                        i >= 2 && i <= 5 ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center font-label text-on-surface-variant">
                    Nothing outstanding{type === 'all' ? '' : ` from ${type} payers`} — everything
                    billed has been collected.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PayerBillsDialog payer={drill} onClose={() => setDrill(null)} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'error';
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4',
        tone === 'error' ? 'border-error' : tone === 'ok' ? 'border-primary' : 'border-outline',
      )}
    >
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-bold',
          strong ? 'text-xl' : 'text-lg',
          tone === 'error' && 'text-error',
          tone === 'ok' && 'text-primary',
        )}
      >
        {value}
      </p>
    </div>
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
                      {fmt(b.balanceDue)}
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
