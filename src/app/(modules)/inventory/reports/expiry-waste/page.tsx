'use client';

import { useState } from 'react';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { AlertTriangle, Trash2, RefreshCcw, IndianRupee, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { useExpiryWasteReport } from '@/hooks/use-inventory';

function fmt(n: number) {
  return n.toLocaleString('en-IN');
}
function rupees(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function ExpiryWasteReportPage() {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [fromDate, setFromDate] = useState(toInputDateStr(sixMonthsAgo));
  const [toDate, setToDate] = useState(toInputDateStr(today));
  const [windowMonths, setWindowMonths] = useState(3);

  const { data, isLoading } = useExpiryWasteReport({ fromDate, toDate, windowMonths });

  const expiringBatches = data?.expiringBatches ?? [];
  const expiredRemovals = data?.expiredRemovals ?? [];
  const returns = data?.returns ?? [];
  const summary = data?.summary ?? { expiringCount: 0, expiredCount: 0, returnCount: 0, wasteValue: 0, expiredQuantity: 0, returnQuantity: 0 };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="Expiry & Waste Report"
        description="Upcoming expiries, expired removals (waste), and returned goods with cost impact"
      />

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <Label htmlFor="from">From (waste/returns)</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">To (waste/returns)</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div>
          <Label>Expiry window</Label>
          <Select value={String(windowMonths)} onValueChange={(v) => setWindowMonths(Number(v ?? 3))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Next 1 month</SelectItem>
              <SelectItem value="3">Next 3 months</SelectItem>
              <SelectItem value="6">Next 6 months</SelectItem>
              <SelectItem value="12">Next 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl shadow-sanctuary p-4 bg-amber-50">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{summary.expiringCount}</p>
          <p className="text-xs text-muted-foreground">batches in window</p>
        </div>
        <div className="rounded-xl shadow-sanctuary p-4 bg-red-50">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            <p className="text-xs text-muted-foreground">Expired Removals</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{fmt(summary.expiredQuantity)}</p>
          <p className="text-xs text-muted-foreground">{summary.expiredCount} entries</p>
        </div>
        <div className="rounded-xl shadow-sanctuary p-4 bg-purple-50">
          <div className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-purple-600" />
            <p className="text-xs text-muted-foreground">Returns</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{fmt(summary.returnQuantity)}</p>
          <p className="text-xs text-muted-foreground">{summary.returnCount} entries</p>
        </div>
        <div className="rounded-xl shadow-sanctuary p-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-slate-700" />
            <p className="text-xs text-muted-foreground">Waste Value</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{rupees(summary.wasteValue)}</p>
        </div>
      </div>

      {/* Expiring batches */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="font-headline text-base font-bold">Expiring Batches ({windowMonths} months)</h2>
        </div>
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-24 w-full" /></div>
        ) : expiringBatches.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={Calendar} title="No upcoming expiries" description="Nothing in the next selected window." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3 text-right">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {expiringBatches.map((b) => {
                  const days = daysUntil(b.expiryDate);
                  return (
                    <tr key={b.transactionId} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="font-medium">{b.item.itemName}</div>
                        {b.item.itemCode && <div className="text-xs text-muted-foreground">{b.item.itemCode}</div>}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{b.batchNumber ?? '-'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(b.expiryDate)}</td>
                      <td className="px-4 py-2 text-right">{fmt(b.remainingQuantity)} {b.item.unitOfMeasurement ?? ''}</td>
                      <td className="px-4 py-2 text-right">
                        <Badge
                          variant="outline"
                          className={`text-xs ${days <= 30 ? 'bg-red-100 text-red-700 border-red-300' : days <= 60 ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-emerald-100 text-emerald-700 border-emerald-300'}`}
                        >
                          {days} days
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expired removals */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-600" />
          <h2 className="font-headline text-base font-bold">Expired Removals</h2>
        </div>
        {expiredRemovals.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No expired removals in window.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Removed</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody>
                {expiredRemovals.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{tx.inventoryItem?.itemName ?? '-'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{tx.batchNumber ?? '-'}</td>
                    <td className="px-4 py-2 text-right">{fmt(tx.quantity)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(tx.createdAt)}</td>
                    <td className="px-4 py-2 text-xs">
                      {tx.performer ? `${tx.performer.firstName} ${tx.performer.lastName}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Returns */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 text-purple-600" />
          <h2 className="font-headline text-base font-bold">Returned Goods</h2>
        </div>
        {returns.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No returns in window.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Returned</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{tx.inventoryItem?.itemName ?? '-'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{tx.batchNumber ?? '-'}</td>
                    <td className="px-4 py-2 text-right">{fmt(tx.quantity)}</td>
                    <td className="px-4 py-2">{tx.supplier?.name ?? '-'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
