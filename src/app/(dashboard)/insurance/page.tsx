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

interface InsuranceClaim {
  id: string;
  claimNumber: string;
  patientId: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  policyId: string;
  policy?: { policyNumber: string; insurer?: { name: string } };
  claimAmount: number;
  approvedAmount?: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  diagnosisCode?: string;
  notes?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function InsurancePage() {
  const router = useRouter();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/insurance/claims', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setClaims(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch insurance claims');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const columns: Column<InsuranceClaim>[] = [
    {
      key: 'claimNumber',
      label: 'Claim #',
      sortable: true,
      render: (claim) => (
        <button
          onClick={() => router.push(`/insurance/${claim.id}`)}
          className="font-mono text-sm text-primary hover:underline font-medium"
        >
          {claim.claimNumber}
        </button>
      ),
    },
    {
      key: 'patient',
      label: 'Patient Name',
      render: (claim) => (
        <button
          onClick={() => router.push(`/patients/${claim.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {claim.patient?.firstName} {claim.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'insurer',
      label: 'Insurer',
      render: (claim) => claim.policy?.insurer?.name || '-',
    },
    {
      key: 'policyNumber',
      label: 'Policy Number',
      render: (claim) => (
        <span className="font-mono text-sm">
          {claim.policy?.policyNumber || '-'}
        </span>
      ),
    },
    {
      key: 'claimAmount',
      label: 'Claim Amount',
      sortable: true,
      render: (claim) => (
        <span className="font-medium">${claim.claimAmount?.toFixed(2) || '0.00'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (claim) => <StatusBadge status={claim.status} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (claim) => {
        try {
          return format(new Date(claim.createdAt), 'MMM dd, yyyy');
        } catch {
          return '-';
        }
      },
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (claim) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/insurance/${claim.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insurance & Claims"
        description="Manage insurance claims and providers"
        action={
          <Button onClick={() => router.push('/insurance/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Claim
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
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={claims as any}
        searchPlaceholder="Search claims by number or patient..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No insurance claims found."
      />
    </div>
  );
}
