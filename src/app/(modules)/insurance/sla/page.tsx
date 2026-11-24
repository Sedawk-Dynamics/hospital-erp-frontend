'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSlaQueue, useWorkflowAnalytics } from '@/hooks/use-insurance-workflow';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/date-utils';
import { formatINR } from '@/lib/money';
import { usePermissions } from '@/hooks/use-permissions';
import { roleLabel } from '@/hooks/use-insurance-admin';
import { SlaEscalationSettings } from '@/components/insurance/sla-escalation-settings';
import { CloseStaleRequestDialog } from '@/components/insurance/close-stale-request-dialog';

function duration(minutes?: number | null) {
  if (minutes == null) return '—';
  const absolute = Math.abs(minutes);
  const days = Math.floor(absolute / 1440);
  const hours = Math.floor((absolute % 1440) / 60);
  const rest = absolute % 60;
  // "14d 18h" reads better than "354h" for long-overdue requests (gap 294).
  const value = days ? `${days}d ${hours}h` : hours ? `${hours}h ${rest}m` : `${rest}m`;
  return minutes < 0 ? `${value} overdue` : `${value} left`;
}

function personName(p?: { firstName: string; lastName?: string | null } | null) {
  return p ? `${p.firstName} ${p.lastName ?? ''}`.trim() : null;
}

function averageTat(minutes?: number | null) {
  // null = no request has both a submitted and a decided time yet (gap 294).
  if (minutes == null) return '—';
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

export default function InsuranceSlaPage() {
  const queue = useSlaQueue();
  const analytics = useWorkflowAnalytics();
  const items = queue.data ?? [];
  const overdue = items.filter((item) => item.breached).length;
  const warning = items.filter((item) => item.alert && !item.breached).length;
  // Gap 294: closing a stale request is a decision-level action (insurance:approve).
  const canClose = usePermissions().canAccess('insurance', 'approve');
  const [closing, setClosing] = useState<{ id: string; requestNumber?: string | null } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold font-headline">Insurance SLA Command Centre</h1><p className="text-sm text-on-surface-variant">Live authorization deadlines and escalation queue.</p></div>
        <Button variant="outline" size="sm" onClick={() => queue.refetch()} disabled={queue.isFetching}><RefreshCw className={cn('mr-1.5 size-4', queue.isFetching && 'animate-spin')} /> Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Pending decisions" value={items.length} icon={<Clock3 className="size-5 text-blue-600" />} />
        <Metric title="Alert window" value={warning} icon={<AlertTriangle className="size-5 text-amber-600" />} />
        <Metric title="Overdue" value={overdue} icon={<AlertTriangle className="size-5 text-rose-600" />} />
        <Metric title="Average decision TAT" value={averageTat(analytics.data?.sla.averageDecisionMinutes)} hint="Average time from submission to the payer's decision, over decided requests that have both times recorded." icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Authorization queue</CardTitle><CardDescription>Initial and enhancement requests target one hour; final discharge authorization targets three hours. Alerts begin at 45 minutes and 2.5 hours respectively.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Deadline</TableHead><TableHead>Request</TableHead><TableHead>Patient</TableHead><TableHead>Case</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Owner</TableHead><TableHead>Last action</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {queue.isLoading ? <TableRow><TableCell colSpan={10} className="text-center">Loading…</TableCell></TableRow> : items.length ? items.map((item) => (
                <TableRow key={item.id} className={cn(item.breached && 'bg-rose-50/60', item.alert && !item.breached && 'bg-amber-50/60')}>
                  <TableCell><div className={cn('font-semibold', item.breached ? 'text-rose-700' : item.alert ? 'text-amber-700' : 'text-emerald-700')}>{duration(item.remainingMinutes)}</div><div className="text-xs text-on-surface-variant">{item.decisionDueAt ? formatDateTime(item.decisionDueAt) : '—'}</div></TableCell>
                  <TableCell className="font-medium">{item.requestNumber ?? item.id.slice(0, 8)}</TableCell>
                  <TableCell>{item.patient?.firstName} {item.patient?.lastName ?? ''}</TableCell>
                  <TableCell>{item.insuranceCase?.caseNumber ?? '—'}</TableCell>
                  <TableCell className="capitalize">{(item.requestType ?? 'initial').replace(/([A-Z])/g, ' $1')}</TableCell>
                  <TableCell>{formatINR(item.estimatedCost)}</TableCell>
                  <TableCell><Badge variant="outline" className={cn(item.breached ? 'border-rose-300 text-rose-700' : item.alert ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700')}>{item.breached ? 'Breached' : item.alert ? 'Escalate' : 'On track'}</Badge>{item.breached && item.escalation && (<div className="mt-1 text-[11px] text-on-surface-variant">{item.escalation.escalatedAt ? `Escalated to ${roleLabel(item.escalation.targetRole)} · ${formatDateTime(item.escalation.escalatedAt)}` : item.escalation.dueAt ? `Escalates to ${roleLabel(item.escalation.targetRole)} at ${formatDateTime(item.escalation.dueAt)}` : null}</div>)}</TableCell>
                  <TableCell>{personName(item.owner) ?? <span className="text-xs text-rose-700">Unassigned</span>}</TableCell>
                  <TableCell>{item.lastAction ? <div><div className="text-sm capitalize">{item.lastAction.label}</div><div className="text-xs text-on-surface-variant">{formatDateTime(item.lastAction.at)}{personName(item.lastAction.by) ? ` · ${personName(item.lastAction.by)}` : ''}</div></div> : <span className="text-xs text-on-surface-variant">No action yet</span>}</TableCell>
                  <TableCell className="text-right"><div className="flex flex-col items-end gap-1">{item.insuranceCaseId ? <Link href={`/insurance/cases/${item.insuranceCaseId}`} className="inline-flex items-center gap-1 text-primary hover:underline">Open <ExternalLink className="size-3.5" /></Link> : <span>—</span>}{item.breached && canClose && <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setClosing({ id: item.id, requestNumber: item.requestNumber })}>Close with reason</Button>}</div></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={10} className="text-center text-on-surface-variant">No authorization decisions are pending.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SlaEscalationSettings />
      <CloseStaleRequestDialog request={closing} onClose={() => setClosing(null)} />
    </div>
  );
}

function Metric({ title, value, icon, hint }: { title: string; value: string | number; icon: React.ReactNode; hint?: string }) {
  return <Card title={hint}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>{title}</CardDescription>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}
