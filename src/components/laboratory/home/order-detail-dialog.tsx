'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { useState } from 'react';
import {
  CheckCircle2,
  Send,
  Eye,
  Undo2,
  X as XIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useUpdateSampleStatus,
  useSubmitLabReport,
  usePublishLabReport,
  useRejectLabReport,
  useLabOrder,
  useCancelLabOrder,
  type LabOrder
} from '@/hooks/use-lab';
import { SendBackDialog } from '@/components/shared/diagnostics/send-back-dialog';
import { cn, getApiErrorMessage } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  useLabOrderAttachments,
  type LabAttachment
} from '@/hooks/use-lab-attachments';
import { useLabRole } from '@/hooks/use-lab-role';
import { LabReportPrintDialog } from '@/components/laboratory/lab-report-print-view';
import { StatusBadge } from '@/components/laboratory/home/lab-table-bits';
import { TestItemRow } from '@/components/laboratory/home/test-item-row';


// ============================================================
// Order Detail Dialog — sample lifecycle + per-test two-mode result entry
// + order-level report panel (Generate → Sign → Publish).
//
// Two report-generation paths per SoW Week 6/7:
//   Mode A (Upload): upload a PDF/image per test → Mark Done. When every
//     item is done the backend auto-publishes the LabReport — the uploaded
//     files ARE the report.
//   Mode B (Add Details): enter structured parameter rows per test (value,
//     unit, normal range, abnormal flag). Generate creates a branded
//     LabReport draft; supervisor signs and publishes.
//
// Role gating: both technicians and supervisors can run either mode and
// generate a draft report. Sign / Publish / Verify-results stay supervisor-
// only (the backend permission `lab_reports.approve` enforces this; the UI
// just hides the controls).
// ============================================================
export function OrderDetailDialog({
  order,
  onOpenChange,
}: {
  order: LabOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const sampleStatus = useUpdateSampleStatus();
  // Re-fetch the order fresh inside the dialog so the report + entered
  // results refresh after Save Results / Generate / Sign / Publish without
  // forcing the parent table to reload.
  const liveOrderQ = useLabOrder(order?.id ?? '');
  const liveOrder = liveOrderQ.data ?? order;
  const { data: attachments } = useLabOrderAttachments(order?.id);
  const cancelOrder = useCancelLabOrder();

  if (!order || !liveOrder) return null;

  const canCancel = liveOrder.status !== 'completed' && liveOrder.status !== 'cancelled';
  const handleCancelOrder = async () => {
    const reason = window.prompt('Reason for cancelling this order? (shown on the order)');
    if (reason === null) return; // dismissed
    try {
      await cancelOrder.mutateAsync({ id: liveOrder.id, reason: reason.trim() || undefined });
      toast.success('Order cancelled');
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to cancel order'));
    }
  };

  const advanceSample = async (
    sampleId: string,
    status: 'in_transit' | 'received' | 'processing' | 'completed',
  ) => {
    try {
      await sampleStatus.mutateAsync({ id: sampleId, status });
      toast.success(`Sample marked ${status.replace('_', ' ')}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update sample'));
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Order #{liveOrder.id.slice(0, 8)} — {liveOrder.patient.firstName} {liveOrder.patient.lastName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <StatusBadge status={liveOrder.status} reportStatus={liveOrder.labReport?.status} />
            <span className="text-xs">{liveOrder.labOrderItems?.length ?? 0} test(s)</span>
            {canCancel && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto h-7 gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                disabled={cancelOrder.isPending}
                onClick={handleCancelOrder}
              >
                <XIcon className="h-3.5 w-3.5" />
                Cancel order
              </Button>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Samples */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Samples</h3>
          {(liveOrder.labSamples?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No samples collected yet.</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {(liveOrder.labSamples ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{s.sampleType}</span>
                    <Badge className="ml-2">{s.status.replace('_', ' ')}</Badge>
                    {s.barcode && (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {s.barcode}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {s.status === 'collected' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'in_transit')}>→ Transit</Button>}
                    {s.status === 'in_transit' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'received')}>→ Received</Button>}
                    {s.status === 'received' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'processing')}>→ Processing</Button>}
                    {s.status === 'processing' && <Button size="sm" variant="outline" onClick={() => advanceSample(s.id, 'completed')}>→ Done</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tests — two-mode result entry per test */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Tests</h3>
            <div className="text-[10px] text-muted-foreground">
              Choose per test: <span className="font-medium">Upload File</span> (file IS the report) or <span className="font-medium">Add Details</span> (generate a branded report).
            </div>
          </div>
          <div className="rounded-lg border divide-y">
            {(liveOrder.labOrderItems ?? []).map((it) => (
              <TestItemRow
                key={it.id}
                orderId={liveOrder.id}
                patientId={liveOrder.patientId}
                item={it}
                attachments={(attachments ?? []).filter((a) => a.labOrderItemId === it.id)}
                reportFinalized={
                  liveOrder.labReport != null &&
                  liveOrder.labReport.status !== 'draft' &&
                  liveOrder.labReport.status !== 'review'
                }
              />
            ))}
          </div>
        </section>

        {/* Order-level report panel (Submit + Preview) */}
        <OrderReportPanel order={liveOrder} attachments={attachments ?? []} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Order-level Report Panel
//   - No report or status='draft': "Submit for Approval" — technicians (and
//     supervisors who choose to draft first) queue the report for review.
//     Submit is enabled when ANY of these is present: an uploaded file, a
//     saved structured result, or both.
//   - status='review': awaiting supervisor approval. Supervisors see
//     "Approve & Publish" (and Preview); technicians see a pending badge.
//   - status='published'/'corrected': Preview / Print only.
// Patient portal stays gated by status='published'|'corrected' so anything
// in review/draft is invisible to the patient until a supervisor publishes.
// ============================================================
export function OrderReportPanel({
  order,
  attachments,
}: {
  order: LabOrder;
  attachments: LabAttachment[];
}) {
  const { canApprove } = useLabRole();
  const submit = useSubmitLabReport();
  const publish = usePublishLabReport();
  const reject = useRejectLabReport();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sendBackOpen, setSendBackOpen] = useState(false);

  const report = order.labReport;
  // A draft carrying correction notes is one the lab admin sent back. The
  // technician needs to read WHY right where they are about to redo the work.
  const sentBackNote =
    report?.status === 'draft'
      ? ((report as { correctionNotes?: string | null }).correctionNotes ?? null)
      : null;

  const hasAnyResult = (order.labOrderItems ?? []).some(
    (it) => (it.labResults?.length ?? 0) > 0,
  );
  const hasAnyAttachment = attachments.length > 0;
  // Any one of file / data / both is enough to submit.
  const canSubmit = hasAnyResult || hasAnyAttachment;

  const isPublished = report?.status === 'published' || report?.status === 'corrected';
  const isAwaitingApproval = report?.status === 'review';
  const canResubmit = !report || report.status === 'draft' || report.status === 'review';

  const onSubmit = async () => {
    try {
      await submit.mutateAsync({ orderId: order.id, notify: true });
      toast.success('Submitted for supervisor approval');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to submit report'));
    }
  };

  const onApprove = async () => {
    if (!report) return;
    try {
      await publish.mutateAsync({ id: report.id, notify: true });
      toast.success('Report approved and published to patient');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to publish report'));
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Report</h3>
      <div className="rounded-lg border p-3 bg-surface-container-low">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm min-w-0">
            {report ? (
              <>
                <span className="font-medium">Lab Report</span>
                <Badge
                  className={cn(
                    'ml-2 capitalize',
                    isAwaitingApproval && 'bg-amber-100 text-amber-800',
                    isPublished && 'bg-emerald-100 text-emerald-800',
                  )}
                >
                  {isAwaitingApproval ? 'Awaiting approval' : report.status}
                </Badge>
                <span className="ml-2 text-[10px] text-muted-foreground">v{report.version ?? 1}</span>
                {report.publishedAt && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    · published {formatDateTime(report.publishedAt)}
                  </span>
                )}
                {!report.publishedAt && report.signedAt && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    · signed {formatDateTime(report.signedAt)}
                  </span>
                )}
                {isAwaitingApproval && (
                  <div className="text-[10px] text-amber-700 mt-1">
                    {canApprove
                      ? 'Read the uploaded files / entered details above, then approve to release it — or send it back with what needs fixing.'
                      : 'Submitted to the lab admin. The patient will see this report only after approval.'}
                  </div>
                )}
                {sentBackNote && (
                  <div className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                    <span className="font-bold">Sent back:</span> {sentBackNote}
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                {canSubmit
                  ? hasAnyResult && hasAnyAttachment
                    ? 'Files and details captured. Submit for supervisor approval.'
                    : hasAnyResult
                      ? 'Details captured. Submit for supervisor approval.'
                      : 'Files uploaded. Submit for supervisor approval.'
                  : 'No report yet. Upload a file or enter parameter details for at least one test, then Submit.'}
              </span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {report && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewId(report.id)}
                className="gap-1"
              >
                <Eye className="size-3.5" />
                Preview / Print
              </Button>
            )}
            {/* Tech can submit / re-submit while the report is still in a
                tech-editable state (no report, draft, or sent back). */}
            {canResubmit && (
              <Button
                size="sm"
                onClick={onSubmit}
                disabled={!canSubmit || submit.isPending}
                className="gap-1"
                title={!canSubmit ? 'Upload a file or enter result details for at least one test' : undefined}
              >
                <Send className="size-3.5" />
                {submit.isPending
                  ? 'Submitting…'
                  : isAwaitingApproval
                    ? 'Re-submit'
                    : 'Submit for Approval'}
              </Button>
            )}
            {/* The lab admin's two-sided decision. Only shown when the report is
                in review, so technicians never see either button. Refusing used
                to have no button at all: a report that was wrong could only be
                published or left in the queue. */}
            {isAwaitingApproval && canApprove && report && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSendBackOpen(true)}
                  disabled={reject.isPending}
                  className="gap-1 border-amber-200 text-amber-800 hover:bg-amber-50"
                >
                  <Undo2 className="size-3.5" />
                  Send back
                </Button>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={publish.isPending}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-3.5" />
                  {publish.isPending ? 'Publishing…' : 'Approve & Publish'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <LabReportPrintDialog
        reportId={previewId}
        open={!!previewId}
        onOpenChange={(next) => !next && setPreviewId(null)}
      />

      <SendBackDialog
        open={sendBackOpen}
        onOpenChange={setSendBackOpen}
        submitting={reject.isPending}
        subject={{
          title: `${order.patient.firstName} ${order.patient.lastName ?? ''}`.trim(),
          sublabel: `Order ${order.id.slice(0, 8)} · ${order.labOrderItems?.length ?? 0} test(s)`,
        }}
        onConfirm={async (reason) => {
          if (!report) return;
          await reject.mutateAsync({ id: report.id, reason });
          toast.success('Sent back to the bench — the technician has been told why');
        }}
      />
    </section>
  );
}

// Per-test row: hosts the two report-generation modes for this single test.
//   Tab "Upload File" — file picker + Mark Done. Mark Done is the fast path:
//     the backend treats the uploaded file as the report, and once every
//     item on the order is marked done it auto-publishes the LabReport.
//   Tab "Add Details" — structured parameter rows (auto-prefilled from the
//     test catalog's normalRange/unit). Save Results creates LabResult rows
//     which the order-level Generate Report button rolls up into a branded
//     LabReport snapshot.

