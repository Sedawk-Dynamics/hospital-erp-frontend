'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AppointmentStatsRow } from '@/components/hospital/appointment-stats-row';
import { PatientTagFilter } from '@/components/hospital/patient-tag-filter';
import { StatusProgression } from '@/components/hospital/status-progression';
import { PatientCategoryIndicators } from '@/components/doctor/patient-category-indicators';
import { DoctorActionButtons } from '@/components/doctor/doctor-action-buttons';
import { useOPAppointments, useAppointmentStats } from '@/hooks/use-hospital';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Edit, XCircle, MoreVertical } from 'lucide-react';

const statusFilterMap: Record<string, string | undefined> = {
  all: undefined,
  booked: 'scheduled',
  arrived: 'checked_in',
  withDoctor: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  ipAppointments: undefined,
};

const categoryColors: Record<string, string> = {
  consultation: 'bg-red-500',
  follow_up: 'bg-blue-500',
  emergency: 'bg-purple-500',
  procedure: 'bg-amber-500',
};

export default function DoctorHomePage() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeStatFilter, setActiveStatFilter] = useState('all');
  const [activeTag, setActiveTag] = useState('all');
  const [page, setPage] = useState(1);

  const statusFilter = statusFilterMap[activeStatFilter];

  // Doctor sees only their own appointments
  const { data: appointmentsData, isLoading } = useOPAppointments({
    page,
    limit: 30,
    date: fromDate,
    doctorId: user?.id,
    status: statusFilter,
    search: searchQuery || undefined,
  });

  const { data: stats, isLoading: statsLoading } = useAppointmentStats(fromDate);

  const appointments = appointmentsData?.data ?? [];

  const handleStatFilter = useCallback((filter: string) => {
    setActiveStatFilter(filter);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Doctor Appointments</h1>
      </div>

      <DoctorActionButtons />

      {/* Patient categories + Stats row */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {user?.firstName?.[0] || 'D'}
            </AvatarFallback>
          </Avatar>
          <PatientCategoryIndicators
            newPatients={0}
            reviewPatients={0}
            oldPatients={0}
          />
        </div>

        <div className="flex-1">
          <AppointmentStatsRow
            stats={stats}
            activeFilter={activeStatFilter}
            onFilterChange={handleStatFilter}
            isLoading={statsLoading}
          />
        </div>
      </div>

      {/* Tag filters + Date range + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PatientTagFilter activeTag={activeTag} onTagChange={setActiveTag} />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">From Date:</span>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-xs w-[140px]"
            />
          </div>
          <span className="text-xs text-muted-foreground">To Date:</span>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="pl-8 h-8 text-xs w-[140px]"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-8 text-xs w-[160px]"
            />
          </div>
        </div>
      </div>

      {/* Appointments table */}
      <DoctorAppointmentTable
        appointments={appointments}
        isLoading={isLoading}
        page={page}
        totalPages={appointmentsData?.meta?.totalPages ?? 1}
        total={appointmentsData?.meta?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}

// Doctor-specific appointment table matching eMedHub screenshot
function DoctorAppointmentTable({
  appointments,
  isLoading,
  page,
  totalPages,
  total,
  onPageChange,
}: {
  appointments: Appointment[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-8 text-center text-muted-foreground">
          No appointments found for the selected date.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient Details</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Appointment Details</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Arriving / Waiting Time</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Purpose of Visit</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => {
              const patient = apt.patient;
              const initials = patient
                ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                : '?';

              return (
                <tr key={apt.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  {/* Patient Details */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                            categoryColors[apt.type] || 'bg-gray-400'
                          )}
                          title={apt.type}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {patient ? `${patient.firstName} ${patient.lastName}`.toUpperCase() : 'Unknown'}
                          {' '}
                          <span className="font-normal text-muted-foreground">
                            {patient?.gender === 'female' ? 'F' : patient?.gender === 'male' ? 'M' : ''}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{patient?.mrn || '-'}</span>
                          <span>|</span>
                          <span>{patient?.phone || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Appointment Details */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        Token: {apt.id?.slice(-4) || '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Consultant: {apt.doctor
                          ? `Dr ${apt.doctor.user?.firstName || ''}`
                          : '-'}
                      </p>
                    </div>
                  </td>

                  {/* Arriving / Waiting Time */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-foreground">
                        {apt.startTime ? `Arrived: ${apt.startTime}` : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Booked: {apt.startTime || '-'}
                      </p>
                    </div>
                  </td>

                  {/* Payment Status */}
                  <td className="px-4 py-3">
                    <div className="space-y-0.5 text-xs">
                      <p className="text-muted-foreground">Bill: -</p>
                      <p className="text-green-600 font-medium">Paid: -</p>
                      <p className="text-red-600">Balance: -</p>
                    </div>
                  </td>

                  {/* Purpose of Visit */}
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground uppercase">
                      {apt.reason || apt.type?.replace('_', ' ') || 'CONSULTATION'}
                    </p>
                  </td>

                  {/* Status Progression */}
                  <td className="px-4 py-3">
                    <StatusProgression status={apt.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Cancel">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="h-7 w-7" />}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Print</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          <span className="font-medium">30</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>1–{appointments.length} of {total}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            ‹
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            ›
          </Button>
        </div>
      </div>
    </div>
  );
}
