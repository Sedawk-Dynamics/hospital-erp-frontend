'use client';

import {
  Inbox,
  FlaskConical,
  Truck,
  Users,
  PencilLine,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLabDashboard } from '@/hooks/use-lab';
import { formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
// Shared with radiology so the two departments' summary strips are literally
// the same component, not two copies that drift.
import { SummaryCard } from '@/components/shared/diagnostics/summary-card';

// Headline stats for the lab user's first paint. The numbers come from
// /lab/dashboard which counts everything in one pass — kept off the order
// list query so this stays a fast preflight check.
//
// The two detail panels that used to sit under these cards — Recent Orders and
// Overdue — moved to the Lab Reports page. Between them and eight cards the
// home page was a wall of readouts above the tabs anyone actually works from.
// The Overdue COUNT stays here and is clickable, which is the better route to
// that list anyway: it filters the work queue rather than showing ten of them.
//
// Which numbers appear depends on the role. Eight identical cards were shown to
// everybody, over half of them about a stage the viewer has no part in: a bench
// technician cannot sign or publish anything, so "Awaiting Sign" and "Awaiting
// Publish" were noise between them and the two numbers they act on.

export function LabDashboardSummary({
  isSupervisor,
  onShowOverdue,
}: {
  isSupervisor: boolean;
  /** Jump the worklist to the overdue filter instead of leaving the page. */
  onShowOverdue?: () => void;
}) {
  const { data, isLoading } = useLabDashboard();
  const s = data?.summary;

  // The bench: what is waiting to be collected, what is moving, what is on the
  // analyser, and what has gone past its SLA.
  const technicianCards = [
    { label: 'To Collect', value: s?.incomingOrders ?? 0, icon: Inbox, tone: 'amber' },
    { label: 'In Transit', value: s?.samplesInTransit ?? 0, icon: Truck, tone: 'blue' },
    { label: 'In Progress', value: s?.inProgressOrders ?? 0, icon: FlaskConical, tone: 'indigo' },
    { label: 'Overdue', value: s?.overdueOrders ?? 0, icon: AlertTriangle, tone: 'red' },
  ];

  // The lab admin: intake to accept, work to hand out, the queue they decide on,
  // and what actually went out today.
  //
  // This used to show three approval stages — Awaiting Verify / Sign / Publish —
  // that no longer describe the flow. `reportsAwaitingSign` counted drafts as
  // well as submissions so it never matched the Awaiting Approval tab, and
  // `reportsAwaitingPublish` counted the legacy `approved` status, which the
  // one-click approve path never sets: it read zero permanently.
  const adminCards = [
    { label: 'To Accept', value: s?.incomingOrders ?? 0, icon: Inbox, tone: 'amber' },
    { label: 'Unassigned', value: s?.unassignedOrders ?? 0, icon: Users, tone: 'blue' },
    { label: 'In Draft', value: s?.draftReports ?? 0, icon: PencilLine, tone: 'indigo' },
    { label: 'Awaiting Approval', value: s?.awaitingApproval ?? 0, icon: ShieldCheck, tone: 'cyan' },
    { label: 'Published Today', value: s?.publishedToday ?? 0, icon: CheckCircle2, tone: 'green' },
    { label: 'Overdue', value: s?.overdueOrders ?? 0, icon: AlertTriangle, tone: 'red' },
  ];

  const cards = isSupervisor ? adminCards : technicianCards;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'grid gap-2.5 grid-cols-2 sm:grid-cols-4',
          isSupervisor ? 'lg:grid-cols-6' : 'lg:grid-cols-4',
        )}
      >
        {cards.map((c) => (
          <SummaryCard
            key={c.label}
            {...c}
            loading={isLoading}
            onClick={c.label === 'Overdue' && (s?.overdueOrders ?? 0) > 0 ? onShowOverdue : undefined}
          />
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

    </div>
  );
}

export function RecentActivityPanel() {
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

export function OverdueOrdersPanel({ onShowAll }: { onShowAll?: () => void }) {
  const { data } = useLabDashboard();
  const overdue = data?.overdueOrders ?? [];
  const total = data?.summary?.overdueOrders ?? overdue.length;

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Overdue ({'>'}24h, no report)
          {total > overdue.length && (
            <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
              {total}
            </span>
          )}
        </h3>
        {/* This linked to /laboratory/reports, which is the analytics page and
            has no overdue list on it. It now filters the worklist below. */}
        {overdue.length > 0 && onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            className="text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            View all {total} →
          </button>
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
