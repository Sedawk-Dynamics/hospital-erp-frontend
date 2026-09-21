'use client';

import { useMemo, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useInsurers, useTpas } from '@/hooks/use-insurance';
import { useCorporatePayers, useCreatePayerContract, useGovernmentSchemes, usePayerContracts, type DocumentCategory, type PayerType } from '@/hooks/use-insurance-workflow';
import { formatDate } from '@/lib/date-utils';

type Requirement = { code: string; name: string; category: DocumentCategory; isRequired: boolean };
type ServiceRate = { serviceCode: string; serviceName: string; agreedRate: string };
type PackageRate = { packageCode: string; packageName: string; agreedAmount: string };
type NonPayable = { itemCode: string; itemPattern: string; reason: string; patientPayable: boolean };

const today = new Date().toISOString().slice(0, 10);
const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const DEFAULT_REQUIREMENTS: Requirement[] = [
  { code: 'FINAL_BILL', name: 'Final itemised bill', category: 'billing', isRequired: true },
  { code: 'DISCHARGE_SUMMARY', name: 'Discharge summary', category: 'clinical', isRequired: true },
  { code: 'AUTHORIZATION', name: 'Authorization letter', category: 'authorization', isRequired: true },
];

export default function PayerContractsPage() {
  const contracts = usePayerContracts();
  const insurers = useInsurers({ isActive: true, limit: 100 });
  const tpas = useTpas({ isActive: true, limit: 100 });
  const corporates = useCorporatePayers({ isActive: true, limit: 100 });
  const schemes = useGovernmentSchemes({ isActive: true, limit: 100 });
  const createContract = useCreatePayerContract();
  const [open, setOpen] = useState(false);
  const [payerType, setPayerType] = useState<PayerType>('insurer');
  const [payerId, setPayerId] = useState('');
  const [base, setBase] = useState({ name: '', contractNumber: '', validFrom: today, validTo: nextYear, submissionWindowDays: '15', queryResponseHours: '24', paymentDueDays: '30', roomRentCap: '', roomRentCapPercent: '', terms: '' });
  const [requirements, setRequirements] = useState<Requirement[]>(DEFAULT_REQUIREMENTS);
  const [services, setServices] = useState<ServiceRate[]>([]);
  const [packages, setPackages] = useState<PackageRate[]>([]);
  const [nonPayables, setNonPayables] = useState<NonPayable[]>([]);

  const payerOptions = useMemo(() => {
    if (payerType === 'insurer') return (insurers.data?.data ?? []).map((item) => [item.id, item.name]);
    if (payerType === 'tpa') return (tpas.data?.data ?? []).map((item) => [item.id, item.name]);
    if (payerType === 'corporate') return (corporates.data?.data ?? []).map((item) => [item.id, item.name]);
    return (schemes.data?.data ?? []).map((item) => [item.id, item.name]);
  }, [payerType, insurers.data, tpas.data, corporates.data, schemes.data]);

  async function save() {
    if (!payerId || base.name.trim().length < 2) return toast.error('Payer and contract name are required');
    if (base.validTo < base.validFrom) return toast.error('Valid-to date cannot precede valid-from date');
    try {
      await createContract.mutateAsync({
        payerType, payerId, name: base.name, contractNumber: base.contractNumber || undefined, validFrom: base.validFrom, validTo: base.validTo,
        submissionWindowDays: Number(base.submissionWindowDays), queryResponseHours: Number(base.queryResponseHours), paymentDueDays: Number(base.paymentDueDays),
        roomRentCap: base.roomRentCap ? Number(base.roomRentCap) : undefined, roomRentCapPercent: base.roomRentCapPercent ? Number(base.roomRentCapPercent) : undefined,
        terms: base.terms ? { notes: base.terms } : undefined,
        documentRequirements: requirements.filter((item) => item.code && item.name).map((item, index) => ({ ...item, sortOrder: index })),
        serviceRates: services.filter((item) => item.serviceCode && item.serviceName && item.agreedRate).map((item) => ({ ...item, agreedRate: Number(item.agreedRate), effectiveFrom: base.validFrom })),
        packageRates: packages.filter((item) => item.packageCode && item.packageName && item.agreedAmount).map((item) => ({ ...item, agreedAmount: Number(item.agreedAmount), effectiveFrom: base.validFrom })),
        nonPayableRules: nonPayables.filter((item) => (item.itemCode || item.itemPattern) && item.reason),
      });
      toast.success('Payer contract created'); setOpen(false);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'Contract could not be created');
    }
  }

  function payerLabel(type: PayerType, id: string) {
    const sources = [...(insurers.data?.data ?? []), ...(tpas.data?.data ?? []), ...(corporates.data?.data ?? []), ...(schemes.data?.data ?? [])];
    return sources.find((item) => item.id === id)?.name ?? `${type} payer`;
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold font-headline">Payer Contracts & Tariffs</h1><p className="text-sm text-on-surface-variant">Submission windows, payment terms, agreed rates, packages, document rules and non-payables.</p></div><Button onClick={() => setOpen(true)}><Plus className="mr-1.5 size-4" /> New Contract</Button></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{contracts.data?.length ? contracts.data.map((contract) => <Card key={contract.id}><CardHeader><div className="flex items-start justify-between gap-2"><FileText className="size-5 text-primary" /><Badge variant={contract.isActive ? 'default' : 'secondary'}>{contract.isActive ? 'Active' : 'Inactive'}</Badge></div><CardTitle className="text-base">{contract.name}</CardTitle><CardDescription>{payerLabel(contract.payerType, contract.payerId)} · {contract.contractNumber ?? 'No contract #'}</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><Info label="Validity" value={`${formatDate(contract.validFrom)} – ${formatDate(contract.validTo)}`} /><Info label="Submission" value={`${contract.submissionWindowDays} days`} /><Info label="Query response" value={`${contract.queryResponseHours} hours`} /><Info label="Payment due" value={`${contract.paymentDueDays} days`} /><Info label="Rates" value={`${contract.serviceRates.length} services · ${contract.packageRates.length} packages`} /><Info label="Checklist" value={`${contract.documentRequirements.length} documents`} /></CardContent></Card>) : <Card className="md:col-span-2"><CardContent className="py-10 text-center text-on-surface-variant">No payer contracts configured.</CardContent></Card>}</div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Create payer contract</DialogTitle></DialogHeader>
      <Tabs defaultValue="terms"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="terms">Terms</TabsTrigger><TabsTrigger value="documents">Documents ({requirements.length})</TabsTrigger><TabsTrigger value="rates">Service rates ({services.length})</TabsTrigger><TabsTrigger value="packages">Packages ({packages.length})</TabsTrigger><TabsTrigger value="nonpayable">Non-payables ({nonPayables.length})</TabsTrigger></TabsList>
        <TabsContent value="terms" className="mt-4 grid gap-3 sm:grid-cols-2"><Choice label="Payer type" value={payerType} onChange={(value) => { setPayerType(value as PayerType); setPayerId(''); }} options={[['insurer', 'Insurer'], ['tpa', 'TPA / administrator'], ['corporate', 'Corporate'], ['governmentScheme', 'Government scheme']]} /><Choice label="Payer *" value={payerId} onChange={setPayerId} options={payerOptions} /><Field label="Contract name *" value={base.name} onChange={(value) => setBase({ ...base, name: value })} /><Field label="Contract number" value={base.contractNumber} onChange={(value) => setBase({ ...base, contractNumber: value })} /><Field label="Valid from" type="date" value={base.validFrom} onChange={(value) => setBase({ ...base, validFrom: value })} /><Field label="Valid to" type="date" value={base.validTo} onChange={(value) => setBase({ ...base, validTo: value })} /><Field label="Submission window (days)" type="number" value={base.submissionWindowDays} onChange={(value) => setBase({ ...base, submissionWindowDays: value })} /><Field label="Query response SLA (hours)" type="number" value={base.queryResponseHours} onChange={(value) => setBase({ ...base, queryResponseHours: value })} /><Field label="Payment due (days)" type="number" value={base.paymentDueDays} onChange={(value) => setBase({ ...base, paymentDueDays: value })} /><Field label="Room-rent cap (₹)" type="number" value={base.roomRentCap} onChange={(value) => setBase({ ...base, roomRentCap: value })} /><Field label="Room-rent cap (%)" type="number" value={base.roomRentCapPercent} onChange={(value) => setBase({ ...base, roomRentCapPercent: value })} /><div className="sm:col-span-2"><Label>Terms / notes</Label><Textarea value={base.terms} onChange={(event) => setBase({ ...base, terms: event.target.value })} /></div></TabsContent>
        <TabsContent value="documents" className="mt-4 space-y-2"><Button size="sm" variant="outline" onClick={() => setRequirements([...requirements, { code: '', name: '', category: 'other', isRequired: true }])}><Plus className="mr-1 size-4" /> Add requirement</Button>{requirements.map((row, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_1fr_auto]"><Input placeholder="Code" value={row.code} onChange={(event) => setRequirements(replaceAt(requirements, index, { ...row, code: event.target.value }))} /><Input placeholder="Document name" value={row.name} onChange={(event) => setRequirements(replaceAt(requirements, index, { ...row, name: event.target.value }))} /><Choice value={row.category} onChange={(value) => setRequirements(replaceAt(requirements, index, { ...row, category: value as DocumentCategory }))} options={['identity', 'eligibility', 'clinical', 'diagnostic', 'billing', 'authorization', 'settlement', 'correspondence', 'other'].map((value) => [value, value])} /><Button variant="ghost" size="icon" onClick={() => setRequirements(requirements.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4" /></Button></div>)}</TabsContent>
        <TabsContent value="rates" className="mt-4 space-y-2"><Button size="sm" variant="outline" onClick={() => setServices([...services, { serviceCode: '', serviceName: '', agreedRate: '' }])}><Plus className="mr-1 size-4" /> Add service rate</Button>{services.map((row, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_1fr_auto]"><Input placeholder="Service code" value={row.serviceCode} onChange={(event) => setServices(replaceAt(services, index, { ...row, serviceCode: event.target.value }))} /><Input placeholder="Service name" value={row.serviceName} onChange={(event) => setServices(replaceAt(services, index, { ...row, serviceName: event.target.value }))} /><Input type="number" placeholder="Agreed rate" value={row.agreedRate} onChange={(event) => setServices(replaceAt(services, index, { ...row, agreedRate: event.target.value }))} /><Button variant="ghost" size="icon" onClick={() => setServices(services.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4" /></Button></div>)}</TabsContent>
        <TabsContent value="packages" className="mt-4 space-y-2"><Button size="sm" variant="outline" onClick={() => setPackages([...packages, { packageCode: '', packageName: '', agreedAmount: '' }])}><Plus className="mr-1 size-4" /> Add package</Button>{packages.map((row, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_1fr_auto]"><Input placeholder="Package code" value={row.packageCode} onChange={(event) => setPackages(replaceAt(packages, index, { ...row, packageCode: event.target.value }))} /><Input placeholder="Package name" value={row.packageName} onChange={(event) => setPackages(replaceAt(packages, index, { ...row, packageName: event.target.value }))} /><Input type="number" placeholder="Agreed amount" value={row.agreedAmount} onChange={(event) => setPackages(replaceAt(packages, index, { ...row, agreedAmount: event.target.value }))} /><Button variant="ghost" size="icon" onClick={() => setPackages(packages.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4" /></Button></div>)}</TabsContent>
        <TabsContent value="nonpayable" className="mt-4 space-y-2"><Button size="sm" variant="outline" onClick={() => setNonPayables([...nonPayables, { itemCode: '', itemPattern: '', reason: '', patientPayable: true }])}><Plus className="mr-1 size-4" /> Add rule</Button>{nonPayables.map((row, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"><Input placeholder="Item code" value={row.itemCode} onChange={(event) => setNonPayables(replaceAt(nonPayables, index, { ...row, itemCode: event.target.value }))} /><Input placeholder="Name pattern" value={row.itemPattern} onChange={(event) => setNonPayables(replaceAt(nonPayables, index, { ...row, itemPattern: event.target.value }))} /><Input placeholder="Disallowance reason" value={row.reason} onChange={(event) => setNonPayables(replaceAt(nonPayables, index, { ...row, reason: event.target.value }))} /><Button variant="ghost" size="icon" onClick={() => setNonPayables(nonPayables.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4" /></Button></div>)}</TabsContent>
      </Tabs><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={createContract.isPending}>Create contract</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function replaceAt<T>(rows: T[], index: number, value: T) { return rows.map((row, rowIndex) => rowIndex === index ? value : row); }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-on-surface-variant">{label}</div><div className="font-medium">{value}</div></div>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function Choice({ label, value, onChange, options }: { label?: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <div>{label && <Label>{label}</Label>}<Select value={value || null} onValueChange={(next) => next && onChange(next as string)}><SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>; }
