'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CollectionSummaryCard } from '@/components/hospital/billing/collection-summary';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate, formatTime24, toInputDateStr } from '@/lib/date-utils';
import type { CollectionSummary, Bill } from '@/types';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/csv';
import { DrawerClose } from '@/components/hospital/billing/drawer-close';
import { ReceivablesTab } from '@/components/hospital/billing/receivables-tab';
import { DiscountApprovals } from '@/components/hospital/billing/discount-approvals';
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
import { fullName } from '@/lib/person-name';
import { formatINR } from '@/lib/money';
import { billBalance, balanceTitle, rowKeyOpen } from '@/components/hospital/billing/bill-balance';
import { BillGeneratorDialog } from '@/components/hospital/billing/bill-generator-dialog';

export default function BillingTransactionPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Billing Transactions</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        {/* `?tab=` deep-links a tab — the dashboard money tiles land on
            Revenue (gap item 360). useSearchParams needs a Suspense boundary
            on a prerendered page. */}
        <Suspense fallback={<TransactionTabs />}>
          <TransactionTabsFromUrl />
        </Suspense>
      </div>
    </div>
  );
}

const TAB_VALUES = ['summary', 'revenue', 'overall', 'credit', 'cancelled', 'draft', 'receipt', 'refunds', 'receivables', 'approvals', 'dayend'];

function TransactionTabsFromUrl() {
  const sp = useSearchParams();
  const tab = sp.get('tab');
  const kind = sp.get('kind') === 'advances' ? 'advances' : 'revenue';
  const date = sp.get('date');
  return (
    <TransactionTabs
      key={`${tab}|${kind}|${date}`}
      initialTab={tab && TAB_VALUES.includes(tab) ? tab : undefined}
      revenueKind={kind}
      revenueDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
    />
  );
}

function TransactionTabs({
  initialTab,
  revenueKind = 'revenue',
  revenueDate,
}: {
  initialTab?: string;
  revenueKind?: 'revenue' | 'advances';
  revenueDate?: string;
}) {
  return (
        <Tabs defaultValue={initialTab ?? 'summary'}>
          <TabsList variant="line" className="flex-wrap">
            <TabsTrigger value="summary">Collection Summary</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="overall">Overall Bills</TabsTrigger>
            <TabsTrigger value="credit">Credit Bills</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="receipt">Receipts</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
            <TabsTrigger value="receivables">Receivables</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="dayend">Day End</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="pt-4">
            <CollectionSummaryTab />
          </TabsContent>
          <TabsContent value="revenue" className="pt-4">
            <RevenueTab initialKind={revenueKind} initialDate={revenueDate} />
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
          <TabsContent value="receivables" className="pt-4">
            <ReceivablesTab />
          </TabsContent>
          <TabsContent value="approvals" className="pt-4">
            <DiscountApprovals />
          </TabsContent>
          <TabsContent value="dayend" className="pt-4">
            <DayEndTab />
          </TabsContent>
        </Tabs>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Revenue tab — the payments behind the dashboard's money tiles (gap item
// 360). Read from the same definition and the same IST day as the tiles, so
// the total here is the tile's figure.
// ────────────────────────────────────────────────────────────────────────

interface RevenueRows {
  date: string;
  kind: 'revenue' | 'advances';
  total: number;
  count: number;
  rows: Array<{
    id: string;
    paymentDate: string;
    amount: number;
    method: string;
    type: string;
    documentNumber: string | null;
    billNumber: string | null;
    patientName: string | null;
    mrn: string | null;
    fromAdvance: boolean;
  }>;
}

function RevenueTab({ initialKind, initialDate }: { initialKind: 'revenue' | 'advances'; initialDate?: string }) {
  const [kind, setKind] = useState<'revenue' | 'advances'>(initialKind);
  const [date, setDate] = useState(initialDate ?? toInputDateStr());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hospital', 'revenue-rows', kind, date],
    queryFn: async () => (await apiGet<RevenueRows>('/dashboard/revenue', { params: { kind, date } })).data,
  });
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['revenue', 'advances'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-bold',
                kind === k ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant',
              )}
            >
              {k === 'revenue' ? 'Revenue' : 'Advances received'}
            </button>
          ))}
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[200px]" />
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              `${kind}-${date}.csv`,
              rows.map((r) => ({
                'Document No': r.documentNumber ?? '',
                'Bill No': r.billNumber ?? '',
                Patient: r.patientName ?? '',
                UHID: r.mrn ?? '',
                Method: r.method.replace(/_/g, ' '),
                Source: r.fromAdvance ? 'advance applied' : r.type,
                Amount: r.amount,
                Time: formatTime24(r.paymentDate),
              })),
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4 border-l-primary">
        <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
          {kind === 'revenue' ? 'Revenue' : 'Advances received'} · {formatDate(data?.date ?? date)}
        </p>
        <p className="mt-1 text-xl font-bold">{formatINR(data?.total ?? 0)}</p>
        <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
          {kind === 'revenue'
            ? 'Money received against bills, including deposits and advances set against a bill. Advances still held are not revenue.'
            : 'Advance and deposit receipts — held for the patient until set against a bill.'}
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Document #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bill #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Method</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Source</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Amount</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">Nothing for this day.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{r.documentNumber ?? '-'}</td>
                    <td className="px-4 py-3 font-label text-sm">{r.billNumber ?? '-'}</td>
                    <td className="px-4 py-3 font-label text-sm">{r.patientName ?? '-'}</td>
                    <td className="px-4 py-3 font-label text-sm capitalize">{r.method.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 font-label text-xs text-on-surface-variant">{r.fromAdvance ? 'advance applied' : r.type}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">{formatINR(r.amount)}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{formatTime24(r.paymentDate)}</td>
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
  // Clicking a row opens the bill (gap item 364).
  const [openBill, setOpenBill] = useState<Bill | null>(null);

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
                  const balance = billBalance(bill);
                  // Ordinary Cancel is for an unpaid bill that is still a draft
                  // or awaiting payment. A paid bill — a waived ₹0 follow-up
                  // included — is settled; reversing it is a refund or credit
                  // note, not a cancel (gap item 365).
                  const canCancel = (bill.status === 'draft' || bill.status === 'pending') && paid === 0;
                  return (
                    <tr
                      key={bill.id}
                      tabIndex={0}
                      aria-label={`Open bill ${bill.billNumber}`}
                      onClick={() => setOpenBill(bill)}
                      onKeyDown={rowKeyOpen(() => setOpenBill(bill))}
                      className="group cursor-pointer hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none transition-colors"
                    >
                      <td className="px-4 py-3 font-label text-sm font-bold">{bill.billNumber}</td>
                      <td className="px-4 py-3 font-label text-sm">{bill.patient ? fullName(bill.patient) : '-'}</td>
                      <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">{formatDate(bill.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-label text-sm font-bold">{formatINR(total)}</td>
                      <td className="px-4 py-3 text-right text-primary font-label text-sm">{formatINR(paid)}</td>
                      <td className="px-4 py-3 text-right text-error font-label text-sm" title={balanceTitle(bill)}>{formatINR(balance)}</td>
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
                        {canCancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-error"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelBill({ id: bill.id, billNumber: bill.billNumber, totalAmount: total, amountPaid: paid });
                            }}
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

      <BillGeneratorDialog
        open={!!openBill}
        onOpenChange={(o) => { if (!o) setOpenBill(null); }}
        initialBillId={openBill?.id ?? null}
        initialPatient={
          openBill?.patient
            ? {
                id: openBill.patient.id,
                firstName: openBill.patient.firstName,
                lastName: openBill.patient.lastName,
                mrn: openBill.patient.mrn ?? null,
              }
            : null
        }
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
                        ? fullName(r.payment.patient)
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
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">{formatINR(r.amount)}</td>
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
                    <td className="px-4 py-3 font-label text-sm">{r.patient ? fullName(r.patient) : '-'}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">{formatINR(r.amount)}</td>
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

  const fmt = (n: number) => formatINR(n);
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

  // Held money set against a bill is not a collection (gap item 361): it is
  // listed apart, after the collection rows, on screen and in the CSV alike.
  const collections = useMemo(() => (data?.payments ?? []).filter((p) => !p.isAdjustment), [data]);
  const adjustments = useMemo(() => (data?.payments ?? []).filter((p) => p.isAdjustment), [data]);

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
              [...collections, ...adjustments].map((p) => ({
                // Each row's own receipt / voucher number — the bill number
                // alone repeated across every advance on the same ADV- holding
                // bill (gap item 361).
                'Document No': p.receiptNumber ?? '',
                'Bill No': p.billNumber ?? '',
                Patient: p.patientName ?? '',
                Method: p.method.replace(/_/g, ' '),
                Type: p.isAdjustment ? 'advance adjusted (not counted)' : p.type,
                // Refunds are money out; signing them keeps a spreadsheet SUM
                // over this column equal to the net figure on screen. An
                // adjustment is not money in at all, so it carries no amount
                // here — only in its own column.
                Amount: p.isAdjustment ? 0 : p.type === 'refund' ? -p.amount : p.amount,
                'Adjusted (not counted)': p.isAdjustment ? p.amount : 0,
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
            {/* Held money set against bills. Listed so the day reconciles,
                never added to the collection (gap item 361). */}
            {(data.byType.adjustment ?? 0) > 0 && (
              <li className="flex items-center justify-between text-on-surface-variant">
                <span>Advance adjusted (not new money)</span><span className="font-bold">{fmt(data.byType.adjustment ?? 0)}</span>
              </li>
            )}
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
            {collections.length} Transactions
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-3 pt-3 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Receipt # / Bill #</th>
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
              {collections.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center font-label text-on-surface-variant">No transactions today.</td></tr>
              ) : collections.map((p) => (
                <tr key={p.id} className={cn('group hover:bg-surface-container-low transition-colors', p.isAdjustment && 'text-on-surface-variant')}>
                  {/* One row per receipt document: its own number first, so
                      two advances on the same ADV- holding bill no longer read
                      as one identifier repeated (gap item 361). */}
                  <td className="px-4 py-2.5 font-label text-sm">
                    <span className="font-bold">{p.receiptNumber ?? '-'}</span>
                    <span className="block text-[10px] text-on-surface-variant">{p.billNumber ?? ''}</span>
                  </td>
                  <td className="px-4 py-2.5 font-label text-sm">{p.patientName ?? '-'}</td>
                  <td className="px-4 py-2.5 capitalize text-xs">{p.method.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                      p.type === 'advance' && 'bg-tertiary/10 text-tertiary',
                      p.type === 'refund' && 'bg-error-container text-on-error-container',
                      p.type === 'regular' && 'bg-primary/10 text-primary',
                    )}>{p.isAdjustment ? 'adjustment' : p.type}</span>
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-label text-sm font-bold',
                    p.type === 'refund' && 'text-error',
                  )}>
                    {p.type === 'refund' ? '−' : ''}{fmt(p.amount)}
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
                    {p.status === 'completed' && p.amount > 0 && !p.isAdjustment && (
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

      {/* Held money set against bills — listed so the day reconciles, never
          added to the collection or the CSV's Amount column (gap item 361). */}
      {adjustments.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-container">
            <h4 className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
              Advance adjusted against bills — not new money ({fmt(adjustments.reduce((s, p) => s + p.amount, 0))})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-surface-container/50">
                {adjustments.map((p) => (
                  <tr key={p.id} className="text-on-surface-variant">
                    <td className="px-4 py-2.5 font-label text-sm">{p.billNumber ?? '-'}</td>
                    <td className="px-4 py-2.5 font-label text-sm">{p.patientName ?? '-'}</td>
                    <td className="px-4 py-2.5 text-right font-label text-sm">{fmt(p.amount)}</td>
                    <td className="px-4 py-2.5 font-label text-[10px]">{formatTime24(p.paymentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
