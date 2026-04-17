'use client';

import { cn } from '@/lib/utils';
import {
  Banknote,
  CreditCard,
  Smartphone,
  Building,
  FileText,
  Download,
  Globe,
  Store,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CollectionMethodBreakdown, CollectionSummary } from '@/types';

interface CollectionSummaryCardProps {
  summary: CollectionSummary | undefined;
  isLoading: boolean;
}

const collectionItems = [
  { key: 'totalCollection', label: 'Total Collection', icon: Banknote, color: 'text-green-600 bg-green-50' },
  { key: 'cash', label: 'Cash', icon: Banknote, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
  { key: 'upi', label: 'UPI', icon: Smartphone, color: 'text-purple-600 bg-purple-50' },
  { key: 'bankTransfer', label: 'Bank Transfer', icon: Building, color: 'text-indigo-600 bg-indigo-50' },
  { key: 'cheque', label: 'Cheque', icon: FileText, color: 'text-amber-600 bg-amber-50' },
] as const;

const billItems = [
  { key: 'totalBill', label: 'Total Bill', color: 'text-foreground' },
  { key: 'totalPaid', label: 'Paid', color: 'text-green-600' },
  { key: 'totalCredit', label: 'Credit', color: 'text-red-600' },
  { key: 'netAdvanceAdjusted', label: 'Net Advance Adjusted', color: 'text-blue-600' },
] as const;

const methodRows: { key: keyof CollectionMethodBreakdown; label: string; icon: typeof Banknote }[] = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'upi', label: 'UPI', icon: Smartphone },
  { key: 'bankTransfer', label: 'Bank Transfer', icon: Building },
  { key: 'cheque', label: 'Cheque', icon: FileText },
  { key: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'other', label: 'Other', icon: Coins },
];

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

function SourceBreakdownCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  data,
}: {
  title: string;
  subtitle: string;
  icon: typeof Globe;
  accent: string;
  data: CollectionMethodBreakdown;
}) {
  const rows = methodRows.filter((row) => (data[row.key] ?? 0) > 0);

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', accent)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-label text-xs font-bold uppercase tracking-widest text-on-surface">
              {title}
            </p>
            <p className="font-label text-[10px] text-on-surface-variant">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Total
          </p>
          <p className="font-display text-xl font-bold">{formatAmount(data.total)}</p>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-surface-container pt-3">
          {rows.map((row) => {
            const RowIcon = row.icon;
            const value = data[row.key] ?? 0;
            const pct = data.total > 0 ? Math.round((value / data.total) * 100) : 0;
            return (
              <div key={row.key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RowIcon className="h-3.5 w-3.5 text-on-surface-variant" />
                  <span className="font-label text-xs text-on-surface">{row.label}</span>
                  <span className="font-label text-[10px] text-on-surface-variant">({pct}%)</span>
                </div>
                <span className="font-label text-sm font-bold">{formatAmount(value)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 border-t border-surface-container pt-3 text-center font-label text-xs text-on-surface-variant">
          No payments collected yet.
        </p>
      )}
    </div>
  );
}

export function CollectionSummaryCard({ summary, isLoading }: CollectionSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {collectionItems.map((item) => (
          <div key={item.key} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <div className="h-4 w-16 animate-shimmer rounded" />
            <div className="mt-2 h-6 w-20 animate-shimmer rounded" />
          </div>
        ))}
      </div>
    );
  }

  const bySource = summary?.bySource;
  const unknownTotal = bySource?.unknown.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Collection stats */}
      <div>
        <h3 className="mb-2 font-label text-xs text-on-surface-variant uppercase tracking-widest">
          Collection
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {collectionItems.map((item) => {
            const Icon = item.icon;
            const value = summary?.[item.key] ?? 0;
            return (
              <div
                key={item.key}
                className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4"
              >
                <div className="flex items-center gap-2">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', item.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
                    {item.label}
                  </span>
                </div>
                <p className="mt-2 text-lg font-label font-bold">{formatAmount(value)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source breakdown — online vs front desk */}
      {bySource && (
        <div>
          <h3 className="mb-2 font-label text-xs text-on-surface-variant uppercase tracking-widest">
            By Source &amp; Method
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SourceBreakdownCard
              title="Online"
              subtitle="Patient portal / Razorpay"
              icon={Globe}
              accent="bg-blue-50 text-blue-600"
              data={bySource.online}
            />
            <SourceBreakdownCard
              title="Front Desk"
              subtitle="Collected at the counter"
              icon={Store}
              accent="bg-amber-50 text-amber-600"
              data={bySource.frontdesk}
            />
          </div>
          {unknownTotal > 0 && (
            <p className="mt-2 font-label text-[11px] text-on-surface-variant">
              {formatAmount(unknownTotal)} of legacy payments could not be classified by source.
            </p>
          )}
        </div>
      )}

      {/* Bill stats */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Bills</h3>
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-4 w-4" />
            Day End Report
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {billItems.map((item) => {
            const value = summary?.[item.key] ?? 0;
            return (
              <div
                key={item.key}
                className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4"
              >
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
                  {item.label}
                </p>
                <p className={cn('mt-1 text-lg font-label font-bold', item.color)}>
                  {formatAmount(value)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
