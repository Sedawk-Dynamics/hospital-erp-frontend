'use client';

// Radiology Admin Dashboard. Mirrors lab-dashboard-summary in shape — worklist
// counts at the top, recent activity feed below, plus a quick TAT card so the
// admin lands on a single-screen "is the department on track today?" view.

import Link from 'next/link';
import {
  Clock, Calendar, Loader2, CheckCircle2, ShieldCheck, FileBarChart,
  AlertTriangle, XCircle, FileSignature, Stethoscope, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import { useImagingDashboard, useImagingAnalytics } from '@/hooks/use-imaging';
import { RadiologyAdminGuard } from '@/components/radiology/radiology-admin-guard';

export default function RadiologyDashboardPage() {
  return (
    <RadiologyAdminGuard>
      <DashboardInner />
    </RadiologyAdminGuard>
  );
}

function DashboardInner() {
  const { data, isLoading, refetch, isFetching } = useImagingDashboard();
  // Use last 7 days for the TAT card on the landing dashboard.
  const range = (() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return {
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
    };
  })();
  const { data: analytics } = useImagingAnalytics(range);

  const counts = data?.counts;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Radiology Dashboard"
        description="Worklist counts, awaiting sign-off, recent activity, and 7-day TAT."
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Top stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard
          label="Pending"
          value={counts?.pending}
          icon={Clock}
          accent="bg-amber-50 text-amber-700"
          loading={isLoading}
          href="/radiology"
        />
        <StatCard
          label="Scheduled"
          value={counts?.scheduled}
          icon={Calendar}
          accent="bg-blue-50 text-blue-700"
          loading={isLoading}
          href="/radiology"
        />
        <StatCard
          label="In Progress"
          value={counts?.inProgress}
          icon={Loader2}
          accent="bg-purple-50 text-purple-700"
          loading={isLoading}
        />
        <StatCard
          label="Awaiting Sign-off"
          value={counts?.awaitingVerify}
          icon={FileSignature}
          accent="bg-rose-50 text-rose-700"
          loading={isLoading}
        />
        <StatCard
          label="Published Today"
          value={counts?.publishedToday}
          icon={ShieldCheck}
          accent="bg-emerald-50 text-emerald-700"
          loading={isLoading}
        />
      </div>

      {/* Second row — operational warnings + today summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="STAT Today"
          value={counts?.statToday}
          icon={AlertTriangle}
          accent="bg-red-50 text-red-700"
          loading={isLoading}
        />
        <StatCard
          label="Overdue Scheduled"
          value={counts?.overdueScheduled}
          icon={AlertTriangle}
          accent="bg-orange-50 text-orange-700"
          loading={isLoading}
        />
        <StatCard
          label="Completed Today"
          value={counts?.completedToday}
          icon={CheckCircle2}
          accent="bg-emerald-50 text-emerald-700"
          loading={isLoading}
        />
        <StatCard
          label="Cancelled Today"
          value={counts?.cancelledToday}
          icon={XCircle}
          accent="bg-zinc-100 text-zinc-700"
          loading={isLoading}
        />
      </div>

      {/* TAT + Modality mix from analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card title="7-day TAT (avg)">
          <p className="font-headline text-4xl font-bold mt-2">
            {analytics ? `${analytics.summary.avgTatHours}h` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Median {analytics ? `${analytics.summary.medianTatHours}h` : '—'} · From request to publish
          </p>
        </Card>
        <Card title="Volume by modality (7d)">
          {(analytics?.modalityVolume?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground italic">No studies in range.</p>
          ) : (
            <BarList
              items={(analytics!.modalityVolume).map((m) => ({
                label: m.modality.replace(/_/g, ' '),
                value: m.count,
              }))}
            />
          )}
        </Card>
        <Card title="Urgency mix (7d)">
          {!analytics ? (
            <p className="text-xs text-muted-foreground italic">—</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(analytics.urgencyMix).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Recent imaging orders (24h)">
          {isLoading ? (
            <Skeleton />
          ) : (data?.recentRequests?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground italic">No new orders in the last 24 hours.</p>
          ) : (
            <ul className="divide-y">
              {data!.recentRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {r.patient?.firstName} {r.patient?.lastName}{' '}
                      <span className="text-xs text-muted-foreground font-mono">
                        {r.patient?.mrn ? `· ${r.patient.mrn}` : ''}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {r.imagingType.replace(/_/g, ' ')} {r.bodyPart ? `· ${r.bodyPart}` : ''} · {r.urgency}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent results activity (24h)">
          {isLoading ? (
            <Skeleton />
          ) : (data?.recentResults?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground italic">No result updates in the last 24 hours.</p>
          ) : (
            <ul className="divide-y">
              {data!.recentResults.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {r.patient?.firstName} {r.patient?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {r.imagingRequest?.imagingType.replace(/_/g, ' ')}{' '}
                      {r.imagingRequest?.bodyPart ? `· ${r.imagingRequest.bodyPart}` : ''}{' '}
                      · {formatDateTime(r.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/radiology"><Button variant="outline" size="sm"><Stethoscope className="mr-1.5 h-4 w-4" />Open Worklist</Button></Link>
        <Link href="/radiology/studies"><Button variant="outline" size="sm"><FileBarChart className="mr-1.5 h-4 w-4" />DICOM Studies</Button></Link>
        <Link href="/radiology/reports"><Button variant="outline" size="sm"><FileBarChart className="mr-1.5 h-4 w-4" />Full Reports & TAT</Button></Link>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent, loading, href,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  loading?: boolean;
  href?: string;
}) {
  const inner = (
    <div className={cn(
      'rounded-xl bg-surface-container-lowest shadow-sanctuary p-4',
      'transition-transform',
      href && 'hover:scale-[1.01] cursor-pointer',
      accent,
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">
            {loading ? '…' : (value ?? 0)}
          </p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
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

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-surface-container-low animate-pulse" />
      ))}
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.slice(0, 6).map((it) => (
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
