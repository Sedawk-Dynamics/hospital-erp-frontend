'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { toInputDateStr } from '@/lib/date-utils';
import {
  BarChart3, Users, BedDouble, Shield, Calendar,
  ArrowRightLeft, FileText, Download, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface ReportColumn {
  /** Unique column id; also used as the dot-path when `get` is not supplied. */
  key: string;
  label: string;
  align?: 'right';
  /** Derive the cell from the whole row — for nested/composite values. */
  get?: (row: Row) => unknown;
}

interface ReportConfig {
  label: string;
  endpoint: string;
  /** Extra fixed query params merged into every request */
  extraParams?: Record<string, string>;
  /**
   * Names the endpoint uses for the date window. Most list endpoints take
   * fromDate/toDate; override where an endpoint differs.
   */
  dateParams?: { from: string; to: string };
  /** Columns to display & export */
  columns: ReportColumn[];
}

// ---------------------------------------------------------------------------
// Shared cell getters
//
// The list endpoints return nested relations (patient {...}, doctor { user
// {...} }), not flat `patientName` / `doctorName` strings. Reading them as flat
// keys is why every report used to show "-" in the patient and doctor columns.
// ---------------------------------------------------------------------------

function nested(row: Row, path: string): Record<string, unknown> | undefined {
  const v = path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Row)[k] : undefined),
    row,
  );
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

function fullName(o: Record<string, unknown> | undefined): string {
  if (!o) return '-';
  const name = `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim();
  return name || '-';
}

/** "Patient Name" from row.patient */
const patientName = (row: Row) => fullName(nested(row, 'patient'));
/** MRN/UHID from row.patient */
const patientMrn = (row: Row) => (nested(row, 'patient')?.mrn as string) ?? '-';
const patientPhone = (row: Row) => (nested(row, 'patient')?.phone as string) ?? '-';
/** "Dr. First Last" from row.doctor.user */
const doctorName = (row: Row) => {
  const name = fullName(nested(row, 'doctor.user'));
  return name === '-' ? '-' : `Dr. ${name}`;
};
const departmentName = (row: Row) =>
  (nested(row, 'doctor.department')?.name as string) ?? '-';

/** HH:mm out of a @db.Time() value like "1970-01-01T09:30:00.000Z" or "09:30" */
const timeOnly = (value: unknown): string => {
  if (typeof value !== 'string') return '-';
  const m = value.match(/(\d{2}:\d{2})/);
  return m ? m[1] : '-';
};

interface ReportCategory {
  title: string;
  icon: LucideIcon;
  reports: ReportConfig[];
}

// ---------------------------------------------------------------------------
// Report category definitions (connected to real endpoints)
// ---------------------------------------------------------------------------

const reportCategories: ReportCategory[] = [
  {
    title: 'OP Service Reports',
    icon: BarChart3,
    reports: [
      {
        label: 'OP Service Detailed',
        endpoint: '/appointments',
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'phone', label: 'Phone', get: patientPhone },
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'department', label: 'Department', get: departmentName },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'startTime', label: 'Time', get: (r) => timeOnly(r.startTime) },
          { key: 'consultationType', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'billNumber', label: 'Bill #', get: (r) => nested(r, 'paymentInfo')?.billNumber ?? '-' },
          {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            get: (r) => nested(r, 'paymentInfo')?.totalAmount ?? 0,
          },
          {
            key: 'balance',
            label: 'Balance',
            align: 'right',
            get: (r) => nested(r, 'paymentInfo')?.balanceDue ?? 0,
          },
        ],
      },
      {
        label: 'OP Service Overview',
        endpoint: '/appointments',
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'visitType', label: 'Visit' },
          { key: 'status', label: 'Status' },
        ],
      },
      {
        label: 'Consultation Wise',
        endpoint: '/appointments',
        columns: [
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'department', label: 'Department', get: departmentName },
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'consultationType', label: 'Type' },
          { key: 'status', label: 'Status' },
        ],
      },
    ],
  },
  {
    title: 'IP Service Reports',
    icon: BedDouble,
    reports: [
      {
        label: 'IP Service Detailed',
        endpoint: '/clinical/admissions',
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'doctor', label: 'Consultant', get: doctorName },
          { key: 'admissionDate', label: 'Admitted' },
          { key: 'dischargeDate', label: 'Discharged' },
          { key: 'ward', label: 'Ward', get: (r) => nested(r, 'ward')?.name ?? '-' },
          { key: 'bed', label: 'Bed', get: (r) => nested(r, 'bed')?.bedNumber ?? '-' },
          { key: 'status', label: 'Status' },
        ],
      },
      {
        label: 'IP Admission List',
        endpoint: '/clinical/admissions',
        extraParams: { status: 'admitted' },
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'phone', label: 'Phone', get: patientPhone },
          { key: 'doctor', label: 'Consultant', get: doctorName },
          { key: 'admissionDate', label: 'Admitted' },
          { key: 'ward', label: 'Ward', get: (r) => nested(r, 'ward')?.name ?? '-' },
          { key: 'bed', label: 'Bed', get: (r) => nested(r, 'bed')?.bedNumber ?? '-' },
        ],
      },
      {
        label: 'IP Discharge List',
        endpoint: '/clinical/admissions',
        extraParams: { status: 'discharged' },
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'doctor', label: 'Consultant', get: doctorName },
          { key: 'admissionDate', label: 'Admitted' },
          { key: 'dischargeDate', label: 'Discharged' },
          { key: 'ward', label: 'Ward', get: (r) => nested(r, 'ward')?.name ?? '-' },
        ],
      },
      {
        label: 'IP Payment Due',
        endpoint: '/billing',
        extraParams: { billType: 'ip', status: 'pending' },
        columns: [
          { key: 'billNumber', label: 'Bill #' },
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'phone', label: 'Phone', get: patientPhone },
          { key: 'ward', label: 'Ward', get: (r) => nested(r, 'admission.ward')?.name ?? '-' },
          { key: 'totalAmount', label: 'Total', align: 'right' },
          { key: 'amountPaid', label: 'Paid', align: 'right' },
          { key: 'balanceDue', label: 'Balance', align: 'right' },
        ],
      },
    ],
  },
  {
    title: 'Insurance Reports',
    icon: Shield,
    reports: [
      {
        label: 'Insurance Patient Bill Report',
        endpoint: '/insurance/claims',
        columns: [
          { key: 'claimNumber', label: 'Claim #' },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'policyNumber', label: 'Policy #', get: (r) => nested(r, 'policy')?.policyNumber ?? '-' },
          { key: 'billNumber', label: 'Bill #', get: (r) => nested(r, 'bill')?.billNumber ?? '-' },
          { key: 'submissionDate', label: 'Date' },
          { key: 'claimAmount', label: 'Claimed', align: 'right' },
          { key: 'approvedAmount', label: 'Approved', align: 'right' },
          { key: 'status', label: 'Status' },
        ],
      },
    ],
  },
  {
    title: 'Appointment Reports',
    icon: Calendar,
    reports: [
      {
        label: 'Patients Appointment',
        endpoint: '/appointments',
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'phone', label: 'Phone', get: patientPhone },
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'startTime', label: 'Time', get: (r) => timeOnly(r.startTime) },
          { key: 'status', label: 'Status' },
        ],
      },
      {
        label: 'Doctors Appointment',
        endpoint: '/appointments',
        columns: [
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'department', label: 'Department', get: departmentName },
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'startTime', label: 'Time', get: (r) => timeOnly(r.startTime) },
          { key: 'status', label: 'Status' },
        ],
      },
      {
        label: 'No Show Report',
        endpoint: '/appointments',
        extraParams: { status: 'no_show' },
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'phone', label: 'Phone', get: patientPhone },
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'startTime', label: 'Time', get: (r) => timeOnly(r.startTime) },
        ],
      },
    ],
  },
  {
    title: 'Patient Reports',
    icon: Users,
    reports: [
      {
        label: 'Patient Demographics',
        endpoint: '/patients',
        columns: [
          { key: 'mrn', label: 'UHID' },
          { key: 'name', label: 'Patient', get: (r) => fullName(r) },
          { key: 'gender', label: 'Gender' },
          { key: 'dateOfBirth', label: 'DOB' },
          { key: 'bloodGroup', label: 'Blood Group' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'city', label: 'City' },
          { key: 'createdAt', label: 'Registered' },
        ],
      },
      {
        label: 'Credit Settlement',
        endpoint: '/billing',
        extraParams: { status: 'partially_paid' },
        columns: [
          { key: 'billNumber', label: 'Bill #' },
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'phone', label: 'Phone', get: patientPhone },
          { key: 'billDate', label: 'Bill Date' },
          { key: 'totalAmount', label: 'Total', align: 'right' },
          { key: 'amountPaid', label: 'Paid', align: 'right' },
          { key: 'balanceDue', label: 'Outstanding', align: 'right' },
        ],
      },
    ],
  },
  {
    title: 'Referral Reports',
    icon: ArrowRightLeft,
    reports: [
      {
        label: 'Referral Report',
        endpoint: '/appointments',
        extraParams: { type: 'follow_up' },
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'department', label: 'Department', get: departmentName },
          { key: 'reason', label: 'Reason' },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'status', label: 'Status' },
        ],
      },
    ],
  },
  {
    title: 'Tally / Collection Reports',
    icon: FileText,
    reports: [
      {
        label: 'Collection Report',
        endpoint: '/billing/payments',
        columns: [
          { key: 'billNumber', label: 'Bill #', get: (r) => nested(r, 'bill')?.billNumber ?? '-' },
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'paymentMethod', label: 'Method' },
          { key: 'transactionId', label: 'Txn / Ref' },
          { key: 'paymentDate', label: 'Date' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'status', label: 'Status' },
        ],
      },
    ],
  },
];

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
function formatCell(value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'string') {
    // If it looks like an ISO date, format it nicely
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    }
    return value.replace(/_/g, ' ');
  }
  return String(value);
}

/** Build CSV string from rows + columns */
function buildCsv(rows: Row[], columns: ReportColumn[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((row) =>
    columns.map((c) => {
      const val = cellValue(row, c);
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(','),
  );
  return [header, ...body].join('\n');
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
                        {formatCell(cellValue(row, col))}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
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

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportConfig | null>(null);

  return (
    <div className="space-y-6 animate-fade-in-up">
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
