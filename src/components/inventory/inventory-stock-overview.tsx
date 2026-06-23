'use client';

import { Boxes, AlertTriangle, PackageX, ShieldX, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventoryStockOverview } from '@/hooks/use-inventory';

// Compact at-a-glance strip spanning BOTH stock systems (generic inventory items
// + pharmacy drug batches) so the merged Inventory page leads with one picture.
// Each card shows the combined figure with the item/drug split underneath.
export function InventoryStockOverview() {
  const { data, isLoading, isError } = useInventoryStockOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Degrade silently — the tabs below still work without the summary.
  if (isError || !data) return null;

  const { combined, items, drugs, expiryAlertMonths } = data;
  const money = (n: number) =>
    `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const split = `${items.skus} items · ${drugs.skus} drugs`;

  const cards = [
    {
      label: 'Total SKUs',
      value: String(combined.skus),
      sub: split,
      icon: Boxes,
      tone: 'text-foreground',
      iconTone: 'text-muted-foreground/40',
    },
    {
      label: 'Low stock',
      value: String(combined.lowStock),
      sub: `${items.lowStock} items · ${drugs.lowStock} drugs`,
      icon: AlertTriangle,
      tone: combined.lowStock > 0 ? 'text-amber-700' : 'text-foreground',
      iconTone: 'text-amber-500/50',
    },
    {
      label: 'Out of stock',
      value: String(combined.outOfStock),
      sub: `${items.outOfStock} items · ${drugs.outOfStock} drugs`,
      icon: PackageX,
      tone: combined.outOfStock > 0 ? 'text-red-700' : 'text-foreground',
      iconTone: 'text-red-500/50',
    },
    {
      label: `Expiring ≤${expiryAlertMonths} mo`,
      value: String(combined.expiring),
      sub: drugs.recalledBatches > 0 ? `${drugs.recalledBatches} recalled batches` : split,
      icon: ShieldX,
      tone: combined.expiring > 0 ? 'text-amber-700' : 'text-foreground',
      iconTone: 'text-amber-500/50',
    },
    {
      label: 'Stock value',
      value: money(combined.stockValue),
      sub: combined.valueAtRisk > 0 ? `${money(combined.valueAtRisk)} at risk` : 'on-hand value',
      icon: Wallet,
      tone: 'text-foreground font-mono',
      iconTone: 'text-primary/40',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary"
          >
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{c.label}</p>
              <p className={`mt-0.5 text-2xl font-bold ${c.tone}`}>{c.value}</p>
              <p className="truncate text-[11px] text-muted-foreground">{c.sub}</p>
            </div>
            <Icon className={`h-7 w-7 shrink-0 ${c.iconTone}`} />
          </div>
        );
      })}
    </div>
  );
}
