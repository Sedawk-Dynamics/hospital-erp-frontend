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
import type { Patient } from '@/types';
import { formatDate } from '@/lib/date-utils';

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/patients', {
        params: { page, limit: 10, search: debouncedSearch || undefined },
      });
      setPatients(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch patients');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const columns: Column<Patient>[] = [
    {
      key: 'mrn',
      label: 'MRN',
      sortable: true,
      render: (patient) => (
        <span className="font-mono text-sm">{patient.mrn}</span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (patient) => (
        <button
          onClick={() => router.push(`/patients/${patient.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {patient.firstName} {patient.lastName}
        </button>
      ),
    },
    {
      key: 'gender',
      label: 'Gender',
      render: (patient) => (
        <span className="capitalize">{patient.gender}</span>
      ),
    },
    {
      key: 'dateOfBirth',
      label: 'Date of Birth',
      render: (patient) => {
        try {
          return formatDate(patient.dateOfBirth);
        } catch {
          return patient.dateOfBirth || '-';
        }
      },
    },
    {
      key: 'phone',
      label: 'Phone',
    },
    {
      key: 'bloodGroup',
      label: 'Blood Group',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (patient) => (
        <StatusBadge status={patient.isActive ? 'active' : 'inactive'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description="Manage patient records and information"
        action={
          <Button onClick={() => router.push('/patients/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Patient
          </Button>
        }
      />
      <DataTable
        columns={columns as any}
        data={patients as any}
        searchPlaceholder="Search patients by name, MRN, or phone..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No patients found. Add your first patient to get started."
      />
    </div>
  );
}
