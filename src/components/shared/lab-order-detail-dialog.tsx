'use client';

// Read-only lab order detail dialog for clinicians (doctor / nurse / admin).
// Shows order metadata, samples, per-test results (highlighting abnormals),
// and any attachments uploaded by the lab. Mirrors the lab-internal dialog
// minus the lifecycle/edit actions.

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useLabOrder, type LabOrder } from '@/hooks/use-lab';
import { LabAttachmentsViewer } from './lab-attachments-viewer';
import type { LabAttachment } from '@/hooks/use-lab-attachments';
import { resolveAttachmentUrl } from '@/hooks/use-lab-attachments';

interface LabOrderDetailDialogProps {
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}

interface LabResultRow {
  id: string;
  parameterName: string;
  value?: string | null;
  unit?: string | null;
  normalRange?: string | null;
  isAbnormal?: boolean;
  status?: string;
  enteredAt?: string;
}

interface LabOrderItemWithResults {
  id: string;
  testId?: string;
  status: string;
  test?: { id: string; testName: string; testCode?: string | null } | null;
  labResults?: LabResultRow[];
}

// We override labOrderItems to widen with results + nullable test fields. The
// underlying LabOrder hook types are stricter than what `getLabOrderById`
// returns; this dialog talks to that endpoint directly.
type LabOrderDetail = Omit<LabOrder, 'labOrderItems' | 'labReport'> & {
  labOrderItems?: LabOrderItemWithResults[];
  attachments?: LabAttachment[];
  labReport?: { id: string; status: string; signedAt?: string | null; publishedAt?: string | null } | null;
  completedExternallyAt?: string | null;
  externalReportUrl?: string | null;
  externalNotes?: string | null;
};

export function LabOrderDetailDialog({ orderId, onOpenChange }: LabOrderDetailDialogProps) {
  const { data, isLoading } = useLabOrder(orderId ?? '');
  const order = data as LabOrderDetail | undefined;

  const flatAbnormal = useMemo(() => {
    const rows: Array<{ test: string; result: LabResultRow }> = [];
    for (const it of order?.labOrderItems ?? []) {
      for (const r of it.labResults ?? []) {
        if (r.isAbnormal) rows.push({ test: it.test?.testName ?? 'Test', result: r });
      }
    }
    return rows;
  }, [order]);

  return (
    <Dialog open={!!orderId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Lab Order
            {order && <span className="text-xs font-mono text-muted-foreground">#{order.id.slice(0, 8)}</span>}
          </DialogTitle>
          {order && (
            <DialogDescription className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="capitalize">{order.status}</Badge>
              {order.urgency && <Badge variant="outline" className="capitalize">{order.urgency}</Badge>}
              {order.labReport && (
                <Badge variant="outline" className="bg-primary/10 text-primary capitalize">
                  Report: {order.labReport.status}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {order.patient?.firstName} {order.patient?.lastName} · MRN {order.patient?.mrn}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading || !order ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5">
            {order.completedExternallyAt && (
              <section className="rounded-md border border-emerald-300 bg-emerald-50 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Marked done by patient · {formatDateTime(order.completedExternallyAt)}
                </p>
                <p className="text-[11px] text-emerald-800/80">
                  Patient had this test performed outside the hospital. Hospital's lab queue no
                  longer sees this order.
                </p>
                {order.externalNotes && (
                  <p className="text-[11px] italic text-emerald-800/90 border-l-2 border-emerald-300 pl-2">
                    {order.externalNotes}
                  </p>
                )}
                {order.externalReportUrl && (
                  <a
                    href={resolveAttachmentUrl(order.externalReportUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View patient-uploaded report
                  </a>
                )}
              </section>
            )}

            {flatAbnormal.length > 0 && (
              <div className="rounded-md border border-error/40 bg-error/5 p-2">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-error">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {flatAbnormal.length} abnormal value{flatAbnormal.length > 1 ? 's' : ''}
                </p>
                <ul className="space-y-0.5 text-[11px]">
                  {flatAbnormal.map(({ test, result }) => (
                    <li key={result.id}>
                      <span className="font-medium text-foreground">{test}:</span>{' '}
                      <span className="text-muted-foreground">{result.parameterName}</span> →{' '}
                      <span className="font-semibold text-error">{result.value ?? '-'}</span>{' '}
                      {result.unit ?? ''}{' '}
                      {result.normalRange && (
                        <span className="text-muted-foreground">(ref {result.normalRange})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tests &amp; Results
              </h3>
              {(order.labOrderItems ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No tests on this order.</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {(order.labOrderItems ?? []).map((it) => (
                    <div key={it.id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">
                          {it.test?.testName ?? 'Test'}
                          {it.test?.testCode && (
                            <span className="ml-1 text-[10px] text-muted-foreground">({it.test.testCode})</span>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize">{it.status}</Badge>
                      </div>
                      {(it.labResults ?? []).length > 0 ? (
                        <table className="mt-2 w-full text-xs">
                          <thead className="text-[10px] uppercase text-muted-foreground">
                            <tr>
                              <th className="text-left font-medium pb-1">Parameter</th>
                              <th className="text-left font-medium pb-1">Value</th>
                              <th className="text-left font-medium pb-1">Reference</th>
                              <th className="text-left font-medium pb-1">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(it.labResults ?? []).map((r) => (
                              <tr key={r.id} className={cn(r.isAbnormal && 'text-error')}>
                                <td className="py-1 pr-2">{r.parameterName}</td>
                                <td className={cn('py-1 pr-2 font-medium', r.isAbnormal && 'text-error')}>
                                  {r.value ?? '-'} {r.unit ?? ''}
                                </td>
                                <td className="py-1 pr-2 text-muted-foreground">
                                  {r.normalRange ?? '-'}
                                </td>
                                <td className="py-1 pr-2">
                                  <Badge variant="outline" className="text-[9px] capitalize">
                                    {r.status ?? 'entered'}
                                  </Badge>
                                  {r.enteredAt && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">
                                      {formatDateTime(r.enteredAt)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mt-1 text-[11px] italic text-muted-foreground">
                          Results not yet entered.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Attachments
              </h3>
              <LabAttachmentsViewer
                attachments={order.attachments ?? []}
                emptyMessage="No files attached to this order yet."
                dense
              />
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
