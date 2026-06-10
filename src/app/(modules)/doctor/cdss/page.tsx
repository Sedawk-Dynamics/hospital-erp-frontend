'use client';

import { useState } from 'react';
import {
  AlertCircle, Activity, RefreshCw, Bell, FlaskConical, Check, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  useCdssAlerts, useCdssAlertsSummary, useAcknowledgeCdssAlert, useOverrideCdssAlert,
  type CdssAlert, type CdssAlertType, type CdssAlertStatus,
} from '@/hooks/use-cdss';

type Tab = 'alerts' | 'abnormal';

const TYPE_LABELS: Record<CdssAlertType, string> = {
  critical_value: 'Critical value',
  drug_interaction: 'Drug interaction',
  allergy: 'Allergy',
  dosage: 'Dosage',
  recall: 'Recall',
};

const TYPE_BADGE: Record<CdssAlertType, string> = {
  critical_value: 'bg-red-500/10 text-red-700 border-red-500/20',
  drug_interaction: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  allergy: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  dosage: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  recall: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
};

export default function CdssDashboardPage() {
  const [tab, setTab] = useState<Tab>('alerts');
  const [typeFilter, setTypeFilter] = useState<CdssAlertType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CdssAlertStatus | 'all'>('active');
  const [overrideTarget, setOverrideTarget] = useState<CdssAlert | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const { data: summary } = useCdssAlertsSummary();
  const { data, isLoading, refetch } = useCdssAlerts({
    limit: 50,
    type: typeFilter,
    status: statusFilter,
  });
  const acknowledge = useAcknowledgeCdssAlert();
  const override = useOverrideCdssAlert();

  const handleAcknowledge = (alert: CdssAlert) => {
    acknowledge.mutate(
      { alertId: alert.id },
      {
        onSuccess: () => toast.success('Alert acknowledged'),
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to acknowledge'),
      },
    );
  };

  const handleOverride = () => {
    if (!overrideTarget || overrideReason.trim().length < 5) {
      toast.error('Override reason must be at least 5 characters');
      return;
    }
    override.mutate(
      { alertId: overrideTarget.id, reason: overrideReason.trim() },
      {
        onSuccess: () => {
          toast.success('Alert overridden with documented reason');
          setOverrideTarget(null);
          setOverrideReason('');
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to override'),
      },
    );
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-red-600" />
            CDSS Alerts
          </h1>
          <p className="text-xs text-muted-foreground">
            Clinical Decision Support: critical lab values, drug warnings, and abnormal results
            requiring review.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Critical today"
          value={summary?.criticalToday ?? '—'}
          icon={AlertCircle}
          tone="red"
        />
        <StatTile
          label="Critical (7 days)"
          value={summary?.criticalWeek ?? '—'}
          icon={Bell}
          tone="amber"
        />
        <StatTile
          label="Active (pending review)"
          value={summary?.activeTotal ?? '—'}
          icon={Activity}
          tone="blue"
        />
        <StatTile
          label="Active interactions"
          value={summary?.byType?.drug_interaction ?? 0}
          icon={ShieldAlert}
          tone="amber"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="alerts">Alerts ({data?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="abnormal">
            Recent Abnormal ({data?.abnormalResults.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v ?? 'all') as CdssAlertType | 'all')}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {(Object.keys(TYPE_LABELS) as CdssAlertType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? 'all') as CdssAlertStatus | 'all')}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="overridden">Overridden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !data || data.alerts.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="No alerts"
                description="All clear. CDSS alerts appear here when prescriptions or lab values trigger a rule."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.alerts.map((a) => (
                    <TableRow key={a.id} className={a.status === 'active' ? 'bg-red-50/40' : ''}>
                      <TableCell>
                        <Badge className={cn('text-xs', TYPE_BADGE[a.alertType])}>
                          {TYPE_LABELS[a.alertType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{a.message}</div>
                        {a.detail && (
                          <div className="text-xs text-muted-foreground mt-0.5">{a.detail}</div>
                        )}
                        {a.status === 'overridden' && a.overrideReason && (
                          <div className="text-xs text-purple-700 mt-0.5">
                            Override reason: {a.overrideReason}
                          </div>
                        )}
                        {a.status === 'acknowledged' && a.acknowledgeNote && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Note: {a.acknowledgeNote}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.patient ? (
                          <div>
                            <div className="font-medium">{a.patient.firstName} {a.patient.lastName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{a.patient.mrn}</div>
                          </div>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTimeAmPm(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.status === 'active' ? (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <div>
                            <Badge variant="outline" className="text-xs capitalize">{a.status}</Badge>
                            {a.acknowledgedBy && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                by {a.acknowledgedBy.firstName} {a.acknowledgedBy.lastName}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {a.status === 'active' && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={acknowledge.isPending}
                              onClick={() => handleAcknowledge(a)}
                            >
                              <Check className="mr-1 h-3 w-3" /> Acknowledge
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-purple-700"
                              onClick={() => { setOverrideTarget(a); setOverrideReason(''); }}
                            >
                              Override
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="abnormal" className="mt-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !data || data.abnormalResults.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="No abnormal results"
                description="Recent abnormal lab results pending review will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.abnormalResults.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.patient ? (
                          <div>
                            <div className="font-medium text-sm">
                              {r.patient.firstName} {r.patient.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{r.patient.mrn}</div>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="font-medium">{r.parameterName}</TableCell>
                      <TableCell className="text-amber-700 font-semibold">
                        {r.value} {r.unit}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.normalRange ?? '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTimeAmPm(r.enteredAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!overrideTarget} onOpenChange={(open) => { if (!open) setOverrideTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Override CDSS alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              {overrideTarget?.message}
            </div>
            <div>
              <label className="text-xs font-medium">Clinical justification *</label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why is it clinically appropriate to proceed despite this alert?"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                The reason is stored on the alert with your name and timestamp.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>Cancel</Button>
            <Button
              onClick={handleOverride}
              disabled={override.isPending || overrideReason.trim().length < 5}
            >
              Override alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'red' | 'amber' | 'blue';
}) {
  const toneCls = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }[tone];
  return (
    <div className={cn('rounded-xl shadow-sanctuary p-4', toneCls)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide">{label}</p>
          <p className="font-headline text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-6" />
      </div>
    </div>
  );
}
