'use client';

import { BarChart3, Users, BedDouble, Shield, Calendar, UserRound, ArrowRightLeft, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ReportCategory {
  title: string;
  icon: LucideIcon;
  reports: { label: string; href: string }[];
}

const reportCategories: ReportCategory[] = [
  {
    title: 'OP Service Reports',
    icon: BarChart3,
    reports: [
      { label: 'OP Service Detailed', href: '#' },
      { label: 'OP Service Overview', href: '#' },
      { label: 'OP Service Share', href: '#' },
      { label: 'Consultation Wise', href: '#' },
      { label: 'OP Service Head-Wise', href: '#' },
      { label: 'Audit Log', href: '#' },
    ],
  },
  {
    title: 'IP Service Reports',
    icon: BedDouble,
    reports: [
      { label: 'IP Service Detailed', href: '#' },
      { label: 'IP Service Overview', href: '#' },
      { label: 'IP Admission List', href: '#' },
      { label: 'IP Discharge List', href: '#' },
      { label: 'IP Occupancy', href: '#' },
      { label: 'IP Payment Due', href: '#' },
      { label: 'IP Service Head-Wise', href: '#' },
    ],
  },
  {
    title: 'Insurance Reports',
    icon: Shield,
    reports: [
      { label: 'Insurance Patient Bill Report', href: '#' },
    ],
  },
  {
    title: 'Appointment Reports',
    icon: Calendar,
    reports: [
      { label: 'Patients Appointment', href: '#' },
      { label: 'Doctors Appointment', href: '#' },
      { label: 'Specialization Appointment', href: '#' },
      { label: 'Appointment Type', href: '#' },
      { label: 'TAT Report', href: '#' },
      { label: 'No Show Report', href: '#' },
    ],
  },
  {
    title: 'Patient Reports',
    icon: Users,
    reports: [
      { label: 'Patient Demographics', href: '#' },
      { label: 'Purpose of Visit', href: '#' },
      { label: 'Reason / Diagnosis', href: '#' },
      { label: 'Concession Report', href: '#' },
      { label: 'Credit Settlement', href: '#' },
      { label: 'Membership Report', href: '#' },
    ],
  },
  {
    title: 'Referral Reports',
    icon: ArrowRightLeft,
    reports: [
      { label: 'Referral Report', href: '#' },
      { label: 'Referral Count', href: '#' },
      { label: 'Referral Type Wise Patient Count', href: '#' },
    ],
  },
  {
    title: 'Tally Reports',
    icon: FileText,
    reports: [
      { label: 'Generate Report', href: '#' },
    ],
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Reports</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div key={category.title} className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">{category.title}</h3>
              </div>
              <div className="p-2">
                {category.reports.map((report) => (
                  <button
                    key={report.label}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    {report.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
