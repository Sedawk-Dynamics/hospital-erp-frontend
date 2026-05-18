'use client';

import { useState } from 'react';
import { TestTube, Download, Eye, FileText, FileImage, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { HospitalFilter } from '../_components/hospital-filter';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { resolveAttachmentUrl, formatFileSize, isImageMime } from '@/hooks/use-lab-attachments';

// ── Types reflecting backend payload (patient-portal.service.ts) ─────────

interface PortalLabResult {
  id: string;
  parameterName: string;
  value?: string | null;
  unit?: string | null;
  normalRange?: string | null;
  isAbnormal: boolean;
  enteredAt: string;
}

interface PortalLabAttachment {
  id: string;
  category: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  description?: string | null;
  createdAt: string;
}

interface PortalLabReport {
  id: string;
  reportNumber?: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
  signedAt?: string;
  pdfUrl?: string | null;
  qrCodeUrl?: string | null;
  version?: number;
  labOrder?: {
    id: string;
    orderNumber?: string;
    status: string;
    labOrderItems?: Array<{
      id: string;
      test?: { testName: string; testCode?: string };
      labResults?: PortalLabResult[];
    }>;
  };
  patient?: {
    firstName: string;
    lastName?: string;
    mrn: string;
    tenant?: { id: string; name: string };
  };
  attachments?: PortalLabAttachment[];
}

export default function PatientLabReportsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [activeReport, setActiveReport] = useState<PortalLabReport | null>(null);
  const { selectedProfileId } = usePatientProfileStore();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'lab-reports', hospitalFilter, selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<PortalLabReport[]>('/patient-portal/lab-reports', { params });
      return res.data ?? [];
    },
  });

  const reports = data ?? [];

  const summarizeTests = (r: PortalLabReport) =>
    r.labOrder?.labOrderItems?.map((i) => i.test?.testName).filter(Boolean).join(', ') || '-';

  const summarizeAbnormal = (r: PortalLabReport) => {
    let count = 0;
    for (const it of r.labOrder?.labOrderItems ?? []) {
      for (const res of it.labResults ?? []) if (res.isAbnormal) count += 1;
    }
    return count;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Lab Reports
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          Access diagnostic results and download test reports from your hospitals.
        </p>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
              <th className="px-4 py-3 text-left font-bold">Report #</th>
              <th className="px-4 py-3 text-left font-bold">Tests</th>
              <th className="px-4 py-3 text-left font-bold">Hospital</th>
              <th className="px-4 py-3 text-left font-bold">Date</th>
              <th className="px-4 py-3 text-left font-bold">Files</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/50">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
                    <TestTube className="h-5 w-5" />
                  </div>
                  <p className="font-label text-sm font-semibold text-on-surface">No lab reports yet</p>
                  <p className="font-label text-xs text-on-surface-variant mt-1">
                    Your published diagnostic results will appear here.
                  </p>
                </td>
              </tr>
            ) : (
              reports.map((r) => {
                const abnormal = summarizeAbnormal(r);
                const fileCount = r.attachments?.length ?? 0;
                return (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label font-bold text-on-surface">
                      {r.reportNumber ?? r.labOrder?.orderNumber ?? r.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      <p className="truncate max-w-[280px]">{summarizeTests(r)}</p>
                      {abnormal > 0 && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-error">
                          <AlertCircle className="h-3 w-3" /> {abnormal} abnormal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {r.patient?.tenant?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {formatDate(r.publishedAt ?? r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {fileCount > 0 ? `${fileCount} file${fileCount > 1 ? 's' : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setActiveReport(r)}
                          aria-label="View report"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(r.attachments?.[0] || r.pdfUrl) && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            nativeButton={false}
                            render={
                              <a
                                href={resolveAttachmentUrl(r.attachments?.[0]?.fileUrl ?? r.pdfUrl ?? '')}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                              />
                            }
                            aria-label="Download report"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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

      <ReportDialog report={activeReport} onClose={() => setActiveReport(null)} />
    </div>
  );
}

// ── Detail dialog ─────────────────────────────────────────────────────────

function ReportDialog({ report, onClose }: { report: PortalLabReport | null; onClose: () => void }) {
  if (!report) return null;
  const items = report.labOrder?.labOrderItems ?? [];
  const attachments = report.attachments ?? [];

  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-4 w-4 text-primary" />
            Lab Report #{report.reportNumber ?? report.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="capitalize">{report.status}</Badge>
            {report.version && <Badge variant="outline">v{report.version}</Badge>}
            {report.patient?.tenant?.name && (
              <span className="text-muted-foreground">{report.patient.tenant.name}</span>
            )}
            {report.publishedAt && (
              <span className="text-muted-foreground">
                Published {formatDateTime(report.publishedAt)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Results
            </h3>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tests on this report.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {items.map((it) => (
                  <div key={it.id} className="px-3 py-2.5">
                    <p className="font-medium text-sm">{it.test?.testName ?? 'Test'}</p>
                    {(it.labResults?.length ?? 0) === 0 ? (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">
                        Result not yet released.
                      </p>
                    ) : (
                      <table className="mt-1 w-full text-xs">
                        <thead className="text-[10px] uppercase text-muted-foreground">
                          <tr>
                            <th className="text-left font-medium pb-1">Parameter</th>
                            <th className="text-left font-medium pb-1">Value</th>
                            <th className="text-left font-medium pb-1">Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {it.labResults!.map((r) => (
                            <tr key={r.id} className={cn(r.isAbnormal && 'text-error')}>
                              <td className="py-1 pr-2">{r.parameterName}</td>
                              <td className={cn('py-1 pr-2 font-medium', r.isAbnormal && 'text-error')}>
                                {r.value ?? '-'} {r.unit ?? ''}
                                {r.isAbnormal && (
                                  <Badge className="ml-2 bg-error/10 text-error text-[9px]">abnormal</Badge>
                                )}
                              </td>
                              <td className="py-1 pr-2 text-muted-foreground">
                                {r.normalRange ?? '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Files ({attachments.length})
            </h3>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No files attached.</p>
            ) : (
              <ul className="space-y-1.5">
                {attachments.map((a) => {
                  const url = resolveAttachmentUrl(a.fileUrl);
                  const isImg = isImageMime(a.mimeType);
                  const Icon = isImg ? FileImage : FileText;
                  return (
                    <li key={a.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                      {isImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a href={url} target="_blank" rel="noopener noreferrer" className="h-12 w-12 shrink-0 overflow-hidden rounded border bg-muted">
                          <img src={url} alt={a.fileName} className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{a.fileName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {a.category.replace('_', ' ')} · {formatFileSize(a.sizeBytes)}
                          {a.description && ` · ${a.description}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        render={<a href={url} target="_blank" rel="noopener noreferrer" download={a.fileName} />}
                        aria-label="Open / download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
