'use client';

import { useState } from 'react';
import {
  FlaskConical,
  ScanLine,
  AlertCircle,
  Clock,
  MapPin,
  ClipboardList,
  CheckCircle2,
  Upload,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import apiClient from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HospitalFilter } from '../_components/hospital-filter';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { resolveAttachmentUrl } from '@/hooks/use-lab-attachments';

// Backend payload (patient-portal.service.ts::getPatientOpenOrders)
interface PortalOpenOrder {
  orderType: 'lab' | 'imaging';
  id: string;
  orderNumber: string;
  status: string;
  urgency: 'routine' | 'urgent' | 'stat';
  notes: string | null;
  description: string;
  sampleTypes: string[];
  items: Array<{ id: string; testName: string; testCode: string | null }>;
  imagingType?: string;
  bodyPart?: string | null;
  clinicalIndication?: string | null;
  scheduledAt?: string | null;
  orderedBy: string | null;
  createdAt: string;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName?: string | null;
    tenant: {
      id: string;
      name: string;
      phone?: string | null;
      address?: string | null;
    } | null;
  } | null;
  completedExternallyAt: string | null;
  externalReportUrl: string | null;
  externalNotes: string | null;
  // Hospital-uploaded report (lab pdf or radiology pdf). When set and the
  // patient did NOT self-complete, the row links to "Lab Report" /
  // "Imaging Report" instead of "View uploaded report".
  reportUrl: string | null;
  reportStatus: string | null;
}

const labStatusLabel: Record<string, string> = {
  ordered: 'Visit lab for sample collection',
  sample_collected: 'Sample collected — awaiting result',
  in_progress: 'Testing in progress',
};

const imagingStatusLabel: Record<string, string> = {
  requested: 'Visit imaging department',
  scheduled: 'Scheduled — be on time',
  in_progress: 'Scan in progress',
};

const urgencyColor: Record<string, string> = {
  routine: 'bg-slate-100 text-slate-700',
  urgent: 'bg-amber-100 text-amber-700',
  stat: 'bg-red-100 text-red-700',
};

export default function PatientOrdersPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [markDoneOrder, setMarkDoneOrder] = useState<PortalOpenOrder | null>(null);
  const { selectedProfileId } = usePatientProfileStore();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'open-orders', hospitalFilter, selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (hospitalFilter) params.tenantId = hospitalFilter;
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<PortalOpenOrder[]>('/patient-portal/open-orders', { params });
      return res.data ?? [];
    },
  });

  const orders = data ?? [];
  const labCount = orders.filter(
    (o) => o.orderType === 'lab' && !o.completedExternallyAt,
  ).length;
  const imagingCount = orders.filter(
    (o) => o.orderType === 'imaging' && !o.completedExternallyAt,
  ).length;
  const doneByPatientCount = orders.filter((o) => o.completedExternallyAt).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          My Investigations
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Tests and scans your doctor has ordered for you. Got it done somewhere else? Use the{' '}
          <span className="font-semibold text-on-surface">Mark as Done</span> button to upload the
          report and clear it from the lab&apos;s queue.
        </p>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      {orders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
            <FlaskConical className="h-3.5 w-3.5" />
            {labCount} lab pending
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 text-secondary px-3 py-1 text-xs font-semibold">
            <ScanLine className="h-3.5 w-3.5" />
            {imagingCount} imaging pending
          </span>
          {doneByPatientCount > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {doneByPatientCount} marked done by you
            </span>
          )}
        </div>
      )}

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-16 text-center">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="font-label text-sm font-semibold text-on-surface">No pending orders</p>
            <p className="font-label text-xs text-on-surface-variant mt-1">
              When a doctor orders a lab test or scan during your consultation, it will appear here
              with where to go and what to bring.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-container/60">
            {orders.map((order) => (
              <OrderRow
                key={`${order.orderType}-${order.id}`}
                order={order}
                onMarkDone={() => setMarkDoneOrder(order)}
              />
            ))}
          </ul>
        )}
      </div>

      <MarkDoneDialog
        order={markDoneOrder}
        onClose={() => setMarkDoneOrder(null)}
      />
    </div>
  );
}

function OrderRow({
  order,
  onMarkDone,
}: {
  order: PortalOpenOrder;
  onMarkDone: () => void;
}) {
  const Icon = order.orderType === 'lab' ? FlaskConical : ScanLine;
  const doneByPatient = !!order.completedExternallyAt;
  const hint = doneByPatient
    ? 'You marked this as done — the lab no longer sees it.'
    : order.orderType === 'lab'
      ? labStatusLabel[order.status] ?? 'Visit lab to complete this test'
      : imagingStatusLabel[order.status] ?? 'Visit imaging to complete this scan';

  return (
    <li
      className={cn(
        'px-4 py-4 sm:px-5 sm:py-5',
        doneByPatient && 'bg-emerald-50/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'shrink-0 mt-0.5 rounded-lg p-2',
            doneByPatient
              ? 'bg-emerald-100 text-emerald-700'
              : order.orderType === 'lab'
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary/10 text-secondary',
          )}
        >
          {doneByPatient ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="font-headline text-sm font-bold text-on-surface leading-tight">
                {order.description}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                #{order.orderNumber}
                {order.orderedBy && <> · Dr. {order.orderedBy}</>}
                {order.patient?.tenant?.name && <> · {order.patient.tenant.name}</>}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {order.urgency !== 'routine' && !doneByPatient && (
                <Badge
                  variant="outline"
                  className={cn('text-[10px] uppercase', urgencyColor[order.urgency])}
                >
                  {order.urgency}
                </Badge>
              )}
              {doneByPatient ? (
                <Badge className="text-[10px] uppercase bg-emerald-100 text-emerald-700 border-transparent">
                  Done by you
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {order.status.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          </div>

          <div
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5',
              doneByPatient ? 'bg-emerald-50' : 'bg-primary/5',
            )}
          >
            {doneByPatient ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
            <p className="text-xs font-medium text-on-surface">{hint}</p>
          </div>

          {order.orderType === 'lab' && order.items.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {order.items.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface"
                >
                  {it.testName}
                  {it.testCode && (
                    <span className="ml-1 text-on-surface-variant">({it.testCode})</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {order.orderType === 'lab' && order.sampleTypes.length > 0 && (
            <p className="text-[11px] text-on-surface-variant">
              Sample needed: <span className="font-medium">{order.sampleTypes.join(', ')}</span>
            </p>
          )}

          {order.orderType === 'imaging' && (
            <div className="space-y-1 text-[11px] text-on-surface-variant">
              {order.bodyPart && (
                <p>
                  Region: <span className="font-medium text-on-surface">{order.bodyPart}</span>
                </p>
              )}
              {order.clinicalIndication && (
                <p className="flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-on-surface-variant" />
                  <span>{order.clinicalIndication}</span>
                </p>
              )}
              {order.scheduledAt && (
                <p className="flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Scheduled for {formatDateTime(order.scheduledAt)}</span>
                </p>
              )}
            </div>
          )}

          {order.notes && (
            <p className="text-[11px] italic text-on-surface-variant border-l-2 border-outline-variant pl-2">
              {order.notes}
            </p>
          )}

          {/* External completion details */}
          {doneByPatient && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 space-y-1">
              <p className="text-[11px] text-emerald-800">
                Marked done {formatDateTime(order.completedExternallyAt!)}
              </p>
              {order.externalNotes && (
                <p className="text-[11px] text-emerald-800/80 italic">{order.externalNotes}</p>
              )}
              {order.externalReportUrl && (
                <a
                  href={resolveAttachmentUrl(order.externalReportUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Patient Uploaded
                </a>
              )}
            </div>
          )}

          {/* Hospital-uploaded report (only when patient hasn't self-completed) */}
          {!doneByPatient && order.reportUrl && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5">
              <a
                href={resolveAttachmentUrl(order.reportUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {order.orderType === 'lab' ? 'Lab Report' : 'Imaging Report'}
              </a>
            </div>
          )}

          {(order.patient?.tenant?.phone || order.patient?.tenant?.address) && !doneByPatient && (
            <p className="text-[10px] text-on-surface-variant">
              {order.patient.tenant.address && <>{order.patient.tenant.address} · </>}
              {order.patient.tenant.phone}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <p className="text-[10px] text-on-surface-variant">
              Ordered {formatDateTime(order.createdAt)}
            </p>
            {!doneByPatient && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={onMarkDone}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark as Done
              </Button>
            )}
            {doneByPatient && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1.5 text-emerald-700 hover:bg-emerald-50"
                onClick={onMarkDone}
              >
                <Upload className="h-3.5 w-3.5" />
                Re-upload / update
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function MarkDoneDialog({
  order,
  onClose,
}: {
  order: PortalOpenOrder | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: async (params: { id: string; orderType: 'lab' | 'imaging' }) => {
      const form = new FormData();
      if (file) form.append('file', file);
      if (notes.trim()) form.append('notes', notes.trim());
      const { data } = await apiClient.post(
        `/patient-portal/orders/${params.orderType}/${params.id}/mark-done`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: () => {
      toast.success('Marked as done — the lab no longer sees this order');
      queryClient.invalidateQueries({ queryKey: ['patient', 'open-orders'] });
      setFile(null);
      setNotes('');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Could not mark this as done');
    },
  });

  if (!order) return null;

  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => {
        if (!open) {
          setFile(null);
          setNotes('');
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Mark as Done
          </DialogTitle>
          <DialogDescription>
            Already had this done elsewhere? Upload the report so it appears in your medical
            history, and we&apos;ll clear it from the hospital&apos;s lab queue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-md bg-surface-container-low px-3 py-2">
            <p className="text-xs font-semibold text-on-surface">{order.description}</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              #{order.orderNumber}
              {order.patient?.tenant?.name && <> · {order.patient.tenant.name}</>}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Report file <span className="text-on-surface-variant font-normal">(optional)</span>
            </Label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-outline-variant file:bg-surface-container-low file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-surface-container"
            />
            {file && (
              <p className="text-[11px] text-on-surface-variant">
                Selected: <span className="font-medium">{file.name}</span> (
                {(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Notes <span className="text-on-surface-variant font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="e.g. Done at Apollo Lab on 12/05/2026"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              mutation.mutate({ id: order.id, orderType: order.orderType })
            }
            disabled={mutation.isPending}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirm Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
