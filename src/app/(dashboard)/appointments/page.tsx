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
import type { Appointment } from '@/types';

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search, 400);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get('/appointments', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      setAppointments(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      toast.error('Failed to fetch appointments');
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const columns: Column<Appointment>[] = [
    {
      key: 'appointmentDate',
      label: 'Date',
      sortable: true,
      render: (appt) => {
        try {
          return formatDate(appt.appointmentDate);
        } catch {
          return appt.appointmentDate;
        }
      },
    },
    {
      key: 'time',
      label: 'Time',
      render: (appt) => `${appt.startTime} - ${appt.endTime}`,
    },
    {
      key: 'patient',
      label: 'Patient',
      render: (appt) => (
        <button
          onClick={() => router.push(`/patients/${appt.patientId}`)}
          className="text-primary hover:underline font-medium"
        >
          {appt.patient?.firstName} {appt.patient?.lastName}
        </button>
      ),
    },
    {
      key: 'doctor',
      label: 'Doctor',
      render: (appt) =>
        appt.doctor?.user
          ? `Dr. ${appt.doctor.user.firstName} ${appt.doctor.user.lastName}`
          : '-',
    },
    {
      key: 'type',
      label: 'Type',
      render: (appt) => (
        <span className="capitalize">{appt.type?.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (appt) => <StatusBadge status={appt.status} />,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-[80px]',
      render: (appt) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/appointments/${appt.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Manage and schedule patient appointments"
        action={
          <Button onClick={() => router.push('/appointments/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Appointment
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
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="in_consultation">In Consultation</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns as any}
        data={appointments as any}
        searchPlaceholder="Search appointments..."
        onSearch={(q) => { setSearch(q); setPage(1); }}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No appointments found."
      />
    </div>
  );
}
