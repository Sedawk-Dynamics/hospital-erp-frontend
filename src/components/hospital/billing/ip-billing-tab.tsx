'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, ShieldCheck, RefreshCw, BedDouble, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useIpAdmissions, type IpBill } from '@/hooks/use-ip-billing';
import { IpBillingDetailDialog } from '@/components/hospital/billing/ip-billing-detail-dialog';

// IP billing section: one consolidated bill per admission, shown separately from
// OP. Click a row to open the full IP bill (edit charges, discount, collect,
// cut/return deposit, record TPA settlement). Insurance patients auto-connect to
// the TPA — no manual transfer. This is the single place for IP billing.

const n = (v: number | string | null | undefined) => Number(v ?? 0);
const money = (v: number | string | null | undefined) => `₹${n(v).toFixed(2)}`;
const isInsurance = (cat?: string | null) => cat === 'insurance' || cat === 'corporate';

const CLAIM_BADGE: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-indigo-100 text-indigo-700',
  partially_approved: 'bg-indigo-100 text-indigo-700',
  settled: 'bg-emerald-100 text-emerald-700',
  partially_settled: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700',
  resubmitted: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-100 text-gray-600',
};
const CATEGORY_BADGE: Record<string, string> = {
  insurance: 'bg-purple-100 text-purple-700',
  corporate: 'bg-fuchsia-100 text-fuchsia-700',
  package: 'bg-sky-100 text-sky-700',
  cash: 'bg-gray-100 text-gray-600',
};

export function IpBillingTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [detailBill, setDetailBill] = useState<IpBill | null>(null);

  // One row per ADMISSION — listed from the moment the patient is admitted
  // (the endpoint ensures each active admission has its running IP bill).
  const { data, isLoading } = useIpAdmissions(search || undefined);
  const grouped = useMemo(() => data ?? [], [data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hospital', 'ip-bills'] });
    qc.invalidateQueries({ queryKey: ['ip-ledger'] });
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search IP bills / patient / MRN…" className="pl-8 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading IP patients…</div>
      ) : grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No IP patients admitted.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2 text-right">Charges</th>
                <th className="px-3 py-2 text-right">Deposit</th>
                <th className="px-3 py-2 text-right">Insurer / Patient</th>
                <th className="px-3 py-2">TPA / Claim</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((b) => {
                const claim = b.insuranceClaims?.[0];
                const liveClaim = claim && !['cancelled', 'rejected'].includes(claim.status);
                const cat = (b.admission?.billingCategory ?? 'cash').toLowerCase();
                const dep = b.deposit;
                const refundable = n(dep?.refundable);
                return (
                  <tr key={b.admissionId ?? b.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{b.patient?.firstName} {b.patient?.lastName}</div>
                      <div className="text-[11px] text-muted-foreground">{b.patient?.mrn}</div>
                      {(b.admission?.ward?.name || b.admission?.bed?.bedNumber) && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <BedDouble className="h-3 w-3" />
                          {[b.admission?.ward?.name, b.admission?.bed?.bedNumber].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {b.admission?.status === 'discharged' && (
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">discharged</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={cn('text-[10px] capitalize', CATEGORY_BADGE[cat] ?? CATEGORY_BADGE.cash)}>{cat}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-[11px]">{b.billNumber}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{b.status.replace('_', ' ')}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-medium">{money(b.totalAmount)}</div>
                      <div className="text-[10px] text-muted-foreground">after deposit {money(dep?.balanceAfterDeposit ?? b.balanceDue)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {n(dep?.onFile) > 0 ? (
                        <>
                          <div className="font-medium text-teal-700">{money(dep?.onFile)}</div>
                          {refundable > 0 && (
                            <div className="text-[10px] text-emerald-600">refund {money(refundable)}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {liveClaim ? (
                        <div className="text-[12px]">
                          <div className="text-purple-700">{money(b.insuranceCoveredAmount)}</div>
                          <div className="text-muted-foreground">pt {money(b.patientPayableAmount)}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {claim ? (
                        <div className="space-y-0.5">
                          <Badge className={cn('text-[10px] capitalize', CLAIM_BADGE[claim.status] ?? 'bg-gray-100 text-gray-600')}>
                            {claim.status.replace('_', ' ')}
                          </Badge>
                          <div className="text-[11px] text-muted-foreground">
                            {claim.policy?.tpa?.name || claim.policy?.insurer?.name || 'TPA'}
                          </div>
                          <div className="text-[11px]">
                            paid {money(claim.paidAmount)} · out {money(claim.outstandingAmount)}
                          </div>
                        </div>
                      ) : isInsurance(cat) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-purple-700">
                          <ShieldCheck className="h-3.5 w-3.5" /> Connected — claim on charges
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {isInsurance(cat) && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700" title="Insurance patient — auto-connected to the TPA at booking (no manual transfer)">
                            <ShieldCheck className="h-3.5 w-3.5" /> {liveClaim ? 'With TPA' : 'Connected to TPA'}
                          </span>
                        )}
                        {refundable > 0 && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] border-emerald-300 text-emerald-700"
                            onClick={() => setDetailBill(b)} title="Return the unused deposit to the patient">
                            <Undo2 className="h-3 w-3" /> Return deposit
                          </Button>
                        )}
                        <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setDetailBill(b)} title="Open the full IP bill — charges, deposit, discount, collect, TPA">
                          Manage
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Every admitted IP patient shows here from day one — one <strong>consolidated bill</strong> that builds up as charges are posted. The <strong>deposit</strong> is cut from the running balance, and its unused part can be <strong>returned</strong> to the patient (e.g. when insurance covers the charges in full). Insurance / corporate patients are <strong>auto-connected to the TPA</strong> at booking — the claim is raised and kept in sync as charges accrue (no manual transfer). Click <strong>Manage</strong> to post charges, apply the deposit, discount, collect &amp; record TPA settlements.
      </p>

      <IpBillingDetailDialog bill={detailBill} open={!!detailBill} onOpenChange={(o) => { if (!o) setDetailBill(null); }} />
    </div>
  );
}
