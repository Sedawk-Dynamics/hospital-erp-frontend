'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useLabOrders,
  useImagingRequests,
  useCancelLabOrder,
  useCancelImagingRequest,
} from '@/hooks/use-doctor';
import type { LabOrder, ImagingRequest } from '@/hooks/use-doctor';
import { apiGet } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date-utils';
import { FlaskConical, ScanLine, Plus, XCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { LabOrderDialog } from './lab-order-dialog';
import { ImagingRequestDialog } from './imaging-request-dialog';
import { LabOrderDetailDialog } from '@/components/shared/lab-order-detail-dialog';
import { ImagingOrderViewerDialog } from '@/components/shared/imaging-order-viewer-dialog';
import { cn } from '@/lib/utils';
import { resolveAttachmentUrl } from '@/hooks/use-lab-attachments';
import { Paperclip, Eye } from 'lucide-react';

interface OrdersPanelProps {
  patientId: string;
  visitId?: string;
}

const labStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  ordered: { label: 'Ordered', bg: 'bg-primary-container/10', text: 'text-primary-container' },
  sample_collected: { label: 'Sample Collected', bg: 'bg-secondary/10', text: 'text-secondary' },
  in_progress: { label: 'In Progress', bg: 'bg-tertiary/10', text: 'text-tertiary' },
  completed: { label: 'Completed', bg: 'bg-primary/10', text: 'text-primary' },
  cancelled: { label: 'Cancelled', bg: 'bg-error/10', text: 'text-error' },
};

const imagingStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  requested: { label: 'Requested', bg: 'bg-primary-container/10', text: 'text-primary-container' },
  scheduled: { label: 'Scheduled', bg: 'bg-secondary/10', text: 'text-secondary' },
  in_progress: { label: 'In Progress', bg: 'bg-tertiary/10', text: 'text-tertiary' },
  completed: { label: 'Completed', bg: 'bg-primary/10', text: 'text-primary' },
  cancelled: { label: 'Cancelled', bg: 'bg-error/10', text: 'text-error' },
};

const imagingTypeLabels: Record<string, string> = {
  xray: 'X-Ray',
  mri: 'MRI',
  ct_scan: 'CT Scan',
  ultrasound: 'Ultrasound',
  ecg: 'ECG',
  echo: 'Echo',
  other: 'Other',
};

export function OrdersPanel({ patientId, visitId }: OrdersPanelProps) {
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [imagingDialogOpen, setImagingDialogOpen] = useState(false);
  // When the doctor clicks a lab order row, open the shared read-only detail
  // dialog so they can see the uploaded report files (PDF / images / scans).
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  // Same idea for imaging — clicking a row opens the universal viewer over
  // the request's attachments (PDFs, JPG/PNG, DICOM, videos).
  const [openImagingId, setOpenImagingId] = useState<string | null>(null);

  // If no visitId passed, auto-fetch the patient's latest active visit.
  const { data: fallbackVisit } = useQuery({
    queryKey: ['doctor', 'active-visit', patientId],
    queryFn: async () => {
      const response = await apiGet<Array<{ id: string; status?: string }>>(
        '/clinical/visits',
        { params: { patientId, status: 'active', limit: 1 } },
      );
      return response.data?.[0]?.id ?? null;
    },
    enabled: !!patientId && !visitId,
  });
  const effectiveVisitId = visitId || fallbackVisit || '';

  const { data: labOrdersData, isLoading: labLoading } = useLabOrders({
    patientId,
    limit: 10,
  });

  const { data: imagingData, isLoading: imagingLoading } = useImagingRequests({
    patientId,
    limit: 10,
  });

  const cancelLabOrder = useCancelLabOrder();
  const cancelImaging = useCancelImagingRequest();

  const labOrders = labOrdersData?.data ?? [];
  const imagingRequests = imagingData?.data ?? [];

  const canOrder = !!effectiveVisitId;

  const handleCancelLab = (id: string) => {
    if (!window.confirm('Cancel this lab order?')) return;
    cancelLabOrder.mutate(
      { id },
      {
        onSuccess: () => toast.success('Lab order cancelled'),
        onError: (err: any) =>
          toast.error(err?.response?.data?.message || 'Failed to cancel lab order'),
      },
    );
  };

  const handleCancelImaging = (id: string) => {
    if (!window.confirm('Cancel this imaging request?')) return;
    cancelImaging.mutate(
      { id },
      {
        onSuccess: () => toast.success('Imaging request cancelled'),
        onError: (err: any) =>
          toast.error(err?.response?.data?.message || 'Failed to cancel imaging request'),
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Lab Orders Section */}
      <Card className="shadow-sanctuary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="h-4 w-4 text-primary" />
              Lab Orders
              {labOrders.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {labOrders.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setLabDialogOpen(true)}
              disabled={!canOrder}
              title={canOrder ? undefined : 'Open from within an active visit to order'}
            >
              <Plus className="h-3 w-3" />
              Order Lab Test
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {labLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : labOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No lab orders yet
            </p>
          ) : (
            <div className="space-y-2">
              {labOrders.map((order: LabOrder) => {
                const statusInfo = labStatusConfig[order.status] ?? labStatusConfig.ordered;
                const items = order.labOrderItems ?? [];
                const doneByPatient = !!order.completedExternallyAt;
                const isCancellable =
                  order.status !== 'completed' && order.status !== 'cancelled';
                const fileCount =
                  (order as any)?._count?.attachments ??
                  (Array.isArray((order as any)?.attachments)
                    ? (order as any).attachments.length
                    : 0);
                return (
                  <div
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenOrderId(order.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpenOrderId(order.id);
                      }
                    }}
                    className={cn(
                      'flex items-start justify-between rounded-lg border p-2.5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30',
                      doneByPatient
                        ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70'
                        : 'border-border/50 hover:bg-accent/30',
                    )}
                    title="View order details and uploaded files"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {items.length > 0 ? (
                          items.map((item, idx) => (
                            <span key={item.id || idx} className="text-sm font-medium text-foreground">
                              {item.test?.testName || 'Test'}
                              {idx < items.length - 1 && ','}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm font-medium text-foreground">
                            {order.orderNumber || 'Lab Order'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </span>
                        {fileCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                            <Paperclip className="h-3 w-3" />
                            {fileCount} file{fileCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {order.urgency && order.urgency !== 'routine' && !doneByPatient && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              order.urgency === 'stat' && 'border-error/30 text-error',
                              order.urgency === 'urgent' && 'border-secondary/30 text-secondary'
                            )}
                          >
                            {order.urgency.toUpperCase()}
                          </Badge>
                        )}
                        {/* Source-aware report link:
                            - patient self-completion → "Patient Uploaded"
                            - else lab-signed report  → "Lab Report"
                            Wrapped in stopPropagation so the row's click doesn't
                            also open the dialog when the doctor wants the
                            direct download. */}
                        {doneByPatient && order.externalReportUrl ? (
                          <a
                            href={resolveAttachmentUrl(order.externalReportUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Patient Uploaded
                          </a>
                        ) : order.labReport?.pdfUrl ? (
                          <a
                            href={resolveAttachmentUrl(order.labReport.pdfUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Lab Report
                          </a>
                        ) : null}
                        {doneByPatient && order.externalNotes && (
                          <span className="text-[10px] italic text-emerald-700 truncate max-w-[220px]">
                            {order.externalNotes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1 ml-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {doneByPatient ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3" />
                          Done by patient
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                            statusInfo.bg,
                            statusInfo.text,
                          )}
                        >
                          {statusInfo.label}
                        </span>
                      )}
                      {isCancellable && !doneByPatient && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          title="Cancel order"
                          onClick={() => handleCancelLab(order.id)}
                          disabled={cancelLabOrder.isPending}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Imaging Requests Section */}
      <Card className="shadow-sanctuary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="h-4 w-4 text-primary" />
              Imaging Requests
              {imagingRequests.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {imagingRequests.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setImagingDialogOpen(true)}
              disabled={!canOrder}
              title={canOrder ? undefined : 'Open from within an active visit to order'}
            >
              <Plus className="h-3 w-3" />
              Request Imaging
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {imagingLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : imagingRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">
              No imaging requests yet
            </p>
          ) : (
            <div className="space-y-2">
              {imagingRequests.map((request: ImagingRequest) => {
                const statusInfo =
                  imagingStatusConfig[request.status] ?? imagingStatusConfig.requested;
                const doneByPatient = !!request.completedExternallyAt;
                const isCancellable =
                  request.status !== 'completed' && request.status !== 'cancelled';
                const hasResult = !!request.imagingResult;
                return (
                  <div
                    key={request.id}
                    onClick={() => hasResult && setOpenImagingId(request.id)}
                    className={cn(
                      'flex items-start justify-between rounded-lg border p-2.5 transition-colors',
                      doneByPatient
                        ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70'
                        : 'border-border/50 hover:bg-accent/30',
                      hasResult && 'cursor-pointer',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {imagingTypeLabels[request.imagingType] || request.imagingType}
                        </span>
                        {request.bodyPart && (
                          <span className="text-xs text-muted-foreground">
                            &mdash; {request.bodyPart}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </span>
                        {request.urgency && request.urgency !== 'routine' && !doneByPatient && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              request.urgency === 'stat' && 'border-error/30 text-error',
                              request.urgency === 'urgent' && 'border-secondary/30 text-secondary'
                            )}
                          >
                            {request.urgency.toUpperCase()}
                          </Badge>
                        )}
                        {request.clinicalIndication && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {request.clinicalIndication}
                          </span>
                        )}
                        {doneByPatient && request.externalReportUrl ? (
                          <a
                            href={resolveAttachmentUrl(request.externalReportUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Patient Uploaded
                          </a>
                        ) : hasResult ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary"
                          >
                            <Eye className="h-3 w-3" />
                            View Report &amp; Files
                          </span>
                        ) : null}
                        {doneByPatient && request.externalNotes && (
                          <span className="text-[10px] italic text-emerald-700 truncate max-w-[220px]">
                            {request.externalNotes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {doneByPatient ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3" />
                          Done by patient
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                            statusInfo.bg,
                            statusInfo.text,
                          )}
                        >
                          {statusInfo.label}
                        </span>
                      )}
                      {isCancellable && !doneByPatient && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          title="Cancel request"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelImaging(request.id);
                          }}
                          disabled={cancelImaging.isPending}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!canOrder && (
        <p className="text-xs text-muted-foreground text-center">
          No active visit for this patient — start a visit to place new orders.
        </p>
      )}

      {/* Dialogs */}
      <LabOrderDialog
        open={labDialogOpen}
        onOpenChange={setLabDialogOpen}
        patientId={patientId}
        visitId={effectiveVisitId}
      />
      <ImagingRequestDialog
        open={imagingDialogOpen}
        onOpenChange={setImagingDialogOpen}
        patientId={patientId}
        visitId={effectiveVisitId}
      />
      <LabOrderDetailDialog
        orderId={openOrderId}
        onOpenChange={(open) => !open && setOpenOrderId(null)}
      />
      <ImagingOrderViewerDialog
        requestId={openImagingId}
        onOpenChange={(open) => !open && setOpenImagingId(null)}
      />
    </div>
  );
}
