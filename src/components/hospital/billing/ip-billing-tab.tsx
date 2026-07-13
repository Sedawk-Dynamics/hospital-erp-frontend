'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, ShieldCheck, RefreshCw, BedDouble, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// IP billing section: one consolidated bill per admission, shown separately from
// OP, with the insurance category surfaced and a "Transfer to TPA" action for
// insurance / corporate patients (raises the claim; TPA then settles).

interface IpClaim {
  id: string;
  claimNumber: string | null;
  status: string;
  claimAmount: number | string;
  approvedAmount: number | string | null;
  coveredAmount: number | string | null;
  patientShare: number | string | null;
  paidAmount: number | string | null;
  outstandingAmount: number | string | null;
  policy?: { policyNumber?: string; insurer?: { name: string } | null; tpa?: { name: string } | null } | null;
}
interface IpBill {
  id: string;
  billNumber: string;
  status: string;
  admissionId: string | null;
  totalAmount: number | string;
  insuranceCoveredAmount: number | string;
  patientPayableAmount: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  patient?: { id: string; mrn: string | null; firstName: string; lastName: string } | null;
  admission?: {
    id: string; billingCategory: string | null; status: string;
    ward?: { name: string } | null; bed?: { bedNumber: string } | null;
  } | null;
  insuranceClaims?: IpClaim[];
}

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
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hospital', 'ip-bills', search],
    queryFn: async () =>
      (await apiGet<IpBill[]>('/billing', { params: { billType: 'ip', limit: 50, ...(search ? { search } : {}) } })).data,
  });
  const bills = useMemo(() => data ?? [], [data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hospital', 'ip-bills'] });
    qc.invalidateQueries({ queryKey: ['ip-ledger'] });
  };

  const consolidate = useMutation({
    mutationFn: async (admissionId: string) => (await apiPost(`/billing/admissions/${admissionId}/consolidate`, {})).data,
    onSuccess: () => { toast.success('IP bill consolidated.'); refresh(); },
    onError: (e: Error) => toast.error(e.message || 'Could not consolidate the bill.'),
  });
  const transfer = useMutation({
    mutationFn: async (admissionId: string) =>
      (await apiPost<{ policy?: { tpa?: { name: string } | null; insurer?: { name: string } | null } }>(`/billing/admissions/${admissionId}/transfer-to-tpa`, {})).data,
    onSuccess: (res) => {
      const via = res?.policy?.tpa?.name || res?.policy?.insurer?.name || 'the TPA';
      toast.success(`Transferred to ${via} — claim raised.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || 'Transfer to TPA failed.'),
  });

  const run = async (m: typeof consolidate | typeof transfer, admissionId: string) => {
    setBusyId(admissionId);
    try { await m.mutateAsync(admissionId); } finally { setBusyId(null); }
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
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading IP bills…</div>
      ) : bills.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No IP bills yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Insurer / Patient</th>
                <th className="px-3 py-2">TPA / Claim</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const claim = b.insuranceClaims?.[0];
                const liveClaim = claim && !['cancelled', 'rejected'].includes(claim.status);
                const cat = (b.admission?.billingCategory ?? 'cash').toLowerCase();
                const canTransfer = !!b.admissionId && isInsurance(cat) && !liveClaim;
                const busy = busyId === b.admissionId;
                return (
                  <tr key={b.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{b.patient?.firstName} {b.patient?.lastName}</div>
                      <div className="text-[11px] text-muted-foreground">{b.patient?.mrn}</div>
                      {(b.admission?.ward?.name || b.admission?.bed?.bedNumber) && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <BedDouble className="h-3 w-3" />
                          {[b.admission?.ward?.name, b.admission?.bed?.bedNumber].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={cn('text-[10px] capitalize', CATEGORY_BADGE[cat] ?? CATEGORY_BADGE.cash)}>{cat}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-[11px]">{b.billNumber}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{b.status.replace('_', ' ')}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{money(b.totalAmount)}</td>
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
                        <span className="text-[11px] text-amber-600">Not transferred</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {b.admissionId && b.status === 'draft' && (
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" disabled={busy}
                            onClick={() => run(consolidate, b.admissionId!)} title="Pull all charges onto the single IP bill + finalize">
                            {busy && consolidate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Generate
                          </Button>
                        )}
                        {canTransfer && (
                          <Button size="sm" className="h-7 gap-1 text-[11px]" disabled={busy}
                            onClick={() => run(transfer, b.admissionId!)} title="Raise an insurance claim and hand the bill to the TPA">
                            {busy && transfer.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />} Transfer to TPA
                          </Button>
                        )}
                        {liveClaim && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5" /> With TPA
                          </span>
                        )}
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
        Each IP admission has <strong>one</strong> consolidated bill with all costs. For insurance / corporate patients, <strong>Transfer to TPA</strong> raises the claim; the TPA team then approves &amp; settles it (paid / outstanding shown here).
      </p>
    </div>
  );
}
