'use client';

import { useState, useCallback } from 'react';
import { toInputDateStr } from '@/lib/date-utils';
import { UserPlus, CalendarPlus } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { OPHomeToolbar } from '@/components/hospital/op-home-toolbar';
import { CreatePatientDialog } from '@/components/hospital/create-patient-dialog';
import { CreateAppointmentDialog } from '@/components/hospital/create-appointment-dialog';
import { Button } from '@/components/ui/button';
import { AppointmentStatsRow } from '@/components/hospital/appointment-stats-row';
import { PatientTagFilter } from '@/components/hospital/patient-tag-filter';
import { AppointmentTable } from '@/components/hospital/appointment-table';
import { useOPAppointments, useAppointmentStats, useDoctorsList } from '@/hooks/use-hospital';
import {
  NurseDashboard,
  FrontDeskDashboard,
  BillingDashboard,
  CashierDashboard,
  InsuranceDashboard,
  BloodBankDashboard,
  HRDashboard,
} from '@/components/hospital/role-dashboards';

const ROLE_DASHBOARD_MAP: Record<string, React.ComponentType> = {
  nurse: NurseDashboard,
  front_desk: FrontDeskDashboard,
  billing_admin: BillingDashboard,
  cashier: CashierDashboard,
  insurance_staff: InsuranceDashboard,
  blood_bank_staff: BloodBankDashboard,
  hr_staff: HRDashboard,
};

const statusFilterMap: Record<string, string | undefined> = {
  all: undefined,
  booked: 'booked',
  arrived: 'checked_in',
  withDoctor: 'in_consultation',
  completed: 'completed',
  cancelled: 'cancelled',
  ipAppointments: undefined,
};

export default function HospitalHomePage() {
  const user = useAuthStore((s) => s.user);
  const roleSlug = user?.role?.slug?.toLowerCase().replace(/[\s-]+/g, '_');

  // Check if this role has a specialized dashboard
  const RoleDashboard = roleSlug ? ROLE_DASHBOARD_MAP[roleSlug] : undefined;

  if (RoleDashboard) {
    return <RoleDashboard />;
  }

  // Default: OP Home for admin and other roles
  return <OPHomeDashboard />;
}

function OPHomeDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());
  const [activeStatFilter, setActiveStatFilter] = useState('all');
  const [activeTag, setActiveTag] = useState('all');
  const [page, setPage] = useState(1);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [createAppointmentOpen, setCreateAppointmentOpen] = useState(false);

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
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">OP Home</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateAppointmentOpen(true)} size="sm">
            <CalendarPlus className="h-4 w-4 mr-1.5" />
            New Appointment
          </Button>
          <Button onClick={() => setCreatePatientOpen(true)} size="sm" variant="outline">
            <UserPlus className="h-4 w-4 mr-1.5" />
            Register Patient
          </Button>
        </div>
      </div>

      <CreateAppointmentDialog
        open={createAppointmentOpen}
        onOpenChange={setCreateAppointmentOpen}
      />

      <CreatePatientDialog
        open={createPatientOpen}
        onOpenChange={setCreatePatientOpen}
      />

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
