'use client';

import { useState } from 'react';
import { toInputDateStr } from '@/lib/date-utils';
import { ArrowDownToLine, ArrowUpToLine, Trash2, RefreshCcw, Boxes } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StockTypeBadge } from '@/components/shared/stock-type-badge';
import { useStockBalanceReport } from '@/hooks/use-inventory';

const CATEGORIES = ['drug', 'product', 'consumable', 'surgical_supply', 'equipment', 'other'] as const;
type Cat = (typeof CATEGORIES)[number];

function fmt(n: number) {
  return n.toLocaleString('en-IN');
}

export default function StockBalanceReportPage() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(toInputDateStr(monthAgo));
  const [toDate, setToDate] = useState(toInputDateStr(today));
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
  const [category, setCategory] = useState<'' | Cat>('');

  const { data, isLoading } = useStockBalanceReport({
    fromDate,
    toDate,
    groupBy,
    category: (category || undefined) as Cat | undefined,
  });

  const totals = data?.totals ?? { stockIn: 0, stockOut: 0, returns: 0, expiredRemoval: 0 };
  const items = data?.items ?? [];
  const movements = data?.movements ?? [];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="Stock Balance Report"
        description="Inflow vs outflow per item, current stock and net change across the chosen window"
      />

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div>
          <Label>Group by</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy((v as 'day' | 'month') ?? 'day')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category || 'all'} onValueChange={(v) => setCategory((v === 'all' ? '' : (v as Cat)) ?? '')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Stock In', value: totals.stockIn, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: ArrowDownToLine },
          { label: 'Stock Out', value: totals.stockOut, color: 'text-blue-600', bg: 'bg-blue-50', icon: ArrowUpToLine },
          { label: 'Returns', value: totals.returns, color: 'text-purple-600', bg: 'bg-purple-50', icon: RefreshCcw },
          { label: 'Expired Removed', value: totals.expiredRemoval, color: 'text-red-600', bg: 'bg-red-50', icon: Trash2 },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl shadow-sanctuary p-4 ${s.bg}`}>
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="font-headline text-2xl font-extrabold mt-1">{fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Per-item summary */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <Boxes className="h-4 w-4 text-primary" />
          <h2 className="font-headline text-base font-bold">Per Item Summary</h2>
          <span className="text-xs text-muted-foreground ml-2">{items.length} items moved</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-right">In</th>
                <th className="px-4 py-3 text-right">Out</th>
                <th className="px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8">
                    <EmptyState icon={Boxes} title="No movement" description="No stock movement in the selected window." />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.itemId} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.itemName}</div>
                      {item.itemCode && <div className="text-xs text-muted-foreground">{item.itemCode}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <StockTypeBadge category={item.category} showMedicine />
                    </td>
                    <td className="px-4 py-2 text-right">{fmt(item.currentStock)} {item.unit || ''}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">{fmt(item.totalIn)}</td>
                    <td className="px-4 py-2 text-right text-blue-700">{fmt(item.totalOut)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${item.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {item.net >= 0 ? `+${fmt(item.net)}` : fmt(item.net)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movements by bucket */}
      {movements.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="font-headline text-base font-bold">
              {groupBy === 'month' ? 'Monthly' : 'Daily'} Movements
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">{groupBy === 'month' ? 'Month' : 'Date'}</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">In</th>
                  <th className="px-4 py-3 text-right">Out</th>
                  <th className="px-4 py-3 text-right">Returns</th>
                  <th className="px-4 py-3 text-right">Expired</th>
                  <th className="px-4 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr key={`${m.itemId}-${m.bucket}-${i}`} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2 text-muted-foreground">{m.bucket}</td>
                    <td className="px-4 py-2">{m.itemName}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">{fmt(m.stockIn)}</td>
                    <td className="px-4 py-2 text-right text-blue-700">{fmt(m.stockOut)}</td>
                    <td className="px-4 py-2 text-right text-purple-700">{fmt(m.returns)}</td>
                    <td className="px-4 py-2 text-right text-red-700">{fmt(m.expiredRemoval)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${m.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {m.net >= 0 ? `+${fmt(m.net)}` : fmt(m.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
