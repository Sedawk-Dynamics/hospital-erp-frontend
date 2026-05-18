'use client';

// Read-only lab order detail dialog for clinicians (doctor / nurse / admin).
// The lab produces reports as uploaded files (PDF / image / scan) — there is
// no separate manual result-entry step — so this dialog renders tests with
// their uploaded files inline. Legacy parameter results (from orders created
// under the old flow) still render in a table if present.

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Download,
  FileText,
  FileImage,
  Paperclip,
} from 'lucide-react';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useLabOrder, type LabOrder } from '@/hooks/use-lab';
import type { LabAttachment } from '@/hooks/use-lab-attachments';
import {
  resolveAttachmentUrl,
  formatFileSize,
  isImageMime,
  isPdfMime,
} from '@/hooks/use-lab-attachments';

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

  // Bucket attachments by labOrderItemId. The Order Detail endpoint returns
  // the full attachment list on the order; we slice it per item so each test
  // row can show its files inline. Files without an item link land in a
  // shared "Additional files" block.
  const { attachmentsByItem, orphanAttachments } = useMemo(() => {
    const byItem = new Map<string, LabAttachment[]>();
    const orphans: LabAttachment[] = [];
    for (const a of order?.attachments ?? []) {
      if (a.labOrderItemId) {
        const list = byItem.get(a.labOrderItemId) ?? [];
        list.push(a);
        byItem.set(a.labOrderItemId, list);
      } else {
        orphans.push(a);
      }
    }
    return { attachmentsByItem: byItem, orphanAttachments: orphans };
  }, [order?.attachments]);

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
                Tests &amp; Report Files
              </h3>
              {(order.labOrderItems ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No tests on this order.</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {(order.labOrderItems ?? []).map((it) => {
                    const files = attachmentsByItem.get(it.id) ?? [];
                    const legacyResults = it.labResults ?? [];
                    return (
                      <div key={it.id} className="px-3 py-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm min-w-0">
                            {it.test?.testName ?? 'Test'}
                            {it.test?.testCode && (
                              <span className="ml-1 text-[10px] text-muted-foreground">({it.test.testCode})</span>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'capitalize',
                              it.status === 'completed' && 'bg-emerald-100 text-emerald-800 border-transparent',
                            )}
                          >
                            {it.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        {/* Legacy parameter results — only renders for older
                            orders that used the manual entry path. New orders
                            never carry these. */}
                        {legacyResults.length > 0 && (
                          <table className="mt-1 w-full text-xs">
                            <thead className="text-[10px] uppercase text-muted-foreground">
                              <tr>
                                <th className="text-left font-medium pb-1">Parameter</th>
                                <th className="text-left font-medium pb-1">Value</th>
                                <th className="text-left font-medium pb-1">Reference</th>
                                <th className="text-left font-medium pb-1">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {legacyResults.map((r) => (
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
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {files.length > 0 ? (
                          <AttachmentList files={files} />
                        ) : legacyResults.length === 0 ? (
                          <p className="text-[11px] italic text-muted-foreground">
                            No report file uploaded for this test yet.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {orphanAttachments.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Additional Files
                </h3>
                <AttachmentList files={orphanAttachments} />
              </section>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Renders a list of uploaded files. Images get an inline thumbnail clickable
// to a new tab; PDFs and other docs get an icon row with download chevron.
// Read-only — clinicians can view + download but never delete from this view.
function AttachmentList({ files }: { files: LabAttachment[] }) {
  return (
    <ul className="space-y-1.5">
      {files.map((a) => {
        const url = resolveAttachmentUrl(a.fileUrl);
        const isImage = isImageMime(a.mimeType);
        const Icon = isImage ? FileImage : isPdfMime(a.mimeType) ? FileText : Paperclip;
        return (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
          >
            {isImage ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 w-10 shrink-0 overflow-hidden rounded border bg-muted"
                title="Open full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={a.fileName} className="h-full w-full object-cover" />
              </a>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{a.fileName}</p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {a.category.replace('_', ' ')} · {formatFileSize(a.sizeBytes)}
                {a.uploader && ` · ${a.uploader.firstName} ${a.uploader.lastName ?? ''}`.trim()}
                {a.description && ` · ${a.description}`}
              </p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download={a.fileName}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-container-high text-muted-foreground hover:text-foreground"
              title={isPdfMime(a.mimeType) ? 'Open PDF' : 'Download'}
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
