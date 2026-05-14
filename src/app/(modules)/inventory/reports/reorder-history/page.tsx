'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { ShoppingCart, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { apiGet } from '@/lib/api';
import { useReorderHistoryReport, type PurchaseOrderStatus } from '@/hooks/use-inventory';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', approved: 'Approved',
  delivered: 'Delivered', partially_delivered: 'Partial', cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  submitted: 'bg-blue-100 text-blue-700 border-blue-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  partially_delivered: 'bg-amber-100 text-amber-700 border-amber-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
};

function rupees(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface Supplier { id: string; name: string }

export default function ReorderHistoryReportPage() {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [fromDate, setFromDate] = useState(toInputDateStr(sixMonthsAgo));
  const [toDate, setToDate] = useState(toInputDateStr(today));
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState<PurchaseOrderStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data: supplierData } = useQuery({
    queryKey: ['inventory', 'suppliers', 'all'],
    queryFn: async () => {
      const r = await apiGet<Supplier[]>('/inventory/suppliers', { params: { limit: 200, isActive: true } });
      return r.data;
    },
  });

  const { data, isLoading } = useReorderHistoryReport({
    fromDate,
    toDate,
    supplierId: supplierId || undefined,
    status: (status || undefined) as PurchaseOrderStatus | undefined,
    page,
    limit: 20,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const bySupplier = data?.bySupplier ?? [];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="Reorder History Report"
        description="Past purchase orders with supplier, items, quantities and amounts"
      />

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label>Supplier</Label>
          <Select value={supplierId || 'all'} onValueChange={(v) => { setSupplierId(v === 'all' ? '' : (v ?? '')); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="All suppliers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {(supplierData ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status || 'all'} onValueChange={(v) => { setStatus((v === 'all' ? '' : (v as PurchaseOrderStatus)) ?? ''); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, lbl]) => (
                <SelectItem key={v} value={v}>{lbl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Supplier summary */}
      {bySupplier.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="font-headline text-base font-bold">By Supplier</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {bySupplier.map((row) => (
                  <tr key={row.supplierId} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{row.supplierName}</td>
                    <td className="px-4 py-2 text-right">{row.orderCount}</td>
                    <td className="px-4 py-2 text-right">{rupees(row.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h2 className="font-headline text-base font-bold">Purchase Orders</h2>
          {meta && (
            <span className="text-xs text-muted-foreground ml-2">{meta.total} total</span>
          )}
        </div>

        {isLoading ? (
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        ) : orders.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={ShoppingCart} title="No purchase orders" description="No POs match the selected filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{po.orderNumber}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(po.orderDate)}</td>
                    <td className="px-4 py-2">{po.supplier?.name ?? '-'}</td>
                    <td className="px-4 py-2 text-xs">
                      {po.items?.length ?? po._count?.items ?? 0} item(s)
                      {po.items && po.items.length > 0 && (
                        <div className="text-muted-foreground">
                          {po.items.slice(0, 2).map((it) => `${it.inventoryItem?.itemName} × ${it.quantityOrdered}`).join(', ')}
                          {po.items.length > 2 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{po.totalAmount ? rupees(Number(po.totalAmount)) : '-'}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLOR[po.status] ?? ''}`}>
                        {STATUS_LABELS[po.status] ?? po.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {meta.page} of {meta.totalPages} ({meta.total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
