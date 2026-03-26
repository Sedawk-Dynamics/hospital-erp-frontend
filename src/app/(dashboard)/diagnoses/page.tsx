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
import { Badge } from '@/components/ui/badge';

interface Diagnosis {
  id: string;
  patientId: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  visitId?: string;
  icdCode?: string;
  description: string;
  type: 'primary' | 'secondary' | 'differential';
  severity?: 'mild' | 'moderate' | 'severe' | 'critical';
  status: 'active' | 'resolved' | 'chronic' | 'recurrence';
  onsetDate?: string;
  resolvedDate?: string;
  notes?: string;
  diagnosedById: string;
  diagnosedBy?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export default function DiagnosesPage() {
  const router = useRouter();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchDiagnoses = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/clinical/diagnoses', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
        },
      });
      setDiagnoses(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch diagnoses');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    fetchDiagnoses();
  }, [fetchDiagnoses]);

  const columns: Column<Diagnosis>[] = [
    {
      key: 'patient',
      label: 'Patient',
      sortable: true,
      render: (diag) => (
        <button
          onClick={() => router.push(`/patients/${diag.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {diag.patient?.firstName} {diag.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'icdCode',
      label: 'ICD Code',
      render: (diag) => diag.icdCode ? (
        <Badge variant="outline" className="font-mono text-xs">
          {diag.icdCode}
        </Badge>
      ) : '-',
    },
    {
      key: 'description',
      label: 'Diagnosis',
      render: (diag) => (
        <span className="max-w-[250px] truncate block" title={diag.description}>
          {diag.description}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (diag) => (
        <Badge variant="secondary" className="capitalize">
          {diag.type}
        </Badge>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (diag) => diag.severity ? (
        <StatusBadge status={diag.severity} />
      ) : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (diag) => <StatusBadge status={diag.status} />,
    },
    {
      key: 'onsetDate',
      label: 'Onset Date',
      render: (diag) => {
        if (!diag.onsetDate) return '-';
        try {
          return formatDate(diag.onsetDate);
        } catch {
          return diag.onsetDate;
        }
      },
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (diag) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/patients/${diag.patientId}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnoses"
        description="Manage patient diagnoses and medical conditions"
        action={
          <Button onClick={() => router.push('/diagnoses/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Diagnosis
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="chronic">Chronic</SelectItem>
              <SelectItem value="recurrence">Recurrence</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val ?? 'all'); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="secondary">Secondary</SelectItem>
              <SelectItem value="differential">Differential</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={diagnoses as any}
        searchPlaceholder="Search by patient name, ICD code, or diagnosis..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No diagnoses found."
      />
    </div>
  );
}
