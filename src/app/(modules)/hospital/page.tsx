'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { toInputDateStr } from '@/lib/date-utils';
import { UserPlus, CalendarPlus, Save, QrCode, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { OPHomeToolbar } from '@/components/hospital/op-home-toolbar';
import { FrontDeskRegisterDialog } from '@/components/hospital/frontdesk-register-dialog';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { QRCodeSVG } from 'qrcode.react';
import { on } from 'events';
import { useQuery } from '@tanstack/react-query';
import { useClinicStore } from '@/stores/clinic-store';
import { MyHospital } from '@/types';
import { apiGet } from '@/lib/api';

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

  const [open, setOpen] = useState<boolean>(false);
  const selectedClinic = useClinicStore((s) => s.selectedClinic);
  
  const { data: hospital, isLoading, error } = useQuery({
    queryKey: ['hospital', 'my', selectedClinic?.id],
    queryFn: async () => {
      const res = await apiGet<MyHospital>(`/hospitals/my/${selectedClinic!.id}`);
      return res.data;
    },
    enabled: !!selectedClinic?.id,
  });
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">OP Home</h1>
        <div className="flex items-center gap-2">
          <Button
          onClick={()=>setOpen(true)}
          size="sm"
        >
            <Save className="mr-1 h-4 w-4" />
          Generate QR
        </Button>
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

      <FrontDeskRegisterDialog
        open={createPatientOpen}
        onOpenChange={setCreatePatientOpen}
        initialMode="new"
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
       <QRDialog
        open={open}
        onOpenChange={setOpen}
        text={`https://trms-frontend-dev-agcqh8-fc1e92-82-29-166-148.traefik.me/register?tenantSlug=${hospital?.slug}`}
        hospitalName={hospital?.name}
      />

    </div>
  );
}



const QRGeneration = ({ text }: { text: string }) => {
  return (
    <QRCodeSVG
      value={text}
      size={192}
      level="H"
      includeMargin={false}
      className="h-48 w-48"
    />
  );
};

const QRDialog = ({
  open,
  onOpenChange,
  text,
  hospitalName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  hospitalName?: string;
}) => {
  const qrRef=useRef(null)

  const handleQrDownload=async()=>{
    if(qrRef.current===null)return;
    try {
      const dataUrl=await toPng(qrRef.current,{cacheBust:true})
      const link=document.createElement('a')
      link.download='qr.png'
      link.href=dataUrl;
      link.click();
      onOpenChange(false)
    } catch (error) {
      toast('failed to downoad the qr ')
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <QrCode className="h-5 w-5" />
          </div>
          <DialogTitle>Hospital QR Code</DialogTitle>
          <DialogDescription>
            {hospitalName
              ? `Scan to open ${hospitalName}.`
              : 'Scan this code to open the hospital.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div
            ref={qrRef}
            className="flex h-56 w-56 items-center justify-center rounded-2xl border border-surface-container bg-white p-4 shadow-sanctuary"
          >
            <QRGeneration text={text} />
          </div>
          {/* <p className="max-w-full break-all text-center font-label text-xs text-on-surface-variant">
            {text}
          </p> */}
        </div>

        <Button onClick={handleQrDownload} className="w-full gap-2">
          <Download className="h-4 w-4" />
          Download PNG
        </Button>
      </DialogContent>
    </Dialog>
  );
};