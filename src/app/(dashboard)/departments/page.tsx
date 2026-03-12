'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';

interface DepartmentHeadUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headUserId: string | null;
  headUser: DepartmentHeadUser | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    wards: number;
  };
}

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/infrastructure/departments', {
        params: { page, limit: 10, search: debouncedSearch || undefined },
      });
      setDepartments(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch departments');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const columns: Column<Department>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (dept) => (
        <button
          onClick={() => router.push(`/departments/${dept.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {dept.name}
        </button>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      render: (dept) => (
        <span className="text-muted-foreground">{dept.code || '-'}</span>
      ),
    },
    {
      key: 'headUser',
      label: 'Head',
      render: (dept) =>
        dept.headUser
          ? `${dept.headUser.firstName} ${dept.headUser.lastName}`
          : '-',
    },
    {
      key: '_count',
      label: 'Wards Count',
      render: (dept) => dept._count?.wards ?? 0,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (dept) => (
        <StatusBadge status={dept.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (dept) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/departments/${dept.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage hospital departments and units"
        action={
          <Button onClick={() => router.push('/departments/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Department
          </Button>
        }
      />
      <DataTable
        columns={columns as any}
        data={departments as any}
        searchPlaceholder="Search departments by name or code..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No departments found."
      />
    </div>
  );
}
