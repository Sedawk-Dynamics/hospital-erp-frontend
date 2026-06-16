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

const MOVEMENT_LABEL: Record<StockLedgerMovement, string> = {
  receipt: 'Stock In',
  dispense: 'Dispense / Sale',
  patient_return: 'Patient Return',
  vendor_return: 'Vendor Return',
  counter_return: 'Counter Return',
};

const MOVEMENT_BADGE: Record<StockLedgerMovement, string> = {
  receipt: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  dispense: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  patient_return: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  vendor_return: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  counter_return: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
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

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-primary" />
            Stock Ledger
          </h1>
          <p className="text-xs text-muted-foreground">
            Batch-wise movement register — every receipt, dispense and return in the period.
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Received (in period)" value={data?.summary.totalReceived ?? '—'} icon={ArrowDownToLine} tone="emerald" />
        <StatTile label="Dispensed / sold" value={data?.summary.totalDispensed ?? '—'} icon={ArrowUpFromLine} tone="blue" />
        <StatTile label="Returned (restocked)" value={data?.summary.totalReturned ?? '—'} icon={Undo2} tone="amber" />
        <StatTile label="Closing stock (live)" value={data?.summary.closingStock ?? '—'} icon={Boxes} tone="teal" />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={BookOpenText}
            title="No stock movements"
            description="Receipts, dispenses and returns in the selected period will appear here."
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
                  <TableHead>Party</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={`${e.movementType}-${e.referenceId}`}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTimeAmPm(e.date)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', MOVEMENT_BADGE[e.movementType])}>
                        {MOVEMENT_LABEL[e.movementType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{e.drugName}</TableCell>
                    <TableCell className="font-mono text-xs">{e.batchNumber}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-700 font-semibold">
                      {e.quantityIn > 0 ? `+${e.quantityIn}` : ''}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-700 font-semibold">
                      {e.quantityOut > 0 ? `−${e.quantityOut}` : ''}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.party ?? '-'}</TableCell>
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
