'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Users, UserCheck, CalendarOff, UserPlus, 
  CheckCircle2, XCircle, ClipboardList,
  ShieldAlert, CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';

interface StaffStats {
  total: number;
  active: number;
  onLeave: number;
  newThisMonth: number;
}

interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  total: number;
}

interface LeaveRequest {
  id: string;
  staffName: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
}

interface LicenseExpiry {
  id: string;
  staffName: string;
  licenseType: string;
  licenseNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export function HRDashboard() {
  const queryClient = useQueryClient();

  const { data: staffStats, isLoading: statsLoading } = useQuery({
    queryKey: ['hr', 'staff-stats'],
    queryFn: async () => {
      try {
        const response = await apiGet<StaffStats>('/hr/staff', {
          params: { summary: true },
        });
        return response.data;
      } catch {
        return { total: 0, active: 0, onLeave: 0, newThisMonth: 0 } as StaffStats;
      }
    },
  });

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['hr', 'attendance-summary'],
    queryFn: async () => {
      try {
        const response = await apiGet<AttendanceSummary>('/hr/attendance/summary', {
          params: { date: toInputDateStr() },
        });
        return response.data;
      } catch {
        return { present: 0, absent: 0, late: 0, total: 0 } as AttendanceSummary;
      }
    },
  });

  const { data: leaveRequests, isLoading: leavesLoading } = useQuery({
    queryKey: ['hr', 'leave-requests'],
    queryFn: async () => {
      const response = await apiGet<LeaveRequest[]>('/hr/leaves', {
        params: { status: 'pending', limit: 15 },
      });
      return response.data;
    },
  });

  const { data: expiringLicenses, isLoading: licensesLoading } = useQuery({
    queryKey: ['hr', 'expiring-licenses'],
    queryFn: async () => {
      const response = await apiGet<LicenseExpiry[]>('/hr/licenses/expiring', {
        params: { days: 30, limit: 10 },
      });
      return response.data;
    },
  });

  const leaveActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approved' | 'rejected' }) => {
      await apiPatch(`/hr/leaves/${id}`, { status: action });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr'] });
      toast.success(`Leave request ${variables.action}`);
    },
    onError: () => {
      toast.error('Failed to update leave request');
    },
  });

  const staff = staffStats ?? { total: 0, active: 0, onLeave: 0, newThisMonth: 0 };
  const attend = attendance ?? { present: 0, absent: 0, late: 0, total: 0 };
  const leaves = leaveRequests ?? [];
  const licenses = expiringLicenses ?? [];

  const stats = [
    { label: 'Total Staff', value: staff.total, icon: Users },
    { label: 'Active', value: staff.active, icon: UserCheck },
    { label: 'On Leave', value: staff.onLeave, icon: CalendarOff },
    { label: 'New This Month', value: staff.newThisMonth, icon: UserPlus },
  ];

  const attendancePercent = attend.total > 0 ? Math.round((attend.present / attend.total) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">HR Dashboard</h1>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
            Staff management, attendance, and leave tracking
          </p>
        </div>
      </div>

      {/* Staff Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary transition-all duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">
                  {statsLoading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Attendance Summary */}
      <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-container">
          <h2 className="font-headline text-lg font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="h-4 w-4" />
            </div>
            Today&apos;s Attendance
          </h2>
        </div>
        <div className="p-4">
          {attendanceLoading ? (
            <div className="flex justify-center py-4">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary text-center">
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Present</p>
                <p className="font-headline text-3xl font-extrabold text-primary">{attend.present}</p>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary text-center">
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Absent</p>
                <p className="font-headline text-3xl font-extrabold text-error">{attend.absent}</p>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary text-center">
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Late</p>
                <p className="font-headline text-3xl font-extrabold text-secondary">{attend.late}</p>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary text-center">
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Attendance Rate</p>
                <p className={cn(
                  'font-headline text-3xl font-extrabold',
                  attendancePercent >= 90 ? 'text-primary' : attendancePercent >= 70 ? 'text-secondary' : 'text-error',
                )}>
                  {attendancePercent}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Leave Requests */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-container">
            <h2 className="font-headline text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </div>
              Pending Leave Requests
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Staff</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Type</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Dates</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold">Days</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {leavesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center font-label text-on-surface-variant">
                      No pending leave requests.
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-label text-sm font-bold">{leave.staffName}</p>
                          <p className="font-label text-[10px] text-on-surface-variant">{leave.department}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize">
                          {leave.leaveType?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                        {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                      </td>
                      <td className="px-4 py-3 text-center font-label text-sm font-bold">{leave.days}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                            disabled={leaveActionMutation.isPending}
                            onClick={() => leaveActionMutation.mutate({ id: leave.id, action: 'approved' })}
                            title="Approve"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-error hover:bg-error-container"
                            disabled={leaveActionMutation.isPending}
                            onClick={() => leaveActionMutation.mutate({ id: leave.id, action: 'rejected' })}
                            title="Reject"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiring Licenses */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-container">
            <h2 className="font-headline text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShieldAlert className="h-4 w-4" />
              </div>
              Upcoming License Expirations
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest border-b border-surface-container">
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Staff</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">License</th>
                  <th className="px-4 pb-4 pt-5 text-left font-semibold">Expiry</th>
                  <th className="px-4 pb-4 pt-5 text-center font-semibold">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container/50">
                {licensesLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </td>
                  </tr>
                ) : licenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center font-label text-on-surface-variant">
                      No licenses expiring in the next 30 days.
                    </td>
                  </tr>
                ) : (
                  licenses.map((lic) => (
                    <tr key={lic.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-label text-sm font-bold">{lic.staffName}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-label text-sm">{lic.licenseType}</p>
                          <p className="font-label text-[10px] text-on-surface-variant">{lic.licenseNumber}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-label text-[10px] text-on-surface-variant">
                        {formatDate(lic.expiryDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                            lic.daysUntilExpiry <= 7
                              ? 'bg-error-container text-on-error-container'
                              : lic.daysUntilExpiry <= 14
                                ? 'bg-secondary/10 text-secondary'
                                : 'bg-primary/10 text-primary',
                          )}
                        >
                          {lic.daysUntilExpiry}d
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
