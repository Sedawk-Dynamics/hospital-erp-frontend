'use client';

import Link from 'next/link';
import { Activity, BedDouble, ClipboardCheck, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NurseInchargeDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nurse In-Charge Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your ward at a glance. Assign nurses to IPD beds for each shift and approve shift handovers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BedDouble} label="Occupied beds" value="—" hint="Active IPD in ward" />
        <StatCard icon={ClipboardCheck} label="Shift assignments" value="—" hint="Covered this shift" />
        <StatCard
          icon={AlertTriangle}
          label="Unassigned beds"
          value="—"
          hint="IPD beds without a nurse"
          accent
        />
        <StatCard icon={ArrowRightLeft} label="Pending handovers" value="—" hint="Awaiting approval" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/nurse-incharge/assignments"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Assign nurses to beds
            </Link>
            <Link
              href="/nurse-incharge/handover"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Run shift handover
            </Link>
            <Link
              href="/nurse-incharge/orders"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <Activity className="mr-2 h-4 w-4" />
              Review doctor orders
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s shift</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Live shift data will appear here once the duty roster is wired up. Use the Assignments
              page to set coverage for each occupied bed.
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
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-md ${
            accent ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
          }`}
        >
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
