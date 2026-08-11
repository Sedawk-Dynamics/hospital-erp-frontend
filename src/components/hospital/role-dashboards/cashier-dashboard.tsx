'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Banknote, CreditCard, Smartphone, Building2, Search,
  IndianRupee, ReceiptText, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface PendingBill {
  id: string;
  billNumber: string;
  patient?: { firstName: string; lastName: string; mrn: string };
  total: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  paymentDate: string;
  referenceNumber?: string;
  bill?: {
    billNumber: string;
    patient?: { firstName: string; lastName: string };
  };
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function CashierDashboard() {
  const [search, setSearch] = useState('');
  const [collectBillId, setCollectBillId] = useState<string | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const queryClient = useQueryClient();
  const today = toInputDateStr();

  // Today's payments for collection summary
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['cashier', 'payments', today],
    queryFn: async () => {
      const response = await apiGet<PaymentRecord[]>('/billing/payments', {
        params: { startDate: today, limit: 100 },
      });
      return response.data;
    },
  });

  // Pending bills (payment queue)
  const { data: pendingBills, isLoading: pendingLoading } = useQuery({
    queryKey: ['cashier', 'pending-bills', search],
    queryFn: async () => {
      const params: Record<string, unknown> = { status: 'pending', limit: 30 };
      if (search) params.search = search;
      const response = await apiGet<PendingBill[]>('/billing', { params });
      return response.data;
    },
  });

  const collectMutation = useMutation({
    mutationFn: async ({ billId, amount, method }: { billId: string; amount: number; method: string }) => {
      await apiPost('/billing/payments', {
        billId,
        amount,
        paymentMethod: method,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashier'] });
      toast.success('Payment collected successfully');
      setCollectBillId(null);
      setCollectAmount('');
      setCollectMethod('cash');
    },
    onError: () => {
      toast.error('Failed to collect payment');
    },
  });

  const allPayments = payments ?? [];
  const completedPayments = allPayments.filter((p) => p.status === 'completed');

  const summary = completedPayments.reduce(
    (acc, p) => {
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

  const summaryCards = [
    { label: 'Total Collection', value: fmt(summary.total), icon: IndianRupee },
    { label: 'Cash', value: fmt(summary.cash), icon: Banknote },
    { label: 'Card', value: fmt(summary.card), icon: CreditCard },
    { label: 'UPI', value: fmt(summary.upi), icon: Smartphone },
    { label: 'Other', value: fmt(summary.other), icon: Building2 },
  ];

  const bills = pendingBills ?? [];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Cashier Dashboard</h1>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">Collect payments and track daily collections</p>
        </div>
      </div>

      {/* Collection Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary transition-all duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <card.icon className="h-3.5 w-3.5" />
              </div>
              <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{card.label}</span>
            </div>
            <p className="font-headline font-bold text-lg">
              {paymentsLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                card.value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Collect Payment Form (inline) */}
      {collectBillId && (
        <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary p-4 space-y-3">
          <h3 className="font-headline text-lg font-bold">Collect Payment</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Amount</label>
              <Input
                type="number"
                placeholder="0.00"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Method</label>
              <div className="flex gap-1">
                {['cash', 'card', 'upi'].map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={collectMethod === m ? 'default' : 'outline'}
                    onClick={() => setCollectMethod(m)}
                    className="capitalize"
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={collectMutation.isPending || !collectAmount}
              onClick={() =>
                collectMutation.mutate({
                  billId: collectBillId,
                  amount: parseFloat(collectAmount),
                  method: collectMethod,
                })
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCollectBillId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          placeholder="Search pending bills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Payment Queue */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ReceiptText className="h-4 w-4" />
            </div>
            Payment Queue — Bills Awaiting Payment
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Bill #</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Patient</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Total</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Paid</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold">Balance</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold">Date</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {pendingLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No pending bills in queue.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="group hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label text-sm font-bold">{bill.billNumber}</td>
                    <td className="px-4 py-3 font-label text-sm">
                      {bill.patient ? [bill.patient.firstName, bill.patient.lastName].filter(Boolean).join(' ') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold">{fmt(bill.total)}</td>
                    <td className="px-4 py-3 text-right font-label text-sm text-primary">{fmt(bill.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-label text-sm font-bold text-error">{fmt(bill.balanceAmount)}</td>
                    <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                      {formatDate(bill.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => {
                          setCollectBillId(bill.id);
                          setCollectAmount(String(bill.balanceAmount));
                        }}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        Collect
                      </Button>
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
