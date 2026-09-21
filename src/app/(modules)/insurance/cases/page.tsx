'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BriefcaseMedical, ExternalLink, Plus, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';
import { usePatientSearch } from '@/hooks/use-hospital';
import { useAdmissions } from '@/hooks/use-clinical';
import { useInsurers, usePoliciesByPatient, useTpas } from '@/hooks/use-insurance';
import {
  useCorporatePayers,
  useCreateInsuranceCase,
  useGovernmentSchemes,
  useInsuranceCases,
  type InsuranceCaseStatus,
  type InsuranceCaseType,
  type InsurancePriority,
  type InsuranceSettlementMode,
} from '@/hooks/use-insurance-workflow';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<InsuranceCaseStatus, string> = {
  open: 'bg-slate-100 text-slate-700 border-slate-300',
  eligibilityPending: 'bg-amber-100 text-amber-700 border-amber-300',
  eligible: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  preAuthPending: 'bg-amber-100 text-amber-700 border-amber-300',
  authorized: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  admitted: 'bg-sky-100 text-sky-700 border-sky-300',
  treatment: 'bg-blue-100 text-blue-700 border-blue-300',
  dischargeAuthorizationPending: 'bg-orange-100 text-orange-700 border-orange-300',
  discharged: 'bg-violet-100 text-violet-700 border-violet-300',
  claimSubmitted: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  queryPending: 'bg-orange-100 text-orange-700 border-orange-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  settled: 'bg-teal-100 text-teal-700 border-teal-300',
  closed: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-300',
};

const EMPTY_FORM = {
  patientId: '',
  admissionId: '',
  caseType: 'insurance' as InsuranceCaseType,
  settlementMode: 'cashless' as InsuranceSettlementMode,
  insurerId: '',
  tpaId: '',
  corporatePayerId: '',
  governmentSchemePayerId: '',
  policyIds: [] as string[],
  memberId: '',
  employeeId: '',
  abhaNumber: '',
  priority: 'routine' as InsurancePriority,
  emergency: false,
  notes: '',
};

function payerName(item: {
  insurer?: { name: string } | null;
  corporatePayer?: { name: string } | null;
  governmentSchemePayer?: { name: string } | null;
}) {
  return item.insurer?.name ?? item.corporatePayer?.name ?? item.governmentSchemePayer?.name ?? '—';
}

export default function InsuranceCasesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InsuranceCaseStatus | 'all'>('all');
  const [open, setOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const debouncedPatient = useDebounce(patientSearch, 250);

  const cases = useInsuranceCases({ search: search || undefined, status: status === 'all' ? undefined : status, limit: 100 });
  const patients = usePatientSearch(debouncedPatient);
  const admissions = useAdmissions({ patientId: form.patientId, limit: 50 }, { enabled: Boolean(form.patientId) });
  const policies = usePoliciesByPatient(form.patientId || undefined);
  const insurers = useInsurers({ isActive: true, limit: 100 });
  const tpas = useTpas({ isActive: true, limit: 100 });
  const corporates = useCorporatePayers({ isActive: true, limit: 100 });
  const schemes = useGovernmentSchemes({ isActive: true, limit: 100 });
  const createCase = useCreateInsuranceCase();

  const selectedPayer = useMemo(() => {
    if (form.caseType === 'insurance') return { type: 'insurer' as const, id: form.insurerId };
    if (form.caseType === 'corporate') return { type: 'corporate' as const, id: form.corporatePayerId };
    return { type: 'governmentScheme' as const, id: form.governmentSchemePayerId };
  }, [form]);

  async function submit() {
    if (!form.patientId) return toast.error('Select a patient');
    if (!selectedPayer.id) return toast.error('Select the payment-responsible payer');
    try {
      const created = await createCase.mutateAsync({
        patientId: form.patientId,
        admissionId: form.admissionId || undefined,
        caseType: form.caseType,
        settlementMode: form.settlementMode,
        insurerId: form.insurerId || undefined,
        tpaId: form.tpaId || undefined,
        corporatePayerId: form.corporatePayerId || undefined,
        governmentSchemePayerId: form.governmentSchemePayerId || undefined,
        paymentResponsibleType: selectedPayer.type,
        paymentResponsibleId: selectedPayer.id,
        claimAdministratorType: form.tpaId ? 'tpa' : undefined,
        claimAdministratorId: form.tpaId || undefined,
        policyIds: form.policyIds,
        memberId: form.memberId || undefined,
        employeeId: form.employeeId || undefined,
        abhaNumber: form.abhaNumber || undefined,
        priority: form.priority,
        emergency: form.emergency,
        notes: form.notes || undefined,
      });
      toast.success(`Payer case ${created.caseNumber} created`);
      setOpen(false);
      setForm(EMPTY_FORM);
      setPatientSearch('');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'Could not create payer case');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Insurance / Payer Cases</h1>
          <p className="text-sm text-on-surface-variant">One workspace from eligibility through authorization, claim and settlement.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="size-4" /> New Payer Case</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Total cases</CardDescription><CardTitle>{cases.data?.meta?.total ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Cashless cases</CardDescription><CardTitle>{cases.data?.data.filter((item) => item.settlementMode === 'cashless').length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Urgent / critical</CardDescription><CardTitle>{cases.data?.data.filter((item) => ['urgent', 'critical', 'deceased'].includes(item.priority)).length ?? 0}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2"><BriefcaseMedical className="size-4 text-primary" /> Case register</CardTitle><CardDescription>Insurer, corporate and government-scheme payer work in one queue.</CardDescription></div>
            <div className="flex gap-2">
              <Select value={status} onValueChange={(value) => value && setStatus(value as InsuranceCaseStatus | 'all')}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.keys(STATUS_TONE).map((value) => <SelectItem key={value} value={value}>{value.replace(/([A-Z])/g, ' $1')}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Case #, MRN or patient" className="pl-8" /></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Patient</TableHead><TableHead>Payer</TableHead><TableHead>Mode</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {cases.isLoading ? <TableRow><TableCell colSpan={8} className="text-center">Loading…</TableCell></TableRow> : cases.data?.data.length ? cases.data.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.caseNumber}</TableCell>
                  <TableCell>{item.patient.firstName} {item.patient.lastName ?? ''}<div className="text-xs text-on-surface-variant">{item.patient.mrn}</div></TableCell>
                  <TableCell>{payerName(item)}<div className="text-xs capitalize text-on-surface-variant">{item.caseType.replace(/([A-Z])/g, ' $1')}</div></TableCell>
                  <TableCell className="capitalize">{item.settlementMode}</TableCell>
                  <TableCell><Badge variant="outline" className={cn(item.priority !== 'routine' && 'border-orange-300 text-orange-700')}>{item.priority}</Badge></TableCell>
                  <TableCell><Badge className={cn('border', STATUS_TONE[item.status])}>{item.status.replace(/([A-Z])/g, ' $1')}</Badge></TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                  <TableCell className="text-right"><Link href={`/insurance/cases/${item.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">Open <ExternalLink className="size-3.5" /></Link></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="text-center text-on-surface-variant">No payer cases found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Create Insurance / Payer Case</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Patient *</Label>
              <Input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Search by name, phone or MRN" />
              {debouncedPatient.length >= 2 && patients.data?.length ? <div className="mt-1 max-h-36 overflow-y-auto rounded-md border bg-background">{patients.data.map((patient) => <button key={patient.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setForm({ ...form, patientId: patient.id, admissionId: '', policyIds: [] }); setPatientSearch(`${patient.firstName} ${patient.lastName ?? ''} (${patient.mrn})`); }}>{patient.firstName} {patient.lastName ?? ''} · {patient.mrn}</button>)}</div> : null}
            </div>
            <FieldSelect label="Case type" value={form.caseType} onChange={(value) => setForm({ ...form, caseType: value as InsuranceCaseType, policyIds: [] })} options={[['insurance', 'Insurance'], ['corporate', 'Corporate payer'], ['governmentScheme', 'Government scheme']]} />
            <FieldSelect label="Settlement route" value={form.settlementMode} onChange={(value) => setForm({ ...form, settlementMode: value as InsuranceSettlementMode })} options={[['cashless', 'Cashless'], ['reimbursement', 'Reimbursement'], ['credit', 'Credit']]} />

            {form.caseType === 'insurance' && <>
              <FieldSelect label="Payment-responsible insurer *" value={form.insurerId} onChange={(value) => setForm({ ...form, insurerId: value })} placeholder="Select insurer" options={(insurers.data?.data ?? []).map((item) => [item.id, item.name])} />
              <FieldSelect label="Administrator / TPA (optional)" value={form.tpaId} onChange={(value) => setForm({ ...form, tpaId: value })} placeholder="Direct insurer handling" options={(tpas.data?.data ?? []).map((item) => [item.id, item.name])} />
            </>}
            {form.caseType === 'corporate' && <FieldSelect label="Corporate payer *" value={form.corporatePayerId} onChange={(value) => setForm({ ...form, corporatePayerId: value })} placeholder="Select corporate" options={(corporates.data?.data ?? []).map((item) => [item.id, item.name])} />}
            {form.caseType === 'governmentScheme' && <FieldSelect label="Government scheme *" value={form.governmentSchemePayerId} onChange={(value) => setForm({ ...form, governmentSchemePayerId: value })} placeholder="Select scheme" options={(schemes.data?.data ?? []).map((item) => [item.id, item.name])} />}

            <FieldSelect label="Linked admission (optional)" value={form.admissionId} onChange={(value) => setForm({ ...form, admissionId: value })} placeholder="Pre-admission / OP / day-care" options={(admissions.data?.data ?? []).map((item) => [item.id, `${formatDate(item.admissionDate)} · ${item.status}${item.ward?.name ? ` · ${item.ward.name}` : ''}`])} />
            <FieldSelect label="Priority" value={form.priority} onChange={(value) => setForm({ ...form, priority: value as InsurancePriority })} options={[['routine', 'Routine'], ['urgent', 'Urgent'], ['critical', 'Critical'], ['deceased', 'Deceased protocol']]} />

            {form.caseType === 'insurance' && form.patientId && <div className="sm:col-span-2 rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-primary" /> Policies in coordination order</div>
              {policies.data?.length ? policies.data.map((policy) => <label key={policy.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={form.policyIds.includes(policy.id)} onChange={(event) => setForm({ ...form, policyIds: event.target.checked ? [...form.policyIds, policy.id] : form.policyIds.filter((id) => id !== policy.id) })} /> <span>{policy.policyNumber} · {policy.insurer?.name ?? '—'}</span></label>) : <p className="text-sm text-on-surface-variant">No active policies found. The case can still be created and policies added later.</p>}
            </div>}

            <div><Label>Member ID</Label><Input value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} /></div>
            <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} /></div>
            <div><Label>ABHA number (optional)</Label><Input value={form.abhaNumber} onChange={(event) => setForm({ ...form, abhaNumber: event.target.value })} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.emergency} onChange={(event) => setForm({ ...form, emergency: event.target.checked, priority: event.target.checked && form.priority === 'routine' ? 'urgent' : form.priority })} /> Emergency admission / intimation required</label>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={createCase.isPending}>Create Case</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, placeholder = 'Select' }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; placeholder?: string }) {
  return <div><Label>{label}</Label><Select value={value || null} onValueChange={(next) => next && onChange(next as string)}><SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>;
}
