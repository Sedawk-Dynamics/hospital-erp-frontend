'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Pencil, ShieldCheck, Search, BadgeCheck } from 'lucide-react';
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
import { useDebounce } from '@/hooks/use-debounce';
import { usePatientSearch } from '@/hooks/use-hospital';
import {
  usePolicies,
  useInsurers,
  useTpas,
  useCreatePolicy,
  useUpdatePolicy,
  useVerifyPolicy,
  type InsurancePolicy,
  type PolicyStatus,
} from '@/hooks/use-insurance';

interface FormState {
  patientId: string;
  patientLabel: string;
  insurerId: string;
  tpaId: string;
  policyNumber: string;
  groupNumber: string;
  planName: string;
  coverageAmount: string;
  coPayPercent: string;
  deductibleAmount: string;
  exclusions: string;
  validFrom: string;
  validTo: string;
  status: PolicyStatus;
}

const EMPTY_FORM: FormState = {
  patientId: '',
  patientLabel: '',
  insurerId: '',
  tpaId: '',
  policyNumber: '',
  groupNumber: '',
  planName: '',
  coverageAmount: '',
  coPayPercent: '0',
  deductibleAmount: '0',
  exclusions: '',
  validFrom: '',
  validTo: '',
  status: 'active',
};

export default function PoliciesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatient = useDebounce(patientSearch, 250);

  const { data, isLoading } = usePolicies({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { data: insurers } = useInsurers({ isActive: true, limit: 100 });
  const { data: tpas } = useTpas({ isActive: true, limit: 100 });
  const { data: patients } = usePatientSearch(debouncedPatient);
  const createMut = useCreatePolicy();
  const updateMut = useUpdatePolicy();
  const verifyMut = useVerifyPolicy();

  const insurerOptions = insurers?.data ?? [];
  const tpaOptions = tpas?.data ?? [];

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPatientSearch('');
    setDialogOpen(true);
  }
  function openEdit(p: InsurancePolicy) {
    setEditing(p);
    setForm({
      patientId: p.patientId,
      patientLabel: p.patient ? `${p.patient.firstName} ${p.patient.lastName ?? ''}` : '',
      insurerId: p.insurerId,
      tpaId: p.tpaId ?? '',
      policyNumber: p.policyNumber,
      groupNumber: p.groupNumber ?? '',
      planName: p.planName ?? '',
      coverageAmount: p.coverageAmount?.toString() ?? '',
      coPayPercent: p.coPayPercent?.toString() ?? '0',
      deductibleAmount: p.deductibleAmount?.toString() ?? '0',
      exclusions: p.exclusions ?? '',
      validFrom: p.validFrom?.slice(0, 10) ?? '',
      validTo: p.validTo?.slice(0, 10) ?? '',
      status: p.status,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.patientId) return toast.error('Pick a patient');
    if (!form.insurerId) return toast.error('Pick an insurer');
    if (!form.policyNumber.trim()) return toast.error('Policy number is required');
    if (!form.validFrom || !form.validTo) return toast.error('Validity dates are required');

    const payload = {
      patientId: form.patientId,
      insurerId: form.insurerId,
      tpaId: form.tpaId || undefined,
      policyNumber: form.policyNumber.trim(),
      groupNumber: form.groupNumber.trim() || undefined,
      planName: form.planName.trim() || undefined,
      coverageAmount: form.coverageAmount ? Number(form.coverageAmount) : undefined,
      coPayPercent: Number(form.coPayPercent || 0),
      deductibleAmount: Number(form.deductibleAmount || 0),
      exclusions: form.exclusions.trim() || undefined,
      validFrom: form.validFrom,
      validTo: form.validTo,
      status: form.status,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body: payload });
        toast.success('Policy updated');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('Policy created');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    }
  }

  async function handleVerify(id: string) {
    try {
      const data = await verifyMut.mutateAsync(id);
      toast.success(data.isValid ? 'Policy is valid' : `Policy status: ${data.status}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Verification failed');
    }
  }

  const filteredPatients = useMemo(() => patients ?? [], [patients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Policy Master</h1>
          <p className="text-sm text-on-surface-variant">
            Patients can carry multiple active policies. Manage them here.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="size-4" /> Add Policy
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Insurance Policies
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => v && setStatusFilter(v as PolicyStatus | 'all')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
                <Input
                  placeholder="Search by policy / patient"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <CardDescription>
            {data?.data?.length ?? 0} of {data?.meta?.total ?? 0} policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Insurer / Plan</TableHead>
                <TableHead>TPA</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Co-Pay / Ded.</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-on-surface-variant">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : data?.data?.length ? (
                data.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.policyNumber}</TableCell>
                    <TableCell>
                      {p.patient?.firstName} {p.patient?.lastName ?? ''}
                    </TableCell>
                    <TableCell>
                      <div>{p.insurer?.name ?? '—'}</div>
                      <div className="text-xs text-on-surface-variant">{p.planName ?? '—'}</div>
                    </TableCell>
                    <TableCell>{p.tpa?.name ?? '—'}</TableCell>
                    <TableCell>
                      ₹{(p.coverageAmount ?? 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <div>{p.coPayPercent}% co-pay</div>
                      <div className="text-xs text-on-surface-variant">
                        ₹{(p.deductibleAmount ?? 0).toLocaleString('en-IN')} ded.
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(p.validFrom)} → {formatDate(p.validTo)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          p.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 border'
                            : p.status === 'expired'
                              ? 'bg-zinc-100 text-zinc-700 border-zinc-300 border'
                              : 'bg-rose-100 text-rose-700 border-rose-300 border'
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleVerify(p.id)}
                          title="Verify policy"
                        >
                          <BadgeCheck className="size-3.5 text-emerald-600" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-on-surface-variant">
                    No policies match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Policy' : 'Add Policy'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {!editing && (
              <div className="col-span-2">
                <Label>Patient *</Label>
                <Input
                  placeholder="Search patient by name / MRN"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                {patientSearch.length >= 2 && filteredPatients.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border bg-surface-container-lowest">
                    {filteredPatients.map((pt: any) => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            patientId: pt.id,
                            patientLabel: `${pt.firstName} ${pt.lastName ?? ''} (${pt.mrn})`,
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
            )}
            <div>
              <Label>Insurer *</Label>
              <Select
                value={form.insurerId || null}
                onValueChange={(v) => v && setForm({ ...form, insurerId: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick insurer" />
                </SelectTrigger>
                <SelectContent>
                  {insurerOptions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>TPA Provider</Label>
              <Select
                value={form.tpaId || null}
                onValueChange={(v) => setForm({ ...form, tpaId: (v as string) ?? '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {tpaOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Policy Number *</Label>
              <Input
                value={form.policyNumber}
                onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>Group Number</Label>
              <Input
                value={form.groupNumber}
                onChange={(e) => setForm({ ...form, groupNumber: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Plan Name</Label>
              <Input
                value={form.planName}
                onChange={(e) => setForm({ ...form, planName: e.target.value })}
              />
            </div>
            <div>
              <Label>Coverage Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                value={form.coverageAmount}
                onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>Co-Pay (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.coPayPercent}
                onChange={(e) => setForm({ ...form, coPayPercent: e.target.value })}
              />
            </div>
            <div>
              <Label>Deductible (₹)</Label>
              <Input
                type="number"
                min="0"
                value={form.deductibleAmount}
                onChange={(e) => setForm({ ...form, deductibleAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => v && setForm({ ...form, status: v as PolicyStatus })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valid From *</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div>
              <Label>Valid To *</Label>
              <Input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Exclusions</Label>
              <Textarea
                rows={2}
                value={form.exclusions}
                onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editing ? 'Save Changes' : 'Add Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-on-surface-variant">
        Tip: A patient can hold multiple active policies. Open a patient profile to manage policies
        in context, or use the global list above.{' '}
        <Link href="/insurance/insurers" className="underline">
          Configure insurers
        </Link>{' '}
        and{' '}
        <Link href="/insurance/tpa" className="underline">
          TPAs
        </Link>{' '}
        first.
      </p>
    </div>
  );
}
