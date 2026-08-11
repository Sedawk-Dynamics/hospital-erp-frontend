'use client';

import { useRef, useState } from 'react';
import { Search, FileText, RefreshCw, Download, BarChart3, Clock, TrendingUp, AlertCircle, Edit3, Eye, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import {
  useLabReports,
  useLabReportAnalytics,
  useLabAnalyticsExtended,
  useCorrectLabReport,
} from '@/hooks/use-lab';
import type { LabReport } from '@/hooks/use-lab';
import { useUploadLabAttachment, formatFileSize } from '@/hooks/use-lab-attachments';
import { SupervisorOnlyGuard } from '@/components/laboratory/supervisor-only-guard';
import { LabReportPrintDialog } from '@/components/laboratory/lab-report-print-view';
import {
  RecentActivityPanel,
  OverdueOrdersPanel,
} from '@/components/laboratory/lab-dashboard-summary';

// Reports are now produced by the per-test upload flow (Status tab → "Mark
// Done"); the lab no longer generates a report manually. The states below
// are what the backend actually emits today.
const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
  published: { label: 'Published', className: 'bg-emerald-100 text-emerald-800' },
  corrected: { label: 'Corrected', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Signed', className: 'bg-blue-100 text-blue-800' },
};

const reportCategories = [
  {
    title: 'Test Volume Report',
    description: 'Summary of tests conducted over a period, grouped by test type.',
    icon: BarChart3,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    title: 'TAT Report',
    description: 'Turnaround time analysis for sample collection to result delivery.',
    icon: Clock,
    color: 'text-amber-600 bg-amber-50',
  },
  {
    title: 'Revenue Report',
    description: 'Financial summary of lab billing, collections, and outstanding amounts.',
    icon: TrendingUp,
    color: 'text-green-600 bg-green-50',
  },
];

export default function LabReportsPage() {
  return (
    <SupervisorOnlyGuard>
      <LabReportsPageInner />
    </SupervisorOnlyGuard>
  );
}

function LabReportsPageInner() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, refetch } = useLabReports({
    search: search || undefined,
    page,
    limit: 20,
    status: statusFilter || undefined,
  });

  const analyticsQ = useLabReportAnalytics();
  const extendedQ = useLabAnalyticsExtended();
  const [correctFor, setCorrectFor] = useState<LabReport | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);

  const reports = data?.data ?? [];
  const meta = data?.meta;
  const analytics = analyticsQ.data;
  const extended = extendedQ.data;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Lab Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reports are auto-published from the Status tab when every test on an order is
            uploaded and marked done.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Analytics summary */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryStat label="Total Orders" value={analytics.summary.totalOrders} />
          <SummaryStat label="Completed" value={analytics.summary.completedOrders} />
          <SummaryStat label="Open" value={analytics.summary.openOrders} />
          <SummaryStat label="Avg TAT" value={`${analytics.summary.avgTatHours}h`} />
        </div>
      )}

      {analytics && analytics.testVolume.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-2">Top Tests</h3>
          <div className="space-y-1">
            {analytics.testVolume.slice(0, 8).map((t) => (
              <div key={t.testId} className="flex items-center justify-between text-sm">
                <span className="truncate">{t.testName}</span>
                <span className="text-muted-foreground">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-test TAT breach analysis — shown when at least one test has data */}
      {extended && extended.perTestTat.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              TAT vs SLA (per test)
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{extended.overallBreaches} breaches</span>
              <span>·</span>
              <span>
                {extended.abnormalRate}% abnormal ({extended.abnormalResults}/{extended.totalResults})
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left pb-1.5">Test</th>
                  <th className="text-right pb-1.5">N</th>
                  <th className="text-right pb-1.5">Avg</th>
                  <th className="text-right pb-1.5">Median</th>
                  <th className="text-right pb-1.5">P95</th>
                  <th className="text-right pb-1.5">SLA</th>
                  <th className="text-right pb-1.5">Breaches</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {extended.perTestTat.slice(0, 12).map((t) => (
                  <tr key={t.testId} className={cn(t.breachRate >= 25 && 'text-error')}>
                    <td className="py-1.5 pr-2 truncate max-w-[180px]">{t.testName}</td>
                    <td className="py-1.5 pr-2 text-right">{t.sampleCount}</td>
                    <td className="py-1.5 pr-2 text-right">{t.avgTatHours}h</td>
                    <td className="py-1.5 pr-2 text-right">{t.medianTatHours}h</td>
                    <td className="py-1.5 pr-2 text-right">{t.p95TatHours}h</td>
                    <td className="py-1.5 pr-2 text-right text-muted-foreground">
                      {t.tatLimitHours ? `${t.tatLimitHours}h` : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {t.breaches > 0 ? (
                        <span className="font-semibold">
                          {t.breaches} <span className="text-muted-foreground">({t.breachRate}%)</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Moved off the lab home page, which was showing eight summary cards and
          these two panels above the tabs people actually work from. This is the
          supervisor's overview page, and an SLA breach list belongs next to the
          turnaround analytics rather than over the bench's worklist. */}
      <div>
        <h2 className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-3">
          Operations
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <RecentActivityPanel />
          {/* No jump-to-worklist here: that lives on the home page, where the
              Overdue card filters the queue directly. */}
          <OverdueOrdersPanel />
        </div>
      </div>

      {/* Report Category Cards */}
      <div>
        <h2 className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-3">Report Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reportCategories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.title}
                className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 text-left hover:shadow-lg transition-shadow group"
                onClick={() => toast.info(`${category.title} - Coming soon`)}
              >
                <div className={cn('inline-flex rounded-lg p-2 mb-3', category.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                  {category.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {category.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Published Reports Table */}
      <div>
        <h2 className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-3">Published Reports</h2>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search report #, patient..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1">
            {[
              { value: '', label: 'All' },
              { value: 'published', label: 'Published' },
              { value: 'corrected', label: 'Corrected' },
              { value: 'draft', label: 'Draft' },
            ].map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setStatusFilter(filter.value); setPage(1); }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Report #</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Tests</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Published</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Version</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          No reports yet. Reports appear here once a lab order has every test
                          uploaded and marked done from the Status tab.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reports.map((report: LabReport) => {
                    const status = statusConfig[report.status] || statusConfig.draft;
                    const fileUrl = report.pdfUrl || report.fileUrl;
                    return (
                      <tr key={report.id} className="group hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 font-medium font-mono text-xs">
                          {report.reportNumber || report.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {report.patient?.firstName || report.order?.patient?.firstName}{' '}
                            {report.patient?.lastName || report.order?.patient?.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {report.patient?.mrn || report.order?.patient?.mrn || ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[180px]">
                            {report.tests && report.tests.length > 0 ? (
                              <div className="text-xs">
                                {report.tests.slice(0, 2).map((t, i) => (
                                  <div key={i} className="truncate">{t.name}</div>
                                ))}
                                {report.tests.length > 2 && (
                                  <span className="text-muted-foreground">+{report.tests.length - 2} more</span>
                                )}
                              </div>
                            ) : report.order?.tests && report.order.tests.length > 0 ? (
                              <div className="text-xs">
                                {report.order.tests.slice(0, 2).map((t, i) => (
                                  <div key={i} className="truncate">{t.name}</div>
                                ))}
                                {report.order.tests.length > 2 && (
                                  <span className="text-muted-foreground">+{report.order.tests.length - 2} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {report.publishedAt
                            ? formatDateTime(report.publishedAt)
                            : report.createdAt
                              ? formatDate(report.createdAt)
                              : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          v{report.version ?? 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                            status.className,
                          )}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewFor(report.id)}
                              title="Preview branded report (uploaded files render inline)"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {(report.status === 'published' || report.status === 'corrected') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCorrectFor(report)}
                                title="Issue a corrected version"
                              >
                                <Edit3 className="mr-1 h-3.5 w-3.5" /> Correct
                              </Button>
                            )}
                            {fileUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(fileUrl, '_blank')}
                                title="Download report file"
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
          {(meta?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {page} of {meta?.totalPages} ({meta?.total} reports)
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CorrectionDialog report={correctFor} onClose={() => setCorrectFor(null)} />

      <LabReportPrintDialog
        reportId={previewFor}
        open={!!previewFor}
        onOpenChange={(next) => !next && setPreviewFor(null)}
      />
    </div>
  );
}

// Issue a corrected version of a published report. Aligned with the upload
// flow: the operator picks the corrected file in this dialog (optional but
// strongly encouraged) and submits with a reason. The new file is uploaded
// tied to the report; the backend bumps version, refreshes publishedAt,
// keeps the report visible to the patient, and sends correction emails.
function CorrectionDialog({ report, onClose }: { report: LabReport | null; onClose: () => void }) {
  const correct = useCorrectLabReport();
  const upload = useUploadLabAttachment();
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const orderId = report?.labOrderId ?? report?.orderId;
  const busy = correct.isPending || upload.isPending;

  const reset = () => {
    setNotes('');
    setNotify(true);
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handle = async () => {
    if (!report) return;
    if (!notes.trim()) {
      toast.error('Correction reason is required');
      return;
    }
    try {
      // Upload first so the new file is already tied to the report by the
      // time the corrected version is announced to the patient + doctor.
      if (file && orderId) {
        await upload.mutateAsync({
          orderId,
          file,
          category: 'report_pdf',
          labReportId: report.id,
          description: `Correction v${(report.version ?? 1) + 1}: ${notes.trim()}`.slice(0, 240),
        });
      }
      await correct.mutateAsync({
        id: report.id,
        correctionNotes: notes.trim(),
        notify,
      });
      toast.success('Corrected report published');
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to correct report');
    }
  };

  return (
    <Dialog
      open={!!report}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Correct Report
          </DialogTitle>
          <DialogDescription>
            Upload the corrected report file and describe what changed. A new version is
            published immediately — the patient and ordering doctor are notified and the
            existing files remain on the order for audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Corrected report file</Label>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="mt-1 flex items-center justify-between rounded-md border bg-card px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  disabled={busy}
                  title="Remove selection"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="mt-1 gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Choose file
              </Button>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              PDF, JPG, PNG, WEBP — max 10 MB. Optional but recommended; existing files stay
              on the order as v{report?.version ?? 1}.
            </p>
          </div>
          <div>
            <Label>Reason for correction *</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Describe what changed and why"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
            />
            Notify patient and ordering doctor (email + portal)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={busy}>
            {upload.isPending ? 'Uploading…' : correct.isPending ? 'Saving…' : 'Issue Correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-headline text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
