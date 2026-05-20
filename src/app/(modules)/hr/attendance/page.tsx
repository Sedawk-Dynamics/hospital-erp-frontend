'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { useAttendance, useRecordAttendance, useStaffProfiles, type AttendanceStatus } from '@/hooks/use-hr';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_TONE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  absent: 'bg-rose-100 text-rose-700 border-rose-200',
  half_day: 'bg-amber-100 text-amber-700 border-amber-200',
  on_leave: 'bg-violet-100 text-violet-700 border-violet-200',
  holiday: 'bg-sky-100 text-sky-700 border-sky-200',
};

export default function HrAttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [status, setStatus] = useState<AttendanceStatus | ''>('');

  const { data, isLoading } = useAttendance({
    fromDate,
    toDate,
    status: status || undefined,
    limit: 100,
  });

  const rows = (data?.data ?? []) as Array<{
    id: string;
    date: string;
    checkIn?: string | null;
    checkOut?: string | null;
    status: AttendanceStatus;
    source: string;
    overtimeHours: number | string;
    staff?: { employeeId?: string | null; user?: { firstName: string; lastName?: string | null } };
  }>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Attendance</h1>
          <p className="text-sm text-on-surface-variant">Daily records, manual entry, overtime tracking.</p>
        </div>
        <RecordAttendanceDialog />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <select
                className="block rounded-md border px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as AttendanceStatus | '')}
              >
                <option value="">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="on_leave">On Leave</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">No records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Check In</th>
                    <th className="px-3 py-2">Check Out</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">OT (hrs)</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 py-2">
                        {r.staff?.user?.firstName} {r.staff?.user?.lastName ?? ''}
                        {r.staff?.employeeId && <span className="ml-1.5 text-xs text-on-surface-variant">({r.staff.employeeId})</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={STATUS_TONE[r.status]}>{r.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">{String(r.overtimeHours)}</td>
                      <td className="px-3 py-2 text-xs">{r.source}</td>
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

function RecordAttendanceDialog() {
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [notes, setNotes] = useState('');

  const { data: staffData } = useStaffProfiles({ status: 'active', limit: 200 });
  const staff = (staffData?.data ?? []) as Array<{ id: string; employeeId?: string | null; user?: { firstName: string; lastName?: string | null } }>;
  const record = useRecordAttendance();

  const submit = () => {
    if (!staffId) return toast.error('Pick a staff member');
    record.mutate(
      {
        staffId,
        date,
        status,
        checkIn: checkIn ? new Date(`${date}T${checkIn}`).toISOString() : undefined,
        checkOut: checkOut ? new Date(`${date}T${checkOut}`).toISOString() : undefined,
        overtimeHours: Number(overtimeHours) || 0,
        notes: notes || undefined,
        source: 'manual',
      },
      {
        onSuccess: () => {
          toast.success('Attendance recorded');
          setOpen(false);
          setStaffId(''); setNotes(''); setCheckIn(''); setCheckOut(''); setOvertimeHours('0');
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast.error(msg ?? 'Could not record attendance');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-3.5 w-3.5 mr-1" />Record
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual Attendance Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Staff</Label>
            <select className="block w-full rounded-md border px-3 py-2 text-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName ?? ''} {s.employeeId ? `(${s.employeeId})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <select className="block w-full rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="on_leave">On Leave</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Check In</Label>
              <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Check Out</Label>
              <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Overtime (hrs)</Label>
              <Input type="number" step="0.25" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={record.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
