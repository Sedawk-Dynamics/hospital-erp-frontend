'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useDutyRosters,
  usePublishDutyRoster,
  type DutyRoster,
  type DutyRosterStatus,
} from '@/hooks/use-duty-rosters';

const DEFAULT_STATUS: DutyRosterStatus = 'scheduled';

export default function RosterApprovalsPage() {
  const [fromDate, setFromDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<DutyRosterStatus | 'all'>(DEFAULT_STATUS);

  const { data, isLoading } = useDutyRosters({
    fromDate,
    toDate,
    status: status === 'all' ? undefined : status,
    limit: 500,
  });
  const rosters = (data?.items ?? (data as any)?.data ?? []) as DutyRoster[];

  const publishMut = usePublishDutyRoster();

  const pendingCount = useMemo(
    () => rosters.filter((r) => r.status === 'scheduled').length,
    [rosters],
  );

  async function handlePublish(id: string) {
    try {
      await publishMut.mutateAsync(id);
      toast.success('Roster approved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve';
      toast.error(msg);
    }
  }

  async function handleBulkPublish() {
    const pending = rosters.filter((r) => r.status === 'scheduled');
    if (pending.length === 0) return;
    const confirmed = window.confirm(`Publish all ${pending.length} pending rosters?`);
    if (!confirmed) return;
    for (const r of pending) {
      try {
        await publishMut.mutateAsync(r.id);
      } catch {
        // continue; failures surface in the per-row toasts
      }
    }
    toast.success('Bulk approval complete');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Roster Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review submitted rosters and publish them to release shifts to bedside nurses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              {pendingCount} pending
            </Badge>
          ) : null}
          <Button
            variant="outline"
            onClick={handleBulkPublish}
            disabled={pendingCount === 0 || publishMut.isPending}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Approve all pending
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                if (value) setStatus(value as DutyRosterStatus | 'all');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="scheduled">Pending (scheduled)</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading rosters…
            </div>
          ) : rosters.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No rosters match the current filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Ward</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rosters.map((r) => {
                  const staffName = r.staff?.user
                    ? `${r.staff.user.firstName} ${r.staff.user.lastName ?? ''}`
                    : '—';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {format(parseISO(r.shiftDate), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{r.shiftType}</TableCell>
                      <TableCell className="text-sm">{staffName}</TableCell>
                      <TableCell className="text-sm">{r.ward?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{r.role ?? '—'}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'scheduled' ? (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(r.id)}
                            disabled={publishMut.isPending}
                          >
                            Approve
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: DutyRosterStatus }) {
  const styles: Record<DutyRosterStatus, string> = {
    scheduled: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-primary/10 text-primary',
    swapped: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="secondary" className={styles[status]}>
      {status}
    </Badge>
  );
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}
