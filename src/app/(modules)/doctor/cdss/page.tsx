'use client';

import { useState } from 'react';
import {
  AlertCircle, Activity, RefreshCw, Bell, FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { useCdssAlerts, useCdssAlertsSummary } from '@/hooks/use-cdss';

type Tab = 'critical' | 'abnormal';

export default function CdssDashboardPage() {
  const [tab, setTab] = useState<Tab>('critical');
  const { data: summary } = useCdssAlertsSummary();
  const { data, isLoading, refetch } = useCdssAlerts({ limit: 50 });

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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatTile
          label="Critical today"
          value={summary?.criticalToday ?? '—'}
          icon={AlertCircle}
          tone="red"
        />
        <StatTile
          label="Last 7 days"
          value={summary?.criticalWeek ?? '—'}
          icon={Bell}
          tone="amber"
        />
        <StatTile
          label="Unread"
          value={summary?.unreadCritical ?? '—'}
          icon={Activity}
          tone="blue"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="critical">Critical Values ({data?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="abnormal">
            Recent Abnormal ({data?.abnormalResults.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="critical" className="mt-3">
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !data || data.alerts.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="No critical alerts"
                description="All clear. CDSS alerts you when lab values hit panic thresholds."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Severity</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>For</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.alerts.map((a) => (
                    <TableRow key={a.id} className={!a.isRead ? 'bg-red-50/40' : ''}>
                      <TableCell>
                        <Badge className="bg-red-500/10 text-red-700 border-red-500/20">
                          Critical
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{a.message}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.user ? `${a.user.firstName} ${a.user.lastName}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTimeAmPm(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.isRead ? (
                          <Badge variant="outline" className="text-xs">Read</Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs">
                            Unread
                          </Badge>
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
