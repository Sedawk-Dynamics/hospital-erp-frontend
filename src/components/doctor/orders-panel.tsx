'use client';

import { useState } from 'react';
import { useLabOrders, useImagingRequests } from '@/hooks/use-doctor';
import type { LabOrder, ImagingRequest } from '@/hooks/use-doctor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date-utils';
import { FlaskConical, ScanLine, Plus } from 'lucide-react';
import { LabOrderDialog } from './lab-order-dialog';
import { ImagingRequestDialog } from './imaging-request-dialog';
import { cn } from '@/lib/utils';

interface OrdersPanelProps {
  patientId: string;
  visitId?: string;
}

const labStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  ordered: { label: 'Ordered', bg: 'bg-blue-100', text: 'text-blue-700' },
  sample_collected: { label: 'Sample Collected', bg: 'bg-amber-100', text: 'text-amber-700' },
  in_progress: { label: 'In Progress', bg: 'bg-purple-100', text: 'text-purple-700' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
};

const imagingStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  requested: { label: 'Requested', bg: 'bg-blue-100', text: 'text-blue-700' },
  scheduled: { label: 'Scheduled', bg: 'bg-amber-100', text: 'text-amber-700' },
  in_progress: { label: 'In Progress', bg: 'bg-purple-100', text: 'text-purple-700' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
};

const imagingTypeLabels: Record<string, string> = {
  x_ray: 'X-Ray',
  mri: 'MRI',
  ct_scan: 'CT Scan',
  ultrasound: 'Ultrasound',
  ecg: 'ECG',
  echo: 'Echo',
};

export function OrdersPanel({ patientId, visitId }: OrdersPanelProps) {
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [imagingDialogOpen, setImagingDialogOpen] = useState(false);

  const { data: labOrdersData, isLoading: labLoading } = useLabOrders({
    patientId,
    limit: 10,
  });

  const { data: imagingData, isLoading: imagingLoading } = useImagingRequests({
    patientId,
    limit: 10,
  });

  const labOrders = labOrdersData?.data ?? [];
  const imagingRequests = imagingData?.data ?? [];

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
                return (
                  <div
                    key={order.id}
                    className="flex items-start justify-between rounded-lg border border-border/50 p-2.5 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.tests && order.tests.length > 0 ? (
                          order.tests.map((test, idx) => (
                            <span key={test.id || idx} className="text-sm font-medium text-foreground">
                              {test.name}
                              {idx < (order.tests?.length ?? 0) - 1 && ','}
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
                        {order.priority && order.priority !== 'routine' && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              order.priority === 'stat' && 'border-red-300 text-red-600',
                              order.priority === 'urgent' && 'border-amber-300 text-amber-600'
                            )}
                          >
                            {order.priority.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2',
                        statusInfo.bg,
                        statusInfo.text
                      )}
                    >
                      {statusInfo.label}
                    </span>
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
                              request.urgency === 'stat' && 'border-red-300 text-red-600',
                              request.urgency === 'urgent' && 'border-amber-300 text-amber-600'
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
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2',
                        statusInfo.bg,
                        statusInfo.text
                      )}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <LabOrderDialog
        open={labDialogOpen}
        onOpenChange={setLabDialogOpen}
        patientId={patientId}
        visitId={visitId ?? ''}
      />
      <ImagingRequestDialog
        open={imagingDialogOpen}
        onOpenChange={setImagingDialogOpen}
        patientId={patientId}
        visitId={visitId ?? ''}
      />
    </div>
  );
}
