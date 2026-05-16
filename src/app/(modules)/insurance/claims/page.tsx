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

const STATUS_TONE: Record<ClaimStatus, string> = {
  submitted: 'bg-amber-100 text-amber-700 border-amber-300',
  under_review: 'bg-amber-100 text-amber-700 border-amber-300',
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
  billId: string;
  billLabel: string;
  claimAmount: string;
  notes: string;
  expiryDays: string;
}

const EMPTY: CreateForm = {
  patientId: '',
  patientLabel: '',
  policyId: '',
  billId: '',
  billLabel: '',
  claimAmount: '',
  notes: '',
  expiryDays: '30',
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

  const { data, isLoading } = useClaims({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });
  const { data: expiring } = useExpiringClaims(7);
  const { data: patients } = usePatientSearch(debouncedPatient);
  const { data: policies } = usePoliciesByPatient(form.patientId || undefined);
  const { data: calc } = useCalcResponsibility(
    form.policyId || undefined,
    form.billId || undefined,
  );
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
    if (!form.policyId) return toast.error('Pick a policy');
    if (!form.billId) return toast.error('Pick a bill');
    if (!form.claimAmount) return toast.error('Claim amount is required');
    try {
      await createMut.mutateAsync({
        patientId: form.patientId,
        policyId: form.policyId,
        billId: form.billId,
        claimAmount: Number(form.claimAmount),
        notes: form.notes.trim() || undefined,
        expiryDays: Number(form.expiryDays || 30),
      });
      toast.success('Claim submitted');
      setDialogOpen(false);
      setForm(EMPTY);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Submit failed');
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
                    <TableCell>{c.policy?.insurer?.name ?? '—'}</TableCell>
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
                            Date.now() + 7 * 24 * 60 * 60 * 1000 &&
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
                  {patients.map((pt: any) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          patientId: pt.id,
                          patientLabel: `${pt.firstName} ${pt.lastName ?? ''} (${pt.mrn})`,
                          policyId: '',
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
              <Label>Policy *</Label>
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
