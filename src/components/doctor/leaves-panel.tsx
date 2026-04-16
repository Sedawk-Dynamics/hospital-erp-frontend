'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import {
  Plus, Loader2, CheckCircle2, XCircle, Clock, Ban, X, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useDoctorLeaves,
  useCancelDoctorLeave,
  type DoctorLeave,
  type DoctorLeaveStatus,
} from '@/hooks/use-doctor-leaves';

const STATUS_FILTERS: { value: 'all' | DoctorLeaveStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
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
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', className)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
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

function formatLeaveRange(leave: DoctorLeave): string {
  const start = formatDate(leave.leaveDate);
  if (!leave.endDate || leave.endDate === leave.leaveDate) return start;
  return `${start} – ${formatDate(leave.endDate)}`;
}

function durationLabel(leave: DoctorLeave): string {
  const s = parseUtcTime(leave.startTime);
  const e = parseUtcTime(leave.endTime);
  if (!s && !e) return 'Full day';
  if (s === '00:00' && e === '13:00') return 'Morning';
  if (s === '13:00' && e === '23:59') return 'Afternoon';
  return `${s ?? '??'}-${e ?? '??'}`;
}

interface Props {
  doctorId: string;
  onApplyClick: () => void;
}

export function LeavesPanel({ doctorId, onApplyClick }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | DoctorLeaveStatus>('all');

  const filters = useMemo(
    () => (statusFilter === 'all' ? undefined : { status: statusFilter }),
    [statusFilter],
  );

  const { data: leaves = [], isLoading } = useDoctorLeaves(doctorId, filters);
  const cancelMutation = useCancelDoctorLeave();

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const l of leaves) {
      if (l.status === 'pending') c.pending++;
      else if (l.status === 'approved') c.approved++;
      else if (l.status === 'rejected') c.rejected++;
    }
    return c;
  }, [leaves]);

  const handleCancel = async (leaveId: string) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await cancelMutation.mutateAsync(leaveId);
      toast.success('Leave cancelled');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel');
    }
  };

  return (
    <div className="rounded-xl border bg-card flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2 bg-muted/20">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            Leave Requests
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {counts.pending} pending · {counts.approved} approved
          </p>
        </div>
        <Button size="sm" onClick={onApplyClick}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Apply
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : leaves.length === 0 ? (
          <div className="py-12 text-center px-4">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs text-muted-foreground">No leave requests{statusFilter !== 'all' ? ` (${statusFilter})` : ''}.</p>
            <Button variant="ghost" size="sm" onClick={onApplyClick} className="mt-2">
              <Plus className="h-3 w-3 mr-1" />
              Apply for leave
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {leaves.map((leave) => (
              <div key={leave.id} className="px-3 py-2.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{formatLeaveRange(leave)}</p>
                    <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                      {leave.leaveType} · {durationLabel(leave)}
                    </p>
                    {leave.reason && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {leave.reason}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={leave.status} />
                </div>
                {(leave.status === 'pending' || leave.status === 'approved') && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={() => handleCancel(leave.id)}
                      disabled={cancelMutation.isPending}
                      className="text-[10px] text-muted-foreground hover:text-red-600 transition-colors inline-flex items-center gap-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
