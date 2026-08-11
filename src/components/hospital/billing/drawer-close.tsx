'use client';

// ────────────────────────────────────────────────────────────────────────
// End-of-day cash drawer reconciliation.
//
// Payments here are marked by hand, so the drawer is the one place the system
// meets physical reality: what it believes was collected against what is
// actually in the till. Everything else on the Day End screen is the system
// talking to itself.
//
// ONLY cash is counted. Card, UPI and bank transfers settle to the bank and
// never sit in a drawer — including them would guarantee a variance every day.
// ────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Lock, Unlock, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDate, formatTime24 } from '@/lib/date-utils';
import {
  useDrawerStatus,
  useCloseDrawer,
  useDrawerClosures,
  useReopenDrawer,
} from '@/hooks/use-hospital';

/** Indian currency in circulation, largest first — how a till is counted. */
const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

const fmt = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

export function DrawerClose({ date }: { date: string }) {
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [manualTotal, setManualTotal] = useState<number | null>(null);

  const { data: status, isLoading } = useDrawerStatus(date, openingFloat);
  const { data: closures } = useDrawerClosures(date);
  const closeDrawer = useCloseDrawer();
  const reopenDrawer = useReopenDrawer();

  // Counting by denomination is the norm, but a cashier who has already tallied
  // the till should not be made to re-key it note by note.
  const countedFromNotes = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] ?? 0), 0),
    [counts],
  );
  const countedCash = manualTotal ?? countedFromNotes;

  const expected = status?.expectedCash ?? 0;
  const variance = countedCash - expected;
  const closed = status?.closure ?? null;

  const submit = () => {
    closeDrawer.mutate(
      {
        date,
        openingFloat,
        countedCash,
        denominations: Object.fromEntries(
          DENOMINATIONS.filter((d) => (counts[d] ?? 0) > 0).map((d) => [String(d), counts[d]!]),
        ),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            variance === 0
              ? 'Drawer closed — balanced'
              : `Drawer closed — ${variance > 0 ? 'over' : 'short'} by ${fmt(Math.abs(variance))}`,
          );
          setCounts({});
          setManualTotal(null);
          setNotes('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not close the drawer')),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="font-headline text-sm font-bold">My Cash Drawer</h3>
          <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
            {formatDate(date)}
          </span>
          {closed && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              <Lock className="h-3 w-3" /> Closed
            </span>
          )}
        </div>

        {closed ? (
          <ClosedSummary closure={closed} onReopen={() => reopenDrawer.mutate(closed.id, {
            onSuccess: () => toast.success('Drawer reopened — recount and close again'),
            onError: (e) => toast.error(getApiErrorMessage(e, 'Could not reopen the drawer')),
          })} reopening={reopenDrawer.isPending} />
        ) : (
          <>
            {/* What the system says should be there */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Figure label="Opening float" value={fmt(status?.openingFloat ?? 0)} />
              <Figure label="Cash collected" value={fmt(status?.cashIn ?? 0)} />
              <Figure label="Cash refunded" value={`− ${fmt(status?.cashOut ?? 0)}`} tone="error" />
              <Figure label="Expected in drawer" value={fmt(expected)} strong />
            </div>
            <p className="font-label text-[10px] text-on-surface-variant">
              Cash only — {status?.transactionCount ?? 0} cash transaction
              {(status?.transactionCount ?? 0) === 1 ? '' : 's'}. Card, UPI and bank transfers
              settle to the bank and are not in the drawer.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="float">Opening float</Label>
              <NumberInput
                value={openingFloat}
                onValueChange={(v) => setOpeningFloat(v ?? 0)}
                min={0}
                className="max-w-[180px]"
              />
              <p className="font-label text-[10px] text-on-surface-variant">
                Cash handed over at the start of the shift to make change with.
              </p>
            </div>

            {/* Count the till */}
            <div className="space-y-2">
              <Label>Count the till</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {DENOMINATIONS.map((d) => (
                  <div key={d} className="flex items-center gap-1.5">
                    <span className="font-label text-xs text-on-surface-variant w-9 text-right">
                      ₹{d}
                    </span>
                    <span className="text-on-surface-variant">×</span>
                    <Input
                      type="number"
                      min={0}
                      value={counts[d] ?? ''}
                      placeholder="0"
                      onChange={(e) => {
                        const n = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                        setCounts((c) => ({ ...c, [d]: n }));
                        setManualTotal(null);
                      }}
                      className="h-8 w-16 text-right text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  Counted
                </span>
                <NumberInput
                  value={countedCash}
                  onValueChange={(v) => setManualTotal(v ?? 0)}
                  min={0}
                  className="max-w-[160px]"
                />
                {manualTotal != null && countedFromNotes > 0 && manualTotal !== countedFromNotes && (
                  <span className="font-label text-[10px] text-secondary">
                    overriding the note count of {fmt(countedFromNotes)}
                  </span>
                )}
              </div>
            </div>

            <VarianceBanner expected={expected} counted={countedCash} variance={variance} />

            <div className="space-y-1.5">
              <Label htmlFor="drawer-notes">Notes</Label>
              <Input
                id="drawer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  variance === 0
                    ? 'Optional'
                    : 'Explain the difference — required reading for whoever checks this'
                }
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={submit} disabled={closeDrawer.isPending || countedCash <= 0}>
                {closeDrawer.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-1.5 h-4 w-4" />
                )}
                Close Drawer
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Every drawer closed today — the supervisor's view of the counter. */}
      {(closures?.closures.length ?? 0) > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-container">
            <h4 className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
              Drawers closed today
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  {['Cashier', 'Float', 'Expected', 'Counted', 'Variance', 'Closed'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'px-4 py-2 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest',
                        i === 0 || i === 5 ? 'text-left' : 'text-right',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {closures!.closures.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-2">{c.cashierName}</td>
                    <td className="px-4 py-2 text-right">{fmt(c.openingFloat)}</td>
                    <td className="px-4 py-2 text-right">{fmt(c.expectedCash)}</td>
                    <td className="px-4 py-2 text-right font-bold">{fmt(c.countedCash)}</td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-bold',
                        c.variance === 0 ? 'text-primary' : 'text-error',
                      )}
                    >
                      {c.variance === 0 ? '—' : `${c.variance > 0 ? '+' : '−'}${fmt(Math.abs(c.variance))}`}
                    </td>
                    <td className="px-4 py-2 font-label text-[10px] text-on-surface-variant">
                      {formatTime24(c.closedAt)} · {c.closedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-surface-container font-bold">
                  <td className="px-4 py-2 font-label text-[10px] uppercase tracking-widest">Total</td>
                  <td />
                  <td className="px-4 py-2 text-right">{fmt(closures!.totals.expectedCash)}</td>
                  <td className="px-4 py-2 text-right">{fmt(closures!.totals.countedCash)}</td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right',
                      closures!.totals.variance === 0 ? 'text-primary' : 'text-error',
                    )}
                  >
                    {closures!.totals.variance === 0
                      ? '—'
                      : `${closures!.totals.variance > 0 ? '+' : '−'}${fmt(Math.abs(closures!.totals.variance))}`}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'error';
}) {
  return (
    <div className="rounded-lg bg-surface-container-low px-3 py-2">
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 font-bold',
          strong ? 'text-lg' : 'text-sm',
          tone === 'error' && 'text-error',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function VarianceBanner({
  expected,
  counted,
  variance,
}: {
  expected: number;
  counted: number;
  variance: number;
}) {
  if (counted <= 0) return null;
  const balanced = variance === 0;
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border-l-4 px-3 py-2',
        balanced ? 'border-primary bg-primary/5' : 'border-error bg-error-container/40',
      )}
    >
      {balanced ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
      )}
      <div className="text-sm">
        {balanced ? (
          <p className="font-bold text-primary">Balanced — {fmt(counted)} counted.</p>
        ) : (
          <>
            <p className="font-bold text-error">
              {variance > 0 ? 'Over' : 'Short'} by {fmt(Math.abs(variance))}
            </p>
            <p className="font-label text-[11px] text-on-surface-variant">
              Expected {fmt(expected)}, counted {fmt(counted)}. A difference usually means a
              payment was recorded under the wrong mode, or missed entirely — worth finding before
              you close.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ClosedSummary({
  closure,
  onReopen,
  reopening,
}: {
  closure: NonNullable<import('@/hooks/use-hospital').DrawerStatus['closure']>;
  onReopen: () => void;
  reopening: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Figure label="Opening float" value={fmt(closure.openingFloat)} />
        <Figure label="Expected" value={fmt(closure.expectedCash)} />
        <Figure label="Counted" value={fmt(closure.countedCash)} strong />
        <Figure
          label="Variance"
          value={
            closure.variance === 0
              ? 'Balanced'
              : `${closure.variance > 0 ? '+' : '−'}${fmt(Math.abs(closure.variance))}`
          }
          tone={closure.variance === 0 ? undefined : 'error'}
          strong
        />
      </div>
      {closure.notes && (
        <p className="rounded-md bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          {closure.notes}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="font-label text-[10px] text-on-surface-variant">
          Closed {formatTime24(closure.closedAt)}
          {closure.closedBy ? ` by ${closure.closedBy}` : ''}
        </p>
        {/* Reopening is gated on billing:approve, so a cashier cannot quietly
            redo their own variance — the button 403s for anyone else. */}
        <Button variant="outline" size="sm" onClick={onReopen} disabled={reopening}>
          {reopening ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlock className="mr-1.5 h-3.5 w-3.5" />
          )}
          Reopen for recount
        </Button>
      </div>
    </div>
  );
}
