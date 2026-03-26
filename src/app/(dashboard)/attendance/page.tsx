'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface AttendanceRecord {
  id: string;
  staffId: string;
  staff: {
    user: { firstName: string; lastName: string };
    employeeId: string;
    department?: { name: string };
  };
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'present' | 'absent' | 'half_day' | 'on_leave' | 'late';
  shiftType?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/hr/attendance', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setRecords(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch attendance records');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'staff',
      label: 'Staff Name',
      sortable: true,
      render: (rec) => (
        <div>
          <span className="font-medium">
            {rec.staff?.user?.firstName} {rec.staff?.user?.lastName}
          </span>
          {rec.staff?.employeeId && (
            <span className="text-xs text-muted-foreground ml-2">
              ({rec.staff.employeeId})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      render: (rec) => rec.staff?.department?.name || '-',
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (rec) => {
        try {
          return formatDate(rec.date);
        } catch {
          return rec.date;
        }
      },
    },
    {
      key: 'checkIn',
      label: 'Check In',
      render: (rec) => rec.checkIn || '-',
    },
    {
      key: 'checkOut',
      label: 'Check Out',
      render: (rec) => rec.checkOut || '-',
    },
    {
      key: 'hoursWorked',
      label: 'Hours',
      render: (rec) => {
        if (!rec.hoursWorked) return '-';
        return (
          <span>
            {rec.hoursWorked.toFixed(1)}h
            {rec.overtimeHours ? (
              <span className="text-amber-600 text-xs ml-1">
                +{rec.overtimeHours.toFixed(1)} OT
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (rec) => <StatusBadge status={rec.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (rec) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/hr`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Track staff attendance and schedules"
        action={
          <Button onClick={() => router.push('/attendance/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Record Attendance
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="half_day">Half Day</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="late">Late</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={records as any}
        searchPlaceholder="Search by staff name or employee ID..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No attendance records found."
      />
    </div>
  );
}
