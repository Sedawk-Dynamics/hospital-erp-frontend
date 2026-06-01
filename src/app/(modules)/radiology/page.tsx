'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/date-utils';
import {
  Search, Clock, CheckCircle2, Loader2,
  ImagePlus, ShieldCheck, Eye, Pencil, IndianRupee,
  Wallet, Ban, RotateCcw, UserX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import {
  useImagingRequests,
  useVerifyImagingResult,
  useVerifyImagingPayment,
  useCloseImagingRequest,
  useReopenImagingRequest,
  useImagingResults,
  IMAGING_CLOSURE_REASONS,
  IMAGING_CLOSURE_REASON_LABELS,
  type ImagingClosureReason,
  type ImagingRequest,
  type ImagingResult,
} from '@/hooks/use-imaging';
import {
  useImagingRequestAttachments,
  useImagingResultAttachments,
} from '@/hooks/use-imaging-attachments';
import { useRadiologyRole } from '@/hooks/use-radiology-role';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { RadiologyReportPrintDialog } from '@/components/radiology/radiology-report-print-view';
import { ImagingAttachmentsViewer } from '@/components/shared/imaging-attachments-viewer';

export default function RadiologyHomePage() {
  const { isRadiologyAdmin, isRadiologist } = useRadiologyRole();
  // Both flows always need Dashboard + Scheduled + Completed + Results.
  // Admin additionally sees Awaiting Payment + Awaiting Approval.
  // Radiologist sees Pending (only payment-verified, status=requested).
  const defaultTab = isRadiologyAdmin ? 'awaiting-payment' : 'pending';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Radiology Home"
        description={
          isRadiologyAdmin
            ? 'Verify payments, route requests to radiologists, approve & publish reports.'
            : 'Pick up cleared requests, perform studies, upload reports, mark complete.'
        }
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList variant="line">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          {isRadiologyAdmin && (
            <TabsTrigger value="awaiting-payment">
              <Wallet className="mr-1.5 size-3.5" /> Awaiting Payment
            </TabsTrigger>
          )}
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          {isRadiologyAdmin && (
            <TabsTrigger value="awaiting-approval">
              <ShieldCheck className="mr-1.5 size-3.5" /> Awaiting Approval
            </TabsTrigger>
          )}
          <TabsTrigger value="closed">
            <UserX className="mr-1.5 size-3.5" /> Closed / No-show
          </TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-4"><DashboardTab /></TabsContent>
        {isRadiologyAdmin && (
          <TabsContent value="awaiting-payment" className="pt-4">
            <RequestList variant="awaiting-payment" />
          </TabsContent>
        )}
        <TabsContent value="pending" className="pt-4">
          <RequestList variant="pending" radiologistView={isRadiologist} />
        </TabsContent>
        <TabsContent value="completed" className="pt-4">
          <RequestList variant="completed" radiologistView={isRadiologist} />
        </TabsContent>
        {isRadiologyAdmin && (
          <TabsContent value="awaiting-approval" className="pt-4">
            <ResultsTab pendingApproval={true} />
          </TabsContent>
        )}
        <TabsContent value="closed" className="pt-4"><ClosedTab /></TabsContent>
        <TabsContent value="results" className="pt-4"><ResultsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Dashboard Tab — stats by status
// ============================================================
function DashboardTab() {
  const [search, setSearch] = useState('');
  // Empty by default → show the whole active worklist. Picking a date narrows
  // to that day's ORDERS (scheduling was removed, so there's no schedule date).
  const [date, setDate] = useState('');

  const { data, isLoading } = useImagingRequests({
    limit: 100,
    search: search || undefined,
    date: date || undefined,
    excludeCancelled: true,
  });

  const requests = (data?.data ?? []) as ImagingRequest[];

  const stats = useMemo(() => {
    let pending = 0, inProgress = 0, completed = 0;
    for (const r of requests) {
      // 'requested' + legacy 'scheduled' are both "to-do" now that scheduling
      // is removed.
      if (r.status === 'requested' || r.status === 'scheduled') pending++;
      else if (r.status === 'in_progress') inProgress++;
      else if (r.status === 'completed') completed++;
    }
    return { pending, inProgress, completed };
  }, [requests]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pending" value={stats.pending} icon={Clock} className="bg-amber-50 text-amber-700" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Loader2} className="bg-purple-50 text-purple-700" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} className="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Orders on</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        {date && (
          <Button size="sm" variant="outline" onClick={() => setDate('')}>All</Button>
        )}
      </div>

      <RequestTable requests={requests} loading={isLoading} variant="pending" />
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, className,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-surface-container-lowest shadow-sanctuary p-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
}

// ============================================================
// Request list per variant
// ============================================================
//   - awaiting-payment: admin-only queue, paymentVerified=false
//   - pending:          the radiologist's active worklist — payment-verified
//                       requests that aren't completed yet (scheduling was
//                       removed, so this is just "ready to scan & upload").
//   - completed:        status=completed
type RequestListVariant = 'awaiting-payment' | 'pending' | 'completed';

function RequestList({
  variant, radiologistView = false,
}: {
  variant: RequestListVariant;
  radiologistView?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Compute the API filter from the variant + role context.
  const apiParams = (() => {
    if (variant === 'awaiting-payment') {
      return { paymentVerified: 'false' as const };
    }
    if (variant === 'completed') {
      return {
        status: 'completed',
        ...(radiologistView ? { paymentVerified: 'true' as const } : {}),
      };
    }
    // pending = active worklist: everything not completed/cancelled/no-show.
    return {
      excludeCompleted: true as const,
      ...(radiologistView ? { paymentVerified: 'true' as const } : {}),
    };
  })();

  const { data, isLoading } = useImagingRequests({
    ...apiParams,
    page,
    limit: 20,
    search: search || undefined,
    excludeCancelled: true,
  });

  const requests = (data?.data ?? []) as ImagingRequest[];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
      </div>
      <RequestTable requests={requests} loading={isLoading} variant={variant} />
      {(data?.meta?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">Page {page} of {data?.meta?.totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestTable({
  requests, loading, variant,
}: {
  requests: ImagingRequest[];
  loading: boolean;
  variant: RequestListVariant;
}) {
  const [uploadFor, setUploadFor] = useState<ImagingRequest | null>(null);
  const [closeFor, setCloseFor] = useState<ImagingRequest | null>(null);
  const { isRadiologyAdmin } = useRadiologyRole();
  const verifyPayment = useVerifyImagingPayment();

  const handleVerifyPayment = async (r: ImagingRequest) => {
    try {
      await verifyPayment.mutateAsync(r.id);
      toast.success('Payment verified — request released to radiologist');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to verify payment');
    }
  };

  // Columns differ slightly by variant: the awaiting-payment queue replaces
  // the "Technician" column with a "Bill" column so the admin can see the
  // payment status at a glance.
  const isAwaitingPayment = variant === 'awaiting-payment';
  // Scheduling was removed, so the Scheduled + Technician columns are gone.
  // The awaiting-payment queue keeps a Bill column for the admin.
  const colCount = isAwaitingPayment ? 7 : 6;

  return (
    <>
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <Th>Patient</Th>
                <Th>Type</Th>
                <Th>Body Part</Th>
                <Th>Urgency</Th>
                <Th>Status</Th>
                {isAwaitingPayment && <Th>Bill</Th>}
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="px-4 py-8 text-center"><Loader2 className="size-5 animate-spin inline-block" /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-8 text-center text-muted-foreground">
                  {isAwaitingPayment
                    ? 'No requests pending payment verification.'
                    : 'No imaging requests.'}
                </td></tr>
              ) : (
                requests.map((r) => {
                  const canUpload = r.paymentVerified !== false; // server also enforces
                  return (
                    <tr key={r.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3 font-medium">
                        <div>{r.patient?.firstName} {r.patient?.lastName}</div>
                        {r.patient?.mrn && (
                          <div className="text-[10px] font-mono text-muted-foreground">{r.patient.mrn}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">{r.imagingType.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">{r.bodyPart ?? '-'}</td>
                      <td className="px-4 py-3"><Badge>{r.urgency ?? r.priority ?? 'routine'}</Badge></td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                        {r.paymentVerified === false && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                              <Wallet className="size-3 mr-1" /> Unpaid
                            </Badge>
                          </div>
                        )}
                      </td>
                      {isAwaitingPayment && (
                        <td className="px-4 py-3 text-xs">
                          <BillCell request={r} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {isAwaitingPayment && isRadiologyAdmin && (
                            <Button
                              size="sm"
                              onClick={() => handleVerifyPayment(r)}
                              disabled={verifyPayment.isPending}
                            >
                              <ShieldCheck className="size-3.5" /> Verify Payment
                            </Button>
                          )}
                          {!isAwaitingPayment && r.status !== 'cancelled' && r.status !== 'no_show' && canUpload && r.imagingResult?.status !== 'published' && (
                            <Button size="sm" onClick={() => setUploadFor(r)}>
                              {r.imagingResult ? (
                                <>
                                  <Pencil className="size-3.5" /> Edit Report
                                </>
                              ) : (
                                <>
                                  <ImagePlus className="size-3.5" /> Upload Result
                                </>
                              )}
                            </Button>
                          )}
                          {/* Published reports are locked — show a read-only marker
                              in place of the edit button. */}
                          {!isAwaitingPayment && r.imagingResult?.status === 'published' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 italic px-2">
                              <ShieldCheck className="size-3" /> Published — locked
                            </span>
                          )}
                          {!isAwaitingPayment && !canUpload && (
                            <span className="text-[10px] text-muted-foreground italic">
                              Payment pending
                            </span>
                          )}
                          {/* Admin can close out a request that won't produce a
                              report file (no-show, refused, done elsewhere, …). */}
                          {isRadiologyAdmin && r.status !== 'completed' && !r.imagingResult && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-700 border-rose-200 hover:bg-rose-50"
                              onClick={() => setCloseFor(r)}
                            >
                              <Ban className="size-3.5" /> Close
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <UploadResultDialog request={uploadFor} onOpenChange={(open) => !open && setUploadFor(null)} />
      <CloseRequestDialog request={closeFor} onOpenChange={(open) => !open && setCloseFor(null)} />
    </>
  );
}

// ============================================================
// Close Request Dialog — admin closes a request with no report file
// ============================================================
// Used for the "patient never came / no scan will happen" cases the normal
// upload→complete flow can't terminate. Picks a reason (which decides whether
// the request lands on `no_show` or `cancelled`) plus an optional note.
function CloseRequestDialog({
  request, onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const close = useCloseImagingRequest();
  const [reason, setReason] = useState<ImagingClosureReason>('patient_no_show');
  const [note, setNote] = useState('');

  useEffect(() => {
    setReason('patient_no_show');
    setNote('');
  }, [request?.id]);

  const selected = IMAGING_CLOSURE_REASONS.find((r) => r.value === reason);

  const handle = async () => {
    if (!request) return;
    if (reason === 'other' && !note.trim()) {
      toast.error('Add a note describing the reason');
      return;
    }
    try {
      await close.mutateAsync({ id: request.id, reason, note: note.trim() || undefined });
      toast.success(
        reason === 'patient_no_show'
          ? 'Marked as no-show'
          : 'Request closed — doctor notified',
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to close request');
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Imaging Request</DialogTitle>
          <DialogDescription>
            Use this for studies that won&apos;t produce a report file — the patient
            didn&apos;t come, refused, had it done elsewhere, or it&apos;s no longer
            required. The ordering doctor is notified.
          </DialogDescription>
        </DialogHeader>
        {request && (
          <div className="rounded-lg bg-surface-container-low px-3 py-2 text-sm">
            <span className="font-medium">
              {request.patient?.firstName} {request.patient?.lastName}
            </span>{' '}
            · <span className="capitalize">{request.imagingType.replace(/_/g, ' ')}</span>
            {request.bodyPart ? ` · ${request.bodyPart}` : ''}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label>Reason *</Label>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as ImagingClosureReason)}
            >
              {IMAGING_CLOSURE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-muted-foreground mt-1">{selected.hint}</p>
            )}
          </div>
          <div>
            <Label>Note {reason === 'other' ? '*' : '(optional)'}</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any extra detail for the record / doctor…"
            />
          </div>
          {reason === 'patient_no_show' ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              This will be recorded as a <strong>no-show</strong>. You can reschedule or
              reopen it later from the Closed / No-show tab if the patient returns.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              This will mark the request <strong>cancelled</strong> with the reason saved
              for reporting. It can be reopened later if needed.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={close.isPending}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={close.isPending} className="bg-rose-600 hover:bg-rose-700">
            {close.isPending ? 'Closing…' : 'Close Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Closed / No-show Tab — terminal admin-closed requests + reopen/reschedule
// ============================================================
function ClosedTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { isRadiologyAdmin } = useRadiologyRole();

  const { data, isLoading } = useImagingRequests({
    closed: true,
    page,
    limit: 20,
    search: search || undefined,
  });

  const requests = (data?.data ?? []) as ImagingRequest[];

  const reopen = useReopenImagingRequest();

  const handleReopen = async (r: ImagingRequest) => {
    try {
      await reopen.mutateAsync(r.id);
      toast.success('Reopened — back in the worklist');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to reopen');
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <Th>Patient</Th>
                <Th>Type</Th>
                <Th>Body Part</Th>
                <Th>Status</Th>
                <Th>Reason</Th>
                <Th>Closed By</Th>
                <Th>Closed At</Th>
                {isRadiologyAdmin && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center"><Loader2 className="size-5 animate-spin inline-block" /></td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No closed or no-show requests.
                </td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">
                      <div>{r.patient?.firstName} {r.patient?.lastName}</div>
                      {r.patient?.mrn && (
                        <div className="text-[10px] font-mono text-muted-foreground">{r.patient.mrn}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{r.imagingType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{r.bodyPart ?? '-'}</td>
                    <td className="px-4 py-3">
                      {r.status === 'no_show' ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                          <UserX className="size-3 mr-1" /> No-show
                        </Badge>
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{r.closureReason ? (IMAGING_CLOSURE_REASON_LABELS[r.closureReason] ?? r.closureReason) : '-'}</div>
                      {r.closureNote && (
                        <div className="text-[10px] text-muted-foreground max-w-[200px] truncate" title={r.closureNote}>
                          {r.closureNote}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.closer ? `${r.closer.firstName} ${r.closer.lastName}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.closedAt ? formatDateTime(r.closedAt) : '-'}
                    </td>
                    {isRadiologyAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {/* Reopen brings a closed/no-show request back into the
                              worklist (Pending). Scheduling was removed. */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReopen(r)}
                            disabled={reopen.isPending}
                          >
                            <RotateCcw className="size-3.5" /> Reopen
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">Page {page} of {data?.meta?.totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Friendly labels for the PaymentMethod enum.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  upi: 'UPI',
  net_banking: 'Net Banking',
  insurance: 'Insurance',
  cheque: 'Cheque',
  other: 'Other',
};

function formatPaymentMethod(method: string) {
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

// Bill summary cell shown on the Awaiting Payment queue. Pulls
// from the linkedBill decoration the list endpoint attaches per row.
function BillCell({ request }: { request: ImagingRequest }) {
  const b = request.linkedBill;
  if (!b) return <span className="text-muted-foreground">No bill yet</span>;
  const charge = Number(b.chargeAmount ?? 0);
  const paid = Number(b.amountPaid ?? 0);
  const due = Number(b.balanceDue ?? 0);
  // Distinct payment modes used against this bill, newest first (already
  // ordered by the API). Lets the admin confirm how the patient paid us.
  const modes = Array.from(
    new Set((b.payments ?? []).map((p) => formatPaymentMethod(p.paymentMethod))),
  );
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-[10px]">{b.billNumber}</div>
      <div className="flex items-center gap-1">
        <IndianRupee className="size-3" />
        <span>{charge.toLocaleString('en-IN')}</span>
        <Badge variant="outline" className="text-[10px] ml-1 capitalize">
          {b.status?.replace(/_/g, ' ') ?? 'pending'}
        </Badge>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Paid {paid.toLocaleString('en-IN')} · Due {due.toLocaleString('en-IN')}
      </div>
      <div className="flex items-center gap-1 flex-wrap pt-0.5">
        <Wallet className="size-3 text-muted-foreground" />
        {modes.length > 0 ? (
          modes.map((m) => (
            <Badge key={m} variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700">
              {m}
            </Badge>
          ))
        ) : (
          <span className="text-[10px] text-muted-foreground italic">No payment recorded</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Upload Result Dialog — create or edit
// ============================================================
// Unified flow: if the request already has a result, this dialog opens in
// edit mode (PATCH /results/:id). Otherwise it first POSTs a draft result
// and then exposes the attachments panel so files can be added to the same
// record. Replaces the previous "paste image URLs" flow.

function UploadResultDialog({
  request, onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  // The result row is created lazily by the backend on the FIRST file upload —
  // opening this dialog no longer creates anything, so opening + closing
  // without uploading leaves no draft behind (and can't trip the "result
  // already exists" conflict). If the request already has a result, bind new
  // files to it; otherwise the viewer uploads against the request alone.
  const existingResultId = request?.imagingResult?.id;
  const isEdit = !!existingResultId;

  const attachmentsQ = useImagingRequestAttachments(request?.id);
  const hasAttachments = (attachmentsQ.data ?? []).length > 0;

  const handleSubmit = () => {
    if (!hasAttachments) {
      toast.error('Attach at least one file before submitting');
      return;
    }
    toast.success(isEdit ? 'Report updated' : 'Result submitted — study marked completed');
    onOpenChange(false);
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Imaging Report' : 'Upload Imaging Result'}
          </DialogTitle>
          <DialogDescription>
            Upload the modality output, scanned PDF report, DICOM file, or video loop.
            The study is marked completed only once a file is attached.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">Attached Files</p>
            {request && (
              <ImagingAttachmentsViewer
                requestId={request.id}
                resultId={existingResultId ?? undefined}
                attachments={attachmentsQ.data ?? []}
                canUpload={true}
                canManage={true}
                enableOrthanc
                emptyMessage="No files attached yet — upload modality images, PDFs, DICOM or videos."
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!hasAttachments}>
            <CheckCircle2 className="size-3.5" /> Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Results Tab — radiology admin approves & publishes uploaded studies
// ============================================================
function ResultsTab({ pendingApproval = false }: { pendingApproval?: boolean }) {
  const [page, setPage] = useState(1);
  // The "Awaiting Approval" admin tab narrows to studies that have a file but
  // aren't published yet (pendingApproval); the plain Results tab shows all.
  const { data, isLoading } = useImagingResults({
    page,
    limit: 20,
    ...(pendingApproval ? { pendingApproval: true } : {}),
  });
  const results = (data?.data ?? []) as ImagingResult[];

  const verify = useVerifyImagingResult();
  const { isRadiologyAdmin } = useRadiologyRole();

  const [editFor, setEditFor] = useState<ImagingResult | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <Th>Patient</Th>
              <Th>Modality</Th>
              <Th>Status</Th>
              <Th>Radiologist</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="size-5 animate-spin inline-block" /></td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                {pendingApproval
                  ? 'No reports awaiting admin approval.'
                  : 'No results yet.'}
              </td></tr>
            ) : (
              results.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3">{(r as any).patient?.firstName} {(r as any).patient?.lastName}</td>
                  <td className="px-4 py-3 capitalize">{r.imagingRequest?.imagingType ?? (r as any).request?.imagingType ?? '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {r.radiologist
                      ? `${r.radiologist.firstName} ${r.radiologist.lastName}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setPreviewId(r.id)} title="Preview branded report">
                        <Eye className="size-3.5" />
                      </Button>
                      {r.status !== 'published' && (
                        <Button size="sm" variant="outline" onClick={() => setEditFor(r)} title="Edit attached files">
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                      )}
                      {/* Radiology admin approves & publishes the uploaded study
                          directly — the radiologist finalize step was removed. */}
                      {r.status !== 'published' && isRadiologyAdmin && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await verify.mutateAsync(r.id);
                              toast.success('Report approved & published — patient can now view it');
                            } catch (err: any) {
                              toast.error(err?.response?.data?.message ?? 'Failed to approve');
                            }
                          }}
                          disabled={verify.isPending}
                        >
                          <ShieldCheck className="size-3.5" /> Approve &amp; Publish
                        </Button>
                      )}
                      {r.status !== 'published' && !isRadiologyAdmin && (
                        <span className="text-[10px] text-muted-foreground italic px-2">
                          Awaiting admin approval
                        </span>
                      )}
                      {r.pdfReportUrl && (
                        <a className="text-xs underline px-2 py-1" href={r.pdfReportUrl} target="_blank" rel="noreferrer">PDF</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RadiologyReportPrintDialog
        resultId={previewId}
        open={!!previewId}
        onOpenChange={(next) => !next && setPreviewId(null)}
      />


      <EditResultDialog
        result={editFor}
        onOpenChange={(open) => !open && setEditFor(null)}
      />

      {(data?.meta?.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">Page {page} of {data?.meta?.totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= (data?.meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone Edit dialog — works for draft + finalized rows on the Results
// tab. Published results are locked (backend rejects PATCH).
function EditResultDialog({
  result, onOpenChange,
}: {
  result: ImagingResult | null;
  onOpenChange: (open: boolean) => void;
}) {
  const requestId = result?.imagingRequest?.id ?? result?.requestId;
  const attachmentsQ = useImagingResultAttachments(result?.id);

  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Imaging Result</DialogTitle>
          <DialogDescription>
            Add, replace, or remove the attached files.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold mb-2">Attached Files</p>
            {requestId && (
              <ImagingAttachmentsViewer
                requestId={requestId}
                resultId={result?.id}
                attachments={attachmentsQ.data ?? []}
                canUpload={true}
                canManage={true}
                enableOrthanc
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
      {children}
    </th>
  );
}
