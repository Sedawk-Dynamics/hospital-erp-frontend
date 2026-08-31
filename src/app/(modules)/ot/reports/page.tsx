'use client';

import { useState } from 'react';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import {
  Activity, UserCheck, XCircle, Clock, TrendingUp, Calendar, BarChart3,
  IndianRupee, ListChecks, Download, Timer, Percent,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { useOTAnalytics } from '@/hooks/use-ot';
import { fullName } from '@/lib/person-name';

// Minimal CSV serialiser + browser download (no dependency).
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-300',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-300',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
};

function rupees(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function statusLabel(s: string) {
  return s === 'requested' ? 'Pending' : s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OTReportsPage() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(toInputDateStr(monthAgo));
  const [toDate, setToDate] = useState(toInputDateStr(today));

  const { data, isLoading } = useOTAnalytics({ fromDate, toDate });

  const totals = data?.totals ?? { total: 0, completed: 0, cancelled: 0, scheduled: 0, inProgress: 0, requested: 0 };
  const surgeonWorkload = data?.surgeonWorkload ?? [];
  const otUtilization = data?.otUtilization ?? [];
  const surgeryList = data?.surgeryList ?? [];

  // Key rates / revenue (derived).
  const completionRate = totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;
  const cancellationRate = totals.total ? Math.round((totals.cancelled / totals.total) * 100) : 0;
  const totalRevenue = surgeryList.reduce((sum, s) => sum + (s.billingAmount ?? 0), 0);
  const avgStartDelay = data?.avgStartDelayMin ?? 0;
  const delaySamples = data?.startDelaySampleSize ?? 0;

  const handleExportCsv = () => {
    if (surgeryList.length === 0) return;
    downloadCsv(
      `ot-report-${fromDate}_to_${toDate}.csv`,
      surgeryList.map((s) => ({
        Patient: fullName(s.patient),
        MRN: s.patient.mrn ?? '',
        Procedure: s.procedureName,
        Type: s.surgeryType ?? '',
        Speciality: s.speciality ?? '',
        Surgeon: s.surgeonName,
        OT: s.otName ?? '',
        Date: s.scheduledDate ? formatDate(s.scheduledDate) : '',
        StartTime: s.scheduledStartTime ?? '',
        DurationMin: s.durationMinutes ?? '',
        Status: statusLabel(s.status),
        BillingAmount: s.billingAmount ?? '',
        BillingStatus: s.billingStatus ?? '',
      })),
    );
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader
        title="OT Reports"
        description="Surgery list, OT utilization and surgeon workload over the chosen window"
      />

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {formatDate(fromDate)} – {formatDate(toDate)}
        </div>
      </div>

      {/* Totals tiles */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: totals.total, color: 'text-blue-700', bg: 'bg-blue-50', icon: BarChart3 },
          { label: 'Pending', value: totals.requested, color: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
          { label: 'Scheduled', value: totals.scheduled, color: 'text-blue-700', bg: 'bg-blue-50', icon: Calendar },
          { label: 'In Progress', value: totals.inProgress, color: 'text-purple-700', bg: 'bg-purple-50', icon: Activity },
          { label: 'Completed', value: totals.completed, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: TrendingUp },
          { label: 'Cancelled', value: totals.cancelled, color: 'text-red-700', bg: 'bg-red-50', icon: XCircle },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl shadow-sanctuary p-3 ${s.bg}`}>
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="font-headline text-2xl font-extrabold mt-1">{s.value.toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      {/* Key rates / revenue */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl shadow-sanctuary p-4 bg-surface-container-lowest">
          <div className="flex items-center gap-2 text-emerald-700">
            <Percent className="h-4 w-4" />
            <p className="text-xs text-muted-foreground">Completion rate</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{completionRate}%</p>
        </div>
        <div className="rounded-xl shadow-sanctuary p-4 bg-surface-container-lowest">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="h-4 w-4" />
            <p className="text-xs text-muted-foreground">Cancellation rate</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{cancellationRate}%</p>
        </div>
        <div className="rounded-xl shadow-sanctuary p-4 bg-surface-container-lowest">
          <div className="flex items-center gap-2 text-amber-700">
            <Timer className="h-4 w-4" />
            <p className="text-xs text-muted-foreground">Avg. start delay</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">
            {avgStartDelay} <span className="text-sm font-medium text-muted-foreground">min</span>
          </p>
          <p className="text-[10px] text-muted-foreground">{delaySamples} surgeries measured</p>
        </div>
        <div className="rounded-xl shadow-sanctuary p-4 bg-surface-container-lowest">
          <div className="flex items-center gap-2 text-blue-700">
            <IndianRupee className="h-4 w-4" />
            <p className="text-xs text-muted-foreground">Total billed</p>
          </div>
          <p className="font-headline text-2xl font-extrabold mt-1">{rupees(totalRevenue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Surgeon workload */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="font-headline text-base font-bold">Surgeon Workload</h2>
            <span className="ml-2 text-xs text-muted-foreground">{surgeonWorkload.length} surgeons</span>
          </div>
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-24 w-full" /></div>
          ) : surgeonWorkload.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={UserCheck} title="No data" description="No surgeries in this window." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                    <th className="px-4 py-3">Surgeon</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Done</th>
                    <th className="px-4 py-3 text-right">Cancelled</th>
                    <th className="px-4 py-3 text-right">Avg Dur</th>
                  </tr>
                </thead>
                <tbody>
                  {surgeonWorkload.map((s) => (
                    <tr key={s.surgeonId} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{s.surgeonName}</td>
                      <td className="px-4 py-2 text-right">{s.total}</td>
                      <td className="px-4 py-2 text-right text-emerald-700">{s.completed}</td>
                      <td className="px-4 py-2 text-right text-red-700">{s.cancelled}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {s.avgDurationMin > 0 ? `${s.avgDurationMin} min` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* OT Utilization */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <h2 className="font-headline text-base font-bold">OT Utilization</h2>
            <span className="ml-2 text-xs text-muted-foreground">{otUtilization.length} theaters</span>
          </div>
          {isLoading ? (
            <div className="p-4"><Skeleton className="h-24 w-full" /></div>
          ) : otUtilization.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Activity} title="No data" description="No OT bookings in this window." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                    <th className="px-4 py-3">OT</th>
                    <th className="px-4 py-3 text-right">Surgeries</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                    <th className="px-4 py-3 text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {otUtilization.map((o) => (
                    <tr key={o.otId} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{o.otName}</td>
                      <td className="px-4 py-2 text-right">{o.total}</td>
                      <td className="px-4 py-2 text-right">{(o.totalDuration / 60).toFixed(1)}h</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${o.utilizationPercent}%` }}
                            />
                          </div>
                          <span className="text-xs w-9 text-right">{o.utilizationPercent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Surgery list */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h2 className="font-headline text-base font-bold">Surgery List</h2>
          <span className="ml-2 text-xs text-muted-foreground">{surgeryList.length} entries</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={handleExportCsv}
            disabled={surgeryList.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        ) : surgeryList.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={ListChecks} title="No surgeries" description="No OT bookings in this window." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest font-label text-on-surface-variant">
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Procedure</th>
                  <th className="px-4 py-3">Surgeon</th>
                  <th className="px-4 py-3">OT</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Billing</th>
                </tr>
              </thead>
              <tbody>
                {surgeryList.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="font-medium">{s.patient.firstName} {s.patient.lastName}</div>
                      {s.patient.mrn && <div className="text-xs text-muted-foreground">{s.patient.mrn}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{s.procedureName}</div>
                      {(s.surgeryType || s.speciality) && (
                        <div className="text-xs text-muted-foreground">
                          {[s.surgeryType, s.speciality].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">{s.surgeonName}</td>
                    <td className="px-4 py-2 text-xs">{s.otName ?? '-'}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {s.scheduledDate ? formatDate(s.scheduledDate) : '-'}
                      {s.scheduledStartTime && ` · ${s.scheduledStartTime}`}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[s.status] ?? ''}`}>
                        {statusLabel(s.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      {s.billingAmount != null ? rupees(s.billingAmount) : <span className="text-muted-foreground">-</span>}
                      {s.billingStatus && (
                        <div className="text-muted-foreground">{s.billingStatus}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unused / placeholder secondary tile for design balance */}
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <IndianRupee className="h-3.5 w-3.5" /> Billing totals shown per surgery; aggregate revenue is available in
        Hospital → Billing → Transactions.
      </div>
    </div>
  );
}
