'use client';

import { useState } from 'react';
import { formatDate, toInputDateStr } from '@/lib/date-utils';
import {
  ScanLine, Search, Plus, Calendar, Activity, Clock, CheckCircle2, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { useImagingRequests, type ImagingRequest } from '@/hooks/use-imaging';
import { cn } from '@/lib/utils';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';

const statCards = [
  { label: 'Total Requests', icon: Activity, color: 'text-blue-600', bgColor: 'bg-blue-50', key: 'total' },
  { label: 'Pending', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', key: 'pending' },
  { label: 'In Progress', icon: Loader2, color: 'text-purple-600', bgColor: 'bg-purple-50', key: 'inProgress' },
  { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50', key: 'completed' },
];

const priorityColors: Record<string, string> = {
  urgent: 'text-red-600 bg-red-50',
  high: 'text-amber-600 bg-amber-50',
  normal: 'text-blue-600 bg-blue-50',
  low: 'text-muted-foreground bg-muted',
};

const columns: Column<ImagingRequest & Record<string, unknown>>[] = [
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
    key: 'imagingType',
    label: 'Type',
    sortable: true,
    render: (item) => (
      <span className="font-medium">{(item.imagingType as string)?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || '-'}</span>
    ),
  },
  {
    key: 'bodyPart',
    label: 'Body Part',
    render: (item) => (item.bodyPart as string) || '-',
  },
  {
    key: 'priority',
    label: 'Priority',
    render: (item) => {
      const priority = (item.priority as string) || 'normal';
      const colorClass = priorityColors[priority.toLowerCase()] || priorityColors.normal;
      return (
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', colorClass)}>
          {priority.charAt(0).toUpperCase() + priority.slice(1)}
        </span>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    render: (item) => <StatusBadge status={item.status as string} />,
  },
  {
    key: 'requestedBy',
    label: 'Requested By',
    render: (item) =>
      item.requestedBy
        ? `Dr. ${item.requestedBy.firstName} ${item.requestedBy.lastName}`
        : '-',
  },
  {
    key: 'createdAt',
    label: 'Date',
    sortable: true,
    render: (item) => formatDate(item.createdAt as string),
  },
];

export default function RadiologyHomePage() {
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);

  const { data, isLoading } = useImagingRequests({
    page,
    limit: 20,
    search: search || undefined,
    date: selectedDate || undefined,
  });

  const requests = (data?.data ?? []) as (ImagingRequest & Record<string, unknown>)[];
  const total = data?.meta?.total ?? 0;

  // Compute stats from data
  const pendingCount = requests.filter((r) => r.status === 'pending' || r.status === 'requested').length;
  const inProgressCount = requests.filter((r) => r.status === 'in_progress' || r.status === 'scheduled').length;
  const completedCount = requests.filter((r) => r.status === 'completed' || r.status === 'report_ready').length;

  const stats = {
    total,
    pending: pendingCount,
    inProgress: inProgressCount,
    completed: completedCount,
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Radiology Home"
        description="Manage imaging requests, reports, and radiology workflows"
        action={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Request
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
            placeholder="Search patient, imaging type..."
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
            className="pl-9 w-full sm:w-[180px]"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        total={total}
        onPageChange={setPage}
        emptyMessage="No imaging requests found for the selected filters."
      />

      {/* Forms assigned by admin to radiology_home view location appear here */}
      <PatientFormSubmissionsPanel
        title="Radiology Forms Submissions"
        viewLocation="radiology_home"
      />
    </div>
  );
}
