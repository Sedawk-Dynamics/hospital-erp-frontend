'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock3, ExternalLink, FileCheck2, HeartPulse, Plus, ShieldCheck, Siren, UserRoundCheck } from 'lucide-react';
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
import { useCreatePreAuth, usePoliciesByPatient } from '@/hooks/use-insurance';
import {
  useAddCasePolicy,
  useCreateEnhancement,
  useInsuranceCase,
  useRecordEligibility,
  useRecordEmergencyIntimation,
  useRecordPhysicalRelease,
  useRequestFinalAuthorization,
  useUpdateInsuranceCaseStatus,
  type InsuranceCaseStatus,
} from '@/hooks/use-insurance-workflow';
import { formatDate } from '@/lib/date-utils';

const TRANSITIONS: Record<InsuranceCaseStatus, InsuranceCaseStatus[]> = {
  open: ['eligibilityPending', 'eligible', 'preAuthPending', 'admitted', 'cancelled'],
  eligibilityPending: ['eligible', 'cancelled'],
  eligible: ['preAuthPending', 'authorized', 'admitted', 'cancelled'],
  preAuthPending: ['authorized', 'cancelled'],
  authorized: ['admitted', 'treatment', 'cancelled'],
  admitted: ['treatment', 'dischargeAuthorizationPending', 'discharged'],
  treatment: ['dischargeAuthorizationPending', 'discharged'],
  dischargeAuthorizationPending: ['discharged', 'authorized'],
  discharged: ['claimSubmitted', 'closed'],
  claimSubmitted: ['queryPending', 'approved', 'settled', 'closed'],
  queryPending: ['claimSubmitted', 'approved', 'closed'],
  approved: ['settled', 'closed'],
  settled: ['closed'],
  closed: [],
  cancelled: [],
};

const money = (value?: number | null) => `₹${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const show = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());

type DialogKind = 'status' | 'eligibility' | 'policy' | 'preauth' | 'enhancement' | 'final' | 'emergency' | 'release' | null;

export default function InsuranceCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const caseQuery = useInsuranceCase(id);
  const item = caseQuery.data;
  const policies = usePoliciesByPatient(item?.patientId);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [selectedPreAuthId, setSelectedPreAuthId] = useState('');
  const [statusForm, setStatusForm] = useState({ status: '' as InsuranceCaseStatus | '', notes: '' });
  const [eligibility, setEligibility] = useState({ policyId: '', isEligible: true, coverageAvailable: '', coPayPercent: '', deductibleAmount: '', roomRentLimit: '', waitingPeriodMet: true, source: '', reference: '', validUntil: '' });
  const [policyForm, setPolicyForm] = useState({ policyId: '', sequence: '1', allocatedAmount: '', originalDocumentsHeld: false, deductionCertificateUrl: '' });
  const [preAuthForm, setPreAuthForm] = useState({ policyId: '', procedureDescription: '', diagnosisCode: '', procedureCode: '', estimatedCost: '', submissionChannel: 'portal' as 'portal' | 'email' | 'nhcx' | 'api' | 'manual', submissionReference: '', notes: '' });
  const [finalForm, setFinalForm] = useState({ claimId: '', finalAmount: '', submissionChannel: 'portal' as 'portal' | 'email' | 'nhcx' | 'api' | 'manual', submissionReference: '', notes: '' });
  const [emergencyForm, setEmergencyForm] = useState({ reference: '', notes: '' });
  const [releaseForm, setReleaseForm] = useState({ undertaking: '', deceased: false });

  const updateStatus = useUpdateInsuranceCaseStatus();
  const recordEligibility = useRecordEligibility();
  const addPolicy = useAddCasePolicy();
  const createPreAuth = useCreatePreAuth();
  const createEnhancement = useCreateEnhancement();
  const requestFinal = useRequestFinalAuthorization();
  const intimateEmergency = useRecordEmergencyIntimation();
  const recordRelease = useRecordPhysicalRelease();

  function fail(error: unknown, fallback: string) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
    toast.error(message ?? fallback);
  }

  if (caseQuery.isLoading) return <div className="p-8 text-center text-on-surface-variant">Loading payer case…</div>;
  if (!item) return <div className="p-8 text-center"><p className="mb-3">Payer case not found.</p><Link href="/insurance/cases" className="inline-flex rounded-md border px-4 py-2 text-sm font-medium">Back to cases</Link></div>;

  const availablePolicies = policies.data?.filter((policy) => !item.policies.some((linked) => linked.policy.id === policy.id)) ?? [];

  async function saveStatus() {
    if (!statusForm.status) return toast.error('Select the next status');
    try { await updateStatus.mutateAsync({ id, status: statusForm.status, notes: statusForm.notes || undefined }); toast.success('Case status updated'); setDialog(null); } catch (error) { fail(error, 'Status update failed'); }
  }

  async function saveEligibility() {
    try {
      await recordEligibility.mutateAsync({ caseId: id, policyId: eligibility.policyId || undefined, isEligible: eligibility.isEligible, coverageAvailable: eligibility.coverageAvailable ? Number(eligibility.coverageAvailable) : undefined, coPayPercent: eligibility.coPayPercent ? Number(eligibility.coPayPercent) : undefined, deductibleAmount: eligibility.deductibleAmount ? Number(eligibility.deductibleAmount) : undefined, roomRentLimit: eligibility.roomRentLimit ? Number(eligibility.roomRentLimit) : undefined, waitingPeriodMet: eligibility.waitingPeriodMet, source: eligibility.source || undefined, reference: eligibility.reference || undefined, validUntil: eligibility.validUntil || undefined });
      toast.success('Eligibility snapshot recorded'); setDialog(null);
    } catch (error) { fail(error, 'Eligibility could not be recorded'); }
  }

  async function savePolicy() {
    if (!policyForm.policyId) return toast.error('Select a policy');
    try { await addPolicy.mutateAsync({ caseId: id, policyId: policyForm.policyId, sequence: Number(policyForm.sequence), allocatedAmount: policyForm.allocatedAmount ? Number(policyForm.allocatedAmount) : undefined, originalDocumentsHeld: policyForm.originalDocumentsHeld, deductionCertificateUrl: policyForm.deductionCertificateUrl || undefined }); toast.success('Policy added to coordination order'); setDialog(null); } catch (error) { fail(error, 'Policy could not be added'); }
  }

  async function savePreAuth(enhancement = false) {
    if (!preAuthForm.procedureDescription || !preAuthForm.estimatedCost) return toast.error('Procedure and estimated cost are required');
    try {
      if (enhancement) {
        await createEnhancement.mutateAsync({ preAuthId: selectedPreAuthId, procedureDescription: preAuthForm.procedureDescription, estimatedCost: Number(preAuthForm.estimatedCost), diagnosisCode: preAuthForm.diagnosisCode || undefined, procedureCode: preAuthForm.procedureCode || undefined, submissionChannel: preAuthForm.submissionChannel, submissionReference: preAuthForm.submissionReference || undefined, notes: preAuthForm.notes || undefined });
        toast.success('Enhancement request created');
      } else {
        await createPreAuth.mutateAsync({ patientId: item!.patientId, insuranceCaseId: id, policyId: preAuthForm.policyId || item!.policies[0]?.policy.id, admissionId: item!.admissionId || undefined, visitId: item!.visitId || undefined, procedureDescription: preAuthForm.procedureDescription, diagnosisCode: preAuthForm.diagnosisCode || undefined, procedureCode: preAuthForm.procedureCode || undefined, estimatedCost: Number(preAuthForm.estimatedCost), submissionChannel: preAuthForm.submissionChannel, submissionReference: preAuthForm.submissionReference || undefined, notes: preAuthForm.notes || undefined });
        toast.success('Initial pre-authorization created');
      }
      setDialog(null);
    } catch (error) { fail(error, 'Authorization request could not be created'); }
  }

  async function saveFinalAuthorization() {
    if (!finalForm.finalAmount) return toast.error('Final amount is required');
    try { await requestFinal.mutateAsync({ caseId: id, claimId: finalForm.claimId || undefined, finalAmount: Number(finalForm.finalAmount), submissionChannel: finalForm.submissionChannel, submissionReference: finalForm.submissionReference || undefined, notes: finalForm.notes || undefined }); toast.success('Final discharge authorization requested'); setDialog(null); } catch (error) { fail(error, 'Final authorization could not be requested'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link href="/insurance/cases" className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="size-4" /> All payer cases</Link><h1 className="text-2xl font-bold font-headline">{item.caseNumber}</h1><p className="text-sm text-on-surface-variant">{item.patient.firstName} {item.patient.lastName ?? ''} · {item.patient.mrn}</p></div>
        <div className="flex flex-wrap gap-2"><Badge variant="outline" className="capitalize">{item.settlementMode}</Badge><Badge variant="outline" className="capitalize">{item.priority}</Badge><Badge>{show(item.status)}</Badge>{TRANSITIONS[item.status].length > 0 && <Button size="sm" onClick={() => { setStatusForm({ status: TRANSITIONS[item.status][0], notes: '' }); setDialog('status'); }}>Advance status</Button>}</div>
      </div>

      {(item.emergency || item.priority !== 'routine') && !item.emergencyIntimatedAt && <Card className="border-orange-300 bg-orange-50/60"><CardContent className="flex items-center justify-between gap-3 pt-6"><div className="flex items-center gap-2 text-orange-800"><Siren className="size-5" /><span>Urgent payer intimation is pending.</span></div><Button size="sm" variant="outline" onClick={() => setDialog('emergency')}>Record intimation</Button></CardContent></Card>}

      <div className="grid gap-4 md:grid-cols-4">
        <Summary label="Payment responsible" value={item.insurer?.name ?? item.corporatePayer?.name ?? item.governmentSchemePayer?.name ?? '—'} />
        <Summary label="Administrator" value={item.tpa?.name ?? 'Direct payer'} />
        <Summary label="Admission / visit" value={item.admission ? `IP · ${formatDate(item.admission.admissionDate)}` : item.visit ? `${item.visit.visitType} · ${formatDate(item.visit.visitDate)}` : 'Pre-admission'} />
        <Summary label="Physical release" value={item.physicalReleaseAt ? formatDate(item.physicalReleaseAt) : 'Not recorded'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialog('eligibility')}><ShieldCheck className="mr-1.5 size-4" /> Record eligibility</Button>
        <Button variant="outline" size="sm" onClick={() => setDialog('policy')} disabled={!availablePolicies.length}><Plus className="mr-1.5 size-4" /> Add policy</Button>
        <Button variant="outline" size="sm" onClick={() => setDialog('preauth')}><FileCheck2 className="mr-1.5 size-4" /> Initial pre-auth</Button>
        <Button variant="outline" size="sm" onClick={() => setDialog('final')}><Clock3 className="mr-1.5 size-4" /> Final authorization</Button>
        {!item.emergencyIntimatedAt && <Button variant="outline" size="sm" onClick={() => setDialog('emergency')}><Siren className="mr-1.5 size-4" /> Emergency intimation</Button>}
        {!item.physicalReleaseAt && <Button variant="outline" size="sm" onClick={() => setDialog('release')}><UserRoundCheck className="mr-1.5 size-4" /> Record release</Button>}
      </div>

      <Tabs defaultValue="journey">
        <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="journey">Case journey</TabsTrigger><TabsTrigger value="policies">Policies & eligibility</TabsTrigger><TabsTrigger value="authorizations">Authorizations</TabsTrigger><TabsTrigger value="claims">Claims</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger></TabsList>
        <TabsContent value="journey" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Patient and encounter</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm"><Detail label="Patient" value={`${item.patient.firstName} ${item.patient.lastName ?? ''}`} /><Detail label="MRN" value={item.patient.mrn} /><Detail label="Phone" value={item.patient.phone ?? '—'} /><Detail label="ABHA" value={item.abhaNumber ?? item.patient.abhaNumber ?? 'Not linked'} /><Detail label="Member ID" value={item.memberId ?? '—'} /><Detail label="Employee ID" value={item.employeeId ?? '—'} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Operational safeguards</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Flag ok={Boolean(item.emergencyIntimatedAt) || !item.emergency} text={item.emergencyIntimatedAt ? `Emergency intimated ${formatDate(item.emergencyIntimatedAt)}` : item.emergency ? 'Emergency intimation pending' : 'Routine case'} /><Flag ok={Boolean(item.physicalReleaseAt)} text={item.physicalReleaseAt ? `Patient physically released ${formatDate(item.physicalReleaseAt)}` : 'Release not yet recorded'} /><Flag ok={!item.deceasedProtocol || Boolean(item.physicalReleaseAt)} text={item.deceasedProtocol ? 'Deceased-patient fast-track active' : 'Standard patient protocol'} />{item.releaseUndertaking && <div className="rounded-md bg-muted p-3 text-on-surface-variant">{item.releaseUndertaking}</div>}</CardContent></Card>
        </TabsContent>
        <TabsContent value="policies" className="mt-4 space-y-4">
          <Card><CardHeader><CardTitle>Policy coordination</CardTitle><CardDescription>Primary, secondary and supplementary recovery order.</CardDescription></CardHeader><CardContent>{item.policies.length ? <div className="space-y-2">{item.policies.map((linked) => <div key={linked.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><div><span className="mr-2 font-semibold">#{linked.sequence}</span>{linked.policy.policyNumber} · {linked.policy.insurer?.name}<div className="text-xs text-on-surface-variant">Coverage {money(linked.policy.coverageAmount)} · Co-pay {linked.policy.coPayPercent}% · Deductible {money(linked.policy.deductibleAmount)}</div></div><div className="text-right text-sm">Allocated {linked.allocatedAmount == null ? 'Not set' : money(linked.allocatedAmount)}<div className="text-xs text-on-surface-variant">Originals {linked.originalDocumentsHeld ? 'held' : 'not held'}</div></div></div>)}</div> : <p className="text-sm text-on-surface-variant">No policies linked.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Eligibility snapshots</CardTitle><CardDescription>Point-in-time payer responses are preserved for audit.</CardDescription></CardHeader><CardContent>{item.eligibilityChecks.length ? <div className="space-y-2">{item.eligibilityChecks.map((check) => <div key={check.id} className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-5"><div><Badge variant={check.isEligible ? 'default' : 'destructive'}>{check.isEligible ? 'Eligible' : 'Not eligible'}</Badge></div><Detail label="Coverage" value={money(check.coverageAvailable)} /><Detail label="Co-pay" value={`${check.coPayPercent ?? 0}%`} /><Detail label="Room cap" value={money(check.roomRentLimit)} /><Detail label="Checked" value={formatDate(check.checkedAt)} /></div>)}</div> : <p className="text-sm text-on-surface-variant">No eligibility check recorded.</p>}</CardContent></Card>
        </TabsContent>
        <TabsContent value="authorizations" className="mt-4"><Card><CardHeader><CardTitle>Authorization chain</CardTitle><CardDescription>Internal request number stays separate from the payer-issued reference.</CardDescription></CardHeader><CardContent>{item.preAuthRequests.length ? <div className="space-y-3">{item.preAuthRequests.map((request) => <div key={request.id} className="rounded-md border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-medium">{request.requestNumber ?? request.id.slice(0, 8)} · {show(request.requestType ?? 'initial')}</div><div className="text-sm text-on-surface-variant">{request.procedureDescription}</div></div><div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{request.status.replace('_', ' ')}</Badge>{request.requestType !== 'finalDischarge' && <Button size="sm" variant="ghost" onClick={() => { setSelectedPreAuthId(request.id); setPreAuthForm({ ...preAuthForm, policyId: request.policyId ?? '', procedureDescription: '', estimatedCost: '' }); setDialog('enhancement'); }}>Enhance</Button>}</div></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-4"><Detail label="Requested" value={money(request.estimatedCost)} /><Detail label="Approved" value={request.approvedAmount == null ? 'Pending' : money(request.approvedAmount)} /><Detail label="Payer reference" value={request.approvalNumber ?? 'Not received'} /><Detail label="Decision due" value={request.decisionDueAt ? new Date(request.decisionDueAt).toLocaleString('en-IN') : '—'} /></div></div>)}</div> : <p className="text-sm text-on-surface-variant">No authorization requests.</p>}</CardContent></Card></TabsContent>
        <TabsContent value="claims" className="mt-4"><Card><CardHeader><CardTitle>Claims</CardTitle><CardDescription>Multiple policies can produce primary, secondary and supplementary claims.</CardDescription></CardHeader><CardContent>{item.claims.length ? <div className="space-y-2">{item.claims.map((claim) => <div key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><div className="font-medium">{claim.claimNumber ?? claim.id.slice(0, 8)} <Badge variant="outline" className="ml-2 capitalize">{claim.tier ?? 'primary'}</Badge></div><div className="text-sm text-on-surface-variant">Claimed {money(claim.claimAmount)} · Outstanding {money(claim.outstandingAmount)}</div></div><div className="flex items-center gap-2"><Badge>{claim.status.replaceAll('_', ' ')}</Badge><Link href={`/insurance/claims/${claim.id}`} className="inline-flex items-center px-2 py-1 text-sm text-primary hover:underline">Open <ExternalLink className="ml-1 size-3.5" /></Link></div></div>)}</div> : <div className="text-sm text-on-surface-variant">No claims linked yet. Create the bill, then submit a primary claim from the claims register using this payer case.</div>}</CardContent></Card></TabsContent>
        <TabsContent value="audit" className="mt-4"><Card><CardHeader><CardTitle>Immutable event timeline</CardTitle></CardHeader><CardContent>{item.auditEvents?.length ? <div className="space-y-3 border-l-2 pl-4">{item.auditEvents.map((event) => <div key={event.id}><div className="text-sm font-medium">{event.eventType.replaceAll('.', ' · ')}</div><div className="text-xs text-on-surface-variant">{new Date(event.occurredAt).toLocaleString('en-IN')}{event.fromStatus || event.toStatus ? ` · ${event.fromStatus ?? '—'} → ${event.toStatus ?? '—'}` : ''}</div></div>)}</div> : <p className="text-sm text-on-surface-variant">No events recorded.</p>}</CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={dialog === 'status'} onOpenChange={(value) => !value && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Advance case status</DialogTitle></DialogHeader><FieldSelect label="Next status" value={statusForm.status} onChange={(value) => setStatusForm({ ...statusForm, status: value as InsuranceCaseStatus })} options={TRANSITIONS[item.status].map((value) => [value, show(value)])} /><div><Label>Transition notes</Label><Textarea value={statusForm.notes} onChange={(event) => setStatusForm({ ...statusForm, notes: event.target.value })} /></div><DialogFooter><Button onClick={saveStatus} disabled={updateStatus.isPending}>Update</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={dialog === 'eligibility'} onOpenChange={(value) => !value && setDialog(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Record eligibility snapshot</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><FieldSelect label="Policy (optional)" value={eligibility.policyId} onChange={(value) => setEligibility({ ...eligibility, policyId: value })} options={item.policies.map((linked) => [linked.policy.id, linked.policy.policyNumber])} /><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={eligibility.isEligible} onChange={(event) => setEligibility({ ...eligibility, isEligible: event.target.checked })} /> Eligible at time of check</label><TextField label="Available coverage" type="number" value={eligibility.coverageAvailable} onChange={(value) => setEligibility({ ...eligibility, coverageAvailable: value })} /><TextField label="Co-pay %" type="number" value={eligibility.coPayPercent} onChange={(value) => setEligibility({ ...eligibility, coPayPercent: value })} /><TextField label="Deductible" type="number" value={eligibility.deductibleAmount} onChange={(value) => setEligibility({ ...eligibility, deductibleAmount: value })} /><TextField label="Room-rent limit" type="number" value={eligibility.roomRentLimit} onChange={(value) => setEligibility({ ...eligibility, roomRentLimit: value })} /><TextField label="Source / channel" value={eligibility.source} onChange={(value) => setEligibility({ ...eligibility, source: value })} /><TextField label="Payer reference" value={eligibility.reference} onChange={(value) => setEligibility({ ...eligibility, reference: value })} /><TextField label="Valid until" type="datetime-local" value={eligibility.validUntil} onChange={(value) => setEligibility({ ...eligibility, validUntil: value })} /><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={eligibility.waitingPeriodMet} onChange={(event) => setEligibility({ ...eligibility, waitingPeriodMet: event.target.checked })} /> Waiting period satisfied</label></div><DialogFooter><Button onClick={saveEligibility} disabled={recordEligibility.isPending}>Save snapshot</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={dialog === 'policy'} onOpenChange={(value) => !value && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Add policy to coordination order</DialogTitle></DialogHeader><FieldSelect label="Policy" value={policyForm.policyId} onChange={(value) => setPolicyForm({ ...policyForm, policyId: value })} options={availablePolicies.map((policy) => [policy.id, `${policy.policyNumber} · ${policy.insurer?.name ?? '—'}`])} /><TextField label="Sequence" type="number" value={policyForm.sequence} onChange={(value) => setPolicyForm({ ...policyForm, sequence: value })} /><TextField label="Allocated claim amount" type="number" value={policyForm.allocatedAmount} onChange={(value) => setPolicyForm({ ...policyForm, allocatedAmount: value })} /><TextField label="Deduction certificate URL" value={policyForm.deductionCertificateUrl} onChange={(value) => setPolicyForm({ ...policyForm, deductionCertificateUrl: value })} /><label className="flex gap-2 text-sm"><input type="checkbox" checked={policyForm.originalDocumentsHeld} onChange={(event) => setPolicyForm({ ...policyForm, originalDocumentsHeld: event.target.checked })} /> Original documents held for this policy</label><DialogFooter><Button onClick={savePolicy} disabled={addPolicy.isPending}>Add policy</Button></DialogFooter></DialogContent></Dialog>

      <AuthorizationDialog open={dialog === 'preauth' || dialog === 'enhancement'} title={dialog === 'enhancement' ? 'Create enhancement request' : 'Create initial pre-authorization'} form={preAuthForm} setForm={setPreAuthForm} policyOptions={item.policies.map((linked) => [linked.policy.id, linked.policy.policyNumber])} onClose={() => setDialog(null)} onSave={() => savePreAuth(dialog === 'enhancement')} pending={createPreAuth.isPending || createEnhancement.isPending} showPolicy={dialog !== 'enhancement'} />

      <Dialog open={dialog === 'final'} onOpenChange={(value) => !value && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Request final discharge authorization</DialogTitle></DialogHeader>{item.claims.length > 0 && <FieldSelect label="Linked claim (optional)" value={finalForm.claimId} onChange={(value) => setFinalForm({ ...finalForm, claimId: value })} options={item.claims.map((claim) => [claim.id, claim.claimNumber ?? claim.id.slice(0, 8)])} />}<TextField label="Final bill amount *" type="number" value={finalForm.finalAmount} onChange={(value) => setFinalForm({ ...finalForm, finalAmount: value })} /><FieldSelect label="Submission channel" value={finalForm.submissionChannel} onChange={(value) => setFinalForm({ ...finalForm, submissionChannel: value as typeof finalForm.submissionChannel })} options={['portal', 'email', 'nhcx', 'api', 'manual'].map((value) => [value, value.toUpperCase()])} /><TextField label="Submission reference" value={finalForm.submissionReference} onChange={(value) => setFinalForm({ ...finalForm, submissionReference: value })} /><div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800"><AlertTriangle className="mr-1 inline size-4" /> Final authorization SLA is three hours; alerting starts at 2.5 hours.</div><DialogFooter><Button onClick={saveFinalAuthorization} disabled={requestFinal.isPending}>Request authorization</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={dialog === 'emergency'} onOpenChange={(value) => !value && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Record emergency intimation</DialogTitle></DialogHeader><TextField label="Payer intimation reference" value={emergencyForm.reference} onChange={(value) => setEmergencyForm({ ...emergencyForm, reference: value })} /><div><Label>Notes</Label><Textarea value={emergencyForm.notes} onChange={(event) => setEmergencyForm({ ...emergencyForm, notes: event.target.value })} /></div><DialogFooter><Button onClick={async () => { try { await intimateEmergency.mutateAsync({ caseId: id, reference: emergencyForm.reference || undefined, notes: emergencyForm.notes || undefined }); toast.success('Emergency intimation recorded'); setDialog(null); } catch (error) { fail(error, 'Could not record intimation'); } }} disabled={intimateEmergency.isPending}>Record intimation</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={dialog === 'release'} onOpenChange={(value) => !value && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>Record physical release</DialogTitle></DialogHeader><div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><HeartPulse className="mr-1 inline size-4" /> Patient release is recorded independently; the payer claim remains open until financial closure.</div><div><Label>Release undertaking *</Label><Textarea rows={4} value={releaseForm.undertaking} onChange={(event) => setReleaseForm({ ...releaseForm, undertaking: event.target.value })} /></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={releaseForm.deceased} onChange={(event) => setReleaseForm({ ...releaseForm, deceased: event.target.checked })} /> Deceased-patient immediate release protocol</label><DialogFooter><Button onClick={async () => { if (releaseForm.undertaking.trim().length < 5) return toast.error('Enter the release undertaking'); try { await recordRelease.mutateAsync({ caseId: id, undertaking: releaseForm.undertaking, deceased: releaseForm.deceased }); toast.success('Physical release recorded; payer workflow remains open'); setDialog(null); } catch (error) { fail(error, 'Release could not be recorded'); } }} disabled={recordRelease.isPending}>Record release</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <Card><CardHeader className="pb-3"><CardDescription>{label}</CardDescription><CardTitle className="text-base">{value}</CardTitle></CardHeader></Card>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><div className="text-xs uppercase tracking-wide text-on-surface-variant">{label}</div><div className="font-medium">{value}</div></div>; }
function Flag({ ok, text }: { ok: boolean; text: string }) { return <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-orange-500'}`} />{text}</div>; }
function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <div><Label>{label}</Label><Select value={value || null} onValueChange={(next) => next && onChange(next as string)}><SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>; }

type AuthorizationForm = { policyId: string; procedureDescription: string; diagnosisCode: string; procedureCode: string; estimatedCost: string; submissionChannel: 'portal' | 'email' | 'nhcx' | 'api' | 'manual'; submissionReference: string; notes: string };
function AuthorizationDialog({ open, title, form, setForm, policyOptions, onClose, onSave, pending, showPolicy }: { open: boolean; title: string; form: AuthorizationForm; setForm: (value: AuthorizationForm) => void; policyOptions: string[][]; onClose: () => void; onSave: () => void; pending: boolean; showPolicy: boolean }) {
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">{showPolicy && policyOptions.length > 0 && <FieldSelect label="Policy" value={form.policyId} onChange={(value) => setForm({ ...form, policyId: value })} options={policyOptions} />}<TextField label="Estimated cost *" type="number" value={form.estimatedCost} onChange={(value) => setForm({ ...form, estimatedCost: value })} /><div className="sm:col-span-2"><Label>Procedure / treatment *</Label><Textarea value={form.procedureDescription} onChange={(event) => setForm({ ...form, procedureDescription: event.target.value })} /></div><TextField label="Diagnosis code" value={form.diagnosisCode} onChange={(value) => setForm({ ...form, diagnosisCode: value })} /><TextField label="Procedure code" value={form.procedureCode} onChange={(value) => setForm({ ...form, procedureCode: value })} /><FieldSelect label="Submission channel" value={form.submissionChannel} onChange={(value) => setForm({ ...form, submissionChannel: value as AuthorizationForm['submissionChannel'] })} options={['portal', 'email', 'nhcx', 'api', 'manual'].map((value) => [value, value.toUpperCase()])} /><TextField label="Submission reference" value={form.submissionReference} onChange={(value) => setForm({ ...form, submissionReference: value })} /><div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onSave} disabled={pending}>Submit request</Button></DialogFooter></DialogContent></Dialog>;
}
