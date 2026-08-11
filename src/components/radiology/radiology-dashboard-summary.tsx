'use client';

// Headline stats for the radiology user's first paint — the twin of
// LabDashboardSummary, using the same card component so the two departments'
// home pages read identically.
//
// Which numbers appear depends on the role. The radiology home used to show
// three counts derived in the BROWSER from one page of 100 requests, so a
// department with more than 100 open studies simply under-reported itself.
// These come from /imaging/dashboard, which counts in one pass over the table.

import {
  Inbox,
  Scan,
  PencilLine,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Users,
} from 'lucide-react';
import { useImagingDashboard } from '@/hooks/use-imaging';
import { cn } from '@/lib/utils';
import { SummaryCard } from '@/components/shared/diagnostics/summary-card';

export function RadiologyDashboardSummary({
  isRadiologyAdmin,
  onShowOverdue,
}: {
  isRadiologyAdmin: boolean;
  /** Jump the worklist to the overdue filter instead of leaving the page. */
  onShowOverdue?: () => void;
}) {
  const { data, isLoading } = useImagingDashboard();
  const c = data?.counts;

  // The radiologist: what is cleared and waiting, what is on their bench, what
  // they have submitted, and what has gone past its SLA.
  const radiologistCards = [
    { label: 'To Scan', value: c?.pending ?? 0, icon: Scan, tone: 'amber' },
    { label: 'My Drafts', value: c?.draft ?? 0, icon: PencilLine, tone: 'indigo' },
    { label: 'Sent for Approval', value: c?.awaitingApproval ?? 0, icon: ShieldCheck, tone: 'cyan' },
    { label: 'Overdue', value: c?.overdue ?? 0, icon: AlertTriangle, tone: 'red' },
  ];

  // The admin: intake to accept, work in flight, the queue they own, and what
  // actually went out today.
  const adminCards = [
    { label: 'To Accept', value: c?.awaitingAccept ?? 0, icon: Inbox, tone: 'amber' },
    { label: 'Unassigned', value: c?.unassigned ?? 0, icon: Users, tone: 'blue' },
    { label: 'In Draft', value: c?.draft ?? 0, icon: PencilLine, tone: 'indigo' },
    { label: 'Awaiting Approval', value: c?.awaitingApproval ?? 0, icon: ShieldCheck, tone: 'cyan' },
    { label: 'Published Today', value: c?.publishedToday ?? 0, icon: CheckCircle2, tone: 'green' },
    { label: 'Overdue', value: c?.overdue ?? 0, icon: AlertTriangle, tone: 'red' },
  ];

  const cards = isRadiologyAdmin ? adminCards : radiologistCards;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'grid grid-cols-2 gap-2.5 sm:grid-cols-4',
          isRadiologyAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-4',
        )}
      >
        {cards.map((card) => (
          <SummaryCard
            key={card.label}
            {...card}
            loading={isLoading}
            onClick={card.label === 'Overdue' && (c?.overdue ?? 0) > 0 ? onShowOverdue : undefined}
          />
        ))}
      </div>

      {/* STAT work is the one thing worth interrupting for. */}
      {c && c.statToday > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-900">
          <AlertTriangle className="h-3.5 w-3.5" />
          {c.statToday} STAT stud{c.statToday === 1 ? 'y' : 'ies'} raised today.
        </div>
      )}
      {isRadiologyAdmin && c && c.noShow > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <UserX className="h-3.5 w-3.5" />
          {c.noShow} request{c.noShow === 1 ? '' : 's'} closed as no-show and never reopened.
        </div>
      )}
    </div>
  );
}
