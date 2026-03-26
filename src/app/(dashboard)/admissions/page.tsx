'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDebounce } from '@/hooks/use-debounce';
import apiClient from '@/lib/api-client';
import type { Admission } from '@/types';

export default function AdmissionsPage() {
  const router = useRouter();
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  // Discharge dialog state
  const [dischargeDialogOpen, setDischargeDialogOpen] = useState(false);
  const [dischargeTarget, setDischargeTarget] = useState<Admission | null>(null);
  const [isDischarging, setIsDischarging] = useState(false);

  const fetchAdmissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/clinical/admissions', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setAdmissions(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch admissions');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchAdmissions();
  }, [fetchAdmissions]);

  const handleDischarge = async () => {
    if (!dischargeTarget) return;
    setIsDischarging(true);
    try {
      await apiClient.patch(`/clinical/admissions/${dischargeTarget.id}/discharge`, {
        dischargeDate: new Date().toISOString(),
      });
      toast.success('Patient discharged successfully');
      setDischargeDialogOpen(false);
      setDischargeTarget(null);
      fetchAdmissions();
    } catch {
      toast.error('Failed to discharge patient');
    } finally {
      setIsDischarging(false);
    }
  };

  const columns: Column<Admission>[] = [
    {
      key: 'patient',
      label: 'Patient Name',
      sortable: true,
      render: (admission) => (
        <button
          onClick={() => router.push(`/patients/${admission.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {admission.patient?.firstName} {admission.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'admissionDate',
      label: 'Admission Date',
      sortable: true,
      render: (admission) => {
        try {
          return formatDate(admission.admissionDate);
        } catch {
          return admission.admissionDate;
        }
      },
    },
    {
      key: 'wardBed',
      label: 'Ward / Bed',
      render: (admission) => (
        <div className="flex items-center gap-1.5">
          <span>{admission.ward?.name || '-'}</span>
          {admission.bed?.bedNumber && (
            <>
              <span className="text-muted-foreground">/</span>
              <Badge variant="outline" className="font-mono text-xs">
                {admission.bed.bedNumber}
              </Badge>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'doctor',
      label: 'Doctor',
      render: (admission) =>
        admission.doctor?.user
          ? `Dr. ${admission.doctor.user.firstName} ${admission.doctor.user.lastName}`
          : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (admission) => <StatusBadge status={admission.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[140px]',
      render: (admission) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/admissions/${admission.id}`)}
          >
            View
          </Button>
          {admission.status === 'admitted' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={() => {
                setDischargeTarget(admission);
                setDischargeDialogOpen(true);
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions"
        description="Manage patient admissions and discharges"
        action={
          <Button onClick={() => router.push('/admissions/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Admission
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
              <SelectItem value="admitted">Admitted</SelectItem>
              <SelectItem value="discharged">Discharged</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
              <SelectItem value="absconded">Absconded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={admissions as any}
        searchPlaceholder="Search admissions by patient name or MRN..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No admissions found."
      />

      {/* Discharge Confirmation Dialog */}
      <Dialog open={dischargeDialogOpen} onOpenChange={setDischargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discharge Patient</DialogTitle>
            <DialogDescription>
              Are you sure you want to discharge{' '}
              <span className="font-medium text-foreground">
                {dischargeTarget?.patient?.firstName} {dischargeTarget?.patient?.lastName}
              </span>
              ? This action will mark the admission as discharged and free up the assigned bed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDischargeDialogOpen(false);
                setDischargeTarget(null);
              }}
              disabled={isDischarging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDischarge}
              disabled={isDischarging}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isDischarging ? 'Discharging...' : 'Confirm Discharge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
