'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Banknote, CreditCard, Smartphone, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate, formatTime24, toInputDateStr } from '@/lib/date-utils';
import type { Bill } from '@/types';
import { cn } from '@/lib/utils';

export default function HospitalBillingPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Hospital Billing</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <Tabs defaultValue="billing">
          <TabsList variant="line">
            <TabsTrigger value="billing">Hospital Billing</TabsTrigger>
            <TabsTrigger value="cash-counter">Cash Counter</TabsTrigger>
            <TabsTrigger value="pending">Pending List</TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="pt-4">
            <BillingTab />
          </TabsContent>
          <TabsContent value="cash-counter" className="pt-4">
            <CashCounterTab />
          </TabsContent>
          <TabsContent value="pending" className="pt-4">
            <PendingListTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BillingTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'billing', { search, page }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (search) params.search = search;
      const response = await apiGet<Bill[]>('/billing', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const bills = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
          <input
            placeholder="Search UHID, Phone, OP Number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
        <Button className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">New Bill</Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 font-semibold">Bill #</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Date</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-right">Total</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-right">Paid</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-right">Balance</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">No bills found.</td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-4 font-label text-sm font-bold">{bill.billNumber}</td>
                    <td className="px-4 py-4 font-label text-sm">
                      {bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-4 font-label text-sm text-on-surface-variant">
                      {formatDate(bill.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right font-label text-sm font-bold">{bill.total?.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-label text-sm text-primary font-bold">{bill.paidAmount?.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-label text-sm text-error font-bold">{bill.balanceAmount?.toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        bill.status === 'paid' && 'bg-primary/10 text-primary',
                        bill.status === 'pending' && 'bg-secondary/10 text-secondary',
                        bill.status === 'partially_paid' && 'bg-primary-container/10 text-primary-container',
                        bill.status === 'cancelled' && 'bg-error-container text-on-error-container',
                        bill.status === 'draft' && 'bg-surface-container-high text-on-surface-variant',
                      )}>
                        {bill.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(data?.meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-xs text-on-surface-variant">Page {page} of {data?.meta?.totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingListTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'billing-pending'],
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params: { status: 'pending', limit: 50 } });
      return response.data;
    },
  });

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 font-semibold">Bill #</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Patient</th>
              <th className="px-4 pb-4 pt-5 font-semibold text-right">Amount</th>
              <th className="px-4 pb-4 pt-5 font-semibold text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/50">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : (data || []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-label text-on-surface-variant">No pending bills.</td>
              </tr>
            ) : (
              (data || []).map((bill) => (
                <tr key={bill.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-4 font-label text-sm font-bold">{bill.billNumber}</td>
                  <td className="px-4 py-4 font-label text-sm">{bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-4 text-right font-label text-sm">{bill.total?.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-label text-sm text-error font-bold">{bill.balanceAmount?.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CashCounterTab() {
  const [search, setSearch] = useState('');

  const { data: payments, isLoading } = useQuery({
    queryKey: ['hospital', 'cash-counter', search],
    queryFn: async () => {
      const today = toInputDateStr();
      const params: Record<string, unknown> = { limit: 50, startDate: today };
      if (search) params.search = search;
      const response = await apiGet<Array<{
        id: string; amount: number; paymentMethod: string; status: string;
        paymentDate: string; referenceNumber?: string;
        bill?: { billNumber: string; patient?: { firstName: string; lastName: string } };
      }>>('/billing/payments', { params });
      return response.data;
    },
  });

  const summary = (payments ?? []).reduce(
    (acc, p) => {
      if (p.status !== 'completed') return acc;
      const amt = Number(p.amount) || 0;
      acc.total += amt;
      if (p.paymentMethod === 'cash') acc.cash += amt;
      else if (p.paymentMethod === 'card') acc.card += amt;
      else if (p.paymentMethod === 'upi') acc.upi += amt;
      else acc.other += amt;
      return acc;
    },
    { total: 0, cash: 0, card: 0, upi: 0, other: 0 },
  );

  const fmt = (n: number) => `Rs ${n.toLocaleString('en-IN')}`;

  const summaryCards = [
    { label: 'Total Collection', value: fmt(summary.total), icon: Building2, border: 'border-primary', iconStyle: 'bg-primary/10 text-primary' },
    { label: 'Cash', value: fmt(summary.cash), icon: Banknote, border: 'border-primary-container', iconStyle: 'bg-primary-container/10 text-primary-container' },
    { label: 'Card', value: fmt(summary.card), icon: CreditCard, border: 'border-secondary', iconStyle: 'bg-secondary/10 text-secondary' },
    { label: 'UPI', value: fmt(summary.upi), icon: Smartphone, border: 'border-tertiary', iconStyle: 'bg-tertiary/10 text-tertiary' },
    { label: 'Other', value: fmt(summary.other), icon: Building2, border: 'border-outline', iconStyle: 'bg-surface-container-high text-on-surface-variant' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {summaryCards.map((s) => (
          <div key={s.label} className={`bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 ${s.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${s.iconStyle}`}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
              <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">{s.label}</span>
            </div>
            <p className="font-headline text-lg font-extrabold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
        <input
          placeholder="Search by bill number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 font-semibold">Bill #</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Patient</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Method</th>
              <th className="px-4 pb-4 pt-5 font-semibold text-right">Amount</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Reference</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Time</th>
              <th className="px-4 pb-4 pt-5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
            ) : (payments ?? []).length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">No payments today.</td></tr>
            ) : (
              (payments ?? []).map((p) => (
                <tr key={p.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-4 font-label text-sm font-bold">{p.bill?.billNumber ?? '-'}</td>
                  <td className="px-4 py-4 font-label text-sm">{p.bill?.patient ? `${p.bill.patient.firstName} ${p.bill.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant capitalize">{p.paymentMethod?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-4 text-right font-label text-sm font-bold">{fmt(Number(p.amount))}</td>
                  <td className="px-4 py-4 font-label text-sm text-on-surface-variant">{p.referenceNumber || '-'}</td>
                  <td className="px-4 py-4 font-label text-sm text-on-surface-variant">{formatTime24(p.paymentDate)}</td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      p.status === 'completed' && 'bg-primary/10 text-primary',
                      p.status === 'pending' && 'bg-secondary/10 text-secondary',
                      p.status === 'failed' && 'bg-error-container text-on-error-container',
                    )}>{p.status}</span>
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
