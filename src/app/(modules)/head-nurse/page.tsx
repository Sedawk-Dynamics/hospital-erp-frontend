'use client';

import Link from 'next/link';
import { Users, CalendarClock, BookCheck, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function HeadNurseDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Head Nurse Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Departmental view: publish duty rosters, designate Nurse In-Charge per shift, and monitor
          staff performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Staff on duty" value="—" hint="Across the department" />
        <StatCard icon={CalendarClock} label="Published rosters" value="—" hint="Current week" />
        <StatCard icon={BookCheck} label="In-charge slots" value="—" hint="Covered this week" />
        <StatCard icon={BarChart3} label="On-time handovers" value="—" hint="Rolling 7 days" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roster actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/head-nurse/roster"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Plan weekly roster
            </Link>
            <Link
              href="/head-nurse/incharge-assignments"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <BookCheck className="mr-2 h-4 w-4" />
              Assign Nurse In-Charge
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff focus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Staff performance metrics, absence trends, and escalated incidents will appear here.
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
