'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import { fullName } from '@/lib/person-name';

interface ImagingRequest {
  id: string;
  patientId: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  doctorId: string;
  doctor: { user: { firstName: string; lastName: string } };
  modality: string;
  bodyPart: string;
  clinicalIndication?: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const modalityColors: Record<string, string> = {
  xray: 'bg-sky-100 text-sky-800',
  ct: 'bg-violet-100 text-violet-800',
  mri: 'bg-indigo-100 text-indigo-800',
  ultrasound: 'bg-teal-100 text-teal-800',
  mammography: 'bg-pink-100 text-pink-800',
  fluoroscopy: 'bg-orange-100 text-orange-800',
  pet: 'bg-amber-100 text-amber-800',
  dexa: 'bg-lime-100 text-lime-800',
};

export default function ImagingPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ImagingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/imaging/requests', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setRequests(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch imaging requests');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const columns: Column<ImagingRequest>[] = [
    {
      key: 'patient',
      label: 'Patient Name',
      render: (req) => (
        <button
          onClick={() => router.push(`/patients/${req.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {req.patient?.firstName} {req.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'modality',
      label: 'Modality',
      render: (req) => {
        const key = req.modality?.toLowerCase();
        const colorClass = modalityColors[key] || 'bg-secondary text-secondary-foreground';
        return (
          <Badge className={`font-medium border-0 ${colorClass}`}>
            {req.modality?.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'bodyPart',
      label: 'Body Part',
      render: (req) => (
        <span className="capitalize">{req.bodyPart?.replace(/_/g, ' ') || '-'}</span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (req) => <StatusBadge status={req.priority} />,
    },
    {
      key: 'doctor',
      label: 'Ordered By',
      render: (req) =>
        req.doctor?.user
          ? `Dr. ${fullName(req.doctor.user)}`
          : '-',
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (req) => {
        try {
          return formatDate(req.createdAt);
        } catch {
          return req.createdAt;
        }
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (req) => <StatusBadge status={req.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (req) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/imaging/${req.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imaging"
        description="Manage radiology and imaging orders"
        action={
          <Button onClick={() => router.push('/imaging/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Request
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
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={requests as any}
        searchPlaceholder="Search imaging requests..."
        onSearch={(q: string) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No imaging requests found."
      />
    </div>
  );
}
