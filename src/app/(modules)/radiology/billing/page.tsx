'use client';

// Radiology Billing — radiology_admin only.
// Mirrors lab billing: roll-up of imaging-linked bill items grouped by status,
// total billed / paid / outstanding, and a recent activity table. Reads from
// /imaging/billing-summary which derives everything from the auto-linked
// BillItem rows (referenceType='imaging_request').

import { useState } from 'react';
import {
  Receipt, RefreshCw, IndianRupee, Clock, CheckCircle, AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { useImagingBillingSummary } from '@/hooks/use-imaging';
import { RadiologyAdminGuard } from '@/components/radiology/radiology-admin-guard';

const paymentStatusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', className: 'bg-zinc-100 text-zinc-700', icon: Clock },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800', icon: AlertCircle },
  partially_paid: { label: 'Partial', className: 'bg-blue-100 text-blue-800', icon: Clock },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800', icon: AlertCircle },
  cancelled: { label: 'Cancelled', className: 'bg-zinc-100 text-zinc-500', icon: AlertCircle },
};

export default function RadiologyBillingPage() {
  return (
    <RadiologyAdminGuard>
      <RadiologyBillingInner />
    </RadiologyAdminGuard>
  );
}

function RadiologyBillingInner() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toInputDateStr(d);
  });
  const [to, setTo] = useState(() => toInputDateStr());

  const { data, isLoading, refetch, isFetching } = useImagingBillingSummary({
    fromDate: from ? new Date(from).toISOString() : undefined,
    toDate: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  });

  const summary = data?.summary;
  const recent = data?.recent ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="Radiology Billing"
        description="Auto-linked imaging charges, payment status, and outstanding balance."
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Date range */}
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          icon={IndianRupee}
          label="Total Billed"
          value={formatCurrency(summary?.totalBilled)}
          accent="border-l-primary"
        />
        <Tile
          icon={CheckCircle}
          label="Total Paid"
          value={formatCurrency(summary?.totalPaid)}
          accent="border-l-green-500"
          iconClassName="text-green-600"
          valueClassName="text-green-600"
        />
        <Tile
          icon={Clock}
          label="Outstanding"
          value={formatCurrency(summary?.totalOutstanding)}
          accent="border-l-amber-500"
          iconClassName="text-amber-600"
          valueClassName="text-amber-600"
        />
      </div>

      {/* Status mix */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-3">
          Billed amount by bill status
        </h3>
        {!data ? (
          <p className="text-xs text-muted-foreground italic">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {Object.entries(data.statusMix).map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-surface-container-low p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                <p className="font-headline text-sm font-bold mt-1">{formatCurrency(Number(v))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <Th>Bill #</Th>
                <Th>Patient</Th>
                <Th>Description</Th>
                <Th align="right">Charge</Th>
                <Th>Bill Status</Th>
                <Th align="right">Paid</Th>
                <Th align="right">Balance</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No radiology charges in this range.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recent.map((it) => {
                  const status = paymentStatusConfig[it.bill.status] || paymentStatusConfig.pending;
                  const Icon = status.icon;
                  return (
                    <tr key={it.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3 font-mono text-xs">{it.bill.billNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {it.bill.patient?.firstName} {it.bill.patient?.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {it.bill.patient?.mrn ?? ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 truncate max-w-[260px]">{it.description}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(Number(it.totalAmount))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                          status.className,
                        )}>
                          <Icon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatCurrency(Number(it.bill.amountPaid ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatCurrency(Number(it.bill.balanceDue ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(it.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

function Tile({
  icon: Icon, label, value, accent, iconClassName, valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  iconClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn('bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4', accent)}>
      <div className="font-label text-xs text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
        <Icon className={cn('h-4 w-4', iconClassName)} />
        {label}
      </div>
      <p className={cn('font-headline text-3xl font-extrabold mt-1', valueClassName)}>
        {value}
      </p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={cn(
      'px-4 pb-4 pt-5 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest',
      align === 'right' ? 'text-right' : 'text-left',
    )}>
      {children}
    </th>
  );
}
