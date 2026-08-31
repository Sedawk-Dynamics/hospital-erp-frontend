'use client';

import { useState } from 'react';
import { formatDateTimeAmPm, toInputDateStr } from '@/lib/date-utils';
import {
  Search, Plus, Calendar, Users, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { useVisits, type Visit } from '@/hooks/use-clinical';
import { fullName } from '@/lib/person-name';

const statCards = [
  { label: 'Total Sessions', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', key: 'total' },
  { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50', key: 'completed' },
  { label: 'Pending', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', key: 'pending' },
  { label: 'Cancelled', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', key: 'cancelled' },
];

const columns: Column<Visit & Record<string, unknown>>[] = [
  {
    key: 'patient',
    label: 'Patient Name',
    render: (item) => (
      <div>
        <p className="font-medium text-foreground">
          {item.patient ? fullName(item.patient) : '-'}
        </p>
        {item.patient?.uhid && (
          <p className="text-xs text-muted-foreground">{item.patient.uhid}</p>
        )}
      </div>
    ),
  },
  {
    key: 'visitType',
    label: 'Session Type',
    render: (item) => (
      <span className="font-medium">
        {(item.visitType as string)?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Counselling'}
      </span>
    ),
  },
  {
    key: 'doctor',
    label: 'Counsellor',
    render: (item) =>
      item.doctor?.user
        ? fullName(item.doctor.user)
        : '-',
  },
  {
    key: 'visitDate',
    label: 'Time',
    sortable: true,
    render: (item) =>
      item.visitDate
        ? formatDateTimeAmPm(item.visitDate as string)
        : '-',
  },
  {
    key: 'status',
    label: 'Status',
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  {
    key: 'chiefComplaint',
    label: 'Notes',
    render: (item) => (
      <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
        {(item.chiefComplaint as string) || (item.notes as string) || '-'}
      </span>
    ),
  },
];

export default function CounsellorHomePage() {
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);

  const { data, isLoading } = useVisits({
    page,
    limit: 20,
    search: search || undefined,
    date: selectedDate || undefined,
  });

  const visits = (data?.data ?? []) as (Visit & Record<string, unknown>)[];
  const total = data?.meta?.total ?? 0;

  const completedCount = visits.filter((v) => v.status === 'completed').length;
  const pendingCount = visits.filter((v) => v.status === 'pending' || v.status === 'scheduled' || v.status === 'in_progress').length;
  const cancelledCount = visits.filter((v) => v.status === 'cancelled').length;

  const stats = {
    total,
    completed: completedCount,
    pending: pendingCount,
    cancelled: cancelledCount,
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Counsellor Home"
        description="Manage counselling sessions, patient appointments, and treatment follow-ups"
        action={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Session
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
            placeholder="Search patient name..."
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
        data={visits}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={total}
        onPageChange={setPage}
        emptyMessage="No counselling sessions found for today."
      />
    </div>
  );
}
