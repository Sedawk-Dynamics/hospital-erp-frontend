'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { OPHomeToolbar } from '@/components/hospital/op-home-toolbar';
import { AppointmentStatsRow } from '@/components/hospital/appointment-stats-row';
import { PatientTagFilter } from '@/components/hospital/patient-tag-filter';
import { AppointmentTable } from '@/components/hospital/appointment-table';
import { useOPAppointments, useAppointmentStats, useDoctorsList } from '@/hooks/use-hospital';

const statusFilterMap: Record<string, string | undefined> = {
  all: undefined,
  booked: 'scheduled',
  arrived: 'checked_in',
  withDoctor: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  ipAppointments: undefined,
};

export default function HospitalHomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeStatFilter, setActiveStatFilter] = useState('all');
  const [activeTag, setActiveTag] = useState('all');
  const [page, setPage] = useState(1);

  const statusFilter = statusFilterMap[activeStatFilter];

  const { data: appointmentsData, isLoading: appointmentsLoading } = useOPAppointments({
    page,
    limit: 20,
    date: selectedDate,
    doctorId: selectedDoctor !== 'all' ? selectedDoctor : undefined,
    status: statusFilter,
    search: searchQuery || undefined,
  });

  const { data: stats, isLoading: statsLoading } = useAppointmentStats(selectedDate);

  const { data: doctorsRaw } = useDoctorsList();

  const doctors = (doctorsRaw || []).map((d) => ({
    id: d.id || d.userId,
    name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
  }));

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">OP Home</h1>
      </div>

      {/* Toolbar: Doctor filter + Search + Date */}
      <OPHomeToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedDoctor={selectedDoctor}
        onDoctorChange={(v) => { setSelectedDoctor(v); setPage(1); }}
        selectedDate={selectedDate}
        onDateChange={(v) => { setSelectedDate(v); setPage(1); }}
        doctors={doctors}
      />

      {/* Stats row */}
      <AppointmentStatsRow
        stats={stats}
        activeFilter={activeStatFilter}
        onFilterChange={handleStatFilter}
        isLoading={statsLoading}
      />

      {/* Tag filters */}
      <PatientTagFilter activeTag={activeTag} onTagChange={setActiveTag} />

      {/* Appointment table */}
      <AppointmentTable
        appointments={appointmentsData?.data ?? []}
        isLoading={appointmentsLoading}
        page={page}
        totalPages={appointmentsData?.meta?.totalPages ?? 1}
        total={appointmentsData?.meta?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
