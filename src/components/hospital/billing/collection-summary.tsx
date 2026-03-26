'use client';

import { cn } from '@/lib/utils';
import { Banknote, CreditCard, Smartphone, Building, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CollectionSummary } from '@/types';

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

export function CollectionSummaryCard({ summary, isLoading }: CollectionSummaryCardProps) {
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

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

  return (
    <div className="space-y-4">
      {/* Collection stats */}
      <div>
        <h3 className="mb-2 font-label text-xs text-on-surface-variant uppercase tracking-widest">Collection</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {collectionItems.map((item) => {
            const Icon = item.icon;
            const value = summary?.[item.key] ?? 0;
            return (
              <div key={item.key} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
                <div className="flex items-center gap-2">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', item.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{item.label}</span>
                </div>
                <p className="mt-2 text-lg font-label font-bold">{formatAmount(value)}</p>
              </div>
            );
          })}
        </div>
      </div>

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
              <div key={item.key} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{item.label}</p>
                <p className={cn('mt-1 text-lg font-label font-bold', item.color)}>{formatAmount(value)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
