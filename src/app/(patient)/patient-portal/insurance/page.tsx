'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, FileCheck2, ShieldCheck } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { cn } from '@/lib/utils';

type PortalCase = {
  id: string;
  caseNumber: string;
  caseType: string;
  settlementMode: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  physicalReleaseAt?: string | null;
  patient: { firstName: string; lastName?: string | null; mrn: string };
  tenant: { name: string };
  insurer?: { name: string } | null;
  tpa?: { name: string } | null;
  corporatePayer?: { name: string } | null;
  governmentSchemePayer?: { name: string } | null;
  preAuthRequests: Array<{ id: string; requestNumber?: string | null; requestType: string; status: string; approvalNumber?: string | null; approvedAmount?: number | null; decisionDueAt?: string | null; decidedAt?: string | null }>;
  claims: Array<{ id: string; claimNumber?: string | null; tier: string; status: string; claimAmount: number; approvedAmount?: number | null; paidAmount: number; outstandingAmount?: number | null; submissionDate: string; settlementDate?: string | null }>;
};

const show = (value: string) => value.replaceAll('_', ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
const money = (value?: number | null) => `₹${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PatientInsurancePage() {
  const selectedProfileId = usePatientProfileStore((state) => state.selectedProfileId);
  const cases = useQuery({
    queryKey: ['patient', 'insurance-cases', selectedProfileId],
    queryFn: async () => (await apiGet<PortalCase[]>('/patient-portal/insurance-cases', { params: selectedProfileId ? { profileId: selectedProfileId } : {} })).data ?? [],
  });

  return <div className="space-y-6">
    <div><p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">Coverage tracking</p><h1 className="font-headline text-3xl font-extrabold">Insurance & Payer Cases</h1><p className="mt-1 text-sm text-on-surface-variant">Follow authorization, claim and settlement progress without exposing internal hospital notes.</p></div>
    {cases.isLoading ? <div className="rounded-xl bg-surface-container-lowest p-8 text-center text-on-surface-variant">Loading coverage status…</div> : cases.data?.length ? cases.data.map((item) => {
      const payer = item.insurer?.name ?? item.corporatePayer?.name ?? item.governmentSchemePayer?.name ?? 'Payer';
      return <div key={item.id} className="rounded-xl bg-surface-container-lowest p-6 shadow-sanctuary">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-headline text-lg font-bold">{item.caseNumber}</h2></div><p className="mt-1 text-xs text-on-surface-variant">{item.tenant.name} · {payer}{item.tpa ? ` · administered by ${item.tpa.name}` : ''}</p></div><div className="flex gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold capitalize text-primary">{item.settlementMode}</span><span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">{show(item.status)}</span></div></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Clock3 className="size-4 text-primary" /> Authorizations</h3>{item.preAuthRequests.length ? <div className="space-y-2">{item.preAuthRequests.map((request) => <div key={request.id} className="rounded-lg bg-surface-container-low p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{request.requestNumber ?? 'Authorization request'}</span><span className={cn('text-xs font-bold capitalize', request.status === 'approved' ? 'text-emerald-700' : request.status === 'denied' ? 'text-rose-700' : 'text-amber-700')}>{show(request.status)}</span></div><div className="mt-1 text-xs text-on-surface-variant">{show(request.requestType)}{request.approvalNumber ? ` · payer reference ${request.approvalNumber}` : ''}{request.approvedAmount != null ? ` · approved ${money(request.approvedAmount)}` : ''}</div></div>)}</div> : <Empty text="No authorization request yet." />}</section>
          <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><FileCheck2 className="size-4 text-primary" /> Claims</h3>{item.claims.length ? <div className="space-y-2">{item.claims.map((claim) => <div key={claim.id} className="rounded-lg bg-surface-container-low p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{claim.claimNumber ?? 'Claim'} · {show(claim.tier)}</span><span className="text-xs font-bold text-primary">{show(claim.status)}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><Amount label="Claimed" value={claim.claimAmount} /><Amount label="Approved" value={claim.approvedAmount} /><Amount label="Outstanding" value={claim.outstandingAmount} /></div></div>)}</div> : <Empty text="No claim submitted yet." />}</section>
        </div>
        {item.physicalReleaseAt && <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="size-4" /> Physical discharge completed. Payer processing may continue until settlement closes.</div>}
      </div>;
    }) : <div className="rounded-xl bg-surface-container-lowest p-10 text-center"><ShieldCheck className="mx-auto mb-3 size-8 text-outline" /><p className="font-medium">No insurance or payer cases found for this profile.</p></div>}
  </div>;
}

function Amount({ label, value }: { label: string; value?: number | null }) { return <div><div className="text-on-surface-variant">{label}</div><div className="font-semibold">{value == null ? '—' : money(value)}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed p-4 text-xs text-on-surface-variant">{text}</div>; }
