'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DollarSign, TrendingUp, Clock, Search, FileCheck,
  CreditCard, ReceiptText, Undo2, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface BillItem {
  id: string;
  billNumber: string;
  patient?: { firstName: string; lastName: string; mrn: string };
  total: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  createdAt: string;
}

interface RevenueStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  pending: number;
}

interface RefundRequest {
  id: string;
  billNumber: string;
  patientName: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function BillingDashboard() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: revenueStats, isLoading: statsLoading } = useQuery({
    queryKey: ['billing-admin', 'revenue-stats'],
    queryFn: async () => {
      try {
        const response = await apiGet<RevenueStats>('/billing/payments', {
          params: { summary: true },
        });
        return response.data;
      } catch {
        return { today: 0, thisWeek: 0, thisMonth: 0, pending: 0 } as RevenueStats;
      }
    },
  });

  const { data: billsData, isLoading: billsLoading } = useQuery({
    queryKey: ['billing-admin', 'recent-bills', search, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const response = await apiGet<BillItem[]>('/billing', { params });
      return { data: response.data, meta: response.meta };
    },
  });

  const { data: refunds, isLoading: refundsLoading } = useQuery({
    queryKey: ['billing-admin', 'refunds'],
    queryFn: async () => {
      try {
        const response = await apiGet<RefundRequest[]>('/billing', {
          params: { status: 'refund_requested', limit: 10 },
        });
        return response.data;
      } catch {
        return [] as RefundRequest[];
      }
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async (billId: string) => {
      await apiPost(`/billing/${billId}/finalize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-admin'] });
      toast.success('Bill finalized successfully');
    },
    onError: () => {
      toast.error('Failed to finalize bill');
    },
  });

  const bills = billsData?.data ?? [];
  const pendingRefunds = refunds ?? [];
  const revenue = revenueStats ?? { today: 0, thisWeek: 0, thisMonth: 0, pending: 0 };

  const stats = [
    { label: 'Today', value: fmt(revenue.today), icon: DollarSign },
    { label: 'This Week', value: fmt(revenue.thisWeek), icon: TrendingUp },
    { label: 'This Month', value: fmt(revenue.thisMonth), icon: CreditCard },
    { label: 'Pending', value: fmt(revenue.pending), icon: Clock },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Billing Administration</h1>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">Revenue overview, bill management, and refunds</p>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary transition-all duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-headline font-bold text-lg">
                  {statsLoading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          placeholder="Search UHID, bill number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {/* Recent Bills Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="h-4 w-4" />
            </div>
            Recent Bills
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Bill #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Total</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Paid</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Balance</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {billsLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center font-label text-on-surface-variant">No bills found.</td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{bill.billNumber}</td>
                    <td className="px-4 py-3 font-label text-sm">
                      {bill.patient ? [bill.patient.firstName, bill.patient.lastName].filter(Boolean).join(' ') : '-'}
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(bill.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">{fmt(bill.total)}</td>
                    <td className="px-4 py-3 text-right font-label text-sm text-primary">{fmt(bill.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-label text-sm text-error">{fmt(bill.balanceAmount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          bill.status === 'paid' && 'bg-primary/10 text-primary',
                          bill.status === 'pending' && 'bg-secondary/10 text-secondary',
                          bill.status === 'partially_paid' && 'bg-secondary/10 text-secondary',
                          bill.status === 'cancelled' && 'bg-error-container text-on-error-container',
                          bill.status === 'draft' && 'bg-secondary/10 text-secondary',
                        )}
                      >
                        {bill.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {bill.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          disabled={finalizeMutation.isPending}
                          onClick={() => finalizeMutation.mutate(bill.id)}
                        >
                          <FileCheck className="h-3.5 w-3.5" />
                          Finalize
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(billsData?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-[10px] text-on-surface-variant">
              Page {page} of {billsData?.meta?.totalPages}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (billsData?.meta?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Refunds */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Undo2 className="h-4 w-4" />
            </div>
            Pending Refunds
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Bill #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Amount</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Reason</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {refundsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : pendingRefunds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No pending refunds.
                  </td>
                </tr>
              ) : (
                pendingRefunds.map((refund) => (
                  <tr key={refund.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{refund.billNumber}</td>
                    <td className="px-4 py-3 font-label text-sm">{refund.patientName}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold text-error">{fmt(refund.amount)}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{refund.reason}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(refund.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">
                        {refund.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
