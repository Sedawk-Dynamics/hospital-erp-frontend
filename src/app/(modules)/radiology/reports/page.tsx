'use client';

import { useState } from 'react';
import {
  Search, RefreshCw, BarChart3, Clock, Activity, Users, Scan,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTime, toInputDateStr } from '@/lib/date-utils';
import { useImagingAnalytics, useImagingRequests, type ImagingRequest } from '@/hooks/use-imaging';
import { StatusBadge } from '@/components/shared/status-badge';
import { RadiologyAdminGuard } from '@/components/radiology/radiology-admin-guard';

export default function RadiologyReportsPage() {
  return (
    <RadiologyAdminGuard>
      <RadiologyReportsInner />
    </RadiologyAdminGuard>
  );
}

function RadiologyReportsInner() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toInputDateStr(d);
  });
  const [to, setTo] = useState(() => toInputDateStr());

  const { data: analytics, isLoading, refetch } = useImagingAnalytics({
    fromDate: from || undefined,
    toDate: to || undefined,
  });

  const summary = analytics?.summary;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Radiology Reports</h1>
          <p className="text-xs text-muted-foreground">
            TAT, modality volume, body-part breakdown, technician workload.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Studies" value={summary?.totalRequests ?? '—'} icon={Scan} accent="bg-blue-50 text-blue-700" />
        <SummaryCard label="Completed" value={summary?.completedRequests ?? '—'} icon={Activity} accent="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Avg TAT" value={summary ? `${summary.avgTatHours}h` : '—'} icon={Clock} accent="bg-amber-50 text-amber-700" />
        <SummaryCard label="Published Reports" value={summary?.publishedReports ?? '—'} icon={BarChart3} accent="bg-purple-50 text-purple-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Volume by Modality">
          {(analytics?.modalityVolume?.length ?? 0) === 0 ? (
            <Empty text="No imaging studies in range." />
          ) : (
            <BarList
              items={analytics!.modalityVolume.map((m) => ({
                label: m.modality.replace(/_/g, ' '),
                value: m.count,
              }))}
            />
          )}
        </Card>

        <Card title="Status Mix">
          {!analytics ? (
            <Empty text="—" />
          ) : (
            <div className="space-y-1.5">
              {Object.entries(analytics.statusMix).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top Body Parts">
          {(analytics?.bodyPartVolume?.length ?? 0) === 0 ? (
            <Empty text="No body-part data." />
          ) : (
            <BarList
              items={analytics!.bodyPartVolume.map((m) => ({
                label: m.bodyPart,
                value: m.count,
              }))}
            />
          )}
        </Card>

        <Card title="Technician Workload">
          {(analytics?.technicianWorkload?.length ?? 0) === 0 ? (
            <Empty text="No technicians assigned in range." />
          ) : (
            <BarList
              items={analytics!.technicianWorkload.map((m) => ({
                label: m.name,
                value: m.count,
              }))}
            />
          )}
        </Card>
      </div>

      <RecentImagingTable />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-surface-container-lowest shadow-sanctuary p-4', accent)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic">{text}</p>;
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.slice(0, 8).map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-sm capitalize">
            <span className="truncate">{it.label}</span>
            <span className="text-muted-foreground">{it.value}</span>
          </div>
          <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.round((it.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentImagingTable() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useImagingRequests({
    limit: 10,
    search: search || undefined,
    sortOrder: 'desc',
    excludeCancelled: true,
  });
  const requests = (data?.data ?? []) as ImagingRequest[];

  return (
    <Card title="Recent Studies">
      <div className="relative max-w-sm mb-2">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container text-[10px] uppercase tracking-wide text-on-surface-variant">
              <th className="text-left pb-2">Patient</th>
              <th className="text-left pb-2">Modality</th>
              <th className="text-left pb-2">Body Part</th>
              <th className="text-left pb-2">Status</th>
              <th className="text-left pb-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Loading…</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No imaging studies.</td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.patient?.firstName} {r.patient?.lastName}</td>
                  <td className="py-2 capitalize">{r.imagingType.replace(/_/g, ' ')}</td>
                  <td className="py-2">{r.bodyPart ?? '—'}</td>
                  <td className="py-2"><StatusBadge status={r.status} /></td>
                  <td className="py-2 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
