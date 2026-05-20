'use client';

import Link from 'next/link';
import {
  Users,
  UserCheck,
  Clock,
  CalendarOff,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHrDashboard } from '@/hooks/use-hr';

function inr(value: number | null | undefined) {
  if (!value && value !== 0) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function HrDashboardPage() {
  const { data, isLoading } = useHrDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-headline">HR & Payroll Dashboard</h1>
        <p className="text-sm text-on-surface-variant">
          Staff headcount, today&apos;s attendance, pending leaves, and current-month payroll status.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          icon={<Users className="text-sky-700" />}
          label="Total Staff"
          value={data?.staff.total ?? 0}
          loading={isLoading}
          href="/hr/staff"
        />
        <StatTile
          icon={<UserCheck className="text-emerald-700" />}
          label="Active Staff"
          value={data?.staff.active ?? 0}
          loading={isLoading}
          href="/hr/staff?status=active"
        />
        <StatTile
          icon={<Clock className="text-amber-700" />}
          label="Pending Leaves"
          value={data?.leaves.pending ?? 0}
          loading={isLoading}
          tone="amber"
          href="/hr/leaves?status=pending"
        />
        <StatTile
          icon={<CalendarOff className="text-rose-700" />}
          label="On Leave Today"
          value={data?.leaves.onLeaveToday ?? 0}
          loading={isLoading}
          href="/hr/leaves?status=approved"
        />
        <StatTile
          icon={<AlertTriangle className="text-orange-600" />}
          label="Licenses Expiring (30d)"
          value={data?.licenses.expiringSoon ?? 0}
          loading={isLoading}
          tone="orange"
          href="/hr/licenses"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <AttendanceCell label="Present" value={data?.attendance.today.present ?? 0} tone="emerald" />
                <AttendanceCell label="Absent" value={data?.attendance.today.absent ?? 0} tone="rose" />
                <AttendanceCell label="Half Day" value={data?.attendance.today.halfDay ?? 0} tone="amber" />
                <AttendanceCell label="On Leave" value={data?.attendance.today.onLeave ?? 0} tone="violet" />
                <AttendanceCell label="Holiday" value={data?.attendance.today.holiday ?? 0} tone="sky" />
              </div>
            )}
            <div className="mt-3 border-t pt-3 text-xs text-on-surface-variant">
              <div className="font-semibold mb-1.5">This week so far</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <AttendanceCell label="Present" value={data?.attendance.thisWeek.present ?? 0} tone="emerald" small />
                <AttendanceCell label="Absent" value={data?.attendance.thisWeek.absent ?? 0} tone="rose" small />
                <AttendanceCell label="Half Day" value={data?.attendance.thisWeek.halfDay ?? 0} tone="amber" small />
                <AttendanceCell label="On Leave" value={data?.attendance.thisWeek.onLeave ?? 0} tone="violet" small />
                <AttendanceCell label="Holiday" value={data?.attendance.thisWeek.holiday ?? 0} tone="sky" small />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" /> Payroll — {data?.payroll.month ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <PayrollStage label="Draft" count={data?.payroll.draft.count ?? 0} total={data?.payroll.draft.total ?? 0} tone="zinc" />
                <PayrollStage label="Processed" count={data?.payroll.processed.count ?? 0} total={data?.payroll.processed.total ?? 0} tone="sky" />
                <PayrollStage label="Paid" count={data?.payroll.paid.count ?? 0} total={data?.payroll.paid.total ?? 0} tone="emerald" />
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link href="/hr/payroll" className="text-xs text-primary hover:underline">View payroll →</Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-4 w-4" /> Staff by Department
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (data?.staff.byDepartment.length ?? 0) === 0 ? (
            <p className="text-sm text-on-surface-variant">No active staff.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {data?.staff.byDepartment.map((d) => (
                <div key={d.departmentId} className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-xs text-on-surface-variant truncate">{d.departmentName}</div>
                  <div className="text-lg font-bold">{d.count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon, label, value, loading, href, tone = 'sky',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading?: boolean;
  href?: string;
  tone?: 'sky' | 'amber' | 'orange';
}) {
  const toneRing = {
    sky: 'ring-sky-100 bg-sky-50/40',
    amber: 'ring-amber-100 bg-amber-50/40',
    orange: 'ring-orange-100 bg-orange-50/40',
  }[tone];
  const body = (
    <div className={`rounded-xl border bg-card px-4 py-3 ring-1 ${toneRing}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs text-on-surface-variant">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="mt-1 text-2xl font-bold">{loading ? '—' : value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function AttendanceCell({
  label, value, tone, small,
}: {
  label: string; value: number; tone: 'emerald' | 'rose' | 'amber' | 'violet' | 'sky'; small?: boolean;
}) {
  const cls = {
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    sky: 'bg-sky-50 text-sky-700',
  }[tone];
  return (
    <div className={`rounded-md ${cls} py-2`}>
      <div className={small ? 'text-base font-bold' : 'text-lg font-bold'}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function PayrollStage({
  label, count, total, tone,
}: { label: string; count: number; total: number; tone: 'zinc' | 'sky' | 'emerald' }) {
  const cls = {
    zinc: 'border-zinc-200 bg-zinc-50 text-zinc-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }[tone];
  return (
    <div className={`rounded-md border ${cls} py-3`}>
      <div className="flex items-center justify-center gap-1 text-xs uppercase tracking-wide">
        {tone === 'emerald' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <IndianRupee className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-1 text-base font-bold">{count}</div>
      <div className="text-[11px]">{inr(total)}</div>
    </div>
  );
}
