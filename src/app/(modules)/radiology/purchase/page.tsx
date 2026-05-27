'use client';

// Radiology Purchase — radiology_admin only.
// Vendor purchase orders relevant to imaging. Mirrors the lab-side purchase
// surface — it's a read-driven lens on /inventory/purchase-orders so the
// admin can see what's been ordered for the radiology department without
// leaving the module. Creating + approving still happens in /inventory.

import { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, RefreshCw, ArrowRight, Search, Truck, CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { usePurchaseOrders, useSuppliers } from '@/hooks/use-inventory';
import { RadiologyAdminGuard } from '@/components/radiology/radiology-admin-guard';

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', className: 'bg-zinc-100 text-zinc-700', icon: Clock },
  pending_approval: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  ordered: { label: 'Ordered', className: 'bg-purple-100 text-purple-800', icon: Truck },
  partially_received: { label: 'Partially Received', className: 'bg-orange-100 text-orange-800', icon: Truck },
  received: { label: 'Received', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function RadiologyPurchasePage() {
  return (
    <RadiologyAdminGuard>
      <RadiologyPurchaseInner />
    </RadiologyAdminGuard>
  );
}

function RadiologyPurchaseInner() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const ordersQ = usePurchaseOrders({ limit: 50 });
  const suppliersQ = useSuppliers({ limit: 100 });

  const orders = (ordersQ.data?.data ?? []).filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      (o.supplier?.name ?? '').toLowerCase().includes(q)
    );
  });

  const radSuppliers = (suppliersQ.data?.data ?? []).filter((s) =>
    s.supplyType === 'all' || s.supplyType === 'consumables' || s.supplyType === 'equipment',
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="Radiology Purchase"
        description="Vendor purchase orders for contrast media, film, consumables and equipment."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { ordersQ.refetch(); suppliersQ.refetch(); }}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
            </Button>
            <Link href="/inventory/purchase-orders">
              <Button size="sm">
                New Purchase Order
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Tile icon={ShoppingCart} label="Open POs" value={countByStatus(orders, ['pending_approval', 'approved', 'ordered', 'partially_received'])} accent="text-primary" />
        <Tile icon={Truck} label="Awaiting delivery" value={countByStatus(orders, ['ordered', 'partially_received'])} accent="text-blue-600" />
        <Tile icon={CheckCircle} label="Suppliers" value={radSuppliers.length} accent="text-emerald-600" href="/inventory/suppliers" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search PO number, supplier…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['', 'pending_approval', 'approved', 'ordered', 'received', 'cancelled'] as const).map((s) => (
            <Button
              key={s || 'all'}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
              className="capitalize"
            >
              {s ? s.replace(/_/g, ' ') : 'All'}
            </Button>
          ))}
        </div>
      </div>

      {/* PO table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        {ordersQ.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchase orders"
            description="Create a PO from the Inventory module — it will appear here filtered for radiology."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <Th>PO #</Th>
                  <Th>Supplier</Th>
                  <Th>Order Date</Th>
                  <Th>Expected</Th>
                  <Th align="right">Items</Th>
                  <Th align="right">Total</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => {
                  const status = statusConfig[po.status] || statusConfig.draft;
                  const Icon = status.icon;
                  return (
                    <tr key={po.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3 font-mono text-xs">{po.orderNumber}</td>
                      <td className="px-4 py-3 font-medium">{po.supplier?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(po.orderDate)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">{po._count?.items ?? po.items?.length ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {po.totalAmount != null
                          ? Number(po.totalAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn('gap-1', status.className)}>
                          <Icon className="h-3 w-3" />
                          {status.label}
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
    </div>
  );
}

function countByStatus(orders: Array<{ status: string }>, statuses: string[]): number {
  return orders.filter((o) => statuses.includes(o.status)).length;
}

function Tile({
  icon: Icon, label, value, accent, href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
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
