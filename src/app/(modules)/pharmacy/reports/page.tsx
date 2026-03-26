'use client';

import { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Package,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const reports: ReportCard[] = [
  {
    id: 'sales',
    title: 'Sales Report',
    description: 'View daily, weekly, and monthly sales summaries with revenue breakdown by drug category.',
    icon: TrendingUp,
    color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600',
  },
  {
    id: 'expiry',
    title: 'Expiry Report',
    description: 'Track drugs nearing expiry dates to manage returns and prevent losses.',
    icon: AlertTriangle,
    color: 'from-amber-500/20 to-amber-500/5 text-amber-600',
  },
  {
    id: 'stock-usage',
    title: 'Stock Usage Report',
    description: 'Analyze stock consumption patterns, fast-moving items, and reorder suggestions.',
    icon: BarChart3,
    color: 'from-blue-500/20 to-blue-500/5 text-blue-600',
  },
  {
    id: 'batch-wise',
    title: 'Batch-wise Report',
    description: 'Detailed batch-level inventory report with purchase price, selling price, and stock values.',
    icon: Package,
    color: 'from-purple-500/20 to-purple-500/5 text-purple-600',
  },
];

export default function PharmacyReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const selected = reports.find((r) => r.id === selectedReport);

  if (selected) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedReport(null)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="font-headline text-xl font-bold">{selected.title}</h1>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${selected.color}`}>
              <selected.icon className="h-8 w-8" />
            </div>
            <h2 className="font-headline text-lg font-bold">{selected.title}</h2>
            <p className="text-sm text-muted-foreground max-w-md">{selected.description}</p>
            <p className="text-xs text-muted-foreground">
              Report generation and filters will be available in the next update.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <h1 className="font-headline text-xl font-bold">Pharmacy Reports</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className="group bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 text-left transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${report.color}`}>
              <report.icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {report.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {report.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
