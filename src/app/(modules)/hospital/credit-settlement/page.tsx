'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Banknote, Search, Building2, ShieldCheck, User, ChevronRight, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  useCreditSettlementList,
  useCreditSettlementBills,
  type CreditSettlementRow,
} from '@/hooks/use-hospital';
import { SplitPaymentDialog } from '@/components/hospital/billing/week12-dialogs';
import { CollectBillPaymentDialog } from '@/components/hospital/billing/collect-bill-payment-dialog';
import { formatDate } from '@/lib/date-utils';

type ProviderType = 'insurance' | 'corporate' | 'patient';

export default function CreditSettlementPage() {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Credit Settlement</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
        <Tabs defaultValue="insurance">
          <TabsList variant="line">
            <TabsTrigger value="insurance">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />Insurance
            </TabsTrigger>
            <TabsTrigger value="corporate">
              <Building2 className="h-3.5 w-3.5 mr-1" />Corporate / TPA
            </TabsTrigger>
            <TabsTrigger value="patient">
              <User className="h-3.5 w-3.5 mr-1" />Patient (Self-Pay)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insurance" className="pt-4">
            <ProviderTab type="insurance" />
          </TabsContent>
          <TabsContent value="corporate" className="pt-4">
            <ProviderTab type="corporate" />
          </TabsContent>
          <TabsContent value="patient" className="pt-4">
            <ProviderTab type="patient" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProviderTab({ type }: { type: ProviderType }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CreditSettlementRow | null>(null);

  const { data, isLoading } = useCreditSettlementList({
    type,
    search: search || undefined,
    limit: 100,
  });
  const items = data?.settlements ?? [];
  const stats = data?.stats;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Providers" value={String(stats?.totalProviders ?? 0)} accent="border-l-primary" />
        <Stat label="Total Claim" value={fmt(stats?.totalClaim ?? 0)} accent="border-l-secondary" />
        <Stat label="Received" value={fmt(stats?.totalReceived ?? 0)} accent="border-l-primary-container" valueClass="text-primary" />
        <Stat label="Outstanding" value={fmt(stats?.totalOutstanding ?? 0)} accent="border-l-error" valueClass="text-error" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder="Search provider name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest capitalize">
                  {type === 'patient' ? 'Patient' : type === 'insurance' ? 'Insurer' : 'TPA / Corporate'}
                </th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bills</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Claim</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Received</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Outstanding</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Oldest</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center"><div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center font-label text-on-surface-variant">No records found.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-label text-sm font-bold">
                    {item.providerName}
                    {item.providerContact && (
                      <span className="ml-2 font-normal text-[10px] text-on-surface-variant">{item.providerContact}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-label text-sm">{item.totalAdmissions}</td>
                  <td className="px-4 py-3 text-right font-label text-sm">{fmt(item.claimAmount)}</td>
                  <td className="px-4 py-3 text-right font-label text-sm text-primary">{fmt(item.receivedAmount)}</td>
                  <td className="px-4 py-3 text-right font-label text-sm font-bold text-error">{fmt(item.outstandingAmount)}</td>
                  <td className="px-4 py-3 text-center font-label text-xs">
                    <span className={cn(
                      'rounded-full px-2 py-0.5',
                      item.ageDays <= 7 && 'bg-primary/10 text-primary',
                      item.ageDays > 7 && item.ageDays <= 30 && 'bg-secondary/10 text-secondary',
                      item.ageDays > 30 && item.ageDays <= 60 && 'bg-tertiary/10 text-tertiary',
                      item.ageDays > 60 && 'bg-error-container text-on-error-container',
                    )}>
                      {item.ageDays}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setSelected(item)}>
                      View Bills <ChevronRight className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ProviderBillsDialog
        provider={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function Stat({ label, value, accent, valueClass }: { label: string; value: string; accent: string; valueClass?: string }) {
  return (
    <div className={cn('bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 border-l-4', accent)}>
      <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', valueClass)}>{value}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Drill-down: bills behind a provider/patient bucket with quick collect.
// ────────────────────────────────────────────────────────────────────────

function ProviderBillsDialog({
  provider,
  onClose,
}: {
  provider: CreditSettlementRow | null;
  onClose: () => void;
}) {
  const { data: bills, isLoading } = useCreditSettlementBills(provider?.id ?? null);
  const [collectBill, setCollectBill] = useState<{
    id: string; billNumber: string; balanceDue: number; patientName?: string;
  } | null>(null);
  const [splitBill, setSplitBill] = useState<{
    id: string; billNumber: string; balanceDue: number; patientName?: string;
  } | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <Dialog open={!!provider} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{provider?.providerName ?? '-'}</DialogTitle>
          <DialogDescription>
            {provider?.totalAdmissions} bill(s) · {fmt(provider?.outstandingAmount ?? 0)} outstanding
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : bills && bills.length > 0 ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-surface-container-lowest">
                <tr className="border-b border-surface-container">
                  <th className="px-3 py-2 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bill #</th>
                  <th className="px-3 py-2 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                  <th className="px-3 py-2 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Date</th>
                  <th className="px-3 py-2 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Total</th>
                  <th className="px-3 py-2 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Paid</th>
                  <th className="px-3 py-2 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Balance</th>
                  <th className="px-3 py-2 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/40">
                {bills.map((b) => {
                  const name = b.patient ? `${b.patient.firstName} ${b.patient.lastName}` : '-';
                  return (
                    <tr key={b.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-3 py-2 font-label text-sm font-bold">{b.billNumber}</td>
                      <td className="px-3 py-2 font-label text-sm">{name}</td>
                      <td className="px-3 py-2 font-label text-xs text-on-surface-variant">{formatDate(b.createdAt)} <span className="ml-1 opacity-60">({b.ageDays}d)</span></td>
                      <td className="px-3 py-2 text-right font-label text-sm">{fmt(b.totalAmount)}</td>
                      <td className="px-3 py-2 text-right font-label text-sm text-primary">{fmt(b.amountPaid)}</td>
                      <td className="px-3 py-2 text-right font-label text-sm font-bold text-error">{fmt(b.balanceDue)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => setCollectBill({ id: b.id, billNumber: b.billNumber, balanceDue: b.balanceDue, patientName: name })}
                          >
                            <Banknote className="h-3 w-3" /> Collect
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => setSplitBill({ id: b.id, billNumber: b.billNumber, balanceDue: b.balanceDue, patientName: name })}
                          >
                            Split
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-on-surface-variant">No bills.</p>
          )}
        </div>

        <CollectBillPaymentDialog
          open={!!collectBill}
          onOpenChange={(o) => { if (!o) setCollectBill(null); }}
          bill={collectBill}
        />
        <SplitPaymentDialog
          open={!!splitBill}
          onOpenChange={(o) => { if (!o) setSplitBill(null); }}
          bill={splitBill}
        />
      </DialogContent>
    </Dialog>
  );
}
