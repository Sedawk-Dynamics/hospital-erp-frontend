'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CollectionSummaryCard } from '@/components/hospital/billing/collection-summary';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate, formatTime24, toInputDateStr } from '@/lib/date-utils';
import type { CollectionSummary, Bill } from '@/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Banknote, CreditCard, Smartphone, FileText, Download } from 'lucide-react';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';

export default function BillingTransactionPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Billing Transaction</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <Tabs defaultValue="summary">
          <TabsList variant="line" className="flex-wrap">
            <TabsTrigger value="summary">Billing & Collection</TabsTrigger>
            <TabsTrigger value="overall">Overall Bills</TabsTrigger>
            <TabsTrigger value="credit">Credit Bills</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled Bills</TabsTrigger>
            <TabsTrigger value="draft">Draft Bills</TabsTrigger>
            <TabsTrigger value="receipt">Receipt Bills</TabsTrigger>
            <TabsTrigger value="dayend">Day End</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="pt-4">
            <CollectionSummaryTab />
          </TabsContent>
          <TabsContent value="overall" className="pt-4">
            <BillListTab status={undefined} />
          </TabsContent>
          <TabsContent value="credit" className="pt-4">
            <BillListTab status="partially_paid" />
          </TabsContent>
          <TabsContent value="cancelled" className="pt-4">
            <BillListTab status="cancelled" />
          </TabsContent>
          <TabsContent value="draft" className="pt-4">
            <BillListTab status="draft" />
          </TabsContent>
          <TabsContent value="receipt" className="pt-4">
            <BillListTab status="paid" />
          </TabsContent>
          <TabsContent value="dayend" className="pt-4">
            <DayEndTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Forms assigned by admin to transactions_home view location appear here */}
      <PatientFormSubmissionsPanel
        title="Transactions Forms Submissions"
        viewLocation="transactions_home"
      />
    </div>
  );
}

function CollectionSummaryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'collection-summary'],
    queryFn: async () => {
      try {
        const response = await apiGet<CollectionSummary>('/billing/collection-summary');
        return response.data;
      } catch {
        return undefined;
      }
    },
  });

  return <CollectionSummaryCard summary={data} isLoading={isLoading} />;
}

function BillListTab({ status }: { status: string | undefined }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'bills', status, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (status) params.status = status;
      const response = await apiGet<Bill[]>('/billing', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const bills = data?.data ?? [];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bill #</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Total</th>
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Paid</th>
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Balance</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
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
                  <td className="px-4 py-3 font-label text-sm font-bold">{bill.billNumber}</td>
                  <td className="px-4 py-3 font-label text-sm">{bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{formatDate(bill.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-label text-sm font-bold">{bill.total?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-label text-sm">{bill.paidAmount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-label text-sm">{bill.balanceAmount?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      bill.status === 'paid' && 'bg-primary/10 text-primary',
                      bill.status === 'pending' && 'bg-secondary/10 text-secondary',
                      bill.status === 'partially_paid' && 'bg-primary/10 text-primary',
                      bill.status === 'cancelled' && 'bg-error-container text-on-error-container',
                      bill.status === 'draft' && 'bg-secondary/10 text-secondary',
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
  );
}

function DayEndTab() {
  const today = toInputDateStr();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['hospital', 'day-end', today],
    queryFn: async () => {
      const response = await apiGet<Array<{
        id: string; amount: number; paymentMethod: string; status: string;
        paymentDate: string; referenceNumber?: string;
        bill?: { billNumber: string; patient?: { firstName: string; lastName: string } };
      }>>('/billing/payments', { params: { startDate: today, limit: 200 } });
      return response.data;
    },
  });

  const { data: bills } = useQuery({
    queryKey: ['hospital', 'day-end-bills', today],
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params: { startDate: today, limit: 200 } });
      return response.data;
    },
  });

  const completed = (payments ?? []).filter((p) => p.status === 'completed');
  const summary = completed.reduce(
    (acc, p) => {
      const amt = Number(p.amount) || 0;
      acc.total += amt;
      acc.count += 1;
      const method = p.paymentMethod || 'other';
      acc.byMethod[method] = (acc.byMethod[method] || 0) + amt;
      return acc;
    },
    { total: 0, count: 0, byMethod: {} as Record<string, number> },
  );

  const totalBills = (bills ?? []).length;
  const paidBills = (bills ?? []).filter((b) => b.status === 'paid').length;
  const pendingBills = (bills ?? []).filter((b) => b.status === 'pending' || b.status === 'partially_paid').length;
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const methodIcons: Record<string, React.ReactNode> = {
    cash: <Banknote className="h-4 w-4 text-emerald-600" />,
    card: <CreditCard className="h-4 w-4 text-blue-600" />,
    upi: <Smartphone className="h-4 w-4 text-violet-600" />,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline text-lg font-bold">Day End Report</h3>
          <p className="font-label text-[10px] text-on-surface-variant">{formatDate(new Date())}</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-primary">
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Total Collection</p>
          <p className="text-2xl font-bold mt-1">{fmt(summary.total)}</p>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">{summary.count} transactions</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-secondary">
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Bills Generated</p>
          <p className="text-2xl font-bold mt-1">{totalBills}</p>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">{paidBills} paid, {pendingBills} pending</p>
        </div>
        {Object.entries(summary.byMethod).map(([method, amount]) => (
          <div key={method} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-primary">
            <div className="flex items-center gap-2">
              {methodIcons[method] || <FileText className="h-4 w-4 text-on-surface-variant" />}
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{method}</p>
            </div>
            <p className="text-2xl font-bold mt-1">{fmt(amount)}</p>
          </div>
        ))}
      </div>

      {/* Transaction List */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h4 className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Today&apos;s Transactions</h4>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bill #</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Method</th>
              <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Amount</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Time</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/50">
            {completed.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">No transactions today.</td></tr>
            ) : (
              completed.map((p) => (
                <tr key={p.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-2.5 font-label text-sm font-bold">{p.bill?.billNumber ?? '-'}</td>
                  <td className="px-4 py-2.5 font-label text-sm">{p.bill?.patient ? `${p.bill.patient.firstName} ${p.bill.patient.lastName}` : '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">
                      {methodIcons[p.paymentMethod]}
                      {p.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-label text-sm font-bold">{fmt(Number(p.amount))}</td>
                  <td className="px-4 py-2.5 font-label text-[10px] text-on-surface-variant">{formatTime24(p.paymentDate)}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Completed</span>
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
