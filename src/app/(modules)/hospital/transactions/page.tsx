'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CollectionSummaryCard } from '@/components/hospital/billing/collection-summary';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate, formatTime24, toInputDateStr } from '@/lib/date-utils';
import type { CollectionSummary, Bill } from '@/types';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import { DrawerClose } from '@/components/hospital/billing/drawer-close';
import {
  Banknote, CreditCard, Smartphone, FileText, Download, RotateCcw, Ban,
  Receipt as ReceiptIcon, Search, RefreshCw,
} from 'lucide-react';
import {
  CancelBillDialog,
  PaymentReversalDialog,
  ReceiptDownloadButton,
  RefundApproveButton,
  RefundRejectButton,
  RefundRequestDialog,
} from '@/components/hospital/billing/week12-dialogs';
import {
  useReceipts,
  useRefunds,
  useDayEnd,
  type ReceiptRow,
} from '@/hooks/use-hospital';

export default function BillingTransactionPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Billing Transactions</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <Tabs defaultValue="summary">
          <TabsList variant="line" className="flex-wrap">
            <TabsTrigger value="summary">Collection Summary</TabsTrigger>
            <TabsTrigger value="overall">Overall Bills</TabsTrigger>
            <TabsTrigger value="credit">Credit Bills</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="receipt">Receipts</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
            <TabsTrigger value="dayend">Day End</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="pt-4">
            <CollectionSummaryTab />
          </TabsContent>
          <TabsContent value="overall" className="pt-4">
            <BillListTab status={undefined} />
          </TabsContent>
          <TabsContent value="credit" className="pt-4">
            <BillListTab status="partially_paid" credit />
          </TabsContent>
          <TabsContent value="cancelled" className="pt-4">
            <BillListTab status="cancelled" />
          </TabsContent>
          <TabsContent value="draft" className="pt-4">
            <BillListTab status="draft" />
          </TabsContent>
          <TabsContent value="receipt" className="pt-4">
            <ReceiptsTab />
          </TabsContent>
          <TabsContent value="refunds" className="pt-4">
            <RefundsTab />
          </TabsContent>
          <TabsContent value="dayend" className="pt-4">
            <DayEndTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CollectionSummaryTab() {
  const [date, setDate] = useState(toInputDateStr());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hospital', 'collection-summary', date],
    queryFn: async () => {
      try {
        const r = await apiGet<CollectionSummary>('/billing/collection-summary', {
          params: { startDate: date, endDate: date },
        });
        return r.data;
      } catch {
        return undefined;
      }
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[200px]" />
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>
      <CollectionSummaryCard summary={data} isLoading={isLoading} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Generic Bill list tab (Overall / Credit / Cancelled / Draft)
// ────────────────────────────────────────────────────────────────────────

function BillListTab({ status, credit }: { status: string | undefined; credit?: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [cancelBill, setCancelBill] = useState<{ id: string; billNumber: string; totalAmount: number; amountPaid: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'bills', status, search, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (status) params.status = status;
      if (search) params.search = search;
      const response = await apiGet<Bill[]>('/billing', { params });
      return { data: response.data, meta: response.meta! };
    },
  });

  const bills = data?.data ?? [];
  // Credit tab also needs `pending` bills (balanceDue > 0) — fold them in
  // when in credit mode by fetching a second slice.
  const { data: extra } = useQuery({
    queryKey: ['hospital', 'bills', 'credit-pending', page, search],
    queryFn: async () => {
      if (!credit) return [];
      const params: Record<string, unknown> = { status: 'pending', limit: 20, page };
      if (search) params.search = search;
      const r = await apiGet<Bill[]>('/billing', { params });
      return r.data ?? [];
    },
    enabled: !!credit,
  });

  const allBills = credit ? [...bills, ...(extra ?? [])] : bills;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder="Search bill # / patient / MRN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

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
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
              ) : allBills.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center font-label text-on-surface-variant">No bills found.</td></tr>
              ) : (
                allBills.map((bill) => {
                  const total = Number((bill as { totalAmount?: number | string }).totalAmount ?? bill.total ?? 0);
                  const paid = Number((bill as { amountPaid?: number | string }).amountPaid ?? bill.paidAmount ?? 0);
                  const balance = Number((bill as { balanceDue?: number | string }).balanceDue ?? bill.balanceAmount ?? 0);
                  return (
                    <tr key={bill.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-label text-sm font-bold">{bill.billNumber}</td>
                      <td className="px-4 py-3 font-label text-sm">{bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}</td>
                      <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{formatDate(bill.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-label text-sm font-bold">₹{total.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-primary font-label text-sm">₹{paid.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-error font-label text-sm">₹{balance.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                          bill.status === 'paid' && 'bg-primary/10 text-primary',
                          bill.status === 'pending' && 'bg-secondary/10 text-secondary',
                          bill.status === 'partially_paid' && 'bg-primary-container/10 text-primary-container',
                          bill.status === 'cancelled' && 'bg-error-container text-on-error-container',
                          bill.status === 'draft' && 'bg-surface-container-high text-on-surface-variant',
                          bill.status === 'refunded' && 'bg-tertiary/10 text-tertiary',
                        )}>
                          {bill.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {bill.status !== 'cancelled' && bill.status !== 'refunded' && paid === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-error"
                            onClick={() => setCancelBill({ id: bill.id, billNumber: bill.billNumber, totalAmount: total, amountPaid: paid })}
                          >
                            <Ban className="h-3 w-3" /> Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
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

      <CancelBillDialog
        open={!!cancelBill}
        onOpenChange={(o) => { if (!o) setCancelBill(null); }}
        bill={cancelBill}
        onCancelled={() => {
          queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Receipts tab — full receipt history with PDF download
// ────────────────────────────────────────────────────────────────────────

function ReceiptsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params: Record<string, unknown> = { page, limit: 20 };
  if (search) params.search = search;
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const { data, isLoading } = useReceipts(params);
  const receipts = (data?.data ?? []) as ReceiptRow[];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder="Search receipt # / bill #..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="max-w-[160px]" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="max-w-[160px]" />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Receipt #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bill #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Type</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Method</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Amount</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
              ) : receipts.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center font-label text-on-surface-variant">No receipts found.</td></tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{r.receiptNumber}</td>
                    <td className="px-4 py-3 font-label text-sm">{r.payment?.bill?.billNumber ?? '-'}</td>
                    <td className="px-4 py-3 font-label text-sm">
                      {r.payment?.patient
                        ? `${r.payment.patient.firstName} ${r.payment.patient.lastName}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                        r.payment?.paymentType === 'advance' && 'bg-tertiary/10 text-tertiary',
                        r.payment?.paymentType === 'refund' && 'bg-error-container text-on-error-container',
                        (!r.payment || r.payment?.paymentType === 'regular') && 'bg-primary/10 text-primary',
                      )}>{r.payment?.paymentType ?? '-'}</span>
                    </td>
                    <td className="px-4 py-3 font-label text-sm capitalize">{r.payment?.paymentMethod?.replace('_', ' ') ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">₹{Number(r.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{formatDate(r.receiptDate)} {formatTime24(r.receiptDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <ReceiptDownloadButton receiptId={r.id} label="PDF" />
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

// ────────────────────────────────────────────────────────────────────────
// Refunds tab — approve/reject workflow
// ────────────────────────────────────────────────────────────────────────

function RefundsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'requested' | 'approved' | 'rejected'>('all');
  const [page, setPage] = useState(1);

  const params: Record<string, unknown> = { page, limit: 20 };
  if (statusFilter !== 'all') params.status = statusFilter;
  const { data, isLoading } = useRefunds(params);
  const refunds = data?.data ?? [];
  const meta = data?.meta;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hospital', 'refunds'] });

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['all', 'requested', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-bold capitalize',
              statusFilter === s ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bill #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Amount</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Reason</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Requested</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Decided by</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
              ) : refunds.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center font-label text-on-surface-variant">No refunds.</td></tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{r.bill?.billNumber ?? '-'}</td>
                    <td className="px-4 py-3 font-label text-sm">{r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '-'}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">₹{Number(r.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-label text-xs text-on-surface-variant max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                        r.status === 'requested' && 'bg-secondary/10 text-secondary',
                        r.status === 'approved' && 'bg-primary/10 text-primary',
                        r.status === 'processed' && 'bg-primary-container/10 text-primary-container',
                        r.status === 'rejected' && 'bg-error-container text-on-error-container',
                      )}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(r.createdAt)}
                      {r.requester && (
                        <div className="text-on-surface">by {r.requester.firstName} {r.requester.lastName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {r.approver
                        ? (
                          <>
                            <div className="text-on-surface">{r.approver.firstName} {r.approver.lastName}</div>
                            {r.processedAt && <div>{formatDate(r.processedAt)}</div>}
                          </>
                        )
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'requested' && (
                        <div className="flex justify-end gap-1">
                          <RefundApproveButton refundId={r.id} onChanged={invalidate} />
                          <RefundRejectButton refundId={r.id} onChanged={invalidate} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(meta?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-xs text-on-surface-variant">Page {page} of {meta?.totalPages}</p>
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

// ────────────────────────────────────────────────────────────────────────
// Day End tab — uses /billing/day-end with reversal/method/type breakdown
// and supports payment reversal inline.
// ────────────────────────────────────────────────────────────────────────

function DayEndTab() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(toInputDateStr());
  const { data, isLoading } = useDayEnd(date);
  const [reversePayment, setReversePayment] = useState<{ id: string; amount: number; billNumber?: string; method?: string } | null>(null);
  const [refundPayment, setRefundPayment] = useState<{ id: string; amount: number; billNumber?: string; patientName?: string } | null>(null);

  const fmt = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
  const methodIcons: Record<string, React.ReactNode> = {
    cash: <Banknote className="h-3.5 w-3.5 text-emerald-600" />,
    credit_card: <CreditCard className="h-3.5 w-3.5 text-blue-600" />,
    debit_card: <CreditCard className="h-3.5 w-3.5 text-blue-600" />,
    upi: <Smartphone className="h-3.5 w-3.5 text-violet-600" />,
    net_banking: <FileText className="h-3.5 w-3.5 text-indigo-600" />,
    cheque: <FileText className="h-3.5 w-3.5 text-amber-600" />,
  };

  const grouped = useMemo(() => {
    const m = new Map<string, number>();
    if (data) {
      for (const [k, v] of Object.entries(data.byMethod)) m.set(k, v);
    }
    return Array.from(m.entries());
  }, [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  if (!data) {
    return <p className="py-12 text-center text-sm text-on-surface-variant">No data for {date}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[200px]" />
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['hospital', 'day-end'] })}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={data.payments.length === 0}
          onClick={() => {
            // Exactly what the screen shows, in the order it shows it — a
            // day-end sheet is reconciled line by line against the drawer, so
            // the export has to agree with the page it was taken from.
            downloadCsv(
              `day-end-${data.date}.csv`,
              data.payments.map((p) => ({
                'Bill No': p.billNumber ?? '',
                Patient: p.patientName ?? '',
                Method: p.method.replace(/_/g, ' '),
                Type: p.type,
                // Refunds are money out; signing them keeps a spreadsheet SUM
                // over this column equal to the net figure on screen.
                Amount: p.type === 'refund' ? -p.amount : p.amount,
                Cashier: p.cashier ?? '',
                Time: formatTime24(p.paymentDate),
                Status: p.status,
                Reference: p.transactionId ?? '',
              })),
            );
          }}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryCell label="Collected" value={fmt(data.collected)} accent="border-l-primary" />
        <SummaryCell label="Refunded" value={fmt(data.refunded ?? 0)} sub="paid back out of the drawer" accent="border-l-error" />
        <SummaryCell
          label="Net in Drawer"
          value={fmt(data.netCollection ?? data.collected)}
          sub="collected less refunds — count against this"
          accent="border-l-primary"
        />
        <SummaryCell label="Bills Generated" value={String(data.byStatusBills.generated)} sub={`${data.byStatusBills.paid} paid · ${data.byStatusBills.pending} pending`} accent="border-l-secondary" />
        <SummaryCell label="Reversed" value={fmt(data.reversed)} accent="border-l-error" />
        <SummaryCell label="Total Billed" value={fmt(data.billed)} accent="border-l-tertiary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* By method — what to count in each tender at close of day */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Collection by Method</p>
          {grouped.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No payments.</p>
          ) : (
            <ul className="space-y-1.5">
              {grouped.map(([m, v]) => {
                const back = data.refundsByMethod?.[m] ?? 0;
                return (
                  <li key={m} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize">
                      {methodIcons[m] ?? <Banknote className="h-3.5 w-3.5 text-on-surface-variant" />}
                      {m.replace('_', ' ')}
                    </span>
                    <span className="text-right">
                      <span className="font-bold">{fmt(v - back)}</span>
                      {back > 0 && (
                        <span className="block font-label text-[10px] text-error">
                          {fmt(v)} in · {fmt(back)} back
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* By type */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Collection by Type</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center justify-between">
              <span>Regular</span><span className="font-bold">{fmt(data.byType.regular ?? 0)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Advance</span><span className="font-bold text-tertiary">{fmt(data.byType.advance ?? 0)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Refund</span><span className="font-bold text-error">{fmt(data.byType.refund ?? 0)}</span>
            </li>
          </ul>
        </div>

        {/* By cashier — with payments marked by hand, this is the unit a shift
            actually reconciles on: whose drawer is holding what. */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">By Cashier</p>
          {(data.byCashier?.length ?? 0) === 0 ? (
            <p className="text-xs text-on-surface-variant">No attributed payments.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.byCashier.map((c) => (
                <li key={c.userId} className="flex items-center justify-between gap-2">
                  <span className="truncate" title={c.name}>{c.name}</span>
                  <span className="text-right whitespace-nowrap">
                    <span className="font-bold">{fmt(c.collected - c.refunded)}</span>
                    {c.refunded > 0 && (
                      <span className="block font-label text-[10px] text-error">
                        {fmt(c.refunded)} refunded
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* The drawer close — everything above is the system talking to itself;
          this is where it meets the cash actually in the till. */}
      <DrawerClose date={date} />

      {/* Transaction list with row actions */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container flex items-center gap-2">
          <ReceiptIcon className="h-3.5 w-3.5 text-primary" />
          <h4 className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
            {data.payments.length} Transactions
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bill #</th>
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Method</th>
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Type</th>
                <th className="px-4 pb-3 pt-3 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Amount</th>
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Cashier</th>
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Time</th>
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                <th className="px-4 pb-3 pt-3 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {data.payments.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center font-label text-on-surface-variant">No transactions today.</td></tr>
              ) : data.payments.map((p) => (
                <tr key={p.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-2.5 font-label text-sm font-bold">{p.billNumber ?? '-'}</td>
                  <td className="px-4 py-2.5 font-label text-sm">{p.patientName ?? '-'}</td>
                  <td className="px-4 py-2.5 capitalize text-xs">{p.method.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      p.type === 'advance' && 'bg-tertiary/10 text-tertiary',
                      p.type === 'refund' && 'bg-error-container text-on-error-container',
                      p.type === 'regular' && 'bg-primary/10 text-primary',
                    )}>{p.type}</span>
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-label text-sm font-bold',
                    p.type === 'refund' && 'text-error',
                  )}>
                    {p.type === 'refund' ? '−' : ''}₹{p.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-2.5 font-label text-[10px] text-on-surface-variant">{p.cashier ?? '—'}</td>
                  <td className="px-4 py-2.5 font-label text-[10px] text-on-surface-variant">{formatTime24(p.paymentDate)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      p.status === 'completed' && 'bg-primary/10 text-primary',
                      p.status === 'reversed' && 'bg-error-container text-on-error-container',
                      p.status === 'failed' && 'bg-secondary/10 text-secondary',
                    )}>{p.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.status === 'completed' && p.amount > 0 && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => setRefundPayment({ id: p.id, amount: p.amount, billNumber: p.billNumber ?? undefined, patientName: p.patientName ?? undefined })}
                        >
                          Refund
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs text-error"
                          onClick={() => setReversePayment({ id: p.id, amount: p.amount, billNumber: p.billNumber ?? undefined, method: p.method })}
                        >
                          <RotateCcw className="h-3 w-3" /> Reverse
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentReversalDialog
        open={!!reversePayment}
        onOpenChange={(o) => { if (!o) setReversePayment(null); }}
        payment={reversePayment}
        onReversed={() => queryClient.invalidateQueries({ queryKey: ['hospital', 'day-end'] })}
      />
      <RefundRequestDialog
        open={!!refundPayment}
        onOpenChange={(o) => { if (!o) setRefundPayment(null); }}
        payment={refundPayment}
        onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['hospital', 'refunds'] })}
      />
    </div>
  );
}

function SummaryCell({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className={cn('bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4', accent)}>
      <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="font-label text-[10px] text-on-surface-variant mt-0.5">{sub}</p>}
    </div>
  );
}
