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
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import type { Visit } from '@/types';
import { fullName } from '@/lib/person-name';

const visitTypeLabels: Record<string, string> = {
  op: 'Outpatient',
  ip: 'Inpatient',
};

export default function VisitsPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visitTypeFilter, setVisitTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchVisits = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/clinical/visits', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          visitType: visitTypeFilter !== 'all' ? visitTypeFilter : undefined,
        },
      });
      setVisits(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch visits');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, visitTypeFilter]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const columns: Column<Visit>[] = [
    {
      key: 'patient',
      label: 'Patient Name',
      render: (visit) => (
        <button
          onClick={() => router.push(`/patients/${visit.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {visit.patient?.firstName} {visit.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'visitType',
      label: 'Visit Type',
      render: (visit) => (
        <Badge variant="secondary" className="capitalize">
          {visitTypeLabels[visit.visitType] || visit.visitType}
        </Badge>
      ),
    },
    {
      key: 'visitDate',
      label: 'Visit Date',
      sortable: true,
      render: (visit) => {
        try {
          return formatDate(visit.visitDate);
        } catch {
          return visit.visitDate;
        }
      },
    },
    {
      key: 'doctor',
      label: 'Doctor',
      render: (visit) =>
        visit.doctor?.user
          ? `Dr. ${fullName(visit.doctor.user)}`
          : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (visit) => <StatusBadge status={visit.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (visit) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/visits/${visit.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visits"
        description="Manage patient visits and consultations"
        action={
          <Button onClick={() => router.push('/visits/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Visit
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
              <SelectItem value="discharged">Discharged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={visitTypeFilter} onValueChange={(val) => { setVisitTypeFilter(val ?? 'all'); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="op">Outpatient</SelectItem>
            <SelectItem value="ip">Inpatient</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns as any}
        data={visits as any}
        searchPlaceholder="Search visits by patient name or MRN..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No visits found."
      />
    </div>
  );
}
