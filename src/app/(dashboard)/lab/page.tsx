'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import type { LabOrder } from '@/types';

const labStatusVariant: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  sample_collected: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const priorityVariant: Record<string, 'default' | 'warning' | 'danger'> = {
  routine: 'default',
  urgent: 'warning',
  stat: 'danger',
};

export default function LabOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/lab/orders', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        },
      });
      setOrders(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch lab orders');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const columns: Column<LabOrder>[] = [
    {
      key: 'orderNumber',
      label: 'Order #',
      sortable: true,
      render: (order) => (
        <button
          onClick={() => router.push(`/lab/${order.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {order.orderNumber}
        </button>
      ),
    },
    {
      key: 'patient',
      label: 'Patient Name',
      render: (order) => (
        <button
          onClick={() => router.push(`/patients/${order.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {order.patient?.firstName} {order.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'doctor',
      label: 'Ordered By',
      render: (order) =>
        order.doctor?.user
          ? `Dr. ${order.doctor.user.firstName} ${order.doctor.user.lastName}`
          : '-',
    },
    {
      key: 'tests',
      label: 'Tests',
      render: (order) => {
        const tests = order.tests || [];
        if (tests.length === 0) return '-';
        if (tests.length === 1) return <Badge variant="secondary">{tests[0].name}</Badge>;
        return (
          <div className="flex items-center gap-1">
            <Badge variant="secondary">{tests[0].name}</Badge>
            <Badge variant="outline">+{tests.length - 1}</Badge>
          </div>
        );
      },
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (order) => (
        <StatusBadge
          status={order.priority}
          variant={priorityVariant[order.priority] || 'default'}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (order) => (
        <StatusBadge
          status={order.status}
          variant={labStatusVariant[order.status] || 'default'}
        />
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (order) => {
        try {
          return format(new Date(order.createdAt), 'MMM dd, yyyy');
        } catch {
          return order.createdAt;
        }
      },
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (order) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/lab/${order.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lab Orders"
        description="Manage laboratory test orders and results"
        action={
          <Button onClick={() => router.push('/lab/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Order
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sample_collected">Sample Collected</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={priorityFilter} onValueChange={(val) => { setPriorityFilter(val ?? 'all'); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="routine">Routine</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="stat">Stat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns as any}
        data={orders as any}
        searchPlaceholder="Search lab orders..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No lab orders found."
      />
    </div>
  );
}
