'use client';

import {
  BarChart3, Activity, UserCheck, Package, XCircle,
  ArrowRight, Calendar, TrendingUp, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';

const reportCards = [
  {
    title: 'OT Utilization Report',
    description: 'View operating theater utilization rates, peak hours, idle time analysis, and capacity planning metrics.',
    icon: Activity,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    stats: [
      { label: 'Avg Utilization', value: '-', icon: TrendingUp },
      { label: 'Peak Hours', value: '-', icon: Clock },
    ],
  },
  {
    title: 'Surgeon Performance',
    description: 'Analyze surgeon-wise surgery count, success rates, average duration, and complication rates.',
    icon: UserCheck,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    stats: [
      { label: 'Total Surgeons', value: '-', icon: UserCheck },
      { label: 'Surgeries Today', value: '-', icon: Calendar },
    ],
  },
  {
    title: 'Consumables Usage',
    description: 'Track OT consumable usage patterns, cost analysis, wastage reports, and procurement forecasting.',
    icon: Package,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    stats: [
      { label: 'Items Consumed', value: '-', icon: Package },
      { label: 'Total Cost', value: '-', icon: TrendingUp },
    ],
  },
  {
    title: 'Cancellation Report',
    description: 'Review surgery cancellation trends, reasons analysis, rescheduling patterns, and impact assessment.',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    stats: [
      { label: 'Cancellations', value: '-', icon: XCircle },
      { label: 'This Month', value: '-', icon: Calendar },
    ],
  },
];

export default function OTReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="OT Reports"
        description="Access comprehensive reports for OT operations, surgeon performance, and resource utilization"
      />

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCards.map((report) => (
          <div
            key={report.title}
            className={`bg-surface-container-lowest rounded-xl shadow-sanctuary border-l-4 border-primary ${report.borderColor} ${report.bgColor} p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group`}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-muted p-3 shadow-sm">
                <report.icon className={`h-6 w-6 ${report.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-headline text-lg font-bold">{report.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {report.description}
                </p>
              </div>
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              {report.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
                >
                  <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-sm font-semibold text-foreground">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              className="mt-4 gap-2 w-full justify-center group-hover:bg-muted"
            >
              View Report
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
