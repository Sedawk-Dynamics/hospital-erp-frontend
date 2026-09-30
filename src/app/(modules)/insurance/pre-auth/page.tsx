'use client';

import { useState } from 'react';
import {
  Plus,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  X,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CommunicationLogPanel } from '@/components/insurance/communication-log-panel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  usePreAuths,
  usePoliciesByPatient,
  useCreatePreAuth,
  useApprovePreAuth,
  useRejectPreAuth,
  useHoldPreAuth,
  useReleasePreAuthHold,
  useCancelPreAuth,
  type PreAuthRequest,
  type PreAuthStatus,
} from '@/hooks/use-insurance';

const STATUS_TONE: Record<PreAuthStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  denied: 'bg-rose-100 text-rose-700 border-rose-300',
  expired: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  on_hold: 'bg-violet-100 text-violet-700 border-violet-300',
  cancelled: 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

interface CreateForm {
  patientId: string;
  patientLabel: string;
  policyId: string;
  procedureDescription: string;
  estimatedCost: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

const EMPTY: CreateForm = {
  patientId: '',
  patientLabel: '',
  policyId: '',
  procedureDescription: '',
  estimatedCost: '',
  validFrom: '',
  validTo: '',
  notes: '',
};

export default function PreAuthPage() {
  const [statusFilter, setStatusFilter] = useState<PreAuthStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatient = useDebounce(patientSearch, 250);
  const [form, setForm] = useState<CreateForm>(EMPTY);

  // Action dialogs
  const [approving, setApproving] = useState<PreAuthRequest | null>(null);
  const [approveData, setApproveData] = useState({
    approvalNumber: '',
    approvedAmount: '',
    validFrom: '',
    validTo: '',
    notes: '',
  });
  const [rejecting, setRejecting] = useState<PreAuthRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [holding, setHolding] = useState<PreAuthRequest | null>(null);
  const [viewingLog, setViewingLog] = useState<PreAuthRequest | null>(null);
  const [holdReason, setHoldReason] = useState('');

  const { data, isLoading } = usePreAuths({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });
  const { data: patientPolicies } = usePoliciesByPatient(form.patientId || undefined);
  const { data: patients } = usePatientSearch(debouncedPatient);

  const createMut = useCreatePreAuth();
  const approveMut = useApprovePreAuth();
  const rejectMut = useRejectPreAuth();
  const holdMut = useHoldPreAuth();
  const releaseMut = useReleasePreAuthHold();
  const cancelMut = useCancelPreAuth();

  async function handleCreate() {
    if (!form.patientId) return toast.error('Pick a patient');
    if (!form.policyId) return toast.error('Pick a policy');
    if (!form.procedureDescription.trim()) return toast.error('Procedure description is required');
    try {
      await createMut.mutateAsync({
        patientId: form.patientId,
        policyId: form.policyId,
        procedureDescription: form.procedureDescription.trim(),
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Pre-auth submitted');
      setDialogOpen(false);
      setForm(EMPTY);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Submit failed');
    }
  }

  async function handleApprove() {
    if (!approving) return;
    try {
      await approveMut.mutateAsync({
        id: approving.id,
        body: {
          approvalNumber: approveData.approvalNumber.trim() || undefined,
          approvedAmount: approveData.approvedAmount ? Number(approveData.approvedAmount) : undefined,
          validFrom: approveData.validFrom || undefined,
          validTo: approveData.validTo || undefined,
          notes: approveData.notes.trim() || undefined,
        },
      });
      toast.success('Pre-auth approved');
      setApproving(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Approval failed');
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    if (!rejectNotes.trim()) return toast.error('Reason is required');
    try {
      await rejectMut.mutateAsync({ id: rejecting.id, notes: rejectNotes.trim() });
      toast.success('Pre-auth rejected');
      setRejecting(null);
      setRejectNotes('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Rejection failed');
    }
  }

  async function handleHold() {
    if (!holding) return;
    if (!holdReason.trim()) return toast.error('Hold reason is required');
    try {
      await holdMut.mutateAsync({ id: holding.id, reason: holdReason.trim() });
      toast.success('Pre-auth put on hold');
      setHolding(null);
      setHoldReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Hold failed');
    }
  }

  async function handleRelease(id: string) {
    try {
      await releaseMut.mutateAsync(id);
      toast.success('Hold released');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Release failed');
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this pre-authorization?')) return;
    try {
      await cancelMut.mutateAsync(id);
      toast.success('Pre-auth cancelled');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cancel failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Pre-Authorization</h1>
          <p className="text-sm text-on-surface-variant">
            Submit procedure approval requests, track validity, and manage holds.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> New Pre-Auth
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-violet-600" /> Pre-Auth Requests
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => v && setStatusFilter(v as PreAuthStatus | 'all')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-on-surface-variant" />
                <Input
                  placeholder="Search procedure / patient"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <CardDescription>
            {data?.data?.length ?? 0} of {data?.meta?.total ?? 0} requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request #</TableHead>
                <TableHead>Payer Reference</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Procedure</TableHead>
                <TableHead>Insurer / Policy</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-on-surface-variant">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : data?.data?.length ? (
                data.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.requestNumber ?? p.id.slice(0, 8)}</TableCell>
                    <TableCell>{p.approvalNumber ?? 'Not received'}</TableCell>
                    <TableCell>
                      {p.patient?.firstName} {p.patient?.lastName ?? ''}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal">
                      <div>{p.procedureDescription}</div>
                      {p.holdReason && (
                        <div className="text-xs text-violet-700">
                          On hold: {p.holdReason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{p.policy?.insurer?.name ?? (p.insuranceCase?.caseNumber ? `Case ${p.insuranceCase.caseNumber}` : '—')}</div>
                      <div className="text-xs text-on-surface-variant">
                        {p.policy?.policyNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      ₹{(p.estimatedCost ?? 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      {p.approvedAmount != null
                        ? `₹${Number(p.approvedAmount).toLocaleString('en-IN')}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {p.validFrom && p.validTo
                        ? `${formatDate(p.validFrom)} → ${formatDate(p.validTo)}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border', STATUS_TONE[p.status])}>
                        {p.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status === 'pending' && (
                          <>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Approve"
                              onClick={() => {
                                setApproving(p);
                                setApproveData({
                                  approvalNumber: '',
                                  approvedAmount: p.estimatedCost?.toString() ?? '',
                                  validFrom: '',
                                  validTo: '',
                                  notes: '',
                                });
                              }}
                            >
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Reject"
                              onClick={() => setRejecting(p)}
                            >
                              <XCircle className="size-3.5 text-rose-600" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Hold"
                              onClick={() => setHolding(p)}
                            >
                              <Pause className="size-3.5 text-violet-600" />
                            </Button>
                          </>
                        )}
                        {p.status === 'on_hold' && (
                          <>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Release hold"
                              onClick={() => handleRelease(p.id)}
                            >
                              <Play className="size-3.5 text-emerald-600" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Approve"
                              onClick={() => {
                                setApproving(p);
                                setApproveData({
                                  approvalNumber: '',
                                  approvedAmount: p.estimatedCost?.toString() ?? '',
                                  validFrom: '',
                                  validTo: '',
                                  notes: '',
                                });
                              }}
                            >
                              <CheckCircle2 className="size-3.5 text-emerald-600" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Reject"
                              onClick={() => setRejecting(p)}
                            >
                              <XCircle className="size-3.5 text-rose-600" />
                            </Button>
                          </>
                        )}
                        {(p.status === 'pending' || p.status === 'on_hold') && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Cancel"
                            onClick={() => handleCancel(p.id)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Communication log"
                          onClick={() => setViewingLog(p)}
                        >
                          <MessageSquare className="size-3.5 text-primary" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-on-surface-variant">
                    No pre-auth requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Pre-Authorization Request</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Patient *</Label>
              <Input
                placeholder="Search patient"
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
            <div className="col-span-2">
              <Label>Policy *</Label>
              <Select
                value={form.policyId || null}
                onValueChange={(v) => v && setForm({ ...form, policyId: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick patient's policy" />
                </SelectTrigger>
                <SelectContent>
                  {patientPolicies?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.policyNumber} · {p.insurer?.name ?? '—'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.patientId && patientPolicies?.length === 0 && (
                <p className="mt-1 text-xs text-rose-600">
                  This patient has no policies yet. Add one in Policies first.
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Label>Procedure Description *</Label>
              <Textarea
                rows={3}
                value={form.procedureDescription}
                onChange={(e) => setForm({ ...form, procedureDescription: e.target.value })}
              />
            </div>
            <div>
              <Label>Estimated Cost (₹)</Label>
              <Input
                type="number"
                min="0"
                value={form.estimatedCost}
                onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
              />
            </div>
            <div />
            <div>
              <Label>Requested Validity From</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div>
              <Label>Requested Validity To</Label>
              <Input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </div>
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
              Submit Pre-Auth
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Pre-Authorization</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Payer-issued pre-authorization reference</Label>
              <Input
                placeholder="Leave blank until supplied by the payer"
                value={approveData.approvalNumber}
                onChange={(e) =>
                  setApproveData({ ...approveData, approvalNumber: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Approved Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                value={approveData.approvedAmount}
                onChange={(e) =>
                  setApproveData({ ...approveData, approvedAmount: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Valid From</Label>
              <Input
                type="date"
                value={approveData.validFrom}
                onChange={(e) =>
                  setApproveData({ ...approveData, validFrom: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Valid To</Label>
              <Input
                type="date"
                value={approveData.validTo}
                onChange={(e) => setApproveData({ ...approveData, validTo: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={approveData.notes}
                onChange={(e) => setApproveData({ ...approveData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveMut.isPending}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Pre-Authorization</DialogTitle>
          </DialogHeader>
          <Label>Reason</Label>
          <Textarea
            rows={4}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={rejectMut.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold dialog */}
      <Dialog open={!!holding} onOpenChange={(o) => !o && setHolding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Pre-Auth on Hold</DialogTitle>
          </DialogHeader>
          <Label>Reason for hold</Label>
          <Textarea
            rows={3}
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            placeholder="e.g. awaiting medical records from doctor, waiting on insurer query…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolding(null)}>
              Cancel
            </Button>
            <Button onClick={handleHold} disabled={holdMut.isPending}>
              Put on Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingLog} onOpenChange={(open) => !open && setViewingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Communication Log</DialogTitle>
            <DialogDescription>{viewingLog?.procedureDescription}</DialogDescription>
          </DialogHeader>
          {viewingLog && <CommunicationLogPanel preAuthId={viewingLog.id} embedded />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
