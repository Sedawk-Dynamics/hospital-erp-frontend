'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface StaffProfile {
  id: string;
  userId: string;
  user: { firstName: string; lastName: string; email: string; phone?: string };
  employeeId: string;
  departmentId?: string;
  department?: { name: string };
  designation?: string;
  joinDate: string;
  contractType?: string;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  createdAt: string;
  updatedAt: string;
}

export default function HRPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/hr/staff', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          departmentId: departmentFilter !== 'all' ? departmentFilter : undefined,
        },
      });
      setStaff(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch staff profiles');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, departmentFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/departments', {
        params: { limit: 100 },
      });
      setDepartments(data.data || []);
    } catch {
      // Silently fail - departments filter just won't populate
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const columns: Column<StaffProfile>[] = [
    {
      key: 'name',
      label: 'Staff Name',
      sortable: true,
      render: (member) => (
        <button
          onClick={() => router.push(`/hr/${member.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {member.user?.firstName} {member.user?.lastName}
        </button>
      ),
    },
    {
      key: 'employeeId',
      label: 'Employee ID',
      render: (member) => (
        <Badge variant="outline" className="font-mono">
          {member.employeeId}
        </Badge>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      render: (member) => member.department?.name || '-',
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (member) => member.designation || '-',
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (member) => member.user?.phone || '-',
    },
    {
      key: 'joinDate',
      label: 'Join Date',
      sortable: true,
      render: (member) => {
        try {
          return format(new Date(member.joinDate), 'MMM dd, yyyy');
        } catch {
          return member.joinDate || '-';
        }
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (member) => <StatusBadge status={member.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (member) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/hr/${member.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"
        description="Manage hospital staff and human resources"
        action={
          <Button onClick={() => router.push('/hr/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Staff
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val ?? 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select
          value={departmentFilter}
          onValueChange={(val) => {
            setDepartmentFilter(val ?? 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns as any}
        data={staff as any}
        searchPlaceholder="Search staff by name, employee ID, or phone..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No staff profiles found. Add your first staff member to get started."
      />
    </div>
  );
}
