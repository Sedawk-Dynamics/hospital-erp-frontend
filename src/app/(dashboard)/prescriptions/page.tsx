'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { fullName } from '@/lib/person-name';

interface Prescription {
  id: string;
  patientId: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  doctorId: string;
  doctor: { user: { firstName: string; lastName: string } };
  visitId?: string;
  items: any[];
  status: 'pending' | 'dispensed' | 'partially_dispensed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PrescriptionsPage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchPrescriptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/prescriptions', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setPrescriptions(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch prescriptions');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const columns: Column<Prescription>[] = [
    {
      key: 'patient',
      label: 'Patient Name',
      render: (rx) => (
        <button
          onClick={() => router.push(`/patients/${rx.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {rx.patient?.firstName} {rx.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'doctor',
      label: 'Prescribed By',
      render: (rx) =>
        rx.doctor?.user
          ? `Dr. ${fullName(rx.doctor.user)}`
          : '-',
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (rx) => {
        try {
          return formatDate(rx.createdAt);
        } catch {
          return rx.createdAt;
        }
      },
    },
    {
      key: 'items',
      label: 'Items Count',
      render: (rx) => rx.items?.length ?? 0,
    },
    {
      key: 'status',
      label: 'Status',
      render: (rx) => <StatusBadge status={rx.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (rx) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/prescriptions/${rx.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescriptions"
        description="Manage patient prescriptions and medications"
        action={
          <Button onClick={() => router.push('/prescriptions/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Prescription
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="dispensed">Dispensed</SelectItem>
              <SelectItem value="partially_dispensed">Partially Dispensed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={prescriptions as any}
        searchPlaceholder="Search prescriptions..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No prescriptions found."
      />
    </div>
  );
}
