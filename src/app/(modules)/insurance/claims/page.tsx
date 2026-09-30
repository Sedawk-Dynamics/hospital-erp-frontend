'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, FileCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { usePatientSearch } from '@/hooks/use-hospital';
import {
  useClaims,
  useCreateClaim,
  usePoliciesByPatient,
  useCalcResponsibility,
  useExpiringClaims,
  type ClaimStatus,
} from '@/hooks/use-insurance';
import apiClient from '@/lib/api-client';
import { useApplyPayerCoverage, useCoveragePreview, useInsuranceCases } from '@/hooks/use-insurance-workflow';

const STATUS_TONE: Record<ClaimStatus, string> = {
  submitted: 'bg-amber-100 text-amber-700 border-amber-300',
  under_review: 'bg-amber-100 text-amber-700 border-amber-300',
  query_raised: 'bg-orange-100 text-orange-700 border-orange-300',
  response_submitted: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  partially_approved: 'bg-sky-100 text-sky-700 border-sky-300',
  rejected: 'bg-rose-100 text-rose-700 border-rose-300',
  resubmitted: 'bg-violet-100 text-violet-700 border-violet-300',
  settled: 'bg-teal-100 text-teal-700 border-teal-300',
  partially_settled: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  cancelled: 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

interface CreateForm {
  patientId: string;
  patientLabel: string;
  policyId: string;
  insuranceCaseId: string;
  billId: string;
  billLabel: string;
  claimAmount: string;
  notes: string;
  expiryDays: string;
  tier: 'primary' | 'secondary' | 'supplementary';
  sequence: string;
  submissionChannel: 'portal' | 'email' | 'nhcx' | 'api' | 'manual';
  settlementMode: 'cashless' | 'reimbursement' | 'credit';
  payerClaimReference: string;
  submissionReference: string;
}

const EMPTY: CreateForm = {
  patientId: '',
  patientLabel: '',
  policyId: '',
  insuranceCaseId: '',
  billId: '',
  billLabel: '',
  claimAmount: '',
  notes: '',
  expiryDays: '30',
  tier: 'primary',
  sequence: '1',
  submissionChannel: 'portal',
  settlementMode: 'cashless',
  payerClaimReference: '',
  submissionReference: '',
};

interface BillSummary {
  id: string;
  billNumber: string;
  totalAmount: number;
  patientPayableAmount?: number;
  status?: string;
}

export default function ClaimsListPage() {
  const sp = useSearchParams();
  const initialStatus = (sp.get('status') as ClaimStatus | null) ?? null;
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>(initialStatus ?? 'all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY);
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatient = useDebounce(patientSearch, 250);
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [billLoading, setBillLoading] = useState(false);
  const [expiryWarningAt] = useState(() => Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { data, isLoading } = useClaims({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });
  const { data: expiring } = useExpiringClaims(7);
  const { data: patients } = usePatientSearch(debouncedPatient);
  const { data: policies } = usePoliciesByPatient(form.patientId || undefined);
  const { data: payerCases } = useInsuranceCases({ patientId: form.patientId || undefined, limit: 100 });
  const { data: calc } = useCalcResponsibility(
    form.policyId || undefined,
    form.billId || undefined,
  );
  const coveragePreview = useCoveragePreview(form.insuranceCaseId || undefined, form.billId || undefined);
  const applyCoverage = useApplyPayerCoverage();
  const createMut = useCreateClaim();

  // Fetch bills when a patient is picked
  useEffect(() => {
    if (!form.patientId) {
      setBills([]);
      return;
    }
    setBillLoading(true);
    apiClient
      .get(`/billing/bills`, { params: { patientId: form.patientId, limit: 50 } })
      .then((res) => setBills((res.data?.data as BillSummary[]) ?? []))
      .catch(() => setBills([]))
      .finally(() => setBillLoading(false));
  }, [form.patientId]);

  useEffect(() => {
    if (calc?.split && !form.claimAmount) {
      setForm((f) => ({ ...f, claimAmount: String(calc.split.claimAmount) }));
    }
  }, [calc]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!form.policyId && !form.insuranceCaseId) return toast.error('Pick a policy or payer case');
    if (!form.billId) return toast.error('Pick a bill');
    if (!form.claimAmount) return toast.error('Claim amount is required');
    try {
      await createMut.mutateAsync({
        patientId: form.patientId,
        policyId: form.policyId || undefined,
        insuranceCaseId: form.insuranceCaseId || undefined,
        billId: form.billId,
        claimAmount: Number(form.claimAmount),
        notes: form.notes.trim() || undefined,
        expiryDays: Number(form.expiryDays || 30),
        tier: form.tier,
        sequence: Number(form.sequence || 1),
        submissionChannel: form.submissionChannel,
        settlementMode: form.settlementMode,
        payerClaimReference: form.payerClaimReference.trim() || undefined,
        submissionReference: form.submissionReference.trim() || undefined,
      });
      toast.success('Claim submitted');
      setDialogOpen(false);
      setForm(EMPTY);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'Submit failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Insurance Claims</h1>
          <p className="text-sm text-on-surface-variant">
            Track the claim pipeline: submitted → approved → settled. Handle rejections,
            partial approvals, resubmissions.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> New Claim
        </Button>
      </div>

      {expiring && expiring.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-4" /> Claims approaching TPA deadline (next 7 days)
            </CardTitle>
            <CardDescription>{expiring.length} claim(s) need follow-up</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {expiring.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                href={`/insurance/claims/${c.id}`}
                className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-amber-100"
              >
                <span>
                  {c.claimNumber ?? c.id.slice(0, 8)} ·{' '}
                  {c.patient?.firstName} {c.patient?.lastName}
                </span>
                <span className="text-xs text-amber-700">
                  Due {c.expiryDate ? formatDate(c.expiryDate) : '—'}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="size-4 text-primary" /> All Claims
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => v && setStatusFilter(v as ClaimStatus | 'all')}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="query_raised">Query Raised</SelectItem>
                  <SelectItem value="response_submitted">Response Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="partially_approved">Partially Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="resubmitted">Resubmitted</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                  <SelectItem value="partially_settled">Partially Settled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
                <Input
                  placeholder="Search claim # / patient"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <CardDescription>
            {data?.data?.length ?? 0} of {data?.meta?.total ?? 0} claims
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead>Bill</TableHead>
                <TableHead>Claimed</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-on-surface-variant">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : data?.data?.length ? (
                data.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.claimNumber ?? c.id.slice(0, 8)}
                      {c.resubmissionCount > 0 && (
                        <span className="ml-1 text-xs text-violet-600">
                          (R{c.resubmissionCount})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.patient?.firstName} {c.patient?.lastName ?? ''}
                    </TableCell>
                    <TableCell>{c.policy?.insurer?.name ?? c.insuranceCase?.insurer?.name ?? c.insuranceCase?.corporatePayer?.name ?? c.insuranceCase?.governmentSchemePayer?.name ?? '—'}</TableCell>
                    <TableCell>{c.bill?.billNumber ?? '—'}</TableCell>
                    <TableCell>₹{Number(c.claimAmount).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      {c.approvedAmount != null
                        ? `₹${Number(c.approvedAmount).toLocaleString('en-IN')}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {c.outstandingAmount != null
                        ? `₹${Number(c.outstandingAmount).toLocaleString('en-IN')}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border', STATUS_TONE[c.status])}>
                        {c.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(c.submissionDate)}</TableCell>
                    <TableCell
                      className={cn(
                        c.expiryDate &&
                          new Date(c.expiryDate).getTime() <=
                            expiryWarningAt &&
                          'text-amber-700 font-medium',
                      )}
                    >
                      {c.expiryDate ? formatDate(c.expiryDate) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/insurance/claims/${c.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Open <ExternalLink className="size-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-on-surface-variant">
                    No claims match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Submit New Claim</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Patient *</Label>
              <Input
                placeholder="Search by name / MRN"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patientSearch.length >= 2 && patients && patients.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border bg-surface-container-lowest">
                  {patients.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          patientId: pt.id,
                          patientLabel: `${pt.firstName} ${pt.lastName ?? ''} (${pt.mrn})`,
                          policyId: '',
                          insuranceCaseId: '',
                          billId: '',
                          billLabel: '',
                        });
                        setPatientSearch(`${pt.firstName} ${pt.lastName ?? ''} (${pt.mrn})`);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-container-low"
                    >
                      {pt.firstName} {pt.lastName} ·{' '}
                      <span className="text-on-surface-variant">{pt.mrn}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.patientLabel && (
                <div className="mt-1 text-xs text-on-surface-variant">
                  Selected: {form.patientLabel}
                </div>
              )}
            </div>
            <div>
              <Label>Payer case</Label>
              <Select
                value={form.insuranceCaseId || null}
                onValueChange={(v) => {
                  const selected = payerCases?.data.find((item) => item.id === v);
                  setForm({ ...form, insuranceCaseId: (v as string) ?? '', policyId: selected?.policies[0]?.policy.id ?? form.policyId, settlementMode: selected?.settlementMode ?? form.settlementMode });
                }}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select payer case" /></SelectTrigger>
                <SelectContent>{payerCases?.data.map((item) => <SelectItem key={item.id} value={item.id}>{item.caseNumber} · {item.settlementMode}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Policy (optional for corporate / scheme)</Label>
              <Select
                value={form.policyId || null}
                onValueChange={(v) => v && setForm({ ...form, policyId: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.policyNumber} · {p.insurer?.name ?? '—'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Claim tier</Label>
              <Select value={form.tier} onValueChange={(value) => value && setForm({ ...form, tier: value as CreateForm['tier'] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary">Primary</SelectItem><SelectItem value="secondary">Secondary</SelectItem><SelectItem value="supplementary">Supplementary</SelectItem></SelectContent></Select>
            </div>
            <div><Label>Claim sequence</Label><Input type="number" min="1" value={form.sequence} onChange={(event) => setForm({ ...form, sequence: event.target.value })} /></div>
            <div>
              <Label>Bill *</Label>
              <Select
                value={form.billId || null}
                onValueChange={(v) => {
                  const b = bills.find((bb) => bb.id === v);
                  setForm({
                    ...form,
                    billId: (v as string) ?? '',
                    billLabel: b ? `${b.billNumber} (₹${b.totalAmount})` : '',
                    claimAmount: b ? String(b.totalAmount) : form.claimAmount,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={billLoading ? 'Loading…' : 'Pick bill'} />
                </SelectTrigger>
                <SelectContent>
                  {bills.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.billNumber} · ₹{Number(b.totalAmount).toLocaleString('en-IN')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Claim Amount (₹) *</Label>
              <Input
                type="number"
                min="0"
                value={form.claimAmount}
                onChange={(e) => setForm({ ...form, claimAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>Claim Expiry (days from now)</Label>
              <Input
                type="number"
                min="1"
                value={form.expiryDays}
                onChange={(e) => setForm({ ...form, expiryDays: e.target.value })}
              />
            </div>
            <div>
              <Label>Submission channel</Label>
              <Select value={form.submissionChannel} onValueChange={(value) => value && setForm({ ...form, submissionChannel: value as CreateForm['submissionChannel'] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{['portal', 'email', 'nhcx', 'api', 'manual'].map((value) => <SelectItem key={value} value={value}>{value.toUpperCase()}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Payer claim reference</Label><Input value={form.payerClaimReference} onChange={(event) => setForm({ ...form, payerClaimReference: event.target.value })} /></div>
            <div><Label>Submission reference</Label><Input value={form.submissionReference} onChange={(event) => setForm({ ...form, submissionReference: event.target.value })} /></div>
            {calc?.split && (
              <div className="col-span-2 rounded-lg border bg-surface-container-low p-3 text-sm">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Auto-computed split
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <SplitCell label="Co-Pay" value={calc.split.copayAmount} tone="text-amber-700" />
                  <SplitCell
                    label="Deductible"
                    value={calc.split.deductibleAmount}
                    tone="text-rose-700"
                  />
                  <SplitCell
                    label="Insurance"
                    value={calc.split.coveredAmount}
                    tone="text-emerald-700"
                  />
                  <SplitCell
                    label="Patient pays"
                    value={calc.split.patientResponsibility}
                    tone="text-primary"
                  />
                </div>
              </div>
            )}
            {form.insuranceCaseId && form.billId && (
              <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-sm">
                {coveragePreview.isLoading ? <span>Calculating payer contract coverage…</span> : coveragePreview.data ? <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-semibold">{coveragePreview.data.contract.name}</div><div className="text-xs text-on-surface-variant">Negotiated rates, room cap and non-payable rules applied to {coveragePreview.data.lines.length} bill lines.</div></div><Button size="sm" variant="outline" disabled={applyCoverage.isPending} onClick={async () => { try { const result = await applyCoverage.mutateAsync({ caseId: form.insuranceCaseId, billId: form.billId }); setForm({ ...form, claimAmount: String(result.summary.payerAllowedAmount) }); toast.success('Payer contract split applied to bill'); } catch (error: unknown) { const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message; toast.error(message ?? 'Could not apply payer contract'); } }}>Apply contract split</Button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><SplitCell label="Billed" value={coveragePreview.data.summary.billedAmount} /><SplitCell label="Payer allowed" value={coveragePreview.data.summary.payerAllowedAmount} tone="text-emerald-700" /><SplitCell label="Patient payable" value={coveragePreview.data.summary.patientPayableAmount} tone="text-amber-700" /><SplitCell label="Contract reduction" value={coveragePreview.data.summary.contractualReduction} tone="text-rose-700" /></div></div> : <div className="text-amber-800">No active payer contract covers this bill date. Configure the contract before applying negotiated coverage.</div>}
              </div>
            )}
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              Submit Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SplitCell({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">{label}</div>
      <div className={cn('text-base font-bold', tone)}>
        ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}
