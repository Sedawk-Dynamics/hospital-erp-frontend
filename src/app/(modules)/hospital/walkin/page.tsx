'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toInputDateStr, formatTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  UserPlus,
  Loader2,
  UserRound,
  MoreHorizontal,
  Play,
  CheckCircle2,
  SkipForward,
  Plus,
  CalendarCheck,
  Clock,
  Users,
  Stethoscope,
  CircleCheckBig,
  Siren,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { FrontDeskRegisterDialog } from '@/components/hospital/frontdesk-register-dialog';
import { CreateAppointmentDialog } from '@/components/hospital/create-appointment-dialog';
import { EmergencyPatientDialog } from '@/components/hospital/emergency-patient-dialog';
import { EmergencyBadge } from '@/components/shared/emergency-badge';
import {
  useOPAppointments,
  useAppointmentStats,
  useDoctorsList,
  usePatientSearch,
  useUpdateAppointmentStatus,
  hospitalKeys,
} from '@/hooks/use-hospital';
import { apiPost, apiPatch } from '@/lib/api';
import type { Patient, Appointment, DoctorProfile } from '@/types';

// ============================================================
// Helper: format HH:MM from a Date
// ============================================================

function formatHHMM(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m + mins, 0, 0);
  return formatHHMM(d);
}

// ============================================================
// Status badge config
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  booked: {
    label: 'Waiting',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  confirmed: {
    label: 'Waiting',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  checked_in: {
    label: 'Waiting',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  in_consultation: {
    label: 'In Consultation',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  cancelled: {
    label: 'Skipped',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  },
  no_show: {
    label: 'Skipped',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  },
};

function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, ' '),
    className: 'bg-gray-100 text-gray-600',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-[11px] font-semibold capitalize ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ============================================================
// Stat Card Component
// ============================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="font-headline text-xl font-bold text-on-surface">{value}</p>
        <p className="font-label text-[11px] text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

// ============================================================
// Walk-In Creation Dialog
// ============================================================

interface WalkInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: { id: string; name: string; specialization?: string }[];
  doctorsLoading: boolean;
}

function WalkInDialog({ open, onOpenChange, doctors, doctorsLoading }: WalkInDialogProps) {
  const queryClient = useQueryClient();

  // Patient search
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Doctor
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: patients, isLoading: patientsLoading } = usePatientSearch(patientQuery);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPatientQuery('');
      setSelectedPatient(null);
      setShowPatientDropdown(false);
      setSelectedDoctorId('');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setPatientQuery(`${patient.firstName} ${patient.lastName} (${patient.mrn})`);
    setShowPatientDropdown(false);
  }, []);

  const handlePatientInputChange = useCallback(
    (value: string) => {
      setPatientQuery(value);
      setShowPatientDropdown(value.length >= 2);
      if (selectedPatient) {
        setSelectedPatient(null);
      }
    },
    [selectedPatient]
  );

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!selectedDoctorId) {
      toast.error('Please select a doctor');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const startTime = formatHHMM(now);
      const endTime = addMinutes(startTime, 15);
      const appointmentDate = toInputDateStr(now);

      // Step 1: Create appointment
      const aptResponse = await apiPost<Appointment>('/appointments', {
        patientId: selectedPatient.id,
        doctorId: selectedDoctorId,
        appointmentDate,
        startTime,
        endTime,
        type: 'consultation',
        priority: 'normal',
      });

      const appointment = aptResponse.data;
      if (!appointment?.id) {
        throw new Error('Failed to create appointment');
      }

      // Step 2: Generate queue token
      let tokenNumber: string | number = '';
      try {
        const queueResponse = await apiPost<{ tokenNumber: string | number }>(
          `/appointments/${appointment.id}/queue`
        );
        tokenNumber = queueResponse.data?.tokenNumber ?? '';
      } catch {
        // Queue token generation is optional — continue without it
      }

      // Step 3: Update status to checked_in
      try {
        await apiPatch(`/appointments/${appointment.id}/status`, {
          status: 'checked_in',
        });
      } catch {
        // Status update failure is non-critical
      }

      // Step 4: Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['hospital', 'op-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'appointment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'walkin-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hospital', 'doctor-queue'] });

      // Step 5: Success toast
      toast.success(
        tokenNumber
          ? `Walk-in registered — Token #${tokenNumber}`
          : 'Walk-in registered successfully'
      );

      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to register walk-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-lg font-bold">New Walk-In</DialogTitle>
          <DialogDescription className="font-label text-sm text-on-surface-variant">
            Register a walk-in patient for immediate consultation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Patient Search */}
          <div className="space-y-1.5">
            <Label className="font-label text-xs font-semibold text-on-surface-variant">
              Patient <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
              <Input
                placeholder="Search by name, MRN, or phone..."
                value={patientQuery}
                onChange={(e) => handlePatientInputChange(e.target.value)}
                onFocus={() => {
                  if (patientQuery.length >= 2 && !selectedPatient) {
                    setShowPatientDropdown(true);
                  }
                }}
                className="bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
              />

              {/* Dropdown */}
              {showPatientDropdown && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-surface-container bg-surface-container-lowest shadow-lg max-h-48 overflow-y-auto">
                  {patientsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  ) : !patients || patients.length === 0 ? (
                    <p className="px-4 py-3 font-label text-sm text-on-surface-variant">
                      No patients found
                    </p>
                  ) : (
                    patients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleSelectPatient(patient)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary font-label text-xs font-bold">
                            {patient.firstName?.[0]}
                            {patient.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-label text-sm font-semibold truncate">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="font-label text-[10px] text-on-surface-variant">
                            {patient.mrn} &middot; {patient.phone}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected patient chip */}
            {selectedPatient && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                <UserRound className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-label text-sm font-semibold truncate">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="font-label text-[10px] text-on-surface-variant">
                    {selectedPatient.mrn} &middot; {selectedPatient.phone}
                    {selectedPatient.gender ? ` &middot; ${selectedPatient.gender}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientQuery('');
                  }}
                  className="text-on-surface-variant/60 hover:text-on-surface-variant text-xs"
                >
                  &times;
                </button>
              </div>
            )}
          </div>

          {/* Doctor Select */}
          <div className="space-y-1.5">
            <Label className="font-label text-xs font-semibold text-on-surface-variant">
              Doctor <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedDoctorId}
              onValueChange={(value) => setSelectedDoctorId(value ?? '')}
            >
              <SelectTrigger className="bg-surface-container-low border-none rounded-xl font-label text-sm focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder={doctorsLoading ? 'Loading doctors...' : 'Select doctor'} />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    <span className="font-label text-sm">
                      {doc.name}
                      {doc.specialization && (
                        <span className="text-on-surface-variant ml-1">
                          ({doc.specialization})
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl font-label text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedPatient || !selectedDoctorId}
            className="bg-primary text-white font-label font-bold text-sm px-6 rounded-xl hover:shadow-lg transition-shadow"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" />
                Register Walk-In
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function WalkInPage() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('booked');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedDate, setSelectedDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);

  // Dialogs
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [walkInDialogOpen, setWalkInDialogOpen] = useState(false);
  const [bookAppointmentOpen, setBookAppointmentOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  // Data
  const { data: appointmentsData, isLoading: appointmentsLoading } = useOPAppointments({
    page,
    limit: 50,
    date: selectedDate,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    doctorId: selectedDoctor !== 'all' ? selectedDoctor : undefined,
    search: search || undefined,
  });

  const { data: stats, isLoading: statsLoading } = useAppointmentStats(selectedDate);

  const { data: doctorsRaw, isLoading: doctorsLoading } = useDoctorsList();

  const doctors = useMemo(
    () =>
      (doctorsRaw || []).map((d: DoctorProfile) => ({
        id: d.id || d.userId,
        name: `Dr. ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim(),
        specialization: d.specialization,
      })),
    [doctorsRaw]
  );

  const appointments = appointmentsData?.data ?? [];
  const meta = appointmentsData?.meta;

  // Status mutation
  const updateStatus = useUpdateAppointmentStatus();

  const handleStatusChange = useCallback(
    (appointmentId: string, newStatus: string) => {
      updateStatus.mutate(
        { id: appointmentId, status: newStatus },
        {
          onSuccess: () => {
            toast.success(
              newStatus === 'in_consultation'
                ? 'Consultation started'
                : newStatus === 'completed'
                  ? 'Consultation completed'
                  : 'Patient skipped'
            );
            queryClient.invalidateQueries({ queryKey: ['hospital', 'walkin-appointments'] });
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Failed to update status');
          },
        }
      );
    },
    [updateStatus, queryClient]
  );

  // Computed queue stats from appointments
  const queueStats = useMemo(() => {
    const total = stats?.all ?? 0;
    const waiting = (stats?.booked ?? 0) + (stats?.arrived ?? 0);
    const inConsultation = stats?.withDoctor ?? 0;
    const completed = stats?.completed ?? 0;
    return { total, waiting, inConsultation, completed };
  }, [stats]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'pending_payment', label: 'Pending Payment' },
    { value: 'booked', label: 'Booked' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'checked_in', label: 'Checked In' },
    { value: 'in_consultation', label: 'In Consultation' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const handleDoctorChange = useCallback((value: string | null) => {
    setSelectedDoctor(value ?? 'all');
    setPage(1);
  }, []);

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setPage(1);
  }, []);

  // Get token number from appointment
  const getToken = (apt: Appointment): string => {
    const token = apt.queueTokens?.[0];
    return token?.tokenNumber != null ? String(token.tokenNumber) : '-';
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Walk In</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCreatePatientOpen(true)}
            size="sm"
            className="rounded-xl font-label text-sm"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Register Patient
          </Button>
          <Button
            variant="outline"
            onClick={() => setBookAppointmentOpen(true)}
            size="sm"
            className="rounded-xl font-label text-sm"
          >
            <CalendarCheck className="h-4 w-4 mr-1.5" />
            Book Appointment
          </Button>
          <Button
            variant="outline"
            onClick={() => setEmergencyOpen(true)}
            size="sm"
            className="rounded-xl font-label text-sm border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
          >
            <Siren className="h-4 w-4 mr-1.5" />
            Emergency
          </Button>
          <Button
            onClick={() => setWalkInDialogOpen(true)}
            className="bg-primary text-white font-label font-bold text-sm px-6 py-2.5 rounded-xl hover:shadow-lg transition-shadow"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Walk In
          </Button>
        </div>
      </div>

      {/* ── Dialogs ────────────────────────────────────────── */}
      <FrontDeskRegisterDialog
        open={createPatientOpen}
        onOpenChange={setCreatePatientOpen}
        initialMode="new"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['hospital'] });
        }}
      />
      <FrontDeskRegisterDialog
        open={walkInDialogOpen}
        onOpenChange={setWalkInDialogOpen}
        initialMode="existing"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['hospital'] });
        }}
      />
      <CreateAppointmentDialog
        open={bookAppointmentOpen}
        onOpenChange={setBookAppointmentOpen}
      />
      <EmergencyPatientDialog
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['hospital'] });
        }}
      />

      {/* ── Queue Stats Row ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          label="Total"
          value={queueStats.total}
          color="bg-indigo-100 dark:bg-indigo-900/30"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Waiting"
          value={queueStats.waiting}
          color="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          icon={<Stethoscope className="h-5 w-5 text-blue-600" />}
          label="In Consultation"
          value={queueStats.inConsultation}
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          icon={<CircleCheckBig className="h-5 w-5 text-green-600" />}
          label="Completed"
          value={queueStats.completed}
          color="bg-green-100 dark:bg-green-900/30"
        />
      </div>

      {/* ── Status Filters ───────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleStatusFilter(f.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 font-label text-xs font-semibold whitespace-nowrap transition-colors',
              f.value === statusFilter
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Filters Row ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <Input
            placeholder="Search patient..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-2.5 font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-on-surface-variant/60"
          />
        </div>

        {/* Doctor filter */}
        <Select value={selectedDoctor} onValueChange={handleDoctorChange}>
          <SelectTrigger className="w-[200px] bg-surface-container-low border-none rounded-xl font-label text-sm focus:ring-2 focus:ring-primary/20">
            <SelectValue placeholder="All Doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Doctors</SelectItem>
            {doctors.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date picker */}
        <Input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="w-[160px] bg-surface-container-low border-none rounded-xl font-label text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
        />
      </div>

      {/* ── Queue Table ────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Token #
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Patient Details
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Doctor
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Status
                </th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Time
                </th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/50">
              {appointmentsLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="font-label text-sm text-on-surface-variant">
                        Loading queue...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-on-surface-variant/30" />
                      <p className="font-label text-sm text-on-surface-variant">
                        No walk-in entries found
                      </p>
                      <p className="font-label text-xs text-on-surface-variant/60">
                        Click &ldquo;New Walk In&rdquo; to register a patient
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => {
                  const token = getToken(apt);
                  const patientName = `${apt.patient?.firstName ?? ''} ${apt.patient?.lastName ?? ''}`.trim();
                  const initials = `${apt.patient?.firstName?.[0] ?? ''}${apt.patient?.lastName?.[0] ?? ''}`.toUpperCase();
                  const doctorName = apt.doctor
                    ? `Dr. ${apt.doctor.user?.firstName ?? ''} ${apt.doctor.user?.lastName ?? ''}`.trim()
                    : '-';
                  const checkInTime = apt.createdAt ? formatTime(apt.createdAt) : '-';
                  const isWaiting =
                    apt.status === 'booked' ||
                    apt.status === 'confirmed' ||
                    apt.status === 'checked_in';
                  const isInConsultation = apt.status === 'in_consultation';
                  const isTerminal =
                    apt.status === 'completed' ||
                    apt.status === 'cancelled' ||
                    apt.status === 'no_show';

                  return (
                    <tr
                      key={apt.id}
                      className="group hover:bg-surface-container-low transition-colors"
                    >
                      {/* Token */}
                      <td className="px-4 py-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-label text-sm font-bold text-primary">
                          {token}
                        </span>
                      </td>

                      {/* Patient Details */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary font-label text-xs font-bold">
                              {initials || <UserRound className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-label text-sm font-bold truncate">
                              {patientName || 'Unknown'}
                              <EmergencyBadge patient={apt.patient} size="sm" />
                            </p>
                            <p className="font-label text-[10px] text-on-surface-variant">
                              {apt.patient?.mrn ?? '-'}
                              {apt.patient?.phone ? ` \u00B7 ${apt.patient.phone}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Doctor */}
                      <td className="px-4 py-3">
                        <p className="font-label text-sm">{doctorName}</p>
                        {apt.doctor?.specialization && (
                          <p className="font-label text-[10px] text-on-surface-variant">
                            {apt.doctor.specialization}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">{getStatusBadge(apt.status)}</td>

                      {/* Time */}
                      <td className="px-4 py-3 font-label text-sm text-on-surface-variant">
                        {checkInTime}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {apt.status === 'booked' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            disabled={updateStatus.isPending}
                            onClick={() => handleStatusChange(apt.id, 'confirmed')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirm
                          </Button>
                        )}
                        {apt.status === 'confirmed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            disabled={updateStatus.isPending}
                            onClick={() => handleStatusChange(apt.id, 'checked_in')}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Check In
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────── */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-container px-4 py-3">
            <p className="font-label text-xs text-on-surface-variant">
              Showing {(meta.page - 1) * meta.limit + 1}–
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="font-label text-xs rounded-lg"
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="font-label text-xs rounded-lg"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
