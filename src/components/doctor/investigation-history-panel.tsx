'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronRight, FileText, FileImage, Download } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { resolveAttachmentUrl, formatFileSize, isImageMime } from '@/hooks/use-lab-attachments';
import { fullName } from '@/lib/person-name';

interface LabResult {
  id: string;
  parameterName: string;
  value?: string | null;
  unit?: string | null;
  normalRange?: string | null;
  isAbnormal: boolean;
  enteredAt: string;
}

interface LabOrderItem {
  id: string;
  status: string;
  test: { id: string; testName: string; testCode?: string } | null;
  labResults: LabResult[];
}

interface LabOrder {
  id: string;
  status: string;
  urgency: string;
  createdAt: string;
  orderer?: { firstName: string; lastName: string } | null;
  visit?: { visitType: string; visitDate: string } | null;
  /**
   * The lab supervisor has published this report. Until then the server sends
   * no values and no attachments — a result nobody has signed off is a draft,
   * not something to act on.
   */
  released?: boolean;
  /** A report exists but is still inside the lab's review loop. */
  awaitingApproval?: boolean;
  labOrderItems: LabOrderItem[];
  labReport?: { id: string; status: string; signedAt?: string | null; publishedAt?: string | null; pdfUrl?: string | null } | null;
  attachments?: Array<{
    id: string;
    category: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
    description?: string | null;
    createdAt: string;
  }>;
}

interface AbnormalFlat {
  orderId: string;
  testName: string;
  parameterName: string;
  value: string | null;
  unit: string | null;
  normalRange: string | null;
  enteredAt: string;
}

type Tab = 'recent' | 'abnormal';

export function InvestigationHistoryPanel({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<Tab>('recent');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['doctor', 'investigation-history', patientId],
    queryFn: async () => {
      const res = await apiGet<{ orders: LabOrder[]; abnormalFlat: AbnormalFlat[] }>(
        `/lab/investigation-history/${patientId}`,
      );
      return res.data ?? { orders: [], abnormalFlat: [] };
    },
    enabled: !!patientId,
  });

  const orders = data?.orders ?? [];
  const abnormal = data?.abnormalFlat ?? [];

  return (
    <div>
      {abnormal.length > 0 && (
        <div className="pb-2">
          <Badge className="bg-error/10 text-error text-[10px]">
            {abnormal.length} abnormal
          </Badge>
        </div>
      )}
      <div className="flex gap-1 pb-3">
        {(['recent', 'abnormal'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium capitalize',
              t === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t}
            <span className="ml-1 rounded-full bg-black/10 px-1 text-[9px] font-bold">
              {t === 'recent' ? orders.length : abnormal.length}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-3">Loading...</p>
        ) : tab === 'recent' ? (
          orders.length === 0 ? (
            <Empty label="No lab orders yet" />
          ) : (
            orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                isExpanded={expanded === o.id}
                onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
              />
            ))
          )
        ) : abnormal.length === 0 ? (
          <Empty label="No abnormal results" />
        ) : (
          <div className="space-y-1.5">
            {abnormal.map((a, i) => (
              <div key={i} className="rounded-md border border-error/30 bg-error/10 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <AlertCircle className="h-3 w-3 text-error shrink-0" />
                  <span className="font-semibold text-foreground">{a.testName}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-foreground/80">{a.parameterName}</span>
                </div>
                <div className="mt-0.5 text-foreground/80">
                  <span className="font-semibold text-error">{a.value ?? '-'}</span>
                  {a.unit && <span> {a.unit}</span>}
                  {a.normalRange && <span className="text-muted-foreground"> (Ref: {a.normalRange})</span>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(a.enteredAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isExpanded,
  onToggle,
}: {
  order: LabOrder;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(order.createdAt).toLocaleDateString('en-IN');
  const tests = order.labOrderItems.map((i) => i.test?.testName || 'Test').join(', ');
  const hasReport = !!order.labReport;
  const reportPublished = order.labReport?.status === 'published';

  const statusIcon = order.status === 'completed'
    ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
    : <Clock className="h-3.5 w-3.5 text-secondary" />;

  return (
    <div className="rounded-md border text-xs overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 text-left"
      >
        {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{tests}</p>
          <p className="text-[10px] text-muted-foreground">
            {date}
            {order.orderer && ` · Dr. ${fullName(order.orderer)}`}
          </p>
        </div>
        <Badge className={cn('text-[9px] px-1 py-0', reportPublished ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          {order.awaitingApproval ? 'awaiting approval' : hasReport ? order.labReport!.status : order.status}
        </Badge>
      </button>

      {isExpanded && (
        <div className="border-t bg-muted/30 p-2 space-y-2">
          {/* Results and files are withheld until the lab supervisor releases
              the report, so say so rather than showing an empty test that reads
              like nothing was done. */}
          {order.awaitingApproval && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              Results are with the lab supervisor for approval. They appear here once released.
            </p>
          )}
          {order.labOrderItems.map((item) => (
            <div key={item.id}>
              <p className="font-semibold text-foreground/90">
                {item.test?.testName || 'Test'}
              </p>
              {item.labResults.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic pl-2">
                  {order.awaitingApproval ? 'Awaiting lab approval' : 'No results entered yet'}
                </p>
              ) : (
                <table className="w-full text-[11px] mt-1">
                  <tbody>
                    {item.labResults.map((r) => (
                      <tr key={r.id} className={cn(r.isAbnormal && 'text-error')}>
                        <td className="py-0.5 pr-2">{r.parameterName}</td>
                        <td className={cn('py-0.5 pr-2 font-semibold', r.isAbnormal && 'text-error')}>
                          {r.value ?? '-'} {r.unit}
                        </td>
                        <td className="py-0.5 text-muted-foreground">{r.normalRange || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {(order.attachments?.length ?? 0) > 0 && (
            <div className="border-t pt-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Attachments ({order.attachments!.length})
              </p>
              <ul className="space-y-1">
                {order.attachments!.map((a) => {
                  const url = resolveAttachmentUrl(a.fileUrl);
                  const isImg = isImageMime(a.mimeType);
                  const Icon = isImg ? FileImage : FileText;
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-[11px] rounded-md border bg-card px-2 py-1">
                      {isImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a href={url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted">
                          <img src={url} alt={a.fileName} className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.fileName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {a.category.replace('_', ' ')} · {formatFileSize(a.sizeBytes)}
                        </p>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={a.fileName}
                        className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Open / download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-center py-6 text-xs text-muted-foreground">
      <FlaskConical className="h-6 w-6 mx-auto mb-1 opacity-40" />
      {label}
    </div>
  );
}
