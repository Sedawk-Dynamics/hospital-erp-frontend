"use client"
import { useImagingRequestAttachments } from '@/hooks/use-imaging-attachments'
import React from 'react'
import { ImagingAttachmentsViewer } from './imaging-attachments-viewer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImagingRequest, useImagingResult } from '@/hooks/use-imaging';

const IMAGING_TYPES = [
  { value: 'xray', label: 'X-Ray' },
  { value: 'mri', label: 'MRI' },
  { value: 'ct_scan', label: 'CT Scan' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'ecg', label: 'ECG' },
  { value: 'echo', label: 'Echo' },
  { value: 'other', label: 'Other' },
];

const IMAGING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  IMAGING_TYPES.map((t) => [t.value, t.label]),
);

const imagingTypeLabel = (t?: string) =>
  t ? (IMAGING_TYPE_LABELS[t] ?? t.replace(/_/g, ' ')) : 'Imaging Study';

export default function ImagingOrderDetailDialog({ orderId, setOpen }: { orderId: string; setOpen: (a: boolean) => void }) {
  const { data: attachments } = useImagingRequestAttachments(orderId);
  const { data: imagingRequest } = useImagingRequest(orderId);
  const {data:imagingResult}=useImagingResult(imagingRequest?.imagingResult?.id ?? "")
  return (
    <Dialog open={!!orderId} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl max- overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            Imaging Report
            {imagingRequest && (
              <span className="text-xs font-mono text-muted-foreground">#{imagingRequest.id.slice(0, 8)}</span>
            )}
          </DialogTitle>
          {imagingRequest && (
            <DialogDescription className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="capitalize">{imagingRequest.status}</Badge>
              {imagingRequest.urgency && (
                <Badge variant="outline" className="capitalize">{imagingRequest.urgency}</Badge>
              )}
              <Badge variant="outline">
                {imagingTypeLabel(imagingRequest.imagingType)}{imagingRequest.bodyPart ? ` · ${imagingRequest.bodyPart}` : ''}
              </Badge>
              <span className="text-muted-foreground">
                {imagingRequest.patient?.firstName} {imagingRequest.patient?.lastName}
                {imagingRequest.patient?.mrn ? ` · MRN ${imagingRequest.patient.mrn}` : ''}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {imagingResult?.impression && (
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Impression / Findings
            </h3>
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
              {imagingResult.impression}
            </p>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Study &amp; Report Files
          </h3>
          <div className="rounded-lg border px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm min-w-0">
                {imagingTypeLabel(imagingRequest?.imagingType)}
                {imagingRequest?.bodyPart && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({imagingRequest.bodyPart})</span>
                )}
              </div>
              {imagingRequest && (
                <Badge
                  variant="outline"
                  className={cn(
                    'capitalize',
                    imagingRequest.status === 'completed' && 'bg-emerald-100 text-emerald-800 border-transparent',
                  )}
                >
                  {imagingRequest.status.replace('_', ' ')}
                </Badge>
              )}
            </div>
            <ImagingAttachmentsViewer
              attachments={attachments}
              requestId={orderId}
              enableOrthanc
            />
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}































