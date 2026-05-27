'use client';

// Radiology Inventory — radiology_admin only.
// Focused view of consumables/equipment most relevant to the imaging
// department (contrast media, film, lead aprons, monitor calibration, etc.).
// Heavy lifting (CRUD, supplier mgmt, full reports) lives in the dedicated
// /inventory module — this page is intentionally a "lens" with quick links.

import { useState } from 'react';
import Link from 'next/link';
import {
  Package, Search, AlertTriangle, ArrowRight, RefreshCw,
  CalendarX2, PackageOpen, Boxes,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useInventoryItems, useLowStockItems, useExpiringInventory,
} from '@/hooks/use-inventory';
import { RadiologyAdminGuard } from '@/components/radiology/radiology-admin-guard';

// Radiology consumables tend to fall under these inventory categories. The
// underlying /inventory module doesn't have a "department" filter on item
// rows, so we just show consumables + equipment, which is the typical mix
// for radiology (contrast media, film, lead aprons, gel, gloves, etc.).
const RAD_CATEGORIES = ['consumable', 'equipment'] as const;

export default function RadiologyInventoryPage() {
  return (
    <RadiologyAdminGuard>
      <RadiologyInventoryInner />
    </RadiologyAdminGuard>
  );
}

function RadiologyInventoryInner() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'consumable' | 'equipment'>('consumable');

  const itemsQ = useInventoryItems({ category, isActive: true, limit: 50 });
  const lowStockQ = useLowStockItems({ limit: 20 });
  const expiringQ = useExpiringInventory(3);

  // Filter client-side by search; the items API doesn't accept search yet.
  const items = (itemsQ.data?.data ?? []).filter((it) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      it.itemName.toLowerCase().includes(q) ||
      (it.itemCode ?? '').toLowerCase().includes(q) ||
      (it.description ?? '').toLowerCase().includes(q)
    );
  });

  // Same client-side narrowing for the low-stock + expiring panels so the
  // radiology admin doesn't see unrelated pharmacy items.
  const lowStockRad = (lowStockQ.data?.data ?? []).filter((it) =>
    (RAD_CATEGORIES as readonly string[]).includes(it.category ?? ''),
  );
  const expiringItems = expiringQ.data && !Array.isArray(expiringQ.data)
    ? expiringQ.data.items
    : [];
  const expiringRad = expiringItems.filter((it) =>
    (RAD_CATEGORIES as readonly string[]).includes(it.item?.category ?? ''),
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="Radiology Inventory"
        description="Contrast media, film, consumables and equipment used in the imaging department."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { itemsQ.refetch(); lowStockQ.refetch(); expiringQ.refetch(); }}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
            </Button>
            <Link href="/inventory">
              <Button size="sm">
                Open full Inventory
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* Top stat row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile
          icon={Boxes}
          label="Tracked items"
          value={itemsQ.data?.meta?.total ?? items.length}
          accent="text-primary"
        />
        <Tile
          icon={AlertTriangle}
          label="Low stock (radiology)"
          value={lowStockRad.length}
          accent="text-amber-600"
          href="/inventory/low-stock"
        />
        <Tile
          icon={CalendarX2}
          label="Expiring ≤ 3mo"
          value={expiringRad.length}
          accent="text-rose-600"
          href="/inventory/expiring"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search item name, SKU, batch…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(['consumable', 'equipment'] as const).map((c) => (
            <Button
              key={c}
              size="sm"
              variant={category === c ? 'default' : 'outline'}
              onClick={() => setCategory(c)}
              className="capitalize"
            >
              <PackageOpen className="mr-1.5 h-3.5 w-3.5" />
              {c}
            </Button>
          ))}
        </div>
      </div>

      {/* Items table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        {itemsQ.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No items in this category"
            description="Use the full Inventory module to add radiology-specific consumables."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <Th>Name</Th>
                  <Th>Code</Th>
                  <Th>Category</Th>
                  <Th align="right">In stock</Th>
                  <Th align="right">Min. threshold</Th>
                  <Th>Unit</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const lowStock = Number(it.currentStock ?? 0) <= Number(it.minimumStockThreshold ?? 0);
                  return (
                    <tr key={it.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3 font-medium">{it.itemName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{it.itemCode ?? '-'}</td>
                      <td className="px-4 py-3 capitalize">{it.category ?? '-'}</td>
                      <td className={cn('px-4 py-3 text-right font-medium', lowStock && 'text-amber-700')}>
                        {it.currentStock ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {it.minimumStockThreshold ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {it.unitOfMeasurement ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        {lowStock ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                            Low stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                            OK
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({
  icon: Icon, label, value, accent, href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: string;
  href?: string;
}) {
  const card = (
    <div className={cn(
      'rounded-xl bg-surface-container-lowest shadow-sanctuary p-4',
      href && 'hover:scale-[1.01] transition-transform cursor-pointer',
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('font-headline text-2xl font-bold mt-1', accent)}>{value}</p>
        </div>
        <Icon className={cn('size-6', accent)} />
      </div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
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
