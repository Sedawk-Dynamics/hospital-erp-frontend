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
import { FlaskConical, ScanLine, Plus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LabOrderDialog } from './lab-order-dialog';
import { ImagingRequestDialog } from './imaging-request-dialog';
import { cn } from '@/lib/utils';

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
                const isCancellable = order.status !== 'completed' && order.status !== 'cancelled';
                return (
                  <div
                    key={order.id}
                    className="flex items-start justify-between rounded-lg border border-border/50 p-2.5 hover:bg-accent/30 transition-colors"
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
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </span>
                        {order.urgency && order.urgency !== 'routine' && (
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
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                          statusInfo.bg,
                          statusInfo.text
                        )}
                      >
                        {statusInfo.label}
                      </span>
                      {isCancellable && (
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
                const statusInfo = imagingStatusConfig[request.status] ?? imagingStatusConfig.requested;
                const isCancellable = request.status !== 'completed' && request.status !== 'cancelled';
                return (
                  <div
                    key={request.id}
                    className="flex items-start justify-between rounded-lg border border-border/50 p-2.5 hover:bg-accent/30 transition-colors"
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
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </span>
                        {request.urgency && request.urgency !== 'routine' && (
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
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                          statusInfo.bg,
                          statusInfo.text
                        )}
                      >
                        {statusInfo.label}
                      </span>
                      {isCancellable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          title="Cancel request"
                          onClick={() => handleCancelImaging(request.id)}
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
    </div>
  );
}
