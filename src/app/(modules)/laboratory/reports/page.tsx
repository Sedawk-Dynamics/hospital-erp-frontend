'use client';

import { useState } from 'react';
import { Search, FileText, RefreshCw, Download, BarChart3, Clock, TrendingUp, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { useLabReports, useGenerateLabReport, useLabReportAnalytics } from '@/hooks/use-lab';
import type { LabReport } from '@/hooks/use-lab';
import { SupervisorOnlyGuard } from '@/components/laboratory/supervisor-only-guard';

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
  generated: { label: 'Generated', className: 'bg-green-100 text-green-800' },
  delivered: { label: 'Delivered', className: 'bg-blue-100 text-blue-800' },
  printed: { label: 'Printed', className: 'bg-purple-100 text-purple-800' },
};

const reportCategories = [
  {
    title: 'Test Volume Report',
    description: 'Summary of tests conducted over a period, grouped by test type and department.',
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
  {
    title: 'Department-wise Report',
    description: 'Breakdown of tests, samples, and results across each lab department.',
    icon: Building2,
    color: 'text-purple-600 bg-purple-50',
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

  const generateReport = useGenerateLabReport();
  const analyticsQ = useLabReportAnalytics();

  const reports = data?.data ?? [];
  const meta = data?.meta;
  const analytics = analyticsQ.data;

  const handleGenerate = async (orderId: string) => {
    try {
      await generateReport.mutateAsync({ orderId });
      toast.success('Report generated successfully');
    } catch {
      toast.error('Failed to generate report');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Lab Reports</h1>
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

      {analytics && (analytics.testVolume.length > 0 || analytics.departmentWorkload.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-2">Top Tests</h3>
            <div className="space-y-1">
              {analytics.testVolume.slice(0, 8).map((t) => (
                <div key={t.testId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{t.testName}</span>
                  <span className="text-muted-foreground">{t.count}</span>
                </div>
              ))}
              {analytics.testVolume.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-2">Department Workload</h3>
            <div className="space-y-1">
              {analytics.departmentWorkload.map((d) => (
                <div key={d.departmentId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d.departmentName}</span>
                  <span className="text-muted-foreground">{d.count}</span>
                </div>
              ))}
              {analytics.departmentWorkload.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Report Category Cards */}
      <div>
        <h2 className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-3">Report Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

      {/* Generated Reports Table */}
      <div>
        <h2 className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-3">Generated Reports</h2>

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
              { value: 'draft', label: 'Draft' },
              { value: 'generated', label: 'Generated' },
              { value: 'delivered', label: 'Delivered' },
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
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Generated Date</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No reports found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reports.map((report: LabReport) => {
                    const status = statusConfig[report.status] || statusConfig.draft;
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
                          {report.generatedAt
                            ? formatDateTime(report.generatedAt)
                            : report.createdAt
                              ? formatDate(report.createdAt)
                              : '-'}
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
                            {report.status === 'draft' && report.orderId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerate(report.orderId!)}
                                disabled={generateReport.isPending}
                              >
                                Generate
                              </Button>
                            )}
                            {report.fileUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(report.fileUrl!, '_blank')}
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
    </div>
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
