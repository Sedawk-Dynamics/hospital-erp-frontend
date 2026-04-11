'use client';

import { useState, useCallback, useMemo } from 'react';
import { toInputDateStr } from '@/lib/date-utils';
import { UserPlus, CalendarPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
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

type ViewMode = 'today' | 'upcoming' | 'past';

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past Bookings' },
];

/** Add (or subtract) days from a yyyy-MM-dd string. Pure date math, no TZ drift. */
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

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
  const [viewMode, setViewMode] = useState<ViewMode>('today');

  const statusFilter = statusFilterMap[activeStatFilter];

  // Compute date params based on view mode
  const dateParams = useMemo(() => {
    const today = toInputDateStr();
    if (viewMode === 'upcoming') {
      // Everything from tomorrow onward
      return { fromDate: shiftDate(today, 1) };
    }
    if (viewMode === 'past') {
      // Everything before today
      return { toDate: shiftDate(today, -1) };
    }
    // 'today' — single day picker
    return { date: selectedDate };
  }, [viewMode, selectedDate]);

  const { data: appointmentsData, isLoading: appointmentsLoading } = useOPAppointments({
    page,
    limit: 20,
    ...dateParams,
    doctorId: selectedDoctor !== 'all' ? selectedDoctor : undefined,
    status: statusFilter,
    search: searchQuery || undefined,
  });

  // Stats only make sense for the "today" view
  const { data: stats, isLoading: statsLoading } = useAppointmentStats(
    viewMode === 'today' ? selectedDate : undefined,
  );

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

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setActiveStatFilter('all');
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

      {/* View mode tabs: Today / Upcoming / Past Bookings */}
      <div className="flex gap-2 overflow-x-auto">
        {VIEW_MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => handleViewModeChange(m.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 font-label text-xs font-semibold whitespace-nowrap transition-colors',
              m.value === viewMode
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Toolbar: Doctor filter + Search + Date (date hidden outside Today view) */}
      <OPHomeToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedDoctor={selectedDoctor}
        onDoctorChange={(v) => { setSelectedDoctor(v); setPage(1); }}
        selectedDate={selectedDate}
        onDateChange={(v) => { setSelectedDate(v); setPage(1); }}
        doctors={doctors}
        hideDate={viewMode !== 'today'}
      />

      {/* Stats row — only meaningful for Today view */}
      {viewMode === 'today' && (
        <AppointmentStatsRow
          stats={stats}
          activeFilter={activeStatFilter}
          onFilterChange={handleStatFilter}
          isLoading={statsLoading}
        />
      )}

      {/* Past / Upcoming: simple status filter chips */}
      {viewMode !== 'today' && (
        <div className="flex gap-2 overflow-x-auto">
          {[
            { value: 'all', label: 'All' },
            { value: 'booked', label: 'Booked' },
            { value: 'arrived', label: 'Checked In' },
            { value: 'withDoctor', label: 'In Consultation' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => handleStatFilter(f.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                f.value === activeStatFilter
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

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
