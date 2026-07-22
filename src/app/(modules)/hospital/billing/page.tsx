'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Search, Banknote, CreditCard, Smartphone, Building2, Plus, FileText, ListChecks,
  Users, Activity, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate, formatTime24, toInputDateStr } from '@/lib/date-utils';
import type { Bill } from '@/types';
import { cn } from '@/lib/utils';
import { CollectBillPaymentDialog } from '@/components/hospital/billing/collect-bill-payment-dialog';
import { BillGeneratorDialog } from '@/components/hospital/billing/bill-generator-dialog';
import { IpBillingTab } from '@/components/hospital/billing/ip-billing-tab';

type TopAction = 'op-list' | 'draft' | 'order-list' | null;

export default function HospitalBillingPage() {
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [initialPatient, setInitialPatient] = useState<
    { id: string; firstName: string; lastName: string; mrn: string | null } | null
  >(null);
  const [initialBillId, setInitialBillId] = useState<string | null>(null);
  const [topAction, setTopAction] = useState<TopAction>(null);

  const openGenerator = (patient?: { id: string; firstName: string; lastName: string; mrn: string | null } | null, billId?: string | null) => {
    setInitialPatient(patient ?? null);
    setInitialBillId(billId ?? null);
    setGeneratorOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Hospital Billing</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setTopAction('op-list')}
          >
            <Users className="h-3.5 w-3.5" /> OP List
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setTopAction('draft')}
          >
            <FileText className="h-3.5 w-3.5" /> Drafts
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setTopAction('order-list')}
          >
            <ListChecks className="h-3.5 w-3.5" /> Order List
          </Button>
          <Button className="gap-1.5" onClick={() => openGenerator(null, null)}>
            <Plus className="h-4 w-4" /> New Bill
          </Button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <Tabs defaultValue="billing">
          <TabsList variant="line">
            <TabsTrigger value="billing">Hospital Billing</TabsTrigger>
            <TabsTrigger value="ip">IP Patients</TabsTrigger>
            <TabsTrigger value="cash-counter">Cash Counter</TabsTrigger>
            <TabsTrigger value="pending">Pending List</TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="pt-4">
            <BillingTab onOpenBill={(id, patient) => openGenerator(patient, id)} />
          </TabsContent>
          <TabsContent value="ip" className="pt-4">
            <IpBillingTab />
          </TabsContent>
          <TabsContent value="cash-counter" className="pt-4">
            <CashCounterTab />
          </TabsContent>
          <TabsContent value="pending" className="pt-4">
            <PendingListTab />
          </TabsContent>
        </Tabs>
      </div>

      <BillGeneratorDialog
        open={generatorOpen}
        onOpenChange={(o) => {
          setGeneratorOpen(o);
          if (!o) {
            setInitialBillId(null);
            setInitialPatient(null);
          }
        }}
        initialPatient={initialPatient}
        initialBillId={initialBillId}
      />

      <TopActionPanel
        action={topAction}
        onClose={() => setTopAction(null)}
        onPickPatient={(p) => {
          setTopAction(null);
          openGenerator(p, null);
        }}
        onPickBill={(bill) => {
          setTopAction(null);
          openGenerator(
            bill.patient
              ? {
                  id: bill.patient.id,
                  firstName: bill.patient.firstName,
                  lastName: bill.patient.lastName,
                  mrn: bill.patient.mrn ?? null,
                }
              : null,
            bill.id,
          );
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Billing tab — list of bills + click row to edit / collect
// ────────────────────────────────────────────────────────────────────────

function BillingTab({
  onOpenBill,
}: {
  onOpenBill: (billId: string, patient: { id: string; firstName: string; lastName: string; mrn: string | null } | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    // Shares the ['hospital','bills'] namespace so every billing mutation
    // (create / finalize / reopen / payment) refreshes this list. It used to
    // sit under ['hospital','billing'], which nothing ever invalidated — that
    // is why a freshly created bill never showed up here.
    queryKey: ['hospital', 'bills', 'list', { search, page }],
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
            placeholder="Search bill #, patient name, MRN..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-surface-container-low border-none rounded-xl pl-12 pr-6 py-2.5 w-full font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>
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
                bills.map((bill) => {
                  const total = Number((bill as { totalAmount?: number | string }).totalAmount ?? bill.total ?? 0);
                  const paid = Number((bill as { amountPaid?: number | string }).amountPaid ?? bill.paidAmount ?? 0);
                  const balance = Number((bill as { balanceDue?: number | string }).balanceDue ?? bill.balanceAmount ?? 0);
                  return (
                    <tr
                      key={bill.id}
                      onClick={() => onOpenBill(bill.id, bill.patient ? {
                        id: bill.patient.id,
                        firstName: bill.patient.firstName,
                        lastName: bill.patient.lastName,
                        mrn: bill.patient.mrn ?? null,
                      } : null)}
                      className="group hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-4 font-label text-sm font-bold">{bill.billNumber}</td>
                      <td className="px-4 py-4 font-label text-sm">
                        {bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}
                      </td>
                      <td className="px-4 py-4 font-label text-sm text-on-surface-variant">
                        {formatDate(bill.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-right font-label text-sm font-bold">{total.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-4 text-right font-label text-sm text-primary font-bold">{paid.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-4 text-right font-label text-sm text-error font-bold">{balance.toLocaleString('en-IN')}</td>
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
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Cash Counter tab — today's collections by method + table
// ────────────────────────────────────────────────────────────────────────

function CashCounterTab() {
  const [search, setSearch] = useState('');

  const today = toInputDateStr();

  // Authoritative summary from /collection-summary so totals reconcile across
  // pagination (the payments list view is intentionally capped at 100 today).
  const { data: summary } = useQuery({
    queryKey: ['hospital', 'collection-summary', today],
    queryFn: async () => {
      const response = await apiGet<{
        totalCollection: number; cash: number; card: number; upi: number;
        bankTransfer: number; cheque: number;
      }>('/billing/collection-summary', { params: { startDate: today, endDate: today } });
      return response.data;
    },
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ['hospital', 'cash-counter', search],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 100, fromDate: today };
      if (search) params.search = search;
      const response = await apiGet<Array<{
        id: string; amount: number; paymentMethod: string; status: string;
        paymentDate: string; transactionId?: string;
        bill?: { billNumber: string; patient?: { firstName: string; lastName: string } };
      }>>('/billing/payments', { params });
      return response.data;
    },
  });

  const fmt = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

  const summaryCards = [
    { label: 'Total Collection', value: fmt(summary?.totalCollection ?? 0), icon: Building2, border: 'border-primary', iconStyle: 'bg-primary/10 text-primary' },
    { label: 'Cash', value: fmt(summary?.cash ?? 0), icon: Banknote, border: 'border-primary-container', iconStyle: 'bg-primary-container/10 text-primary-container' },
    { label: 'Card', value: fmt(summary?.card ?? 0), icon: CreditCard, border: 'border-secondary', iconStyle: 'bg-secondary/10 text-secondary' },
    { label: 'UPI', value: fmt(summary?.upi ?? 0), icon: Smartphone, border: 'border-tertiary', iconStyle: 'bg-tertiary/10 text-tertiary' },
    { label: 'Bank/Cheque', value: fmt((summary?.bankTransfer ?? 0) + (summary?.cheque ?? 0)), icon: Building2, border: 'border-outline', iconStyle: 'bg-surface-container-high text-on-surface-variant' },
  ];

  // Hourly distribution chart (today only)
  const hourlyDist = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => 0);
    for (const p of payments ?? []) {
      if (p.status !== 'completed') continue;
      const d = new Date(p.paymentDate);
      buckets[d.getHours()] += Number(p.amount) || 0;
    }
    const max = Math.max(...buckets, 1);
    return { buckets, max };
  }, [payments]);

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

      {/* Hourly distribution */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">
            Hourly Collection (Today)
          </span>
        </div>
        <div className="flex items-end gap-1 h-20">
          {hourlyDist.buckets.map((amt, h) => (
            <div
              key={h}
              className="flex-1 flex flex-col items-center justify-end gap-1"
              title={`${h.toString().padStart(2, '0')}:00 — ₹${amt.toLocaleString('en-IN')}`}
            >
              <div
                className={cn(
                  'w-full rounded-t transition-all',
                  amt > 0 ? 'bg-primary' : 'bg-surface-container',
                )}
                style={{ height: `${(amt / hourlyDist.max) * 100}%`, minHeight: amt > 0 ? '4px' : '2px' }}
              />
              <span className="font-label text-[8px] text-on-surface-variant">{h}</span>
            </div>
          ))}
        </div>
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
                    <td className="px-4 py-4 font-label text-sm text-on-surface-variant">{p.transactionId || '-'}</td>
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

// ────────────────────────────────────────────────────────────────────────
// Pending tab — unpaid/partial bills with aging + quick collect
// ────────────────────────────────────────────────────────────────────────

function PendingListTab() {
  const queryClient = useQueryClient();
  const [collectTarget, setCollectTarget] = useState<Bill | null>(null);
  const [agingFilter, setAgingFilter] = useState<'all' | '0-7' | '8-30' | '31-60' | '60+'>('all');

  const { data: pending } = useQuery({
    queryKey: ['hospital', 'billing-pending', 'pending'],
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params: { status: 'pending', limit: 100 } });
      return response.data;
    },
  });
  const { data: partial } = useQuery({
    queryKey: ['hospital', 'billing-pending', 'partial'],
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params: { status: 'partially_paid', limit: 100 } });
      return response.data;
    },
  });

  const all = useMemo(() => {
    const merged = [...(pending ?? []), ...(partial ?? [])];
    return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [pending, partial]);

  const withAging = useMemo(() => {
    const now = new Date();
    return all.map((b) => {
      const ageDays = Math.floor((now.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      let bucket: '0-7' | '8-30' | '31-60' | '60+';
      if (ageDays <= 7) bucket = '0-7';
      else if (ageDays <= 30) bucket = '8-30';
      else if (ageDays <= 60) bucket = '31-60';
      else bucket = '60+';
      return { ...b, ageDays, bucket };
    });
  }, [all]);

  const filtered = useMemo(
    () => (agingFilter === 'all' ? withAging : withAging.filter((b) => b.bucket === agingFilter)),
    [withAging, agingFilter],
  );

  const bucketTotals = useMemo(() => {
    const t = { '0-7': 0, '8-30': 0, '31-60': 0, '60+': 0 };
    for (const b of withAging) {
      const bal = Number((b as { balanceDue?: number | string }).balanceDue ?? b.balanceAmount ?? 0);
      t[b.bucket] += bal;
    }
    return t;
  }, [withAging]);

  const handleCollected = () => {
    queryClient.invalidateQueries({ queryKey: ['hospital', 'billing-pending'] });
    queryClient.invalidateQueries({ queryKey: ['hospital', 'bills'] });
    queryClient.invalidateQueries({ queryKey: ['hospital', 'cash-counter'] });
    queryClient.invalidateQueries({ queryKey: ['hospital', 'collection-summary'] });
    setCollectTarget(null);
  };

  const fmt = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['0-7', '8-30', '31-60', '60+'] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setAgingFilter(agingFilter === b ? 'all' : b)}
            className={cn(
              'rounded-xl border-l-4 p-3 text-left transition-all',
              agingFilter === b ? 'bg-primary/10 border-primary' : 'bg-surface-container-lowest border-outline hover:border-primary/40',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3 w-3 text-on-surface-variant" />
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{b} days</span>
            </div>
            <p className="font-headline text-base font-extrabold">{fmt(bucketTotals[b])}</p>
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 font-semibold">Bill #</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 font-semibold">Age</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-right">Amount</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-right">Balance</th>
                <th className="px-4 pb-4 pt-5 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No pending bills{agingFilter !== 'all' ? ` in ${agingFilter} day bucket` : ''}.
                  </td>
                </tr>
              ) : (
                filtered.map((bill) => {
                  const total = Number((bill as { totalAmount?: number | string }).totalAmount ?? bill.total ?? 0);
                  const balance = Number((bill as { balanceDue?: number | string }).balanceDue ?? bill.balanceAmount ?? 0);
                  return (
                    <tr key={bill.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-4 font-label text-sm font-bold">{bill.billNumber}</td>
                      <td className="px-4 py-4 font-label text-sm">{bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}</td>
                      <td className="px-4 py-4 font-label text-xs">
                        <span className={cn(
                          'rounded-full px-2 py-0.5',
                          bill.bucket === '0-7' && 'bg-primary/10 text-primary',
                          bill.bucket === '8-30' && 'bg-secondary/10 text-secondary',
                          bill.bucket === '31-60' && 'bg-tertiary/10 text-tertiary',
                          bill.bucket === '60+' && 'bg-error-container text-on-error-container',
                        )}>
                          {bill.ageDays}d
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-label text-sm">{fmt(total)}</td>
                      <td className="px-4 py-4 text-right font-label text-sm text-error font-bold">{fmt(balance)}</td>
                      <td className="px-4 py-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          disabled={balance <= 0}
                          onClick={() => setCollectTarget(bill)}
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          Accept Payment
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <CollectBillPaymentDialog
          open={!!collectTarget}
          onOpenChange={(open) => { if (!open) setCollectTarget(null); }}
          bill={
            collectTarget
              ? {
                  id: collectTarget.id,
                  billNumber: collectTarget.billNumber,
                  balanceDue: Number(
                    (collectTarget as { balanceDue?: number | string }).balanceDue ?? collectTarget.balanceAmount ?? 0,
                  ),
                  patientName: collectTarget.patient
                    ? `${collectTarget.patient.firstName} ${collectTarget.patient.lastName}`
                    : undefined,
                }
              : null
          }
          onCollected={handleCollected}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Top-bar action panel (OP List / Drafts / Order List)
// Slides down under the page header.
// ────────────────────────────────────────────────────────────────────────

function TopActionPanel({
  action,
  onClose,
  onPickPatient,
  onPickBill,
}: {
  action: TopAction;
  onClose: () => void;
  onPickPatient: (p: { id: string; firstName: string; lastName: string; mrn: string | null }) => void;
  onPickBill: (b: Bill) => void;
}) {
  if (!action) return null;
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-label text-sm font-bold capitalize">
          {action === 'op-list' && "Today's OP Appointments"}
          {action === 'draft' && 'Draft Bills'}
          {action === 'order-list' && 'Pending Orders Awaiting Billing'}
        </h2>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
      {action === 'op-list' && <OPListPanel onPickPatient={onPickPatient} />}
      {action === 'draft' && <DraftListPanel onPickBill={onPickBill} />}
      {action === 'order-list' && <OrderListPanel onPickPatient={onPickPatient} />}
    </div>
  );
}

function OPListPanel({
  onPickPatient,
}: {
  onPickPatient: (p: { id: string; firstName: string; lastName: string; mrn: string | null }) => void;
}) {
  const today = toInputDateStr();
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'billing-op-list', today],
    queryFn: async () => {
      const response = await apiGet<Array<{
        id: string;
        appointmentDate: string; startTime: string; status: string;
        patient?: { id: string; firstName: string; lastName: string; mrn: string };
        doctor?: { user?: { firstName: string; lastName: string }; specialization?: string };
      }>>('/appointments', { params: { date: today, limit: 100 } });
      return response.data;
    },
  });

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-on-surface-variant"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Loading...</p>;
  }
  if (!data || data.length === 0) {
    return <p className="py-6 text-center text-sm text-on-surface-variant">No OP appointments today.</p>;
  }
  return (
    <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-surface-container-lowest">
          <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Patient</th>
            <th className="px-3 py-2">Doctor</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container/40">
          {data.map((a) => (
            <tr key={a.id} className="hover:bg-surface-container-low">
              <td className="px-3 py-2 font-label text-sm">{formatTime24(a.startTime)}</td>
              <td className="px-3 py-2 font-label text-sm">
                {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '-'}
                <span className="ml-2 text-[10px] text-on-surface-variant">MRN {a.patient?.mrn ?? '-'}</span>
              </td>
              <td className="px-3 py-2 font-label text-sm">
                {a.doctor?.user ? `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName}` : '-'}
              </td>
              <td className="px-3 py-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant capitalize">
                  {a.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={!a.patient}
                  onClick={() => a.patient && onPickPatient({
                    id: a.patient.id,
                    firstName: a.patient.firstName,
                    lastName: a.patient.lastName,
                    mrn: a.patient.mrn,
                  })}
                >
                  Generate Bill
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DraftListPanel({ onPickBill }: { onPickBill: (b: Bill) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'billing-drafts'],
    queryFn: async () => {
      const response = await apiGet<Bill[]>('/billing', { params: { status: 'draft', limit: 100 } });
      return response.data;
    },
  });

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-on-surface-variant"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Loading...</p>;
  }
  if (!data || data.length === 0) {
    return <p className="py-6 text-center text-sm text-on-surface-variant">No draft bills.</p>;
  }
  return (
    <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-surface-container-lowest">
          <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
            <th className="px-3 py-2">Bill #</th>
            <th className="px-3 py-2">Patient</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2 text-right">Items</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container/40">
          {data.map((b) => {
            const total = Number((b as { totalAmount?: number | string }).totalAmount ?? b.total ?? 0);
            const itemCount = (b as { billItems?: unknown[]; items?: unknown[] }).billItems?.length
              ?? (b as { items?: unknown[] }).items?.length
              ?? 0;
            return (
              <tr key={b.id} className="hover:bg-surface-container-low">
                <td className="px-3 py-2 font-label text-sm font-bold">{b.billNumber}</td>
                <td className="px-3 py-2 font-label text-sm">
                  {b.patient ? `${b.patient.firstName} ${b.patient.lastName}` : '-'}
                </td>
                <td className="px-3 py-2 font-label text-xs text-on-surface-variant">{formatDate(b.createdAt)}</td>
                <td className="px-3 py-2 text-right font-label text-sm">{itemCount}</td>
                <td className="px-3 py-2 text-right font-label text-sm font-bold">₹{total.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" className="text-xs" onClick={() => onPickBill(b)}>
                    Continue
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderListPanel({
  onPickPatient,
}: {
  onPickPatient: (p: { id: string; firstName: string; lastName: string; mrn: string | null }) => void;
}) {
  // Pull lab+imaging+pharmacy unbilled orders. Backend aggregation isn't
  // exposed yet — we query each module's existing read endpoint and merge.
  const { data: labOrders } = useQuery({
    queryKey: ['hospital', 'billing-order-list', 'lab'],
    queryFn: async () => {
      const r = await apiGet<Array<{
        id: string; createdAt: string;
        patient?: { id: string; firstName: string; lastName: string; mrn?: string };
        labOrderItems?: Array<{ test?: { testName: string } }>;
      }>>('/lab/orders', { params: { limit: 30 } });
      return r.data ?? [];
    },
  });

  const { data: imagingReqs } = useQuery({
    queryKey: ['hospital', 'billing-order-list', 'imaging'],
    queryFn: async () => {
      const r = await apiGet<Array<{
        id: string; createdAt: string; imagingType: string; bodyPart?: string;
        patient?: { id: string; firstName: string; lastName: string; mrn?: string };
      }>>('/imaging/requests', { params: { limit: 30 } });
      return r.data ?? [];
    },
  });

  const merged = useMemo(() => {
    const rows: Array<{
      key: string; type: string; createdAt: string; description: string;
      patient?: { id: string; firstName: string; lastName: string; mrn?: string };
    }> = [];
    for (const o of labOrders ?? []) {
      rows.push({
        key: `lab-${o.id}`,
        type: 'Lab',
        createdAt: o.createdAt,
        description: o.labOrderItems?.map((i) => i.test?.testName).filter(Boolean).join(', ') || 'Lab order',
        patient: o.patient,
      });
    }
    for (const r of imagingReqs ?? []) {
      rows.push({
        key: `img-${r.id}`,
        type: 'Imaging',
        createdAt: r.createdAt,
        description: `${r.imagingType}${r.bodyPart ? ` — ${r.bodyPart}` : ''}`,
        patient: r.patient,
      });
    }
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [labOrders, imagingReqs]);

  if (merged.length === 0) {
    return <p className="py-6 text-center text-sm text-on-surface-variant">No pending orders.</p>;
  }
  return (
    <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-surface-container-lowest">
          <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Patient</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container/40">
          {merged.map((r) => (
            <tr key={r.key} className="hover:bg-surface-container-low">
              <td className="px-3 py-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.type}</span>
              </td>
              <td className="px-3 py-2 font-label text-sm">{r.description}</td>
              <td className="px-3 py-2 font-label text-sm">
                {r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '-'}
                <span className="ml-2 text-[10px] text-on-surface-variant">MRN {r.patient?.mrn ?? '-'}</span>
              </td>
              <td className="px-3 py-2 font-label text-xs text-on-surface-variant">{formatDate(r.createdAt)}</td>
              <td className="px-3 py-2 text-right">
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={!r.patient}
                  onClick={() => r.patient && onPickPatient({
                    id: r.patient.id,
                    firstName: r.patient.firstName,
                    lastName: r.patient.lastName,
                    mrn: r.patient.mrn ?? null,
                  })}
                >
                  Bill Patient
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
