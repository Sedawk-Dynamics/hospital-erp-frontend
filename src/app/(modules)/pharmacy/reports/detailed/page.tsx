'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePharmacyDetailedReport } from '@/hooks/use-pharmacy';
import {
  StatCard, ReportSection, BarRow, TrendBars, RTable, RHead, inr, compact,
} from '@/components/reports/report-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BarChart3, TrendingUp, AlertTriangle, PackageX } from 'lucide-react';

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function PharmacyDetailedReportPage() {
  const [fromDate, setFromDate] = useState(isoDaysAgo(29));
  const [toDate, setToDate] = useState(today());
  const { data, isLoading } = usePharmacyDetailedReport({ fromDate, toDate });

  const preset = (days: number) => { setFromDate(isoDaysAgo(days - 1)); setToDate(today()); };

  const trend = data?.trend ?? [];
  const formMax = useMemo(() => Math.max(1, ...(data?.byDosageForm ?? []).map((f) => f.revenue)), [data]);
  const valFormMax = useMemo(() => Math.max(1, ...(data?.valuation.byForm ?? []).map((f) => f.costValue)), [data]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/pharmacy/reports" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Pharmacy — Detailed Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Sales, margin, ABC, stock valuation, expiry exposure, returns, GST &amp; supplier purchases for the selected period.
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
            {[7, 30, 90].map((d) => (
              <Button key={d} variant="outline" size="xs" onClick={() => preset(d)}>{d}d</Button>
            ))}
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

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
            <StatCard label="Revenue" value={inr(data.sales.revenue)} sub={`${inr(data.sales.perDayRevenue)}/day`} tone="primary" />
            <StatCard label="Gross profit" value={inr(data.sales.grossProfit)} sub={`${data.sales.marginPct}% margin`} tone="emerald" />
            <StatCard label="Bills" value={compact(data.sales.bills)} sub={`avg ${inr(data.sales.avgBillValue)}`} />
            <StatCard label="Items sold" value={compact(data.sales.itemsSold)} sub={`${data.sales.lines} lines`} />
            <StatCard label="COGS" value={inr(data.sales.cost)} sub="cost of goods" tone="amber" />
            <StatCard label="Returns" value={compact(data.returns.count)} sub={`${data.returns.returnRatePct}% rate · ${inr(data.returns.refundValue)}`} tone="red" />
            <StatCard label="Stock value (cost)" value={inr(data.valuation.costValue)} sub={`${compact(data.valuation.drugCount)} drugs`} tone="blue" />
            <StatCard label="Expiry at risk (90d)" value={inr(data.expiry.valueAtRisk)} sub={`${data.expiry.expiredBatches} expired batches`} tone="red" />
          </div>

          {/* ── Trend ── */}
          <ReportSection
            title="Revenue & profit trend"
            description="Daily sales over the period."
            csv={{ filename: `pharmacy-trend-${fromDate}_${toDate}.csv`, rows: trend }}
            right={<span className="flex items-center gap-1 text-[11px] text-muted-foreground"><TrendingUp className="h-3 w-3 text-primary" /> revenue</span>}
          >
            <TrendBars data={trend} valueKey="revenue" height={72} />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{trend[0]?.date}</span><span>{trend[trend.length - 1]?.date}</span>
            </div>
          </ReportSection>

          {/* ── ABC + dosage-form mix ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="ABC analysis" description="Drugs ranked by revenue contribution (Pareto).">
              <div className="grid grid-cols-3 gap-2">
                {(['A', 'B', 'C'] as const).map((c) => (
                  <div key={c} className="rounded-lg border bg-surface-container-lowest p-2.5 text-center">
                    <p className={`text-lg font-bold ${c === 'A' ? 'text-emerald-600' : c === 'B' ? 'text-amber-600' : 'text-muted-foreground'}`}>{c}</p>
                    <p className="text-xs font-semibold">{data.abc[c].count} drugs</p>
                    <p className="text-[11px] text-muted-foreground">{data.abc[c].sharePct}% · {inr(data.abc[c].revenue)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">A = top 80% of revenue, B = next 15%, C = last 5%. Focus stock-control on A items.</p>
            </ReportSection>

            <ReportSection title="Sales by dosage form" csv={{ filename: 'pharmacy-by-form.csv', rows: data.byDosageForm }}>
              <div className="space-y-1.5">
                {data.byDosageForm.map((f) => (
                  <BarRow key={f.form} label={cap(f.form)} value={f.revenue} max={formMax} valueLabel={`${inr(f.revenue)} · ${f.sharePct}%`} />
                ))}
                {data.byDosageForm.length === 0 && <p className="text-xs text-muted-foreground">No sales in this period.</p>}
              </div>
            </ReportSection>
          </div>

          {/* ── Top drugs ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="Top drugs by revenue" csv={{ filename: 'pharmacy-top-revenue.csv', rows: data.topByRevenue }}>
              <RTable>
                <RHead cols={[{ label: 'Drug' }, { label: 'Qty', align: 'right' }, { label: 'Revenue', align: 'right' }, { label: 'Margin', align: 'right' }]} />
                <tbody>
                  {data.topByRevenue.map((d) => (
                    <tr key={d.drugId} className="border-t">
                      <td className="px-2.5 py-1.5">{d.drugName}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(d.qty)}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{inr(d.revenue)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-emerald-600">{d.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </RTable>
            </ReportSection>

            <ReportSection title="Top drugs by quantity" csv={{ filename: 'pharmacy-top-qty.csv', rows: data.topByQuantity }}>
              <RTable>
                <RHead cols={[{ label: 'Drug' }, { label: 'Units', align: 'right' }, { label: 'Revenue', align: 'right' }]} />
                <tbody>
                  {data.topByQuantity.map((d) => (
                    <tr key={d.drugId} className="border-t">
                      <td className="px-2.5 py-1.5">{d.drugName}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{compact(d.qty)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{inr(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </RTable>
            </ReportSection>
          </div>

          {/* ── Staff performance ── */}
          {data.dispensers.length > 0 && (
            <ReportSection title="Staff performance (dispensing)" csv={{ filename: 'pharmacy-staff.csv', rows: data.dispensers }}>
              <RTable>
                <RHead cols={[{ label: 'Dispensed by' }, { label: 'Lines', align: 'right' }, { label: 'Units', align: 'right' }, { label: 'Revenue', align: 'right' }]} />
                <tbody>
                  {data.dispensers.map((d) => (
                    <tr key={d.userId} className="border-t">
                      <td className="px-2.5 py-1.5">{d.name}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{d.lines}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(d.qty)}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{inr(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </RTable>
            </ReportSection>
          )}

          {/* ── Stock valuation ── */}
          <ReportSection
            title="Stock valuation (live, non-expired)"
            description={`${compact(data.valuation.batchCount)} batches · potential margin ${inr(data.valuation.potentialMargin)} (${data.valuation.marginPct}%)`}
            csv={{ filename: 'pharmacy-valuation-by-form.csv', rows: data.valuation.byForm }}
          >
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="At cost" value={inr(data.valuation.costValue)} tone="amber" />
              <StatCard label="At retail" value={inr(data.valuation.retailValue)} tone="emerald" />
              <StatCard label="Potential margin" value={inr(data.valuation.potentialMargin)} tone="primary" />
              <StatCard label="Distinct drugs" value={compact(data.valuation.drugCount)} />
            </div>
            <div className="space-y-1.5">
              {data.valuation.byForm.map((f) => (
                <BarRow key={f.form} tone="blue" label={`${cap(f.form)} (${compact(f.units)}u)`} value={f.costValue} max={valFormMax} valueLabel={inr(f.costValue)} />
              ))}
            </div>
          </ReportSection>

          {/* ── Expiry exposure ── */}
          <ReportSection
            title="Expiry exposure"
            description="Near-expiry stock by window (value at cost)."
            right={<span className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3 w-3" /> {inr(data.expiry.valueAtRisk)} at risk</span>}
            csv={{ filename: 'pharmacy-expiry-upcoming.csv', rows: data.expiry.upcoming }}
          >
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Expired (in stock)" value={inr(data.expiry.expiredValue)} sub={`${data.expiry.expiredBatches} batches`} tone="red" />
              <StatCard label="≤ 30 days" value={inr(data.expiry.near30.value)} sub={`${data.expiry.near30.count} batches`} tone="red" />
              <StatCard label="31–60 days" value={inr(data.expiry.near60.value)} sub={`${data.expiry.near60.count} batches`} tone="amber" />
              <StatCard label="61–90 days" value={inr(data.expiry.near90.value)} sub={`${data.expiry.near90.count} batches`} tone="amber" />
            </div>
            {data.expiry.upcoming.length > 0 && (
              <RTable>
                <RHead cols={[{ label: 'Drug' }, { label: 'Batch' }, { label: 'Expiry' }, { label: 'Qty', align: 'right' }, { label: 'Value', align: 'right' }]} />
                <tbody>
                  {data.expiry.upcoming.map((b, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2.5 py-1.5">{b.drugName}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px]">{b.batchNumber}</td>
                      <td className="px-2.5 py-1.5">{b.expiryDate}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(b.qty)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{inr(b.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </RTable>
            )}
          </ReportSection>

          {/* ── Dead + low stock ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection
              title="Dead / non-moving stock"
              description={`${data.deadStock.count} drugs in stock with no sale this period · ${inr(data.deadStock.value)} locked`}
              right={<PackageX className="h-4 w-4 text-muted-foreground" />}
              csv={{ filename: 'pharmacy-dead-stock.csv', rows: data.deadStock.items }}
            >
              <RTable>
                <RHead cols={[{ label: 'Drug' }, { label: 'Stock', align: 'right' }, { label: 'Value', align: 'right' }]} />
                <tbody>
                  {data.deadStock.items.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2.5 py-1.5">{d.drugName}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(d.stock)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{inr(d.value)}</td>
                    </tr>
                  ))}
                  {data.deadStock.items.length === 0 && <tr><td colSpan={3} className="px-2.5 py-3 text-center text-muted-foreground">Nothing idle — all stock moved.</td></tr>}
                </tbody>
              </RTable>
            </ReportSection>

            <ReportSection
              title="Low stock (below reorder)"
              description={`${data.lowStock.count} drugs at/under their reorder level`}
              csv={{ filename: 'pharmacy-low-stock.csv', rows: data.lowStock.items }}
            >
              <RTable>
                <RHead cols={[{ label: 'Drug' }, { label: 'Stock', align: 'right' }, { label: 'Min', align: 'right' }, { label: 'Short by', align: 'right' }]} />
                <tbody>
                  {data.lowStock.items.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2.5 py-1.5">{d.drugName}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(d.stock)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{compact(d.minStock)}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-red-600">{compact(d.deficit)}</td>
                    </tr>
                  ))}
                  {data.lowStock.items.length === 0 && <tr><td colSpan={4} className="px-2.5 py-3 text-center text-muted-foreground">All drugs above reorder level.</td></tr>}
                </tbody>
              </RTable>
            </ReportSection>
          </div>

          {/* ── Returns + GST ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportSection title="Returns & refunds" csv={{ filename: 'pharmacy-returns.csv', rows: data.returns.byType }}>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="outline">{data.returns.count} returns</Badge>
                <Badge variant="outline">{data.returns.quantity} units</Badge>
                <Badge variant="outline">{data.returns.returnRatePct}% of units sold</Badge>
                <Badge variant="outline">{inr(data.returns.refundValue)} refunded/credited</Badge>
              </div>
              <RTable>
                <RHead cols={[{ label: 'Type' }, { label: 'Count', align: 'right' }, { label: 'Units', align: 'right' }, { label: 'Value', align: 'right' }]} />
                <tbody>
                  {data.returns.byType.map((t) => (
                    <tr key={t.type} className="border-t">
                      <td className="px-2.5 py-1.5">{cap(t.type.replace(/_/g, ' '))}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{t.count}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(t.quantity)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{inr(t.value)}</td>
                    </tr>
                  ))}
                  {data.returns.byType.length === 0 && <tr><td colSpan={4} className="px-2.5 py-3 text-center text-muted-foreground">No returns in this period.</td></tr>}
                </tbody>
              </RTable>
            </ReportSection>

            <ReportSection title="GST summary (by rate)" description={`Estimated GST ${inr(data.gst.totalTax)} on ${inr(data.gst.taxableValue)} taxable (MRP-inclusive)`} csv={{ filename: 'pharmacy-gst.csv', rows: data.gst.byRate }}>
              <RTable>
                <RHead cols={[{ label: 'Rate' }, { label: 'Lines', align: 'right' }, { label: 'Taxable', align: 'right' }, { label: 'GST', align: 'right' }]} />
                <tbody>
                  {data.gst.byRate.map((g) => (
                    <tr key={g.rate} className="border-t">
                      <td className="px-2.5 py-1.5">{g.rate}%</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{g.lines}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{inr(g.taxable)}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{inr(g.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </RTable>
            </ReportSection>
          </div>

          {/* ── Supplier purchases ── */}
          <ReportSection
            title="Supplier purchases (this period)"
            description={`Stock received worth ${inr(data.purchases.total)} from ${data.purchases.suppliers.length} suppliers`}
            csv={{ filename: 'pharmacy-suppliers.csv', rows: data.purchases.suppliers }}
          >
            <RTable>
              <RHead cols={[{ label: 'Supplier' }, { label: 'Batches', align: 'right' }, { label: 'Units', align: 'right' }, { label: 'Purchase value', align: 'right' }]} />
              <tbody>
                {data.purchases.suppliers.map((s) => (
                  <tr key={s.supplierId} className="border-t">
                    <td className="px-2.5 py-1.5">{s.name}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{s.batches}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{compact(s.units)}</td>
                    <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{inr(s.purchaseValue)}</td>
                  </tr>
                ))}
                {data.purchases.suppliers.length === 0 && <tr><td colSpan={4} className="px-2.5 py-3 text-center text-muted-foreground">No stock received in this period.</td></tr>}
              </tbody>
            </RTable>
          </ReportSection>
        </>
      )}
    </div>
  );
}
