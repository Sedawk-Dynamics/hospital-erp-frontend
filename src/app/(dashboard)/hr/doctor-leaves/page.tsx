'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Clock, Ban, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import {
  useAllDoctorLeaves,
  useApproveDoctorLeave,
  useRejectDoctorLeave,
  type DoctorLeave,
  type DoctorLeaveStatus,
} from '@/hooks/use-doctor-leaves';

const STATUS_FILTERS: { value: 'all' | DoctorLeaveStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

function StatusBadge({ status }: { status: DoctorLeaveStatus }) {
  const map: Record<DoctorLeaveStatus, { label: string; className: string; Icon: typeof Clock }> = {
    pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
    approved: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
    rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
    cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-muted-foreground/20', Icon: Ban },
  };
  const { label, className, Icon } = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function formatRange(leave: DoctorLeave): string {
  const start = formatDate(leave.leaveDate);
  if (!leave.endDate || leave.endDate === leave.leaveDate) return start;
  return `${start} – ${formatDate(leave.endDate)}`;
}

function parseUtcTime(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function durationLabel(leave: DoctorLeave): string {
  const s = parseUtcTime(leave.startTime);
  const e = parseUtcTime(leave.endTime);
  if (!s && !e) return 'Full day';
  if (s === '00:00' && e === '13:00') return 'Half day · morning';
  if (s === '13:00' && e === '23:59') return 'Half day · afternoon';
  return `${s ?? '??'} – ${e ?? '??'}`;
}

export default function HRDoctorLeavesPage() {
  const [status, setStatus] = useState<'all' | DoctorLeaveStatus>('pending');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rejectLeave, setRejectLeave] = useState<DoctorLeave | null>(null);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (status !== 'all') f.status = status;
    if (fromDate) f.fromDate = fromDate;
    if (toDate) f.toDate = toDate;
    return f;
  }, [status, fromDate, toDate]);

  const { data, isLoading, refetch } = useAllDoctorLeaves(filters as any);
  const leaves = data?.data ?? [];

  const approveMutation = useApproveDoctorLeave();

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success('Leave approved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Leave Requests"
        description="Review, approve, or reject leave requests submitted by doctors."
      />

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus((v as any) ?? 'pending')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        {(fromDate || toDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); }}>
            Clear dates
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden ring-1 ring-foreground/5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium">No leave requests match the filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Doctor</th>
                <th className="text-left px-4 py-2 font-medium">Department</th>
                <th className="text-left px-4 py-2 font-medium">Dates</th>
                <th className="text-left px-4 py-2 font-medium">Duration</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Reason</th>
                <th className="text-left px-4 py-2 font-medium">Requested</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {leave.doctor ? `Dr. ${leave.doctor.user.firstName} ${leave.doctor.user.lastName}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {leave.doctor?.department?.name || '-'}
                  </td>
                  <td className="px-4 py-3">{formatRange(leave)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{durationLabel(leave)}</td>
                  <td className="px-4 py-3 capitalize">{leave.leaveType}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={leave.reason ?? ''}>
                    {leave.reason || '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(leave.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {leave.status === 'pending' ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(leave.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectLeave(leave)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {leave.approver ? `by ${leave.approver.firstName} ${leave.approver.lastName}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RejectDialog
        leave={rejectLeave}
        onClose={() => setRejectLeave(null)}
        onSubmitted={() => { refetch(); }}
      />
    </div>
  );
}

function RejectDialog({
  leave, onClose, onSubmitted,
}: {
  leave: DoctorLeave | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState('');
  const rejectMutation = useRejectDoctorLeave();

  const handleReject = async () => {
    if (!leave) return;
    try {
      await rejectMutation.mutateAsync({ leaveId: leave.id, reason: reason.trim() || undefined });
      toast.success('Leave rejected');
      setReason('');
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject');
    }
  };

  return (
    <Dialog open={!!leave} onOpenChange={(v) => { if (!v) { setReason(''); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Leave Request</DialogTitle>
          <DialogDescription>
            Optionally add a reason that will be visible to the doctor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="rejectReason">Reason (optional)</Label>
          <Textarea
            id="rejectReason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="E.g. Conflicting on-call schedule"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={rejectMutation.isPending}>Cancel</Button>
          <Button
            onClick={handleReject}
            disabled={rejectMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {rejectMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting…</>
            ) : (
              'Confirm Reject'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
