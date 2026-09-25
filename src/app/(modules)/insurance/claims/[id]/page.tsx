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
  X,
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
import { CommunicationLogPanel } from '@/components/insurance/communication-log-panel';
import { ClaimWorkflowPanel } from '@/components/insurance/claim-workflow-panel';
import { ClaimBillCard } from '@/components/insurance/claim-bill-card';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import {
  useClaim,
  useSubmitClaim,
  useApproveClaim,
  useRejectClaim,
  usePartialApproveClaim,
  useResubmitClaim,
  useCancelClaim,
  useExportClaim,
  useSplitBill,
  type ClaimStatus,
  type AppliedBillSplit,
} from '@/hooks/use-insurance';

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

const PIPELINE: ClaimStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'partially_settled',
  'settled',
];

function inr(value: number | string | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function apiError(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: claim, isLoading } = useClaim(id);

  const [approveOpen, setApproveOpen] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [approvedAmount, setApprovedAmount] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [resubmitAmount, setResubmitAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [appliedSplit, setAppliedSplit] = useState<AppliedBillSplit | null>(null);

  const submitMut = useSubmitClaim();
  const approveMut = useApproveClaim();
  const partialMut = usePartialApproveClaim();
  const rejectMut = useRejectClaim();
  const resubmitMut = useResubmitClaim();
  const cancelMut = useCancelClaim();
  const exportMut = useExportClaim();
  const splitMut = useSplitBill();

  if (isLoading || !claim) {
    return <div className="p-8 text-on-surface-variant">Loading claim…</div>;
  }

  const stage = claim.status === 'query_raised' || claim.status === 'response_submitted' || claim.status === 'rejected'
    ? 1
    : claim.status === 'partially_approved'
      ? 2
      : PIPELINE.indexOf(claim.status as ClaimStatus);
  const claimSafe = claim;

  async function doSubmit() {
    try {
      await submitMut.mutateAsync(id);
      toast.success('Marked under review');
    } catch (err: unknown) {
      toast.error(apiError(err, 'Failed'));
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
    } catch (err: unknown) {
      toast.error(apiError(err, 'Failed'));
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
    } catch (err: unknown) {
      toast.error(apiError(err, 'Failed'));
    }
  }
  async function doReject() {
    if (!rejectReason.trim()) return toast.error('Reason is required');
    try {
      await rejectMut.mutateAsync({ id, rejectionReason: rejectReason.trim() });
      toast.success('Claim rejected');
      setRejectOpen(false);
    } catch (err: unknown) {
      toast.error(apiError(err, 'Failed'));
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
    } catch (err: unknown) {
      toast.error(apiError(err, 'Failed'));
    }
  }
  async function doCancel() {
    if (!cancelReason.trim()) return toast.error('Reason is required');
    try {
      await cancelMut.mutateAsync({ id, reason: cancelReason.trim() });
      toast.success('Claim cancelled');
      setCancelOpen(false);
    } catch (err: unknown) {
      toast.error(apiError(err, 'Failed'));
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
      toast.success('Claim export downloaded');
    } catch (err: unknown) {
      toast.error(apiError(err, 'Export failed'));
    }
  }
  async function doApplySplit() {
    if (!claimSafe.policyId) return toast.error('A policy is required to calculate this split');
    try {
      const result = await splitMut.mutateAsync({
        billId: claimSafe.billId,
        policyId: claimSafe.policyId,
        claimAmount: Number(claimSafe.claimAmount),
      });
      setAppliedSplit(result.billSplit);
      const wasAlreadyCorrect =
        Number(claimSafe.bill?.insuranceCoveredAmount ?? 0) === result.billSplit.insurancePortion &&
        Number(claimSafe.bill?.patientPayableAmount ?? 0) === result.billSplit.patientPortion &&
        Number(claimSafe.bill?.balanceDue ?? 0) === result.billSplit.balanceDue;
      toast.success(
        wasAlreadyCorrect
          ? 'TPA / patient split was already correct.'
          : `Split updated: TPA ${inr(result.billSplit.insurancePortion)}, patient ${inr(result.billSplit.patientPortion)}.`,
      );
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not recalculate the bill split'));
    }
  }
  const isOpen = ['submitted', 'under_review', 'query_raised', 'response_submitted', 'resubmitted'].includes(claim.status);
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
            Payer: {claim.policy?.insurer?.name ?? claim.insuranceCase?.insurer?.name ?? claim.insuranceCase?.corporatePayer?.name ?? claim.insuranceCase?.governmentSchemePayer?.name ?? '—'} ·{' '}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-9">
        <MoneyCard label="Claim Amount" value={inr(claim.claimAmount)} />
        <MoneyCard label="Co-Pay" value={inr(claim.copayAmount)} tone="text-amber-700" />
        <MoneyCard label="Deductible" value={inr(claim.deductibleAmount)} tone="text-rose-700" />
        <MoneyCard
          label="Payer Approved"
          value={inr(claim.approvedAmount ?? claim.coveredAmount)}
          tone="text-emerald-700"
        />
        <MoneyCard label="Gross Recovered" value={inr(claim.paidAmount)} tone="text-teal-700" />
        <MoneyCard label="TDS Receivable" value={inr(claim.tdsReceivableAmount)} tone="text-violet-700" />
        <MoneyCard label="Outstanding" value={inr(claim.outstandingAmount)} tone="text-rose-700" />
        <MoneyCard label="Delay Liability" value={inr(claim.delayLiabilityAmount)} tone="text-orange-700" />
        <MoneyCard
          label="Patient Share (Claim)"
          value={inr(claim.patientShare)}
          tone="text-primary"
        />
      </div>

      {claim.bill && <ClaimBillCard bill={claim.bill} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Claim lifecycle and payer decisions</CardDescription>
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
              <Download className="size-4 text-primary" /> Legacy Claim Export
            </Button>
            <Button
              onClick={doApplySplit}
              variant="outline"
              className="justify-start gap-1.5"
              disabled={splitMut.isPending}
            >
              <Split className="size-4 text-cyan-700" />
              {splitMut.isPending ? 'Recalculating…' : 'Recalculate TPA / Patient Share'}
            </Button>
            {appliedSplit && (
              <div role="status" className="rounded-md border border-cyan-200 bg-cyan-50 p-2.5 text-xs text-cyan-950">
                <div className="font-semibold">Bill split recalculated</div>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  <span>TPA <strong>{inr(appliedSplit.insurancePortion)}</strong></span>
                  <span>Patient <strong>{inr(appliedSplit.patientPortion)}</strong></span>
                  <span>Due <strong>{inr(appliedSplit.balanceDue)}</strong></span>
                </div>
              </div>
            )}
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
            <CardTitle>Payer, Policy & Bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Policy #" value={claim.policy?.policyNumber} />
            <Row label="Payer" value={claim.policy?.insurer?.name ?? claim.insuranceCase?.insurer?.name ?? claim.insuranceCase?.corporatePayer?.name ?? claim.insuranceCase?.governmentSchemePayer?.name} />
            {claim.insuranceCase && <Row label="Payer Case" value={<Link href={`/insurance/cases/${claim.insuranceCase.id}`} className="text-primary underline">{claim.insuranceCase.caseNumber}</Link>} />}
            <Row label="Claim tier" value={(claim.tier ?? 'primary').replace(/_/g, ' ')} />
            <Row label="Payer claim ref" value={claim.payerClaimReference ?? '—'} />
            <Row label="Bill #" value={claim.bill?.billNumber} />
            <Row label="Bill Total" value={inr(claim.bill?.totalAmount)} />
          </CardContent>
        </Card>
      </div>

      <ClaimWorkflowPanel claim={claim} />

      <CommunicationLogPanel claimId={claim.id} />

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
