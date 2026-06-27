'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useInventoryDetailedReport } from '@/hooks/use-inventory';
import {
  StatCard, ReportSection, BarRow, TrendBars, RTable, RHead, inr, compact,
} from '@/components/reports/report-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3, AlertTriangle, ArrowRightLeft } from 'lucide-react';

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export default function InventoryDetailedReportPage() {
  const [fromDate, setFromDate] = useState(isoDaysAgo(29));
  const [toDate, setToDate] = useState(today());
  const { data, isLoading } = useInventoryDetailedReport({ fromDate, toDate });

  const preset = (days: number) => { setFromDate(isoDaysAgo(days - 1)); setToDate(today()); };
  const catMax = useMemo(() => Math.max(1, ...(data?.valuation.byCategory ?? []).map((c) => c.costValue)), [data]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/inventory/reports" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Inventory — Detailed Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Stock valuation, movements, low-stock, purchases, transfers, expiry/waste &amp; department consumption.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-0.5 block text-[10px] uppercase text-muted-foreground">From</label>
            <Input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] uppercase text-muted-foreground">To</label>
            <Input type="date" value={toDate} min={fromDate} max={today()} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (<Button key={d} variant="outline" size="xs" onClick={() => preset(d)}>{d}d</Button>))}
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Crunching the numbers…</div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Period <b>{data.period.fromDate}</b> → <b>{data.period.toDate}</b> ({data.period.days} days)
          </p>

          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Stock value (cost)" value={inr(data.valuation.costValue)} sub={`${compact(data.valuation.itemCount)} items`} tone="primary" />
            <StatCard label="Stock value (retail)" value={inr(data.valuation.retailValue)} sub={`${compact(data.valuation.units)} units`} tone="emerald" />
            <StatCard label="Potential margin" value={inr(data.valuation.potentialMargin)} tone="blue" />
            <StatCard label="Low stock" value={compact(data.lowStock.count)} sub="below reorder" tone="red" />
            <StatCard label="Stock IN" value={inr(data.movements.stockIn.value)} sub={`${compact(data.movements.stockIn.qty)} units`} tone="emerald" />
            <StatCard label="Stock OUT" value={inr(data.movements.stockOut.value)} sub={`${compact(data.movements.stockOut.qty)} units`} tone="amber" />
            <StatCard label="Waste (expired)" value={inr(data.movements.expiredRemoval.value)} sub={`${compact(data.movements.expiredRemoval.qty)} units`} tone="red" />
            <StatCard label="Purchase spend" value={inr(data.purchases.totalSpend)} sub={`${data.purchases.poCount} POs`} />
          </div>

          {/* Movements trend */}
          <ReportSection
            title="Stock movement trend"
            description="Daily units in vs out."
            csv={{ filename: `inventory-trend-${fromDate}_${toDate}.csv`, rows: data.movements.trend }}
            right={<span className="text-[11px] text-muted-foreground"><span className="text-emerald-600">IN</span> / <span className="text-amber-600">OUT</span></span>}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium text-emerald-600">Stock in</p>
                <TrendBars data={data.movements.trend} valueKey="stockIn" tone="emerald" height={56} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-amber-600">Stock out</p>
                <TrendBars data={data.movements.trend} valueKey="stockOut" height={56} />
              </div>
            </div>
          </ReportSection>

          {/* Valuation by category + movement summary */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="Valuation by category" csv={{ filename: 'inventory-valuation.csv', rows: data.valuation.byCategory }}>
              <div className="space-y-1.5">
                {data.valuation.byCategory.map((c) => (
                  <BarRow key={c.category} tone="blue" label={`${cap(c.category)} (${c.items})`} value={c.costValue} max={catMax} valueLabel={inr(c.costValue)} />
                ))}
                {data.valuation.byCategory.length === 0 && <p className="text-xs text-muted-foreground">No active items.</p>}
              </div>
            </ReportSection>

            <ReportSection title="Movement summary" description="By transaction type over the period.">
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Stock in" value={compact(data.movements.stockIn.qty)} sub={inr(data.movements.stockIn.value)} tone="emerald" />
                <StatCard label="Stock out" value={compact(data.movements.stockOut.qty)} sub={inr(data.movements.stockOut.value)} tone="amber" />
                <StatCard label="Adjustments" value={compact(data.movements.adjustments.qty)} sub={inr(data.movements.adjustments.value)} />
                <StatCard label="Returns" value={compact(data.movements.returns.qty)} sub={inr(data.movements.returns.value)} tone="blue" />
                <StatCard label="Expired removal" value={compact(data.movements.expiredRemoval.qty)} sub={inr(data.movements.expiredRemoval.value)} tone="red" />
              </div>
            </ReportSection>
          </div>

          {/* Top consumed + low stock */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="Top consumed items" description="Highest stock-out value." csv={{ filename: 'inventory-top-consumed.csv', rows: data.topConsumed }}>
              <RTable>
                <RHead cols={[{ label: 'Item' }, { label: 'Category' }, { label: 'Units', align: 'right' }, { label: 'Value', align: 'right' }]} />
                <tbody>
                  {data.topConsumed.map((t, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2.5 py-1.5">{t.itemName}</td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">{cap(t.category)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(t.qty)}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{inr(t.value)}</td>
                    </tr>
                  ))}
                  {data.topConsumed.length === 0 && <tr><td colSpan={4} className="px-2.5 py-3 text-center text-muted-foreground">No consumption in this period.</td></tr>}
                </tbody>
              </RTable>
            </ReportSection>

            <ReportSection title="Low stock (below reorder)" description={`${data.lowStock.count} items at/under threshold`} csv={{ filename: 'inventory-low-stock.csv', rows: data.lowStock.items }}>
              <RTable>
                <RHead cols={[{ label: 'Item' }, { label: 'Stock', align: 'right' }, { label: 'Min', align: 'right' }, { label: 'Short by', align: 'right' }]} />
                <tbody>
                  {data.lowStock.items.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2.5 py-1.5">{d.itemName}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(d.stock)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{compact(d.minStock)}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-red-600">{compact(d.deficit)}</td>
                    </tr>
                  ))}
                  {data.lowStock.items.length === 0 && <tr><td colSpan={4} className="px-2.5 py-3 text-center text-muted-foreground">All items above reorder level.</td></tr>}
                </tbody>
              </RTable>
            </ReportSection>
          </div>

          {/* Purchases */}
          <ReportSection title="Purchase orders" description={`${data.purchases.poCount} POs · ${inr(data.purchases.totalSpend)} spend`} csv={{ filename: 'inventory-po-suppliers.csv', rows: data.purchases.bySupplier }}>
            <div className="mb-3 flex flex-wrap gap-2">
              {data.purchases.byStatus.map((s) => (
                <Badge key={s.status} variant="outline">{cap(s.status)}: {s.count} · {inr(s.value)}</Badge>
              ))}
            </div>
            <RTable>
              <RHead cols={[{ label: 'Supplier' }, { label: 'Orders', align: 'right' }, { label: 'Value', align: 'right' }]} />
              <tbody>
                {data.purchases.bySupplier.map((s) => (
                  <tr key={s.supplierId} className="border-t">
                    <td className="px-2.5 py-1.5">{s.name}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{s.orders}</td>
                    <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{inr(s.value)}</td>
                  </tr>
                ))}
                {data.purchases.bySupplier.length === 0 && <tr><td colSpan={3} className="px-2.5 py-3 text-center text-muted-foreground">No purchase orders in this period.</td></tr>}
              </tbody>
            </RTable>
          </ReportSection>

          {/* Transfers + expiry/waste */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="Stock transfers" description={`${data.transfers.count} transfers`} right={<ArrowRightLeft className="h-4 w-4 text-muted-foreground" />}>
              <RTable>
                <RHead cols={[{ label: 'Status' }, { label: 'Count', align: 'right' }, { label: 'Units', align: 'right' }]} />
                <tbody>
                  {data.transfers.byStatus.map((s) => (
                    <tr key={s.status} className="border-t">
                      <td className="px-2.5 py-1.5">{cap(s.status)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{s.count}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(s.qty)}</td>
                    </tr>
                  ))}
                  {data.transfers.byStatus.length === 0 && <tr><td colSpan={3} className="px-2.5 py-3 text-center text-muted-foreground">No transfers in this period.</td></tr>}
                </tbody>
              </RTable>
            </ReportSection>

            <ReportSection
              title="Expiry & waste"
              right={<span className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3 w-3" /> {inr(data.expiryWaste.summary.wasteValue)} waste</span>}
              csv={{ filename: 'inventory-expiring.csv', rows: data.expiryWaste.expiringSoon }}
            >
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="outline">{data.expiryWaste.summary.expiringCount} expiring</Badge>
                <Badge variant="outline">{data.expiryWaste.summary.expiredCount} expired</Badge>
                <Badge variant="outline">{compact(data.expiryWaste.summary.expiredQuantity)} units wasted</Badge>
              </div>
              <RTable>
                <RHead cols={[{ label: 'Item' }, { label: 'Batch' }, { label: 'Expiry' }, { label: 'Qty', align: 'right' }]} />
                <tbody>
                  {data.expiryWaste.expiringSoon.map((b, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2.5 py-1.5">{b.itemName}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px]">{b.batchNumber}</td>
                      <td className="px-2.5 py-1.5">{String(b.expiryDate).slice(0, 10)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(b.remaining)}</td>
                    </tr>
                  ))}
                  {data.expiryWaste.expiringSoon.length === 0 && <tr><td colSpan={4} className="px-2.5 py-3 text-center text-muted-foreground">Nothing expiring soon.</td></tr>}
                </tbody>
              </RTable>
            </ReportSection>
          </div>

          {/* Department consumption */}
          <ReportSection title="Department consumption" description="Items consumed by department (cost)." csv={{ filename: 'inventory-dept-consumption.csv', rows: data.departments }}>
            <RTable>
              <RHead cols={[{ label: 'Department' }, { label: 'Units', align: 'right' }, { label: 'Cost', align: 'right' }]} />
              <tbody>
                {data.departments.map((d, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2.5 py-1.5">{d.departmentName}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(d.quantity)}</td>
                    <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{inr(d.cost)}</td>
                  </tr>
                ))}
                {data.departments.length === 0 && <tr><td colSpan={3} className="px-2.5 py-3 text-center text-muted-foreground">No department consumption recorded.</td></tr>}
              </tbody>
            </RTable>
          </ReportSection>
        </>
      )}
    </div>
  );
}
