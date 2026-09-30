'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClaims } from '@/hooks/use-insurance';
import { useBankMatches, useRecordBulkSettlements } from '@/hooks/use-insurance-workflow';

type Row = { claimId: string; grossApprovedAmount: string; grossPaidAmount: string; tdsAmount: string; disallowedAmount: string; disallowanceReason: string; paymentReference: string };
const blank = (): Row => ({ claimId: '', grossApprovedAmount: '', grossPaidAmount: '', tdsAmount: '0', disallowedAmount: '0', disallowanceReason: '', paymentReference: '' });
const today = new Date().toISOString().slice(0, 10);

export default function InsuranceSettlementsPage() {
  const claims = useClaims({ limit: 100 });
  const bulk = useRecordBulkSettlements();
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [bankReference, setBankReference] = useState('');
  const [bankStatementDate, setBankStatementDate] = useState(today);
  const [settlementDate, setSettlementDate] = useState(today);
  const [tdsSection, setTdsSection] = useState('');
  const [tdsRate, setTdsRate] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const bankMatches = useBankMatches(matchSearch);

  const available = useMemo(() => (claims.data?.data ?? []).filter((claim) => ['approved', 'partially_approved', 'partially_settled', 'settled'].includes(claim.status)), [claims.data]);
  const totals = rows.reduce((sum, row) => ({ gross: sum.gross + Number(row.grossPaidAmount || 0), tds: sum.tds + Number(row.tdsAmount || 0), net: sum.net + Math.max(0, Number(row.grossPaidAmount || 0) - Number(row.tdsAmount || 0)) }), { gross: 0, tds: 0, net: 0 });

  function update(index: number, value: Row) { setRows(rows.map((row, rowIndex) => rowIndex === index ? value : row)); }
  async function save() {
    const valid = rows.filter((row) => row.claimId && row.grossPaidAmount);
    if (!valid.length) return toast.error('Add at least one claim allocation');
    if (!bankReference.trim()) return toast.error('Bank reference is required for bulk reconciliation');
    try {
      await bulk.mutateAsync(valid.map((row) => ({ claimId: row.claimId, grossApprovedAmount: Number(row.grossApprovedAmount), grossPaidAmount: Number(row.grossPaidAmount), tdsAmount: Number(row.tdsAmount || 0), tdsSection: tdsSection || undefined, tdsRate: tdsRate ? Number(tdsRate) : undefined, disallowedAmount: Number(row.disallowedAmount || 0), disallowanceReason: row.disallowanceReason || undefined, netPaidAmount: Math.max(0, Number(row.grossPaidAmount) - Number(row.tdsAmount || 0)), paymentReference: row.paymentReference || undefined, bankReference, bankStatementDate, settlementDate }))); 
      toast.success(`${valid.length} claim settlement allocation(s) recorded`); setRows([blank()]);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'Bulk settlement allocation failed');
    }
  }

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold font-headline">Settlement & Remittance Allocation</h1><p className="text-sm text-on-surface-variant">Allocate one bank remittance across claims while preserving gross payment, TDS receivable, disallowance and net receipt.</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Gross remittance" value={totals.gross} /><Metric label="TDS receivable" value={totals.tds} /><Metric label="Net bank receipt" value={totals.net} /></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="size-5 text-primary" /> Remittance header</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Bank reference *" value={bankReference} onChange={setBankReference} /><Field label="Bank statement date" type="date" value={bankStatementDate} onChange={setBankStatementDate} /><Field label="Settlement date" type="date" value={settlementDate} onChange={setSettlementDate} /><Field label="TDS section" value={tdsSection} onChange={setTdsSection} /><Field label="TDS rate %" type="number" value={tdsRate} onChange={setTdsRate} /></CardContent></Card>
    <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Claim allocations</CardTitle><CardDescription>Net receipt is calculated as gross paid less TDS for each claim.</CardDescription></div><Button size="sm" variant="outline" onClick={() => setRows([...rows, blank()])}><Plus className="mr-1 size-4" /> Add claim</Button></div></CardHeader><CardContent className="space-y-3">{rows.map((row, index) => <div key={index} className="grid gap-2 rounded-md border p-3 lg:grid-cols-[2fr_repeat(4,1fr)_2fr_auto]"><div><Label>Claim *</Label><Select value={row.claimId || null} onValueChange={(value) => { const claim = available.find((item) => item.id === value); update(index, { ...row, claimId: value as string, grossApprovedAmount: String(claim?.approvedAmount ?? claim?.claimAmount ?? ''), grossPaidAmount: String(claim?.outstandingAmount ?? claim?.approvedAmount ?? '') }); }}><SelectTrigger className="w-full"><SelectValue placeholder="Select approved claim" /></SelectTrigger><SelectContent>{available.map((claim) => <SelectItem key={claim.id} value={claim.id}>{claim.claimNumber ?? claim.id.slice(0, 8)} · {claim.patient?.firstName} · ₹{Number(claim.outstandingAmount ?? claim.approvedAmount ?? 0).toLocaleString('en-IN')}</SelectItem>)}</SelectContent></Select></div><Field label="Approved" type="number" value={row.grossApprovedAmount} onChange={(value) => update(index, { ...row, grossApprovedAmount: value })} /><Field label="Gross paid *" type="number" value={row.grossPaidAmount} onChange={(value) => update(index, { ...row, grossPaidAmount: value })} /><Field label="TDS" type="number" value={row.tdsAmount} onChange={(value) => update(index, { ...row, tdsAmount: value })} /><div><Label>Net paid</Label><Input readOnly value={Math.max(0, Number(row.grossPaidAmount || 0) - Number(row.tdsAmount || 0))} /></div><Field label="Payment reference" value={row.paymentReference} onChange={(value) => update(index, { ...row, paymentReference: value })} /><Button variant="ghost" size="icon" className="self-end" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} disabled={rows.length === 1}><Trash2 className="size-4" /></Button><div className="lg:col-span-2"><Field label="Disallowed amount" type="number" value={row.disallowedAmount} onChange={(value) => update(index, { ...row, disallowedAmount: value })} /></div><div className="lg:col-span-5"><Field label="Disallowance reason" value={row.disallowanceReason} onChange={(value) => update(index, { ...row, disallowanceReason: value })} /></div></div>)}<div className="flex justify-end"><Button onClick={save} disabled={bulk.isPending}>Post bulk settlement</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Bank reference match</CardTitle><CardDescription>Search previously recorded allocations before posting a duplicate remittance.</CardDescription></CardHeader><CardContent><div className="relative mb-3 max-w-sm"><Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" /><Input className="pl-8" value={matchSearch} onChange={(event) => setMatchSearch(event.target.value)} placeholder="Enter at least 3 characters" /></div>{bankMatches.data?.length ? <Table><TableHeader><TableRow><TableHead>Claim</TableHead><TableHead>Patient</TableHead><TableHead>Gross</TableHead><TableHead>TDS</TableHead><TableHead>Net</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{bankMatches.data.map((item) => <TableRow key={item.id}><TableCell>{(item as unknown as { claim?: { claimNumber?: string | null } }).claim?.claimNumber ?? '—'}</TableCell><TableCell>{(item as unknown as { claim?: { patient?: { firstName?: string; lastName?: string | null } } }).claim?.patient?.firstName ?? '—'} {(item as unknown as { claim?: { patient?: { lastName?: string | null } } }).claim?.patient?.lastName ?? ''}</TableCell><TableCell>₹{Number(item.grossPaidAmount).toLocaleString('en-IN')}</TableCell><TableCell>₹{Number(item.tdsAmount).toLocaleString('en-IN')}</TableCell><TableCell>₹{Number(item.netPaidAmount).toLocaleString('en-IN')}</TableCell><TableCell>{new Date(item.settlementDate).toLocaleDateString('en-IN')}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-on-surface-variant">{matchSearch.length >= 3 ? 'No matching allocations.' : 'Search by bank reference.'}</p>}</CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle>₹{value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</CardTitle></CardHeader></Card>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
