'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import {
  BookOpenText, RefreshCw, ArrowDownToLine, ArrowUpFromLine, Undo2, Boxes,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { formatDateTimeAmPm, toInputDateStr } from '@/lib/date-utils';
import { useStockLedger, type StockLedgerMovement } from '@/hooks/use-pharmacy';

// 349: every movement the log records — sales and transfers included.
const MOVEMENT_LABEL: Record<StockLedgerMovement, string> = {
  receipt: 'Stock In',
  sale: 'Counter Sale',
  sale_cancel: 'Sale Cancelled',
  dispense: 'Dispense',
  patient_return: 'Patient Return',
  counter_return: 'Counter Return',
  vendor_return: 'Vendor Return',
  adjustment: 'Adjustment',
  transfer_out: 'Transfer Out',
  transfer_in: 'Transfer In',
  ward_issue: 'Ward Issue',
  ward_return: 'Ward Return',
  indent_issue: 'IP Indent Issue',
  indent_return: 'IP Return to Stock',
  ot_issue: 'OT Kit Issue',
  ot_return: 'OT Kit Return',
  hold: 'Pre-pack Hold',
  hold_release: 'Hold Released',
  ndps: 'NDPS Consumption',
};

const IN_BADGE = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
const OUT_BADGE = 'bg-blue-500/10 text-blue-700 border-blue-500/20';
const RETURN_BADGE = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
const OTHER_BADGE = 'bg-purple-500/10 text-purple-700 border-purple-500/20';

const MOVEMENT_BADGE: Record<StockLedgerMovement, string> = {
  receipt: IN_BADGE,
  transfer_in: IN_BADGE,
  sale: OUT_BADGE,
  dispense: OUT_BADGE,
  transfer_out: OUT_BADGE,
  ward_issue: OUT_BADGE,
  indent_issue: OUT_BADGE,
  ot_issue: OUT_BADGE,
  ndps: OUT_BADGE,
  hold: OUT_BADGE,
  sale_cancel: RETURN_BADGE,
  patient_return: RETURN_BADGE,
  counter_return: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
  ward_return: RETURN_BADGE,
  indent_return: RETURN_BADGE,
  ot_return: RETURN_BADGE,
  hold_release: RETURN_BADGE,
  vendor_return: OTHER_BADGE,
  adjustment: OTHER_BADGE,
};

function StockLedgerPageInner() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return toInputDateStr(d);
  });
  const [to, setTo] = useState(() => toInputDateStr());
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useStockLedger({
    fromDate: from || undefined,
    toDate: to || undefined,
    page,
    limit: 50,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const showBalance = !!data?.entries.some((e) => e.balance != null);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-primary" />
            Stock Ledger
          </h1>
          <p className="text-xs text-muted-foreground">
            Batch-wise movement register — every receipt, sale, transfer, return and adjustment in the period.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium">From</label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <div>
          <label className="text-xs font-medium">To</label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Opening stock" value={data?.summary.openingStock ?? '—'} icon={Boxes} tone="teal" />
        <StatTile label="Received (in period)" value={data?.summary.totalReceived ?? '—'} icon={ArrowDownToLine} tone="emerald" />
        <StatTile label="Dispensed / sold" value={data?.summary.totalDispensed ?? '—'} icon={ArrowUpFromLine} tone="blue" />
        <StatTile label="Returned (restocked)" value={data?.summary.totalReturned ?? '—'} icon={Undo2} tone="amber" />
        <StatTile label="Closing stock" value={data?.summary.closingStock ?? '—'} icon={Boxes} tone="teal" />
      </div>

      {/* 349: the closing is anchored on live stock; say so, and say when part of
          the period predates the movement log. */}
      {data && (
        <p className="text-xs text-muted-foreground">
          Opening + in − out = closing. Totals above count single units (tablets, bottles…) across all items; each
          row below names its own unit. Live stock now: {data.summary.liveStock} unit(s)
          {data.summary.expiredOnHand > 0 ? ` (${data.summary.expiredOnHand} expired, not yet written off)` : ''}.
          {data.summary.reconstructedBefore && (
            <> Movements before {formatDateTimeAmPm(data.summary.reconstructedBefore)} are rebuilt from bills, receipts and
              returns; transfers and adjustments from that time are not itemised and sit in the opening balance.</>
          )}
        </p>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={BookOpenText}
            title="No stock movements"
            description="Receipts, sales, transfers, returns and adjustments in the selected period will appear here."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead>Drug</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  {showBalance && <TableHead className="text-right">Balance</TableHead>}
                  <TableHead>Party</TableHead>
                  {/* Gap 347: who sold / dispensed / received each movement. */}
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e.id ?? `${e.movementType}-${e.referenceId}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTimeAmPm(e.date)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', MOVEMENT_BADGE[e.movementType] ?? OTHER_BADGE)}>
                        {MOVEMENT_LABEL[e.movementType] ?? e.movementType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{e.drugName}</TableCell>
                    <TableCell className="font-mono text-xs">{e.batchNumber}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-700 font-semibold">
                      {e.quantityIn > 0 ? `+${e.quantityText ?? e.quantityIn}` : ''}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-700 font-semibold">
                      {e.quantityOut > 0 ? `−${e.quantityText ?? e.quantityOut}` : ''}
                    </TableCell>
                    {showBalance && (
                      <TableCell className="text-right text-sm font-medium">{e.balanceText ?? e.balance ?? ''}</TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground">{e.party ?? '-'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{e.by ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
              <span>
                {data.total} movement(s) · net change {data.summary.netChange >= 0 ? '+' : ''}{data.summary.netChange} unit(s)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span>Page {data.page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'blue' | 'amber' | 'teal';
}) {
  const toneCls = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    teal: 'bg-teal-50 text-teal-700',
  }[tone];
  return (
    <div className={cn('rounded-xl shadow-sanctuary p-4', toneCls)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
}

export default function StockLedgerPage() {
  return (
    <PharmacyAdminGuard>
      <StockLedgerPageInner />
    </PharmacyAdminGuard>
  );
}
