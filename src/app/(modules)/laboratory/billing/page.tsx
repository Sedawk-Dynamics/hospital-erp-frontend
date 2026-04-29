'use client';

import { useState } from 'react';
import { Search, Receipt, RefreshCw, IndianRupee, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLabOrders } from '@/hooks/use-lab';
import type { LabOrder } from '@/hooks/use-lab';

const paymentStatusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  unpaid: { label: 'Unpaid', className: 'bg-red-100 text-red-800', icon: AlertCircle },
  partial: { label: 'Partial', className: 'bg-amber-100 text-amber-800', icon: Clock },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800', icon: CheckCircle },
};

const orderStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  sample_collected: { label: 'Sample Collected', className: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', className: 'bg-purple-100 text-purple-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
};

export default function LabBillingPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [paymentFilter, setPaymentFilter] = useState<string>('');

  const { data, isLoading, refetch } = useLabOrders({
    search: search || undefined,
    page,
    limit: 20,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;

  // Client-side payment filter (API may not support this directly)
  const filteredOrders = paymentFilter
    ? orders.filter((o: LabOrder) => (o.paymentStatus || 'unpaid') === paymentFilter)
    : orders;

  // Calculate summary stats from current page
  const totalBilled = orders.reduce((sum: number, o: LabOrder) => sum + (o.totalAmount || 0), 0);
  const totalPaid = orders.reduce((sum: number, o: LabOrder) => sum + (o.paidAmount || 0), 0);
  const totalPending = totalBilled - totalPaid;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Lab Billing</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary">
          <div className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
            <IndianRupee className="h-4 w-4" />
            Total Billed
          </div>
          <p className="font-headline text-3xl font-extrabold mt-1">
            {totalBilled.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
          </p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary">
          <div className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Total Paid
          </div>
          <p className="font-headline text-3xl font-extrabold mt-1 text-green-600">
            {totalPaid.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
          </p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary">
          <div className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
            <Clock className="h-4 w-4 text-amber-600" />
            Pending Amount
          </div>
          <p className="font-headline text-3xl font-extrabold mt-1 text-amber-600">
            {totalPending.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order #, patient name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          {[
            { value: '', label: 'All' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'partial', label: 'Partial' },
            { value: 'paid', label: 'Paid' },
          ].map((filter) => (
            <Button
              key={filter.value}
              variant={paymentFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setPaymentFilter(filter.value); setPage(1); }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Order #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Tests</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Total Amount</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Paid</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Payment Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Order Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No billing records found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: LabOrder) => {
                  const paymentStatus = paymentStatusConfig[order.paymentStatus || 'unpaid'] || paymentStatusConfig.unpaid;
                  const orderStatus = orderStatusConfig[order.status] || orderStatusConfig.pending;
                  const PaymentIcon = paymentStatus.icon;
                  return (
                    <tr key={order.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-medium font-mono text-xs">{order.orderNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {order.patient?.firstName} {order.patient?.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{order.patient?.mrn || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[180px]">
                          {(order.tests?.length ?? 0) > 0 ? (
                            <div className="text-xs">
                              {(order.tests ?? []).slice(0, 2).map((t, i) => (
                                <div key={i} className="truncate">{t.name}</div>
                              ))}
                              {(order.tests?.length ?? 0) > 2 && (
                                <span className="text-muted-foreground">+{(order.tests?.length ?? 0) - 2} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {(order.totalAmount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {(order.paidAmount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
                          paymentStatus.className,
                        )}>
                          <PaymentIcon className="h-3 w-3" />
                          {paymentStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          orderStatus.className,
                        )}>
                          {orderStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {(meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {meta?.totalPages} ({meta?.total} records)
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
