// The Hospital Reports catalogue — every report's endpoint and columns. Lives
// outside page.tsx so the top-bar search can list report titles (gap 367).

import {
  BarChart3, Users, BedDouble, Shield, Calendar,
  ArrowRightLeft, FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Row = Record<string, unknown>;

export interface ReportColumn {
  /** Unique column id; also used as the dot-path when `get` is not supplied. */
  key: string;
  label: string;
  align?: 'right';
  /** Derive the cell from the whole row — for nested/composite values. */
  get?: (row: Row) => unknown;
  /** Show as money (₹1,23,456.78) on screen; the CSV keeps the plain number. */
  money?: boolean;
  /** Sum this column into a Total row (on screen and in the CSV). */
  total?: boolean;
}

export interface ReportConfig {
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
  /** One line under the title saying how a derived figure is computed. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Shared cell getters
//
// The list endpoints return nested relations (patient {...}, doctor { user
// {...} }), not flat `patientName` / `doctorName` strings. Reading them as flat
// keys is why every report used to show "-" in the patient and doctor columns.
// ---------------------------------------------------------------------------

export function nested(row: Row, path: string): Record<string, unknown> | undefined {
  const v = path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Row)[k] : undefined),
    row,
  );
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

export function fullName(o: Record<string, unknown> | undefined): string {
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

export interface ReportCategory {
  title: string;
  icon: LucideIcon;
  reports: ReportConfig[];
}

// ---------------------------------------------------------------------------
// Report category definitions (connected to real endpoints)
// ---------------------------------------------------------------------------

export const reportCategories: ReportCategory[] = [
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
        // Gap 334: visits with a recorded referral source — not follow-ups,
        // which are the same doctor asking the patient back.
        extraParams: { referred: 'true' },
        note:
          'Revenue = net billed amount of the referred visit: every finalised bill linked to the appointment or the visit opened from it (draft and cancelled bills excluded), at its total after concessions, less approved or processed refunds.',
        columns: [
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'referredBy', label: 'Referred By', get: (r) => nested(r, 'patient')?.referredBy ?? '-' },
          { key: 'doctor', label: 'Doctor', get: doctorName },
          { key: 'department', label: 'Department', get: departmentName },
          { key: 'reason', label: 'Reason' },
          { key: 'appointmentDate', label: 'Date' },
          { key: 'status', label: 'Status' },
          // Gap 334: what the referred visit brought in (net billed).
          { key: 'referralRevenue', label: 'Revenue (net billed)', align: 'right', money: true, total: true },
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
        // Money actually received or paid back. A deposit set against a bill
        // only moves money already counted as its receipt (gap item 361).
        extraParams: { collectionOnly: 'true' },
        columns: [
          // Each row's own receipt / voucher number. Two deposits sit on one
          // ADV- holding bill, so the bill number repeated across both.
          { key: 'documentNumber', label: 'Document #', get: (r) => r.documentNumber ?? '-' },
          { key: 'billNumber', label: 'Bill #', get: (r) => nested(r, 'bill')?.billNumber ?? '-' },
          { key: 'mrn', label: 'UHID', get: patientMrn },
          { key: 'patient', label: 'Patient', get: patientName },
          { key: 'paymentType', label: 'Type' },
          { key: 'paymentMethod', label: 'Method' },
          { key: 'transactionId', label: 'Txn / Ref' },
          { key: 'paymentDate', label: 'Date' },
          // Refunds are money out: signed, so a SUM over the column is the net.
          {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            get: (r) => (r.paymentType === 'refund' ? -Number(r.amount ?? 0) : Number(r.amount ?? 0)),
          },
          { key: 'status', label: 'Status' },
        ],
      },
    ],
  },
];

/** Every report, flattened — for search. */
export const allReports: Array<ReportConfig & { category: string }> = reportCategories.flatMap((c) =>
  c.reports.map((r) => ({ ...r, category: c.title })),
);

