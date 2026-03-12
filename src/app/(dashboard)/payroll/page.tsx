'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface PayrollRecord {
  id: string;
  staffId: string;
  staff: {
    user: { firstName: string; lastName: string };
    employeeId: string;
    department?: { name: string };
    designation?: string;
  };
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  overtimePay: number;
  netSalary: number;
  grossSalary: number;
  status: 'draft' | 'pending' | 'approved' | 'paid';
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PayrollPage() {
  const router = useRouter();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
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
      const { data } = await apiClient.get('/hr/payroll', {
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
      toast.error('Failed to fetch payroll records');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const columns: Column<PayrollRecord>[] = [
    {
      key: 'staff',
      label: 'Employee',
      sortable: true,
      render: (rec) => (
        <div>
          <span className="font-medium">
            {rec.staff?.user?.firstName} {rec.staff?.user?.lastName}
          </span>
          <div className="text-xs text-muted-foreground">
            {rec.staff?.employeeId}
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      render: (rec) => rec.staff?.department?.name || '-',
    },
    {
      key: 'period',
      label: 'Period',
      render: (rec) => (
        <Badge variant="outline">
          {monthNames[rec.month - 1]} {rec.year}
        </Badge>
      ),
    },
    {
      key: 'basicSalary',
      label: 'Basic',
      render: (rec) => formatCurrency(rec.basicSalary),
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (rec) => (
        <span className="text-emerald-600">+{formatCurrency(rec.allowances)}</span>
      ),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (rec) => (
        <span className="text-red-600">-{formatCurrency(rec.deductions)}</span>
      ),
    },
    {
      key: 'netSalary',
      label: 'Net Salary',
      render: (rec) => (
        <span className="font-semibold">{formatCurrency(rec.netSalary)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (rec) => <StatusBadge status={rec.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[100px]',
      render: (rec) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/payroll/${rec.id}`)}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Manage staff payroll and compensation"
        action={
          <Button onClick={() => router.push('/payroll/generate')} className="gap-2">
            <Plus className="h-4 w-4" />
            Generate Payroll
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
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={records as any}
        searchPlaceholder="Search by employee name or ID..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No payroll records found."
      />
    </div>
  );
}
