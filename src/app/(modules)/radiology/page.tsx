'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDateTime, toInputDateStr } from '@/lib/date-utils';
import {
  Search, Calendar, Clock, CheckCircle2, Loader2,
  CalendarPlus, ImagePlus, ShieldCheck, Eye, Pencil, IndianRupee,
  Wallet,
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
  useScheduleImaging,
  useUploadImagingResult,
  useAddImagingReport,
  useEditImagingResult,
  useVerifyImagingResult,
  useVerifyImagingPayment,
  useImagingResults,
  type ImagingRequest,
  type ImagingResult,
} from '@/hooks/use-imaging';
import {
  useImagingRequestAttachments,
  useImagingResultAttachments,
} from '@/hooks/use-imaging-attachments';
import { useUsersList } from '@/hooks/use-users';
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
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          {isRadiologyAdmin && (
            <TabsTrigger value="awaiting-approval">
              <ShieldCheck className="mr-1.5 size-3.5" /> Awaiting Approval
            </TabsTrigger>
          )}
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
        <TabsContent value="scheduled" className="pt-4">
          <RequestList variant="scheduled" radiologistView={isRadiologist} />
        </TabsContent>
        <TabsContent value="completed" className="pt-4">
          <RequestList variant="completed" radiologistView={isRadiologist} />
        </TabsContent>
        {isRadiologyAdmin && (
          <TabsContent value="awaiting-approval" className="pt-4">
            <ResultsTab onlyFinalized={true} />
          </TabsContent>
        )}
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
  const [date, setDate] = useState(toInputDateStr());

  const { data, isLoading } = useImagingRequests({
    limit: 100,
    search: search || undefined,
    date: date || undefined,
    excludeCancelled: true,
  });

  const requests = (data?.data ?? []) as ImagingRequest[];

  const stats = useMemo(() => {
    let pending = 0, scheduled = 0, inProgress = 0, completed = 0;
    for (const r of requests) {
      if (r.status === 'requested') pending++;
      else if (r.status === 'scheduled') scheduled++;
      else if (r.status === 'in_progress') inProgress++;
      else if (r.status === 'completed') completed++;
    }
    return { pending, scheduled, inProgress, completed };
  }, [requests]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pending" value={stats.pending} icon={Clock} className="bg-amber-50 text-amber-700" />
        <StatCard label="Scheduled" value={stats.scheduled} icon={Calendar} className="bg-blue-50 text-blue-700" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Loader2} className="bg-purple-50 text-purple-700" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} className="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
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
//   - pending:          radiologist sees paymentVerified=true + status=requested,
//                       admin sees all status=requested (paid + unpaid)
//   - scheduled:        status=scheduled (already gated by payment server-side)
//   - completed:        status=completed
type RequestListVariant = 'awaiting-payment' | 'pending' | 'scheduled' | 'completed';

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
    const base: { status?: string; paymentVerified?: 'true' } = {
      status: variant === 'pending' ? 'requested' : variant,
    };
    if (radiologistView) base.paymentVerified = 'true';
    return base;
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
  const [scheduleFor, setScheduleFor] = useState<ImagingRequest | null>(null);
  const [uploadFor, setUploadFor] = useState<ImagingRequest | null>(null);
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
  const colCount = 8;

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
                <Th>Scheduled</Th>
                <Th>{isAwaitingPayment ? 'Bill' : 'Technician'}</Th>
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
                  const canSchedule = r.paymentVerified !== false; // server also enforces
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
                      <td className="px-4 py-3 text-xs">
                        {r.scheduledAt ? formatDateTime(r.scheduledAt) : '-'}
                        {r.room && <div className="text-muted-foreground">Room: {r.room}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isAwaitingPayment ? (
                          <BillCell request={r} />
                        ) : r.assignedTechnician ? (
                          `${r.assignedTechnician.firstName} ${r.assignedTechnician.lastName}`
                        ) : (
                          '-'
                        )}
                      </td>
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
                          {!isAwaitingPayment && (r.status === 'requested' || r.status === 'scheduled') && canSchedule && (
                            <Button size="sm" variant="outline" onClick={() => setScheduleFor(r)}>
                              <CalendarPlus className="size-3.5" /> Schedule
                            </Button>
                          )}
                          {!isAwaitingPayment && r.status !== 'cancelled' && canSchedule && (
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
                          {!isAwaitingPayment && !canSchedule && (
                            <span className="text-[10px] text-muted-foreground italic">
                              Payment pending
                            </span>
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
      <ScheduleDialog request={scheduleFor} onOpenChange={(open) => !open && setScheduleFor(null)} />
      <UploadResultDialog request={uploadFor} onOpenChange={(open) => !open && setUploadFor(null)} />
    </>
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
// Schedule Dialog (date + technician + room)
// ============================================================
function ScheduleDialog({
  request, onOpenChange,
}: {
  request: ImagingRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const schedule = useScheduleImaging();
  const usersQ = useUsersList({ limit: 200 });

  const techs = useMemo(
    () =>
      (usersQ.data?.data ?? []).filter((u) =>
        u.userRoles?.some((ur) => ['radiologist', 'lab_technician'].includes(ur.role.name)),
      ),
    [usersQ.data],
  );

  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [techId, setTechId] = useState('');
  const [room, setRoom] = useState('');

  const handle = async () => {
    if (!request) return;
    if (!date) { toast.error('Pick a date'); return; }
    try {
      await schedule.mutateAsync({
        id: request.id,
        scheduledDate: date,
        scheduledTime: time,
        assignedTechnicianId: techId || undefined,
        room: room || undefined,
      });
      toast.success('Scheduled');
      setDate(''); setTime('09:00'); setTechId(''); setRoom('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to schedule');
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Imaging</DialogTitle>
          <DialogDescription>Assign date, room, and technician.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Technician</Label>
            <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm" value={techId} onChange={(e) => setTechId(e.target.value)}>
              <option value="">-- Select technician --</option>
              {techs.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Room</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Radiology Room 2" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={schedule.isPending}>Cancel</Button>
          <Button onClick={handle} disabled={schedule.isPending}>{schedule.isPending ? 'Saving…' : 'Schedule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const upload = useUploadImagingResult();
  const edit = useEditImagingResult();

  // The request payload only carries { id, status } for an existing result —
  // so once we have a resultId (either from the request or from a fresh
  // create), fetch the attachments using that ID directly.
  const existingResultId = request?.imagingResult?.id;
  const [resultId, setResultId] = useState<string | null>(existingResultId ?? null);
  const isEdit = !!existingResultId || !!resultId;

  const attachmentsQ = useImagingRequestAttachments(request?.id);

  useEffect(() => {
    setResultId(existingResultId ?? null);
  }, [request?.id, existingResultId]);

  // For new results we create an empty draft so the attachments panel can
  // bind uploads to a resultId. Auto-runs once when the dialog opens on a
  // request that doesn't yet have a result.
  useEffect(() => {
    if (!request || resultId) return;
    let cancelled = false;
    (async () => {
      try {
        const created = await upload.mutateAsync({
          imagingRequestId: request.id,
          patientId: request.patientId,
        });
        if (!cancelled) setResultId((created as any)?.id ?? null);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.response?.data?.message ?? 'Failed to create draft');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Imaging Report' : 'Upload Imaging Result'}
          </DialogTitle>
          <DialogDescription>
            Upload the modality output, scanned PDF report, DICOM file, or video loop.
            The doctor will view these in the embedded viewer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-2">Attached Files</p>
            {request && (
              <ImagingAttachmentsViewer
                requestId={request.id}
                resultId={resultId ?? undefined}
                attachments={attachmentsQ.data ?? []}
                canUpload={true}
                canManage={true}
                enableOrthanc
                emptyMessage={
                  resultId
                    ? 'No files attached yet — upload modality images, PDFs, DICOM or videos.'
                    : upload.isPending
                      ? 'Preparing draft…'
                      : 'Creating draft…'
                }
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Results Tab — finalize (radiologist) + sign/publish (admin) + edit
// ============================================================
function ResultsTab({ onlyFinalized = false }: { onlyFinalized?: boolean }) {
  const [page, setPage] = useState(1);
  // When called from "Awaiting Approval" admin tab, narrow to finalized only.
  const { data, isLoading } = useImagingResults({
    page,
    limit: 20,
    ...(onlyFinalized ? { status: 'finalized' } : {}),
  });
  const results = (data?.data ?? []) as ImagingResult[];

  const addReport = useAddImagingReport();
  const verify = useVerifyImagingResult();
  const { isRadiologyAdmin } = useRadiologyRole();

  const [reportFor, setReportFor] = useState<ImagingResult | null>(null);
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
                {onlyFinalized
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
                      {/* Radiologist marks the report complete (finalized). */}
                      {r.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => setReportFor(r)}>
                          <CheckCircle2 className="size-3.5" /> Mark Complete
                        </Button>
                      )}
                      {/* Only radiology_admin can publish a finalized report (2026-05-27 flow). */}
                      {r.status === 'finalized' && isRadiologyAdmin && (
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
                          <ShieldCheck className="size-3.5" /> Approve & Publish
                        </Button>
                      )}
                      {r.status === 'finalized' && !isRadiologyAdmin && (
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

      <FinalizeReportDialog
        result={reportFor}
        onOpenChange={(open) => !open && setReportFor(null)}
        onSubmit={async (payload) => {
          if (!reportFor) return;
          try {
            await addReport.mutateAsync({ id: reportFor.id, ...payload });
            toast.success('Marked complete — sent to admin for approval');
            setReportFor(null);
          } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed');
          }
        }}
        pending={addReport.isPending}
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

// Finalize Report — sets status=finalized so it can be signed/published.
// Replaces the old "paste PDF URL" version with attachments management; the
// PDF the radiologist uploads via the attachments panel is auto-mirrored
// onto ImagingResult.pdfReportUrl by the backend.
function FinalizeReportDialog({
  result, onOpenChange, onSubmit, pending,
}: {
  result: ImagingResult | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { recommendation?: string }) => void;
  pending: boolean;
}) {
  const [recommendation, setRecommendation] = useState('');

  const requestId = result?.imagingRequest?.id ?? result?.requestId;
  const attachmentsQ = useImagingRequestAttachments(requestId);

  useEffect(() => {
    setRecommendation('');
  }, [result?.id]);

  const hasAttachments = (attachmentsQ.data ?? []).length > 0;

  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Report Complete</DialogTitle>
          <DialogDescription>
            Confirm the attached files are correct. Marking complete sends the
            report to the radiology admin for approval before it reaches the patient.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Recommendation</Label>
            <Textarea rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-semibold">Attached Files</p>
            <p className="text-xs text-muted-foreground mb-2">
              The uploaded report (PDF / DICOM / image / video) carries the radiology finding.
            </p>
            {requestId && (
              <ImagingAttachmentsViewer
                requestId={requestId}
                resultId={result?.id}
                attachments={attachmentsQ.data ?? []}
                canUpload={true}
                canManage={true}
                enableOrthanc
                dense={true}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button
            disabled={pending || !hasAttachments}
            onClick={() =>
              onSubmit({
                recommendation: recommendation || undefined,
              })
            }
          >
            {pending ? 'Saving…' : 'Mark Complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
