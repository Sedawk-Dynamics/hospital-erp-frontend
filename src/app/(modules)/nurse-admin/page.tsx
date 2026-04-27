'use client';

import Link from 'next/link';
import { ShieldCheck, Users, FileCheck, FileText, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NurseAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nursing Administration</h1>
        <p className="text-sm text-muted-foreground">
          Hospital-wide view of nursing staffing, rosters, policies, and compliance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Active nursing staff" value="—" hint="Across all wards" />
        <StatCard icon={FileCheck} label="Rosters pending" value="—" hint="Awaiting approval" />
        <StatCard icon={ShieldCheck} label="Compliance alerts" value="—" hint="Open, last 30 days" />
        <StatCard icon={BarChart3} label="Coverage KPI" value="—" hint="Rolling 7-day average" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Administration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/nurse-admin/staffing"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <Users className="mr-2 h-4 w-4" />
              Hospital-wide staffing
            </Link>
            <Link
              href="/nurse-admin/rosters"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <FileCheck className="mr-2 h-4 w-4" />
              Approve rosters
            </Link>
            <Link
              href="/nurse-admin/policies"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Review policies
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance & audit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vital corrections, roster publishes, and assignment changes — filterable by date
              range — will surface here once the compliance viewer is wired up.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs font-medium">{label}</div>
          {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
