'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSlaQueue, useWorkflowAnalytics } from '@/hooks/use-insurance-workflow';
import { cn } from '@/lib/utils';

function duration(minutes?: number | null) {
  if (minutes == null) return '—';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  const value = hours ? `${hours}h ${rest}m` : `${rest}m`;
  return minutes < 0 ? `${value} overdue` : `${value} left`;
}

export default function InsuranceSlaPage() {
  const queue = useSlaQueue();
  const analytics = useWorkflowAnalytics();
  const items = queue.data ?? [];
  const overdue = items.filter((item) => item.breached).length;
  const warning = items.filter((item) => item.alert && !item.breached).length;

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
        <Metric title="Average decision TAT" value={`${analytics.data?.sla.averageDecisionMinutes ?? 0} min`} icon={<CheckCircle2 className="size-5 text-emerald-600" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Authorization queue</CardTitle><CardDescription>Initial and enhancement requests target one hour; final discharge authorization targets three hours. Alerts begin at 45 minutes and 2.5 hours respectively.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Deadline</TableHead><TableHead>Request</TableHead><TableHead>Patient</TableHead><TableHead>Case</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {queue.isLoading ? <TableRow><TableCell colSpan={8} className="text-center">Loading…</TableCell></TableRow> : items.length ? items.map((item) => (
                <TableRow key={item.id} className={cn(item.breached && 'bg-rose-50/60', item.alert && !item.breached && 'bg-amber-50/60')}>
                  <TableCell><div className={cn('font-semibold', item.breached ? 'text-rose-700' : item.alert ? 'text-amber-700' : 'text-emerald-700')}>{duration(item.remainingMinutes)}</div><div className="text-xs text-on-surface-variant">{item.decisionDueAt ? new Date(item.decisionDueAt).toLocaleString('en-IN') : '—'}</div></TableCell>
                  <TableCell className="font-medium">{item.requestNumber ?? item.id.slice(0, 8)}</TableCell>
                  <TableCell>{item.patient?.firstName} {item.patient?.lastName ?? ''}</TableCell>
                  <TableCell>{item.insuranceCase?.caseNumber ?? '—'}</TableCell>
                  <TableCell className="capitalize">{(item.requestType ?? 'initial').replace(/([A-Z])/g, ' $1')}</TableCell>
                  <TableCell>₹{Number(item.estimatedCost ?? 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell><Badge variant="outline" className={cn(item.breached ? 'border-rose-300 text-rose-700' : item.alert ? 'border-amber-300 text-amber-700' : 'border-emerald-300 text-emerald-700')}>{item.breached ? 'Breached' : item.alert ? 'Escalate' : 'On track'}</Badge></TableCell>
                  <TableCell className="text-right">{item.insuranceCaseId ? <Link href={`/insurance/cases/${item.insuranceCaseId}`} className="inline-flex items-center gap-1 text-primary hover:underline">Open <ExternalLink className="size-3.5" /></Link> : '—'}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={8} className="text-center text-on-surface-variant">No authorization decisions are pending.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>{title}</CardDescription>{icon}</CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}
