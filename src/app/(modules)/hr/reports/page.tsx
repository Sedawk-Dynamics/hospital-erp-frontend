'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAbsenteeismReport, useAttritionReport, useOvertimeReport, useLeaveUtilizationReport,
} from '@/hooks/use-hr';

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function HrReportsPage() {
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(todayIso());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-headline">HR Reports</h1>
        <p className="text-sm text-on-surface-variant">
          Absenteeism, attrition, overtime, and leave utilization trends.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="absenteeism">
        <TabsList>
          <TabsTrigger value="absenteeism">Absenteeism</TabsTrigger>
          <TabsTrigger value="attrition">Attrition</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
          <TabsTrigger value="leave">Leave Utilization</TabsTrigger>
        </TabsList>

        <TabsContent value="absenteeism" className="pt-3">
          <AbsenteeismReport fromDate={fromDate} toDate={toDate} />
        </TabsContent>
        <TabsContent value="attrition" className="pt-3">
          <AttritionReport fromDate={fromDate} toDate={toDate} />
        </TabsContent>
        <TabsContent value="overtime" className="pt-3">
          <OvertimeReport fromDate={fromDate} toDate={toDate} />
        </TabsContent>
        <TabsContent value="leave" className="pt-3">
          <LeaveUtilizationReport fromDate={fromDate} toDate={toDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AbsenteeismReport({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = useAbsenteeismReport({ fromDate, toDate });
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Overall absenteeism rate: <span className="text-rose-700">{data.overallRate}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2 text-right">Working Days</th>
              <th className="px-3 py-2 text-right">Absent</th>
              <th className="px-3 py-2 text-right">Half Days</th>
              <th className="px-3 py-2 text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.staffId} className="border-b last:border-0">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-xs">{r.department ?? '—'}</td>
                <td className="px-3 py-2 text-right">{r.workingDays}</td>
                <td className="px-3 py-2 text-right">{r.absentDays}</td>
                <td className="px-3 py-2 text-right">{r.halfDays}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  <span className={r.absenteeismRate > 10 ? 'text-rose-700' : ''}>{r.absenteeismRate}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AttritionReport({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = useAttritionReport({ fromDate, toDate });
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4">
          <div className="text-xs text-on-surface-variant">Current Headcount</div>
          <div className="text-2xl font-bold">{data.headcount}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-on-surface-variant">Total Leavers</div>
          <div className="text-2xl font-bold">{data.totalLeavers}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-xs text-on-surface-variant">Attrition Rate</div>
          <div className="text-2xl font-bold text-rose-700">{data.attritionRate}%</div>
        </CardContent></Card>
      </div>

      {data.leavers.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Leavers</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Exited</th>
                </tr>
              </thead>
              <tbody>
                {data.leavers.map((l) => (
                  <tr key={l.staffId} className="border-b last:border-0">
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2 text-xs">{l.department ?? '—'}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{l.status}</Badge></td>
                    <td className="px-3 py-2 text-xs">{new Date(l.exitedAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OvertimeReport({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = useOvertimeReport({ fromDate, toDate });
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Total overtime: <span className="text-amber-700">{data.totalOvertimeHours} hours</span> across {data.staffWithOvertime} staff
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-on-surface-variant">No overtime recorded in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2 text-right">OT Hours</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.staffId} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-xs">{r.department ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.overtimeHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function LeaveUtilizationReport({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = useLeaveUtilizationReport({ fromDate, toDate });
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  const types = ['vacation', 'sick', 'casual', 'maternity', 'paternity', 'unpaid', 'other'] as const;
  type LeaveTypeKey = typeof types[number];

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total leave days: {data.totalDays}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
            {types.map((t) => (
              <div key={t} className="rounded-md border bg-card px-3 py-2 text-center">
                <div className="text-xs uppercase text-on-surface-variant">{t}</div>
                <div className="text-lg font-bold">{data.byType[t] ?? 0}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.rows.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2">Department</th>
                  {types.map((t) => <th key={t} className="px-2 py-2 text-right">{t.slice(0, 3)}</th>)}
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.filter((r) => r.totalDays > 0).map((r) => (
                  <tr key={r.staffId} className="border-b last:border-0">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-xs">{r.department ?? '—'}</td>
                    {types.map((t: LeaveTypeKey) => <td key={t} className="px-2 py-2 text-right text-xs">{r[t]}</td>)}
                    <td className="px-3 py-2 text-right font-semibold">{r.totalDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
