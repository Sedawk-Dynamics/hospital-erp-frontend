'use client';

import Link from 'next/link';
import {
  Inbox,
  FlaskConical,
  Truck,
  ClipboardCheck,
  FileSignature,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLabDashboard } from '@/hooks/use-lab';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

// Headline stats for the lab user's first paint. The numbers come from
// /lab/dashboard which counts everything in one pass — kept off the order
// list query so this stays a fast preflight check.

export function LabDashboardSummary() {
  const { data, isLoading } = useLabDashboard();
  const s = data?.summary;

  const cards = [
    { label: 'Incoming', value: s?.incomingOrders ?? 0, icon: Inbox, tone: 'amber' },
    { label: 'In Progress', value: s?.inProgressOrders ?? 0, icon: FlaskConical, tone: 'indigo' },
    { label: 'In Transit', value: s?.samplesInTransit ?? 0, icon: Truck, tone: 'blue' },
    { label: 'Awaiting Verify', value: s?.resultsAwaitingVerify ?? 0, icon: ClipboardCheck, tone: 'purple' },
    { label: 'Awaiting Sign', value: s?.reportsAwaitingSign ?? 0, icon: FileSignature, tone: 'cyan' },
    { label: 'Awaiting Publish', value: s?.reportsAwaitingPublish ?? 0, icon: Send, tone: 'teal' },
    { label: 'Published Today', value: s?.publishedToday ?? 0, icon: CheckCircle2, tone: 'green' },
    { label: 'Overdue', value: s?.overdueOrders ?? 0, icon: AlertTriangle, tone: 'red' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {cards.map((c) => (
          <SummaryCard key={c.label} {...c} loading={isLoading} />
        ))}
      </div>

      {/* Show the abnormal-results banner when something needs immediate
          attention, but only once we have data — empty state is fine. */}
      {s && s.abnormalRecent > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-900">
          <AlertTriangle className="h-3.5 w-3.5" />
          {s.abnormalRecent} abnormal result{s.abnormalRecent === 1 ? '' : 's'} entered in the last 24 hours.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RecentActivityPanel />
        <OverdueOrdersPanel />
      </div>
    </div>
  );
}

const TONE_CLS: Record<string, { wrap: string; icon: string }> = {
  amber: { wrap: 'bg-amber-50', icon: 'text-amber-600' },
  indigo: { wrap: 'bg-indigo-50', icon: 'text-indigo-600' },
  blue: { wrap: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { wrap: 'bg-purple-50', icon: 'text-purple-600' },
  cyan: { wrap: 'bg-cyan-50', icon: 'text-cyan-600' },
  teal: { wrap: 'bg-teal-50', icon: 'text-teal-600' },
  green: { wrap: 'bg-green-50', icon: 'text-green-600' },
  red: { wrap: 'bg-red-50', icon: 'text-red-600' },
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  loading: boolean;
}) {
  const cls = TONE_CLS[tone] ?? TONE_CLS.indigo;
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-3">
      <div className={cn('inline-flex rounded-lg p-1.5 mb-2', cls.wrap)}>
        <Icon className={cn('h-3.5 w-3.5', cls.icon)} />
      </div>
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <p className="font-headline text-xl font-bold mt-0.5">
        {loading ? <span className="text-muted-foreground/40">—</span> : value}
      </p>
    </div>
  );
}

function RecentActivityPanel() {
  const { data, isLoading } = useLabDashboard();
  const orders = data?.recentOrders ?? [];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Recent Orders
        </h3>
        {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No recent orders.</p>
      ) : (
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id} className="py-1.5 text-sm flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {o.patient.firstName} {o.patient.lastName ?? ''}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {o.patient.mrn} · {o.labOrderItems?.length ?? 0} test(s)
                  {o.orderer && ` · Dr. ${o.orderer.firstName} ${o.orderer.lastName}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <Badge className="capitalize text-[10px]">{o.status.replace(/_/g, ' ')}</Badge>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDateTime(o.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OverdueOrdersPanel() {
  const { data } = useLabDashboard();
  const overdue = data?.overdueOrders ?? [];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Overdue ({'>'}24h, no report)
        </h3>
        {overdue.length > 0 && (
          <Link
            href="/laboratory/reports"
            className="text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            View all →
          </Link>
        )}
      </div>
      {overdue.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">All orders are within SLA.</p>
      ) : (
        <ul className="divide-y">
          {overdue.map((o) => (
            <li key={o.id} className="py-1.5 text-sm flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {o.patient.firstName} {o.patient.lastName ?? ''}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {o.patient.mrn}
                </p>
              </div>
              <div className="text-right shrink-0">
                <Badge className="bg-red-100 text-red-800 capitalize text-[10px]">
                  {o.status.replace(/_/g, ' ')}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Since {formatDateTime(o.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
