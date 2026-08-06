'use client';

import { useState } from 'react';
import { formatDateTimeAmPm, toInputDateStr } from '@/lib/date-utils';
import {
  Sun, Search, Plus, Calendar, Users, CheckCircle2, Clock, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { useAdmissions, type Admission } from '@/hooks/use-clinical';

const statCards = [
  { label: "Today's Patients", icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', key: 'total' },
  { label: 'In Progress', icon: Loader2, color: 'text-purple-600', bgColor: 'bg-purple-50', key: 'inProgress' },
  { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50', key: 'completed' },
  { label: 'Pending', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', key: 'pending' },
];

const columns: Column<Admission & Record<string, unknown>>[] = [
  {
    key: 'patient',
    label: 'Patient',
    render: (item) => (
      <div>
        <p className="font-medium text-foreground">
          {item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : '-'}
        </p>
        {item.patient?.uhid && (
          <p className="text-xs text-muted-foreground">{item.patient.uhid}</p>
        )}
      </div>
    ),
  },
  {
    key: 'procedure',
    label: 'Procedure',
    render: (item) => (
      <span className="font-medium">
        {(item.procedure as string) || (item.diagnosis as string) || '-'}
      </span>
    ),
  },
  {
    key: 'doctor',
    label: 'Doctor',
    render: (item) =>
      item.doctor?.user
        ? `Dr. ${item.doctor.user.firstName} ${item.doctor.user.lastName}`
        : '-',
  },
  {
    key: 'admissionDate',
    label: 'Time',
    sortable: true,
    render: (item) =>
      item.admissionDate
        ? formatDateTimeAmPm(item.admissionDate as string)
        : '-',
  },
  {
    key: 'status',
    label: 'Status',
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  {
    key: 'ward',
    label: 'Bay/Room',
    render: (item) => {
      const wardName = item.ward?.name || '-';
      const bedNum = item.bed?.bedNumber || '';
      return bedNum ? `${wardName} - ${bedNum}` : wardName;
    },
  },
];

export default function DayCareHomePage() {
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdmissions({
    page,
    limit: 20,
    search: search || undefined,
    date: selectedDate || undefined,
    status: undefined,
  });

  const admissions = (data?.data ?? []) as (Admission & Record<string, unknown>)[];
  const total = data?.meta?.total ?? 0;

  // A day-care patient signed off but still waiting on the bill is in progress.
  const inProgressCount = admissions.filter(
    (a) => a.status === 'in_progress' || a.status === 'admitted' || a.status === 'ready_to_discharge',
  ).length;
  const completedCount = admissions.filter((a) => a.status === 'completed' || a.status === 'discharged').length;
  const pendingCount = admissions.filter((a) => a.status === 'pending' || a.status === 'scheduled').length;

  const stats = {
    total,
    inProgress: inProgressCount,
    completed: completedCount,
    pending: pendingCount,
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Day Care Home"
        description="Manage day care admissions, procedures, and patient discharges"
        action={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Admission
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className={`bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 border-primary ${card.bgColor} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/80 p-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">{stats[card.key as keyof typeof stats]}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, procedure..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
            className="pl-9 w-[180px]"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={admissions}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={total}
        onPageChange={setPage}
        emptyMessage="No day care admissions found for today."
      />
    </div>
  );
}
