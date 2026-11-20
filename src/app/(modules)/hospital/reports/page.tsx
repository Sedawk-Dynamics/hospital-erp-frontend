'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { toInputDateStr } from '@/lib/date-utils';
import { formatINR } from '@/lib/money';
import { Download, Loader2 } from 'lucide-react';
import {
  reportCategories, allReports, type Row, type ReportColumn, type ReportConfig,
} from './report-catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function today(): string {
  return toInputDateStr();
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toInputDateStr(d);
}

/** Resolve a dot-path like "bill.patient.firstName" from an object */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Value for one cell — custom getter if the column defines one, else dot-path. */
function cellValue(row: Row, col: ReportColumn): unknown {
  return col.get ? col.get(row) : resolvePath(row, col.key);
}

/** Format cell value for display */
function formatCell(value: unknown, col?: ReportColumn): string {
  if (col?.money) return value == null || value === '' ? '-' : formatINR(value as number | string);
  if (value == null) return '-';
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'string') {
    // If it looks like an ISO date, format it nicely
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
      });
    }
    return value.replace(/_/g, ' ');
  }
  return String(value);
}

/** Column totals for columns marked `total` (gap 334); null when none are. */
function columnTotals(rows: Row[], columns: ReportColumn[]): Record<string, number> | null {
  if (!columns.some((c) => c.total)) return null;
  const totals: Record<string, number> = {};
  for (const c of columns) {
    if (!c.total) continue;
    const sum = rows.reduce((s, row) => s + (Number(cellValue(row, c)) || 0), 0);
    totals[c.key] = Math.round(sum * 100) / 100;
  }
  return totals;
}

/** Build CSV string from rows + columns. Money stays a plain number so it can be summed. */
function buildCsv(rows: Row[], columns: ReportColumn[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((row) =>
    columns.map((c) => {
      const val = cellValue(row, c);
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(','),
  );
  const totals = columnTotals(rows, columns);
  const footer = totals
    ? [columns.map((c, i) => `"${c.key in totals ? totals[c.key] : i === 0 ? 'Total' : ''}"`).join(',')]
    : [];
  return [header, ...body, ...footer].join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// ReportViewerDialog
// ---------------------------------------------------------------------------

function ReportViewerDialog({
  report,
  open,
  onOpenChange,
}: {
  report: ReportConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report', report.label, report.endpoint, startDate, endDate, report.extraParams],
    queryFn: async () => {
      // Every list endpoint here takes fromDate/toDate — the screen used to
      // send startDate/endDate, which zod silently stripped, so the range
      // filter never applied.
      const { from, to } = report.dateParams ?? { from: 'fromDate', to: 'toDate' };
      const params: Record<string, unknown> = {
        [from]: startDate,
        [to]: endDate,
        limit: 200,
        ...report.extraParams,
      };
      const response = await apiGet<Row[]>(report.endpoint, { params });
      return response.data ?? [];
    },
    enabled: open && shouldFetch,
  });

  // Show toast on error
  if (isError && error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch report data';
    toast.error(msg);
  }

  const rows = data ?? [];
  const totals = columnTotals(rows, report.columns);

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    setShouldFetch(true);
  };

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const csv = buildCsv(rows, report.columns);
    const safeName = report.label.replace(/\s+/g, '_').toLowerCase();
    downloadCsv(csv, `${safeName}_${startDate}_${endDate}.csv`);
    toast.success('CSV downloaded');
  };

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      // Reset fetch state when dialog closes
      setShouldFetch(false);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{report.label}</DialogTitle>
          {report.note && (
            <p className="font-label text-xs text-on-surface-variant">{report.note}</p>
          )}
        </DialogHeader>

        {/* Date filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setShouldFetch(false); }}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="font-label text-xs text-on-surface-variant uppercase tracking-widest">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setShouldFetch(false); }}
              className="w-40"
            />
          </div>
          <Button onClick={handleGenerate} disabled={isLoading} className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow">
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </Button>
        </div>

        {/* Results table */}
        <div className="flex-1 overflow-auto bg-surface-container-lowest rounded-xl shadow-sanctuary">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                {report.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 pb-4 pt-5 font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {isLoading ? (
                <tr>
                  <td colSpan={report.columns.length} className="px-4 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : !shouldFetch ? (
                <tr>
                  <td colSpan={report.columns.length} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    Select date range and click Generate.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={report.columns.length} className="px-4 py-8 text-center font-label text-on-surface-variant">
                    No records found for the selected period.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={(row.id as string) ?? i} className="group hover:bg-surface-container-low transition-colors">
                    {report.columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 whitespace-nowrap font-label text-sm ${col.align === 'right' ? 'text-right font-bold' : ''}`}
                      >
                        {formatCell(cellValue(row, col), col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {/* Gap 334: totals for summable columns (e.g. referral revenue). */}
            {totals && shouldFetch && !isLoading && rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-surface-container">
                  {report.columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 whitespace-nowrap font-label text-sm font-bold ${col.align === 'right' ? 'text-right' : ''}`}
                    >
                      {col.key in totals ? formatCell(totals[col.key], col) : i === 0 ? 'Total' : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer with count + export */}
        <DialogFooter>
          {shouldFetch && rows.length > 0 && (
            <span className="mr-auto font-label text-xs text-on-surface-variant">
              {rows.length} record{rows.length !== 1 ? 's' : ''}
            </span>
          )}
          <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------

/**
 * Opens the report named in `?report=` — the top-bar search links here
 * (gap 367). Its own component so `useSearchParams` sits under a Suspense
 * boundary, which a prerendered page needs.
 */
function OpenReportFromUrl({ onOpen }: { onOpen: (r: ReportConfig) => void }) {
  const wanted = useSearchParams().get('report');
  useEffect(() => {
    if (!wanted) return;
    const match = allReports.find((r) => r.label === wanted);
    if (match) onOpen(match);
  }, [wanted, onOpen]);
  return null;
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportConfig | null>(null);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <Suspense fallback={null}>
        <OpenReportFromUrl onOpen={setActiveReport} />
      </Suspense>
      <h1 className="font-headline text-xl font-bold">Reports</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div key={category.title} className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
              <div className="flex items-center gap-2 border-b border-surface-container px-4 py-3">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-headline text-lg font-bold">{category.title}</h3>
              </div>
              <div className="p-2">
                {category.reports.map((report) => (
                  <button
                    key={report.label}
                    onClick={() => setActiveReport(report)}
                    className="w-full rounded-xl px-3 py-2 text-left font-label text-sm hover:bg-surface-container-low transition-colors"
                  >
                    {report.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {activeReport && (
        <ReportViewerDialog
          report={activeReport}
          open={!!activeReport}
          onOpenChange={(open) => { if (!open) setActiveReport(null); }}
        />
      )}
    </div>
  );
}
