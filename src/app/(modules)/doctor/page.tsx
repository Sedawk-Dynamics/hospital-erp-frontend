'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toInputDateStr, formatTime24 } from '@/lib/date-utils';
import { Search, CalendarIcon, Users, Clock, BedDouble, FlaskConical, Scissors } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AppointmentStatsRow } from '@/components/hospital/appointment-stats-row';
import { PatientTagFilter } from '@/components/hospital/patient-tag-filter';
import { PatientCategoryIndicators } from '@/components/doctor/patient-category-indicators';
import { DoctorActionButtons } from '@/components/doctor/doctor-action-buttons';
import { useDoctorAppointments, useDoctorAppointmentStats, useUpdateAppointmentStatus, useLabOrders, useDoctorOTRequests } from '@/hooks/use-doctor';
import { useAuthStore } from '@/stores/auth-store';
import { useActionFormsTrigger } from '@/hooks/use-action-forms-trigger';
import { IntakeFormsModal } from '@/components/forms/intake-forms-modal';
import type { FormTrigger } from '@/types/forms';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Appointment } from '@/types';

// Map doctor status transitions to form triggers
const DOCTOR_STATUS_TO_TRIGGER: Record<string, FormTrigger> = {
  in_consultation: 'pre_consultation',
  completed: 'feedback',
};
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Edit, XCircle, MoreVertical, CheckCircle, LogIn, Stethoscope, UserCheck } from 'lucide-react';

// Status filter mapping for doctor panel
const statusFilterMap: Record<string, string | undefined> = {
  all: undefined,
  pending_payment: 'pending_payment',
  booked: 'booked',
  confirmed: 'confirmed',
  checked_in: 'checked_in',
  in_consultation: 'in_consultation',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

const DOCTOR_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'booked', label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'in_consultation', label: 'In Consultation' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

type ViewMode = 'today' | 'upcoming' | 'past';

const DOCTOR_VIEW_MODES: { value: ViewMode; label: string }[] = [
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

const categoryColors: Record<string, string> = {
  consultation: 'bg-error',
  follow_up: 'bg-primary-container',
  emergency: 'bg-tertiary',
  procedure: 'bg-secondary',
};

// Patient type badge config based on visitType + patient.isNew
function getPatientTypeBadge(apt: Appointment): { label: string; className: string } {
  const visitType = (apt as any).visitType as string | undefined;
  const isNew = (apt as any).patient?.isNew as boolean | undefined;
  if (visitType === 'revisit') {
    return { label: 'Review', className: 'bg-primary/10 text-primary' };
  }
  if (isNew === true) {
    return { label: 'New', className: 'bg-error/10 text-error' };
  }
  return { label: 'Old', className: 'bg-tertiary/10 text-tertiary' };
}

// Status transitions the doctor can perform
// Confirm & Check In are front-desk responsibilities — doctor handles consultation onward
const DOCTOR_TRANSITIONS: Record<string, { label: string; to: string; icon: typeof CheckCircle; color?: string }[]> = {
  confirmed: [
    { label: 'Start Consultation', to: 'in_consultation', icon: Stethoscope },
  ],
  checked_in: [
    { label: 'Start Consultation', to: 'in_consultation', icon: Stethoscope },
  ],
  in_consultation: [
    { label: 'Complete', to: 'completed', icon: UserCheck },
  ],
};

// ── Quick Stat Card ──────────────────────────────────────

function QuickStatCard({ icon, label, value, accent, iconBg, iconColor, badge }: { icon: React.ReactNode; label: string; value: number; accent: string; iconBg: string; iconColor: string; badge?: string }) {
  return (
    <div className={cn('bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4', accent)}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn('p-2 rounded-lg', iconBg, iconColor)}>{icon}</div>
        {badge && (
          <span className={cn('text-[10px] font-label font-bold px-2 py-1 rounded-full', iconColor, iconBg.replace('/10', '/5'))}>{badge}</span>
        )}
      </div>
      <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">{label}</p>
      <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">{value}</h3>
    </div>
  );
}

// ── Alerts Panel ─────────────────────────────────────────

function AlertsPanel({ pendingLabCount, pendingOTCount }: { pendingLabCount: number; pendingOTCount: number }) {
  if (pendingLabCount === 0 && pendingOTCount === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {pendingLabCount > 0 && (
        <div className="inline-flex items-center gap-2 rounded-lg bg-secondary/10 border border-secondary/20 px-3 py-1.5 font-label text-xs font-bold text-secondary">
          <FlaskConical className="h-3.5 w-3.5" />
          {pendingLabCount} pending lab results
        </div>
      )}
      {pendingOTCount > 0 && (
        <div className="inline-flex items-center gap-2 rounded-lg bg-tertiary/10 border border-tertiary/20 px-3 py-1.5 font-label text-xs font-bold text-tertiary">
          <Scissors className="h-3.5 w-3.5" />
          {pendingOTCount} OT approvals pending
        </div>
      )}
    </div>
  );
}

export default function DoctorHomePage() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(toInputDateStr());
  const [toDate, setToDate] = useState(toInputDateStr());
  const [activeStatFilter, setActiveStatFilter] = useState('all');
  const [activeTag, setActiveTag] = useState('all');
  const [page, setPage] = useState(1);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [telemedicineActive, setTelemedicineActive] = useState(false);

  const statusFilter = statusFilterMap[activeStatFilter];

  // Compute date params based on view mode
  const dateParams = useMemo(() => {
    const today = toInputDateStr();
    if (viewMode === 'upcoming') {
      return { fromDate: shiftDate(today, 1) };
    }
    if (viewMode === 'past') {
      return { toDate: shiftDate(today, -1) };
    }
    // 'today' — use the existing date input
    return { date: fromDate };
  }, [viewMode, fromDate]);

  // Doctor sees only their own appointments — pass doctorUserId so backend resolves DoctorProfile
  const { data: appointmentsData, isLoading } = useDoctorAppointments({
    page,
    limit: 30,
    ...dateParams,
    doctorUserId: user?.id,
    status: statusFilter,
    search: searchQuery || undefined,
    type: telemedicineActive ? 'telemedicine' : undefined,
  });

  // Separate lightweight query just for the telemedicine count badge
  const { data: telemedicineData } = useDoctorAppointments({
    page: 1,
    limit: 1,
    ...dateParams,
    doctorUserId: user?.id,
    type: 'telemedicine',
  });
  const telemedicineCount =
    telemedicineData?.meta?.total ?? telemedicineData?.data?.length ?? 0;

  // Stats only meaningful for the "today" view (single-date stats)
  const { data: doctorStats, isLoading: statsLoading } = useDoctorAppointmentStats(
    user?.id,
    viewMode === 'today' ? fromDate : undefined,
  );

  // Alerts data
  const { data: labOrdersData } = useLabOrders({ status: 'ordered', limit: 5 });
  const { data: otRequestsData } = useDoctorOTRequests({ status: 'pending', limit: 5 });

  const pendingLabCount = labOrdersData?.meta?.total ?? labOrdersData?.data?.length ?? 0;
  const pendingOTCount = otRequestsData?.meta?.total ?? otRequestsData?.data?.length ?? 0;

  const appointments = appointmentsData?.data ?? [];

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

  const handleToggleTelemedicine = useCallback(() => {
    setTelemedicineActive((prev) => !prev);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header with action buttons */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">Doctor Appointments</h1>
          <p className="font-label text-sm text-on-surface-variant mt-0.5">Manage today's consultations, upcoming visits & patient queue</p>
        </div>
      </div>

      <DoctorActionButtons
        telemedicineCount={telemedicineCount}
        telemedicineActive={telemedicineActive}
        onToggleTelemedicine={handleToggleTelemedicine}
      />

      {/* View mode tabs: Today / Upcoming / Past Bookings */}
      <div className="flex gap-2 overflow-x-auto">
        {DOCTOR_VIEW_MODES.map((m) => (
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

      {/* Quick Stats Cards — only meaningful for Today view */}
      {viewMode === 'today' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <QuickStatCard icon={<Users className="h-5 w-5" />} label="Total Patients" value={doctorStats?.all ?? 0} accent="border-primary" iconBg="bg-primary/10" iconColor="text-primary" />
          <QuickStatCard icon={<CheckCircle className="h-5 w-5" />} label="Completed" value={doctorStats?.completed ?? 0} accent="border-primary-container" iconBg="bg-primary-container/10" iconColor="text-primary-container" />
          <QuickStatCard icon={<Clock className="h-5 w-5" />} label="Pending" value={(doctorStats?.booked ?? 0) + (doctorStats?.arrived ?? 0)} accent="border-secondary" iconBg="bg-secondary/10" iconColor="text-secondary" />
          <QuickStatCard icon={<BedDouble className="h-5 w-5" />} label="IP Referrals" value={doctorStats?.ipAppointments ?? 0} accent="border-tertiary" iconBg="bg-tertiary/10" iconColor="text-tertiary" />
        </div>
      )}

      {/* Alerts Panel */}
      <AlertsPanel pendingLabCount={pendingLabCount} pendingOTCount={pendingOTCount} />

      {/* Patient categories + Stats row — only for Today view */}
      {viewMode === 'today' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {user?.firstName?.[0] || 'D'}
              </AvatarFallback>
            </Avatar>
            <PatientCategoryIndicators
              newPatients={doctorStats?.newPatients ?? 0}
              reviewPatients={doctorStats?.reviewPatients ?? 0}
              oldPatients={doctorStats?.oldPatients ?? 0}
            />
          </div>

          <div className="flex-1">
            <AppointmentStatsRow
              stats={doctorStats}
              activeFilter={activeStatFilter}
              onFilterChange={handleStatFilter}
              isLoading={statsLoading}
            />
          </div>
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DOCTOR_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleStatFilter(f.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 font-label text-xs font-semibold whitespace-nowrap transition-colors',
              f.value === activeStatFilter
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tag filters + Date range + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PatientTagFilter activeTag={activeTag} onTagChange={setActiveTag} />

        <div className="flex items-center gap-2">
          {viewMode === 'today' && (
            <>
              <span className="text-xs text-muted-foreground">From Date:</span>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                  className="pl-8 h-8 text-xs w-full sm:w-[140px]"
                />
              </div>
              <span className="text-xs text-muted-foreground">To Date:</span>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="pl-8 h-8 text-xs w-full sm:w-[140px]"
                />
              </div>
            </>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient..."
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
        onViewDetails={(patientId, appointmentId) => {
          const params = appointmentId ? `?appointmentId=${appointmentId}` : '';
          router.push(`/doctor/consultation/${patientId}${params}`);
        }}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────

/** Normalize plain time strings (e.g. "09:00") into a parseable ISO format, then use formatTime24. */
function formatTimeFromISO(t: string | null | undefined): string {
  if (!t) return '-';
  // If it looks like a plain HH:mm or HH:mm:ss string, prefix with a date so Date can parse it
  const normalized = /^\d{1,2}:\d{2}(:\d{2})?$/.test(t.trim())
    ? `1970-01-01T${t.trim()}Z`
    : t;
  return formatTime24(normalized);
}

const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
  pending_payment: { label: 'Pending Payment', bg: 'bg-secondary/10', text: 'text-secondary' },
  booked: { label: 'Booked', bg: 'bg-primary-container/10', text: 'text-primary-container' },
  confirmed: { label: 'Confirmed', bg: 'bg-primary/10', text: 'text-primary' },
  checked_in: { label: 'Checked In', bg: 'bg-secondary/10', text: 'text-secondary' },
  in_consultation: { label: 'In Consultation', bg: 'bg-tertiary/10', text: 'text-tertiary' },
  completed: { label: 'Completed', bg: 'bg-primary/10', text: 'text-primary' },
  cancelled: { label: 'Cancelled', bg: 'bg-error/10', text: 'text-error' },
  no_show: { label: 'No Show', bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
};

// ── Doctor-specific appointment table ──────────────────

function DoctorAppointmentTable({
  appointments,
  isLoading,
  page,
  totalPages,
  total,
  onPageChange,
  onViewDetails,
}: {
  appointments: Appointment[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onViewDetails: (patientId: string, appointmentId?: string) => void;
}) {
  const statusMutation = useUpdateAppointmentStatus();
  const formsTrigger = useActionFormsTrigger();

  const handleStatusChange = (apt: Appointment, newStatus: string) => {
    // Intercept "completed" → navigate to consultation page instead
    if (newStatus === 'completed') {
      onViewDetails(apt.patientId, apt.id);
      return;
    }

    statusMutation.mutate(
      { id: apt.id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Appointment ${newStatus.replace('_', ' ')} successfully`);

          // After Start Consultation, fire any matching forms
          const trigger = DOCTOR_STATUS_TO_TRIGGER[newStatus];
          if (trigger) {
            formsTrigger.fire(trigger, apt.tenantId, {
              appointmentId: apt.id,
              patientId: apt.patientId,
            });
          }
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || `Failed to update status`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center text-muted-foreground">
          No appointments found for the selected date.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-container">
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Patient Details</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Appointment Details</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Time</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Purpose of Visit</th>
              <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Status</th>
              <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => {
              const patient = apt.patient;
              const initials = patient
                ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                : '?';
              const transitions = DOCTOR_TRANSITIONS[apt.status] ?? [];
              const st = statusLabels[apt.status] ?? statusLabels.booked;
              const PrimaryIcon = transitions.length > 0 ? transitions[0].icon : null;

              return (
                <tr
                  key={apt.id}
                  className="group hover:bg-surface-container-low transition-colors cursor-pointer"
                  onClick={() => apt.patientId && onViewDetails(apt.patientId, apt.id)}
                >
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
                            (apt.type && categoryColors[apt.type]) || 'bg-outline'
                          )}
                          title={apt.type ?? 'general'}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground truncate max-w-[200px]">
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
                          <span className={cn('rounded-full px-1.5 py-0 text-[9px] font-bold', getPatientTypeBadge(apt).className)}>
                            {getPatientTypeBadge(apt).label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Appointment Details */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground capitalize">
                        {apt.type?.replace('_', ' ') || 'General'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apt.doctor?.department?.name || apt.doctor?.specialization || '-'}
                      </p>
                    </div>
                  </td>

                  {/* Time */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatTimeFromISO(apt.startTime)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apt.endTime ? `to ${formatTimeFromISO(apt.endTime)}` : ''}
                      </p>
                    </div>
                  </td>

                  {/* Purpose of Visit */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground truncate max-w-[180px]">
                      {apt.reason || '-'}
                    </p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 font-label text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full',
                      st.bg, st.text,
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', st.text.replace('text-', 'bg-'))} />
                      {st.label}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {/* Quick action: primary transition */}
                      {transitions.length > 0 && transitions[0].to !== 'cancelled' && PrimaryIcon && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn('h-7 text-xs gap-1', transitions[0].color)}
                          onClick={() => handleStatusChange(apt, transitions[0].to)}
                          disabled={statusMutation.isPending}
                          title={transitions[0].label}
                        >
                          <PrimaryIcon className="h-3.5 w-3.5" />
                          {transitions[0].label}
                        </Button>
                      )}

                      {/* More actions dropdown */}
                      {transitions.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="h-7 w-7" />}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {transitions.map((t) => {
                              const TIcon = t.icon;
                              return (
                                <DropdownMenuItem
                                  key={t.to}
                                  onClick={() => handleStatusChange(apt, t.to)}
                                  className={t.color}
                                >
                                  <TIcon className="mr-2 h-4 w-4" />
                                  {t.label}
                                </DropdownMenuItem>
                              );
                            })}
                            <DropdownMenuItem onClick={() => apt.patientId && onViewDetails(apt.patientId, apt.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {transitions.length === 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View"
                          onClick={() => apt.patientId && onViewDetails(apt.patientId, apt.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-outline-variant/30 px-6 py-4">
        <div className="flex items-center gap-2 font-label text-xs text-on-surface-variant">
          <span>Rows per page:</span>
          <span className="font-bold text-on-surface">30</span>
        </div>
        <div className="flex items-center gap-2 font-label text-xs text-on-surface-variant">
          <span>1–{appointments.length} of {total}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-surface-container-high" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            ‹
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-surface-container-high" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            ›
          </Button>
        </div>
      </div>

      {/* After-action forms modal — fires after Start Consultation */}
      <IntakeFormsModal
        open={formsTrigger.isOpen}
        trigger={formsTrigger.trigger ?? 'manual'}
        tenantId={formsTrigger.tenantId}
        context={formsTrigger.context}
        onComplete={formsTrigger.close}
      />
    </div>
  );
}
