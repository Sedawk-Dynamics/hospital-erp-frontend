'use client';
import { PharmacyAdminGuard } from '@/components/pharmacy/pharmacy-admin-guard';

import { useState } from 'react';
import {
  TrendingUp, AlertTriangle, BarChart3, Package,
  RefreshCw, IndianRupee, Receipt, Layers,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { usePharmacyAnalytics } from '@/hooks/use-pharmacy';

const fmtINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function PharmacyReportsPageInner() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return toInputDateStr(d);
  });
  const [to, setTo] = useState(() => toInputDateStr());

  const { data, isLoading, refetch } = usePharmacyAnalytics({
    fromDate: from || undefined,
    toDate: to || undefined,
  });

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Pharmacy Reports</h1>
          <p className="text-xs text-muted-foreground">
            Sales, expiry, stock usage and batch-wise inventory analysis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
      </div>

      {/* Sales tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Today's Sales"
          value={isLoading || !data ? '…' : fmtINR(data.sales.today)}
          icon={IndianRupee}
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Last 7 Days"
          value={isLoading || !data ? '…' : fmtINR(data.sales.week)}
          icon={TrendingUp}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Last 30 Days"
          value={isLoading || !data ? '…' : fmtINR(data.sales.month)}
          icon={BarChart3}
          accent="bg-purple-50 text-purple-700"
        />
        <StatCard
          label="Margin / Profit (range)"
          value={isLoading || !data ? '…' : fmtINR(data.sales.rangeMargin)}
          icon={Receipt}
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      {/* Top drugs */}
      <Card title="Top Dispensed Drugs" subtitle="By units dispensed in the selected range.">
        {data && data.topDrugs.length > 0 ? (
          <BarList
            items={data.topDrugs.slice(0, 10).map((d) => ({
              label: d.drugName,
              value: d.qty,
              display: `${d.qty} units · ${fmtINR(d.revenue)}`,
            }))}
          />
        ) : (
          <Empty text={isLoading ? 'Loading…' : 'No dispenses in range.'} />
        )}
      </Card>

      {/* Expiry */}
      <Card
        title="Expiry Report"
        subtitle="Active batches expiring in the next 90 days. Sell or return before expiry."
        icon={<AlertTriangle className="size-4 text-amber-600" />}
      >
        <div className="grid grid-cols-3 gap-3 mb-3">
          <MiniStat label="Soon-to-expire" value={data?.expiry.soonCount ?? '—'} tone="amber" />
          <MiniStat label="Expired (blocked)" value={data?.expiry.expiredCount ?? '—'} tone="red" />
          <MiniStat
            label="Value at Risk"
            value={data ? fmtINR(data.expiry.valueAtRisk) : '—'}
            tone="amber"
          />
        </div>
        {data && data.expiry.upcoming.length > 0 ? (
          <BatchTable
            rows={data.expiry.upcoming.map((b) => ({
              drugName: b.drugName,
              batchNumber: b.batchNumber,
              qty: b.quantityInStock,
              extra: `Expires ${formatDate(b.expiryDate)} · ${fmtINR(b.sellingPrice)}`,
            }))}
          />
        ) : (
          <Empty text={isLoading ? 'Loading…' : 'No batches expiring in the next 90 days.'} />
        )}
      </Card>

      {/* Stock usage / slow movers */}
      <Card
        title="Stock Usage — Slow Movers"
        subtitle="Active stock that hasn't been dispensed in the selected range."
        icon={<Package className="size-4 text-blue-600" />}
      >
        {data && data.stockUsage.slowMovers.length > 0 ? (
          <BatchTable
            rows={data.stockUsage.slowMovers.map((b) => ({
              drugName: b.drugName,
              batchNumber: b.batchNumber,
              qty: b.quantityInStock,
              extra: `Expires ${formatDate(b.expiryDate)}`,
            }))}
          />
        ) : (
          <Empty text={isLoading ? 'Loading…' : 'No slow movers — every active batch is moving.'} />
        )}
      </Card>

      {/* Batch summary */}
      <Card
        title="Batch-wise Inventory Summary"
        subtitle="Active, non-expired, non-recalled batches."
        icon={<Layers className="size-4 text-purple-600" />}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Active Batches" value={data?.batchSummary.activeBatches ?? '—'} tone="purple" />
          <MiniStat
            label="Stock Value (cost)"
            value={data ? fmtINR(data.batchSummary.totalStockValue) : '—'}
            tone="blue"
          />
          <MiniStat
            label="Retail Value"
            value={data ? fmtINR(data.batchSummary.totalRetailValue) : '—'}
            tone="emerald"
          />
          <MiniStat
            label="Potential Margin"
            value={data ? fmtINR(data.batchSummary.potentialMargin) : '—'}
            tone="amber"
          />
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-surface-container-lowest shadow-sanctuary p-4', accent)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
}

function Card({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic py-2">{text}</p>;
}

function BarList({
  items,
}: {
  items: { label: string; value: number; display?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.slice(0, 12).map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-sm">
            <span className="truncate pr-2">{it.label}</span>
            <span className="text-muted-foreground">{it.display ?? it.value}</span>
          </div>
          <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${Math.round((it.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({
  label, value, tone,
}: {
  label: string;
  value: string | number;
  tone: 'amber' | 'red' | 'blue' | 'emerald' | 'purple';
}) {
  const toneCls: Record<typeof tone, string> = {
    amber: 'text-amber-700 bg-amber-50',
    red: 'text-red-700 bg-red-50',
    blue: 'text-blue-700 bg-blue-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    purple: 'text-purple-700 bg-purple-50',
  };
  return (
    <div className={cn('rounded-lg p-3', toneCls[tone])}>
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

function BatchTable({
  rows,
}: {
  rows: { drugName: string; batchNumber: string; qty: number; extra: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-on-surface-variant border-b">
            <th className="text-left pb-2">Drug</th>
            <th className="text-left pb-2">Batch</th>
            <th className="text-right pb-2">Qty</th>
            <th className="text-right pb-2">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, idx) => (
            <tr key={`${r.batchNumber}-${idx}`}>
              <td className="py-1.5 pr-2 truncate">{r.drugName}</td>
              <td className="py-1.5 pr-2 font-mono text-xs text-muted-foreground">{r.batchNumber}</td>
              <td className="py-1.5 pr-2 text-right">{r.qty}</td>
              <td className="py-1.5 pr-2 text-right text-xs text-muted-foreground">{r.extra}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PharmacyReportsPage() {
  return (
    <PharmacyAdminGuard>
      <PharmacyReportsPageInner />
    </PharmacyAdminGuard>
  );
}
