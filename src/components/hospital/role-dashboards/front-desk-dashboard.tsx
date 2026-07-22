'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CalendarCheck, UserPlus, Search, Users,
  Clock, CircleCheck, LogIn, Footprints, Banknote,
} from 'lucide-react';
import { toInputDateStr, formatDate } from '@/lib/date-utils';
import { CreateAppointmentDialog } from '@/components/hospital/create-appointment-dialog';
import { FrontDeskRegisterDialog } from '@/components/hospital/frontdesk-register-dialog';
import { AppointmentTable } from '@/components/hospital/appointment-table';
import type { Appointment } from '@/types';

interface QueueAppointment {
  id: string;
  tokenNumber?: number;
  patientId?: string;
  doctorId?: string;
  consultationType?: string;
  priority?: string;
  patient: { id: string; firstName: string; lastName: string; mrn: string; phone?: string };
  doctor?: { user?: { firstName: string; lastName: string } };
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  status: string;
  type?: string;
  queueTokens?: Array<{ tokenNumber: number }>;
  paymentInfo?: {
    billId: string;
    billNumber: string;
    billStatus: string;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: 'paid_online' | 'paid_at_frontdesk' | 'pay_at_frontdesk' | 'pending' | 'no_billing';
  } | null;
}

/** Add (or subtract) days from a yyyy-MM-dd string. Pure date math, no TZ drift. */
function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

type ViewMode = 'today' | 'upcoming' | 'past';

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past Bookings' },
];

export function FrontDeskDashboard() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [bookAppointmentOpen, setBookAppointmentOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const today = toInputDateStr();
  // In "Today" mode the desk can still page to any single day with the picker.
  const [selectedDate, setSelectedDate] = useState(today);
  const queryClient = useQueryClient();

  // Date window sent to the API for the active view.
  const dateParams: Record<string, string> =
    viewMode === 'upcoming'
      ? { fromDate: shiftDate(today, 1) }
      : viewMode === 'past'
        ? { toDate: shiftDate(today, -1) }
        : { date: selectedDate };
  // Stat tiles are always a single-day figure; they follow the day picker.
  const statsDate = viewMode === 'today' ? selectedDate : today;

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['front-desk', 'queue', dateParams, search, statusFilter, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { ...dateParams, page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await apiGet<QueueAppointment[]>('/appointments', { params });
      return { data: response.data, meta: response.meta };
    },
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['front-desk', 'stats', statsDate],
    queryFn: async () => {
      const response = await apiGet<{
        all: number; pendingPayment: number; booked: number; arrived: number;
        withDoctor: number; completed: number; cancelled: number;
      }>('/appointments/stats', { params: { date: statsDate } });
      const s = response.data;
      return s ? {
        total: s.all ?? 0,
        pendingPayment: s.pendingPayment ?? 0,
        checkedIn: s.arrived ?? 0,
        waiting: s.booked ?? 0,
        completed: s.completed ?? 0,
      } : { total: 0, pendingPayment: 0, checkedIn: 0, waiting: 0, completed: 0 };
    },
  });

  const appointments = queueData?.data ?? [];
  const computedStats = statsData ?? { total: 0, pendingPayment: 0, checkedIn: 0, waiting: 0, completed: 0 };

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

  const stats = [
    {
      label: statsDate === today ? "Today's Appointments" : `Appointments ${formatDate(statsDate)}`,
      value: computedStats.total,
      icon: CalendarCheck,
    },
    // Patient-app bookings land as `pending_payment`; surfacing the count keeps
    // them from being missed at the counter.
    { label: 'Pending Payment', value: computedStats.pendingPayment, icon: Banknote },
    { label: 'Checked In', value: computedStats.checkedIn, icon: LogIn },
    { label: 'Waiting', value: computedStats.waiting, icon: Clock },
    { label: 'Completed', value: computedStats.completed, icon: CircleCheck },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold">Front Desk</h1>
          <p className="font-label text-[10px] text-on-surface-variant mt-0.5">
            Manage appointments, registrations, and patient check-ins
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest p-6 rounded-xl shadow-[24px_0_40px_-4px_rgba(0,0,0,0.05)] border-l-4 border-primary transition-all duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-headline text-3xl font-extrabold">
                  {statsLoading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="gap-2" onClick={() => setRegisterOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Register Patient
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setBookAppointmentOpen(true)}>
          <CalendarCheck className="h-4 w-4" />
          Book Appointment
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setWalkInOpen(true)}>
          <Footprints className="h-4 w-4" />
          Walk-In
        </Button>
        {/* Emergency intake lives inside Register Patient / Walk-In — pick the
            "Emergency" option on the patient step. */}
      </div>

      {/* Register Patient + Book Appointment (multi-step) */}
      <FrontDeskRegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['front-desk'] });
        }}
      />

      {/* Walk-In: same flow but starts with existing patient search */}
      <FrontDeskRegisterDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        initialMode="existing"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['front-desk'] });
        }}
      />

      {/* Book Appointment for existing patients */}
      <CreateAppointmentDialog
        open={bookAppointmentOpen}
        onOpenChange={setBookAppointmentOpen}
      />

      {/* Resolve a temporary casualty straight from the queue */}

      {/* View window: Today (any single day) / Upcoming / Past Bookings */}
      <div className="flex flex-wrap items-center gap-2">
        {VIEW_MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => {
              setViewMode(m.value);
              setStatusFilter('all');
              setPage(1);
            }}
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
        {viewMode === 'today' && (
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value || today);
              setPage(1);
            }}
            className="h-8 w-auto text-xs"
          />
        )}
      </div>

      {/* Filters + Search */}
      <div className="space-y-3">
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
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder="Search by name, phone, MRN..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Appointment Queue Table */}
      <div className="space-y-2">
        <h2 className="font-headline text-lg font-bold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          {viewMode === 'upcoming'
            ? 'Upcoming Appointments'
            : viewMode === 'past'
              ? 'Past Bookings'
              : selectedDate === today
                ? "Today's Appointment Queue"
                : `Appointments — ${formatDate(selectedDate)}`}
        </h2>

        {/* Same table the admin OP Home and the Walk In queue render, so the
            patient / payment / status-progression flow is identical everywhere. */}
        <AppointmentTable
          appointments={appointments as unknown as Appointment[]}
          isLoading={queueLoading}
          page={page}
          totalPages={queueData?.meta?.totalPages ?? 1}
          total={queueData?.meta?.total ?? 0}
          onPageChange={setPage}
          showToken
          emptyMessage="No appointments found for this view."
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['front-desk'] });
            queryClient.invalidateQueries({ queryKey: ['hospital'] });
          }}
        />
      </div>
    </div>
  );
}
