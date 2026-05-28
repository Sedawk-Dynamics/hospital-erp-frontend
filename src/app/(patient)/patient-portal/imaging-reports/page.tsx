'use client';

import { useState } from 'react';
import { ScanLine, Download, Eye, FileText, FileImage } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { HospitalFilter } from '../_components/hospital-filter';
import { usePatientProfileStore } from '@/stores/patient-profile-store';
import { resolveAttachmentUrl, formatFileSize, isImageMime } from '@/hooks/use-lab-attachments';

// ── Types reflecting backend payload (patient-portal.service.ts) ─────────

interface PortalImagingAttachment {
  id: string;
  category: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  description?: string | null;
  createdAt: string;
}

interface PortalImagingReport {
  id: string;
  status: string;
  impression?: string | null;
  signedAt?: string | null;
  pdfReportUrl?: string | null;
  createdAt: string;
  imagingRequest?: {
    id: string;
    imagingType: string;
    bodyPart?: string | null;
    urgency?: string | null;
    clinicalIndication?: string | null;
    scheduledAt?: string | null;
    attachments?: PortalImagingAttachment[];
  };
  patient?: {
    firstName: string;
    lastName?: string;
    mrn: string;
    tenant?: { id: string; name: string };
  };
  radiologist?: { id: string; firstName: string; lastName: string };
}

const IMAGING_TYPE_LABELS: Record<string, string> = {
  xray: 'X-Ray',
  mri: 'MRI',
  ct_scan: 'CT Scan',
  ultrasound: 'Ultrasound',
  ecg: 'ECG',
  echo: 'Echo',
  other: 'Other',
};

function studyLabel(r: PortalImagingReport) {
  const t = r.imagingRequest?.imagingType ?? '';
  const label = IMAGING_TYPE_LABELS[t] ?? t.replace(/_/g, ' ');
  const part = r.imagingRequest?.bodyPart;
  return part ? `${label} — ${part}` : label;
}

export default function PatientImagingReportsPage() {
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [activeReport, setActiveReport] = useState<PortalImagingReport | null>(null);
  const { selectedProfileId } = usePatientProfileStore();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', 'imaging-reports', hospitalFilter, selectedProfileId],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 50 };
      if (hospitalFilter) params.tenantId = hospitalFilter;
      if (selectedProfileId) params.profileId = selectedProfileId;
      const res = await apiGet<PortalImagingReport[]>('/patient-portal/imaging-reports', { params });
      return res.data ?? [];
    },
  });

  const reports = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Care Records
        </p>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
          Imaging Reports
        </h1>
        <p className="font-label text-sm text-on-surface-variant mt-1.5">
          View your radiology studies and download scans &amp; reports from your hospitals.
        </p>
      </div>

      <HospitalFilter value={hospitalFilter} onChange={setHospitalFilter} />

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
              <th className="px-4 py-3 text-left font-bold">Study</th>
              <th className="px-4 py-3 text-left font-bold">Radiologist</th>
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
                    <ScanLine className="h-5 w-5" />
                  </div>
                  <p className="font-label text-sm font-semibold text-on-surface">No imaging reports yet</p>
                  <p className="font-label text-xs text-on-surface-variant mt-1">
                    Your published radiology reports will appear here.
                  </p>
                </td>
              </tr>
            ) : (
              reports.map((r) => {
                const fileCount = r.imagingRequest?.attachments?.length ?? 0;
                const radiologist = r.radiologist
                  ? `${r.radiologist.firstName} ${r.radiologist.lastName}`
                  : '-';
                const firstFile = r.imagingRequest?.attachments?.[0];
                return (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-label font-bold text-on-surface capitalize">
                      {studyLabel(r)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{radiologist}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {r.patient?.tenant?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {formatDate(r.signedAt ?? r.createdAt)}
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
                        {(firstFile || r.pdfReportUrl) && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            nativeButton={false}
                            render={
                              <a
                                href={resolveAttachmentUrl(firstFile?.fileUrl ?? r.pdfReportUrl ?? '')}
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

function ReportDialog({ report, onClose }: { report: PortalImagingReport | null; onClose: () => void }) {
  if (!report) return null;
  const files = report.imagingRequest?.attachments ?? [];

  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            <span className="capitalize">{studyLabel(report)}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="capitalize">{report.status}</Badge>
            {report.patient?.tenant?.name && (
              <span className="text-muted-foreground">{report.patient.tenant.name}</span>
            )}
            {report.signedAt && (
              <span className="text-muted-foreground">
                Published {formatDateTime(report.signedAt)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {report.imagingRequest?.clinicalIndication && (
            <section className="space-y-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Clinical Indication
              </h3>
              <p className="text-sm whitespace-pre-wrap">{report.imagingRequest.clinicalIndication}</p>
            </section>
          )}

          {report.impression && (
            <section className="space-y-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Impression
              </h3>
              <p className="text-sm whitespace-pre-wrap">{report.impression}</p>
            </section>
          )}

          {report.radiologist && (
            <p className="text-[11px] text-muted-foreground">
              Reported by {report.radiologist.firstName} {report.radiologist.lastName}
            </p>
          )}

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Files
            </h3>
            {files.length > 0 ? (
              <AttachmentList files={files} />
            ) : (
              <p className="text-[11px] italic text-muted-foreground">
                No files attached to this report.
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentList({ files }: { files: PortalImagingAttachment[] }) {
  return (
    <ul className="space-y-1.5">
      {files.map((a) => {
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
  );
}
