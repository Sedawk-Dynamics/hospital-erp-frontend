'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaves, useApproveLeave, useRejectLeave, type LeaveStatus, type LeaveType } from '@/hooks/use-hr';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_TONE: Record<LeaveStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  cancelled: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

const TYPE_LABEL: Record<LeaveType, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  casual: 'Casual',
  maternity: 'Maternity',
  paternity: 'Paternity',
  unpaid: 'Unpaid',
  other: 'Other',
};

function diffDays(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function HrLeavesPage() {
  const [status, setStatus] = useState<LeaveStatus | ''>('pending');
  const { data, isLoading } = useLeaves({ status: status || undefined, limit: 100 });
  const approve = useApproveLeave();
  const reject = useRejectLeave();

  const rows = (data?.data ?? []) as Array<{
    id: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string | null;
    status: LeaveStatus;
    createdAt: string;
    staff?: { employeeId?: string | null; user?: { firstName: string; lastName?: string | null } };
  }>;

  const handle = (action: 'approve' | 'reject', id: string) => {
    const mutation = action === 'approve' ? approve : reject;
    mutation.mutate(id, {
      onSuccess: () => toast.success(`Leave ${action}d`),
      onError: () => toast.error(`Could not ${action} leave`),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-headline">Leave Requests</h1>
        <p className="text-sm text-on-surface-variant">
          Approve or reject staff leave requests — staff are auto-notified.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as LeaveStatus | '')}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">No leave requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">Applied</th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">From → To</th>
                    <th className="px-3 py-2">Days</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 py-2">
                        {r.staff?.user?.firstName} {r.staff?.user?.lastName ?? ''}
                      </td>
                      <td className="px-3 py-2">{TYPE_LABEL[r.leaveType]}</td>
                      <td className="px-3 py-2 text-xs">
                        {new Date(r.startDate).toLocaleDateString('en-IN')} → {new Date(r.endDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-xs">{diffDays(r.startDate, r.endDate)}</td>
                      <td className="px-3 py-2 max-w-[260px] truncate text-xs" title={r.reason ?? ''}>
                        {r.reason ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={STATUS_TONE[r.status]}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.status === 'pending' && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handle('approve', r.id)} className="h-7 px-2">
                              <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handle('reject', r.id)} className="h-7 px-2">
                              <X className="h-3.5 w-3.5 mr-1 text-rose-600" />Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
