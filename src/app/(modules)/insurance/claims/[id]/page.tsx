'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  Split,
  MessageSquarePlus,
  X,
  IndianRupee,
  Banknote,
} from 'lucide-react';
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
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  useClaim,
  useSubmitClaim,
  useApproveClaim,
  useRejectClaim,
  usePartialApproveClaim,
  useSettleClaim,
  useResubmitClaim,
  useCancelClaim,
  useExportClaim,
  useTpaLogs,
  useCreateTpaLog,
  useTpas,
  useSplitBill,
  type ClaimStatus,
} from '@/hooks/use-insurance';

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

const PIPELINE: ClaimStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'partially_settled',
  'settled',
];

function inr(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: claim, isLoading } = useClaim(id);
  const { data: tpaLogs } = useTpaLogs({ claimId: id });
  const { data: tpas } = useTpas({ isActive: true, limit: 100 });

  const [approveOpen, setApproveOpen] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const [approvedAmount, setApprovedAmount] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState('');
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [resubmitAmount, setResubmitAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [logForm, setLogForm] = useState({
    tpaId: '',
    direction: 'outbound' as 'inbound' | 'outbound',
    communicationType: 'email' as 'email' | 'phone' | 'portal' | 'letter',
    subject: '',
    content: '',
  });

  const submitMut = useSubmitClaim();
  const approveMut = useApproveClaim();
  const partialMut = usePartialApproveClaim();
  const rejectMut = useRejectClaim();
  const settleMut = useSettleClaim();
  const resubmitMut = useResubmitClaim();
  const cancelMut = useCancelClaim();
  const exportMut = useExportClaim();
  const createLogMut = useCreateTpaLog();
  const splitMut = useSplitBill();

  if (isLoading || !claim) {
    return <div className="p-8 text-on-surface-variant">Loading claim…</div>;
  }

  const stage = PIPELINE.indexOf(claim.status as ClaimStatus);
  const claimSafe = claim;

  async function doSubmit() {
    try {
      await submitMut.mutateAsync(id);
      toast.success('Marked under review');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doApprove() {
    if (!approvedAmount) return toast.error('Approved amount is required');
    try {
      await approveMut.mutateAsync({
        id,
        approvedAmount: Number(approvedAmount),
        notes: approveNotes.trim() || undefined,
      });
      toast.success('Claim approved');
      setApproveOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doPartial() {
    if (!approvedAmount) return toast.error('Approved amount is required');
    try {
      await partialMut.mutateAsync({
        id,
        approvedAmount: Number(approvedAmount),
        rejectionReason: rejectReason.trim() || undefined,
        notes: approveNotes.trim() || undefined,
      });
      toast.success('Marked partially approved');
      setPartialOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doReject() {
    if (!rejectReason.trim()) return toast.error('Reason is required');
    try {
      await rejectMut.mutateAsync({ id, rejectionReason: rejectReason.trim() });
      toast.success('Claim rejected');
      setRejectOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doSettle() {
    if (!settleAmount) return toast.error('Amount is required');
    try {
      await settleMut.mutateAsync({
        id,
        paidAmount: Number(settleAmount),
        settlementDate: settleDate || undefined,
      });
      toast.success('Settlement recorded');
      setSettleOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doResubmit() {
    if (!resubmitNotes.trim()) return toast.error('Notes are required');
    try {
      await resubmitMut.mutateAsync({
        id,
        body: {
          notes: resubmitNotes.trim(),
          claimAmount: resubmitAmount ? Number(resubmitAmount) : undefined,
        },
      });
      toast.success('Claim resubmitted');
      setResubmitOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doCancel() {
    if (!cancelReason.trim()) return toast.error('Reason is required');
    try {
      await cancelMut.mutateAsync({ id, reason: cancelReason.trim() });
      toast.success('Claim cancelled');
      setCancelOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doExport() {
    try {
      const exportData = await exportMut.mutateAsync(id);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claim-${claimSafe.claimNumber ?? id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('TPA-ready export downloaded');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Export failed');
    }
  }
  async function doApplySplit() {
    try {
      await splitMut.mutateAsync({
        billId: claimSafe.billId,
        policyId: claimSafe.policyId,
        claimAmount: Number(claimSafe.claimAmount),
      });
      toast.success('Bill split applied');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    }
  }
  async function doLog() {
    if (!logForm.tpaId) return toast.error('Pick a TPA');
    try {
      await createLogMut.mutateAsync({
        tpaId: logForm.tpaId,
        claimId: id,
        direction: logForm.direction,
        communicationType: logForm.communicationType,
        subject: logForm.subject.trim() || undefined,
        content: logForm.content.trim() || undefined,
      });
      toast.success('Communication logged');
      setLogOpen(false);
      setLogForm({ ...logForm, subject: '', content: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Log failed');
    }
  }

  const isOpen = ['submitted', 'under_review', 'resubmitted'].includes(claim.status);
  const isApproved = ['approved', 'partially_approved', 'partially_settled'].includes(claim.status);
  const isResubmittable = ['rejected', 'partially_approved'].includes(claim.status);

  return (
    <div className="space-y-6">
      <Link
        href="/insurance/claims"
        className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Back to claims
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">
            Claim {claim.claimNumber ?? claim.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-on-surface-variant">
            Patient: {claim.patient?.firstName} {claim.patient?.lastName} ·{' '}
            Insurer: {claim.policy?.insurer?.name ?? '—'} ·{' '}
            Bill: {claim.bill?.billNumber ?? '—'}
          </p>
        </div>
        <Badge className={cn('border', STATUS_TONE[claim.status])}>
          {claim.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {/* Status pipeline */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            {PIPELINE.map((s, idx) => {
              const active = idx <= stage;
              return (
                <div key={s} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'size-7 rounded-full flex items-center justify-center text-xs font-bold',
                        active ? 'bg-primary text-on-primary' : 'bg-surface-container border',
                      )}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                      {s.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {idx < PIPELINE.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 mx-2',
                        idx < stage ? 'bg-primary' : 'bg-surface-container',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Money breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MoneyCard label="Claim Amount" value={inr(claim.claimAmount)} />
        <MoneyCard label="Co-Pay" value={inr(claim.copayAmount)} tone="text-amber-700" />
        <MoneyCard label="Deductible" value={inr(claim.deductibleAmount)} tone="text-rose-700" />
        <MoneyCard
          label="Insurer Approved"
          value={inr(claim.approvedAmount ?? claim.coveredAmount)}
          tone="text-emerald-700"
        />
        <MoneyCard label="Paid by Insurer" value={inr(claim.paidAmount)} tone="text-teal-700" />
        <MoneyCard
          label="Patient Pays"
          value={inr(claim.patientShare)}
          tone="text-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Lifecycle and TPA operations</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {isOpen && (
              <>
                <Button onClick={doSubmit} variant="outline" className="justify-start gap-1.5">
                  <CheckCircle2 className="size-4 text-amber-600" /> Mark Under Review
                </Button>
                <Button
                  onClick={() => {
                    setApprovedAmount(String(claim.claimAmount));
                    setApproveOpen(true);
                  }}
                  variant="outline"
                  className="justify-start gap-1.5"
                >
                  <CheckCircle2 className="size-4 text-emerald-600" /> Approve in Full
                </Button>
                <Button
                  onClick={() => {
                    setApprovedAmount('');
                    setRejectReason('');
                    setPartialOpen(true);
                  }}
                  variant="outline"
                  className="justify-start gap-1.5"
                >
                  <CheckCircle2 className="size-4 text-sky-600" /> Partial Approval
                </Button>
                <Button
                  onClick={() => {
                    setRejectReason('');
                    setRejectOpen(true);
                  }}
                  variant="outline"
                  className="justify-start gap-1.5"
                >
                  <XCircle className="size-4 text-rose-600" /> Reject
                </Button>
              </>
            )}
            {isApproved && (
              <Button
                onClick={() => {
                  setSettleAmount('');
                  setSettleDate(new Date().toISOString().slice(0, 10));
                  setSettleOpen(true);
                }}
                variant="outline"
                className="justify-start gap-1.5"
              >
                <Banknote className="size-4 text-teal-600" /> Record Settlement
              </Button>
            )}
            {isResubmittable && (
              <Button
                onClick={() => {
                  setResubmitNotes('');
                  setResubmitAmount(String(claim.claimAmount));
                  setResubmitOpen(true);
                }}
                variant="outline"
                className="justify-start gap-1.5"
              >
                <RotateCcw className="size-4 text-violet-600" /> Resubmit with Docs
              </Button>
            )}
            <Button onClick={doExport} variant="outline" className="justify-start gap-1.5">
              <Download className="size-4 text-primary" /> Export for TPA
            </Button>
            <Button onClick={doApplySplit} variant="outline" className="justify-start gap-1.5">
              <Split className="size-4 text-cyan-700" /> Re-apply Bill Split
            </Button>
            <Button
              onClick={() => setLogOpen(true)}
              variant="outline"
              className="justify-start gap-1.5"
            >
              <MessageSquarePlus className="size-4" /> Log TPA Communication
            </Button>
            {claim.status !== 'cancelled' && claim.status !== 'settled' && (
              <Button
                onClick={() => {
                  setCancelReason('');
                  setCancelOpen(true);
                }}
                variant="destructive"
                className="justify-start gap-1.5"
              >
                <X className="size-4" /> Cancel Claim
              </Button>
            )}
          </CardContent>
        </Card>

        {/* TPA logs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>TPA Communication Log</CardTitle>
            <CardDescription>Every message in or out with the TPA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tpaLogs?.data?.length ? (
              tpaLogs.data.map((l) => (
                <div
                  key={l.id}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm',
                    l.direction === 'inbound'
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-sky-200 bg-sky-50/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider">
                      {l.direction} · {l.communicationType ?? 'note'} · {l.tpa?.name}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {formatDateTime(l.createdAt)}
                    </div>
                  </div>
                  {l.subject && <div className="font-medium">{l.subject}</div>}
                  {l.content && (
                    <div className="whitespace-pre-wrap text-on-surface-variant">{l.content}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-outline-variant/40 px-3 py-6 text-center text-xs text-on-surface-variant">
                No TPA communication logged yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Claim Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Submitted" value={formatDateTime(claim.submissionDate)} />
            <Row label="Approval Date" value={claim.approvalDate ? formatDateTime(claim.approvalDate) : '—'} />
            <Row label="Settlement Date" value={claim.settlementDate ? formatDateTime(claim.settlementDate) : '—'} />
            <Row label="Expiry / Deadline" value={claim.expiryDate ? formatDate(claim.expiryDate) : '—'} />
            <Row label="Outstanding" value={inr(claim.outstandingAmount)} />
            <Row label="Resubmissions" value={String(claim.resubmissionCount ?? 0)} />
            {claim.previousClaim && (
              <Row
                label="Previous claim"
                value={
                  <Link
                    href={`/insurance/claims/${claim.previousClaim.id}`}
                    className="text-primary underline"
                  >
                    {claim.previousClaim.claimNumber ?? 'View'}
                  </Link>
                }
              />
            )}
            {claim.rejectionReason && (
              <Row label="Rejection / Note" value={claim.rejectionReason} tone="text-rose-700" />
            )}
            {claim.notes && <Row label="Notes" value={claim.notes} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy & Bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Policy #" value={claim.policy?.policyNumber} />
            <Row label="Insurer" value={claim.policy?.insurer?.name} />
            <Row label="Bill #" value={claim.bill?.billNumber} />
            <Row label="Bill Total" value={inr(claim.bill?.totalAmount)} />
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Full Claim</DialogTitle>
          </DialogHeader>
          <Label>Approved Amount (₹)</Label>
          <Input
            type="number"
            value={approvedAmount}
            onChange={(e) => setApprovedAmount(e.target.value)}
          />
          <Label>Notes</Label>
          <Textarea
            rows={2}
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doApprove} disabled={approveMut.isPending}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={partialOpen} onOpenChange={setPartialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partial Approval</DialogTitle>
          </DialogHeader>
          <Label>Approved Amount (₹) — less than ₹{Number(claim.claimAmount).toLocaleString('en-IN')}</Label>
          <Input
            type="number"
            value={approvedAmount}
            onChange={(e) => setApprovedAmount(e.target.value)}
          />
          <Label>Reason for partial approval</Label>
          <Textarea
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <Label>Internal notes</Label>
          <Textarea
            rows={2}
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doPartial} disabled={partialMut.isPending}>
              Mark Partial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Claim</DialogTitle>
          </DialogHeader>
          <Label>Reason</Label>
          <Textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doReject} disabled={rejectMut.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Insurer Payment</DialogTitle>
          </DialogHeader>
          <Label>Amount paid by insurer (₹)</Label>
          <Input
            type="number"
            value={settleAmount}
            onChange={(e) => setSettleAmount(e.target.value)}
          />
          <Label>Settlement Date</Label>
          <Input
            type="date"
            value={settleDate}
            onChange={(e) => setSettleDate(e.target.value)}
          />
          <p className="text-xs text-on-surface-variant">
            Partial payments are allowed — the claim will move to “Partially Settled” until the full
            approved amount is received.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doSettle} disabled={settleMut.isPending}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resubmit Claim</DialogTitle>
          </DialogHeader>
          <Label>Revised Claim Amount (₹) — optional</Label>
          <Input
            type="number"
            value={resubmitAmount}
            onChange={(e) => setResubmitAmount(e.target.value)}
          />
          <Label>What changed / additional documentation summary</Label>
          <Textarea
            rows={4}
            value={resubmitNotes}
            onChange={(e) => setResubmitNotes(e.target.value)}
            placeholder="e.g. attached pathology report, discharge summary signed off, billing breakdown updated…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doResubmit} disabled={resubmitMut.isPending}>
              Resubmit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Claim</DialogTitle>
          </DialogHeader>
          <Label>Reason</Label>
          <Textarea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Open
            </Button>
            <Button variant="destructive" onClick={doCancel} disabled={cancelMut.isPending}>
              Cancel Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log TPA Communication</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>TPA</Label>
              <Select
                value={logForm.tpaId || null}
                onValueChange={(v) => v && setLogForm({ ...logForm, tpaId: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick TPA" />
                </SelectTrigger>
                <SelectContent>
                  {tpas?.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Direction</Label>
              <Select
                value={logForm.direction}
                onValueChange={(v) =>
                  v && setLogForm({ ...logForm, direction: v as 'inbound' | 'outbound' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound (hospital → TPA)</SelectItem>
                  <SelectItem value="inbound">Inbound (TPA → hospital)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select
                value={logForm.communicationType}
                onValueChange={(v) =>
                  v &&
                  setLogForm({
                    ...logForm,
                    communicationType: v as 'email' | 'phone' | 'portal' | 'letter',
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Subject</Label>
              <Input
                value={logForm.subject}
                onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Content</Label>
              <Textarea
                rows={4}
                value={logForm.content}
                onChange={(e) => setLogForm({ ...logForm, content: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doLog} disabled={createLogMut.isPending}>
              Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  tone,
}: { label: string; value: string; tone?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
          {label}
        </div>
        <div className={cn('text-xl font-bold font-headline', tone)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  tone,
}: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-on-surface-variant">{label}</span>
      <span className={cn('text-right font-medium', tone)}>{value ?? '—'}</span>
    </div>
  );
}
