'use client';

import Link from 'next/link';
import {
  Users,
  ClipboardCheck,
  ArrowRightLeft,
  CalendarClock,
  ClipboardPlus,
  BedDouble,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NurseAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nursing Administration</h1>
        <p className="text-sm text-muted-foreground">
          Hospital-wide view of nursing: nurse-to-doctor assignment, ward / floor management, shift
          planning, and handover.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Active nursing staff" value="—" hint="Across all wards" />
        <StatCard icon={BedDouble} label="Occupied IPD beds" value="—" hint="Awaiting coverage" />
        <StatCard
          icon={AlertTriangle}
          label="Unassigned beds"
          value="—"
          hint="Need a nurse this shift"
          accent
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/nurse-admin/nurse-doctor"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <Users className="mr-2 h-4 w-4" />
              Assign nurse to doctor(s)
            </Link>
            <Link
              href="/nurse-admin/assignments"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Assign nurses to beds
            </Link>
            <Link
              href="/nurse-admin/handover"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Run shift handover
            </Link>
            <Link
              href="/nurse-admin/orders"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <ClipboardPlus className="mr-2 h-4 w-4" />
              Review doctor orders
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planning & oversight</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/nurse-admin/roster"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Plan weekly roster
            </Link>
            <Link
              href="/nurse-admin/staffing"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-start')}
            >
              <Users className="mr-2 h-4 w-4" />
              Hospital-wide staffing
            </Link>
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
