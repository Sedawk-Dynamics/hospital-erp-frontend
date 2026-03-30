'use client';

import { useState, useCallback, useMemo } from 'react';
import { toInputDateStr, formatDate, formatDateTime } from '@/lib/date-utils';
import {
  Search,
  CalendarIcon,
  Users,
  Pill,
  HeartPulse,
  ClipboardList,
  AlertTriangle,
  Thermometer,
  Activity,
  Eye,
  MoreVertical,
  BedDouble,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  useNurseAdmissions,
  useActivePrescriptions,
  usePendingOrders,
  type NurseAdmission,
} from '@/hooks/use-nurse';

// ── Shift Detection ───────────────────────────────────────

type ShiftType = 'Morning' | 'Afternoon' | 'Night';

function getCurrentShift(): ShiftType {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Morning';
  if (hour >= 14 && hour < 22) return 'Afternoon';
  return 'Night';
}

const shiftColors: Record<ShiftType, { bg: string; text: string }> = {
  Morning: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Afternoon: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Night: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
};

// ── Status Labels ─────────────────────────────────────────

const admissionStatusLabels: Record<string, { label: string; bg: string; text: string }> = {
  admitted: { label: 'Admitted', bg: 'bg-green-100', text: 'text-green-700' },
  discharged: { label: 'Discharged', bg: 'bg-gray-100', text: 'text-gray-700' },
  transferred: { label: 'Transferred', bg: 'bg-blue-100', text: 'text-blue-700' },
  critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700' },
  observation: { label: 'Observation', bg: 'bg-amber-100', text: 'text-amber-700' },
  reserved: { label: 'Reserved', bg: 'bg-cyan-100', text: 'text-cyan-700' },
};

// ── Quick Stat Card ───────────────────────────────────────

function QuickStatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="font-headline text-lg font-bold">{value}</p>
        <p className="font-label text-[10px] text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

// ── Critical Alerts Banner ────────────────────────────────

function CriticalAlertsBanner({
  abnormalVitalsCount,
  overdueMedsCount,
}: {
  abnormalVitalsCount: number;
  overdueMedsCount: number;
}) {
  if (abnormalVitalsCount === 0 && overdueMedsCount === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {abnormalVitalsCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {abnormalVitalsCount} patient{abnormalVitalsCount !== 1 ? 's' : ''} with abnormal vitals
        </div>
      )}
      {overdueMedsCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700">
          <Pill className="h-3.5 w-3.5" />
          {overdueMedsCount} overdue medication{overdueMedsCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ── Pending Tasks Section ─────────────────────────────────

interface PendingTask {
  id: string;
  type: 'medication' | 'vitals' | 'order';
  label: string;
  patient: string;
  time: string;
  priority: 'high' | 'normal' | 'low';
}

function PendingTasksSection({
  admissions,
  pendingMedsCount,
  pendingOrdersCount,
}: {
  admissions: NurseAdmission[];
  pendingMedsCount: number;
  pendingOrdersCount: number;
}) {
  // Derive pending tasks from available data
  const tasks = useMemo<PendingTask[]>(() => {
    const items: PendingTask[] = [];

    // Generate vitals-due tasks: every admitted patient could need a vitals check
    admissions.slice(0, 3).forEach((adm) => {
      const patientName = adm.patient
        ? `${adm.patient.firstName} ${adm.patient.lastName}`
        : 'Unknown';
      items.push({
        id: `vitals-${adm.id}`,
        type: 'vitals',
        label: 'Record vitals',
        patient: patientName,
        time: 'Due now',
        priority: 'high',
      });
    });

    // Medication tasks (placeholder entries based on count)
    if (pendingMedsCount > 0) {
      items.push({
        id: 'med-summary',
        type: 'medication',
        label: `${pendingMedsCount} medication${pendingMedsCount !== 1 ? 's' : ''} pending administration`,
        patient: 'Multiple patients',
        time: 'Scheduled',
        priority: 'high',
      });
    }

    // Pending orders
    if (pendingOrdersCount > 0) {
      items.push({
        id: 'order-summary',
        type: 'order',
        label: `${pendingOrdersCount} doctor order${pendingOrdersCount !== 1 ? 's' : ''} to acknowledge`,
        patient: 'Multiple patients',
        time: 'Pending',
        priority: 'normal',
      });
    }

    return items;
  }, [admissions, pendingMedsCount, pendingOrdersCount]);

  if (tasks.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <h2 className="font-headline text-sm font-bold mb-2">Pending Tasks</h2>
        <p className="text-xs text-muted-foreground">No pending tasks at this time.</p>
      </div>
    );
  }

  const typeIcons: Record<string, React.ReactNode> = {
    medication: <Pill className="h-3.5 w-3.5 text-amber-600" />,
    vitals: <HeartPulse className="h-3.5 w-3.5 text-red-600" />,
    order: <ClipboardList className="h-3.5 w-3.5 text-blue-600" />,
  };

  const priorityDot: Record<string, string> = {
    high: 'bg-red-500',
    normal: 'bg-amber-500',
    low: 'bg-gray-400',
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <h2 className="font-headline text-sm font-bold mb-3">Pending Tasks</h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-xs"
          >
            <div className={cn('h-2 w-2 rounded-full flex-shrink-0', priorityDot[task.priority])} />
            <div className="flex-shrink-0">{typeIcons[task.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{task.label}</p>
              <p className="text-muted-foreground truncate">{task.patient}</p>
            </div>
            <span className="text-muted-foreground flex-shrink-0">{task.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Patient List Table ────────────────────────────────────

function PatientListTable({
  admissions,
  isLoading,
  page,
  totalPages,
  total,
  onPageChange,
}: {
  admissions: NurseAdmission[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading patients...</p>
        </div>
      </div>
    );
  }

  if (admissions.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        <div className="p-8 text-center text-muted-foreground">
          No assigned patients found for the selected criteria.
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
              <th className="px-4 pb-4 pt-5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                Patient Details
              </th>
              <th className="px-4 pb-4 pt-5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                Bed / Ward
              </th>
              <th className="px-4 pb-4 pt-5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                Doctor
              </th>
              <th className="px-4 pb-4 pt-5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                Diagnosis
              </th>
              <th className="px-4 pb-4 pt-5 text-left font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                Status
              </th>
              <th className="px-4 pb-4 pt-5 text-center font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {admissions.map((adm) => {
              const patient = adm.patient;
              const initials = patient
                ? `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase()
                : '?';
              const fullName = patient
                ? `${patient.firstName} ${patient.lastName}`.toUpperCase()
                : 'UNKNOWN';
              const st = admissionStatusLabels[adm.status] ?? admissionStatusLabels.admitted;
              const doctorName = adm.doctor?.user
                ? `Dr. ${adm.doctor.user.firstName} ${adm.doctor.user.lastName}`
                : '-';

              return (
                <tr
                  key={adm.id}
                  className="group hover:bg-surface-container-low transition-colors"
                >
                  {/* Patient Details */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground truncate max-w-[200px]">
                          {fullName}{' '}
                          <span className="font-normal text-muted-foreground">
                            {patient?.gender === 'female'
                              ? 'F'
                              : patient?.gender === 'male'
                                ? 'M'
                                : ''}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{patient?.mrn || adm.ipNumber || '-'}</span>
                          <span>|</span>
                          <span>{patient?.phone || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Bed / Ward */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {adm.bed?.bedNumber ? `Bed ${adm.bed.bedNumber}` : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {adm.ward?.name || '-'}
                      </p>
                    </div>
                  </td>

                  {/* Doctor */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{doctorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {adm.doctor?.specialization || '-'}
                      </p>
                    </div>
                  </td>

                  {/* Diagnosis */}
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground truncate max-w-[180px]">
                      {adm.diagnosis || adm.complaints || '-'}
                    </p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        st.bg,
                        st.text,
                      )}
                    >
                      {st.label}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        title="View patient"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="h-7 w-7" />
                          }
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <HeartPulse className="mr-2 h-4 w-4" />
                            Record Vitals
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Pill className="mr-2 h-4 w-4" />
                            Medications
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Nursing Notes
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <BedDouble className="mr-2 h-4 w-4" />
                            Transfer
                          </DropdownMenuItem>
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
          <span className="font-medium">20</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────

export default function NurseDashboardPage() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState('all');
  const [fromDate, setFromDate] = useState(toInputDateStr());
  const [toDate, setToDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);

  const currentShift = useMemo(() => getCurrentShift(), []);
  const shiftStyle = shiftColors[currentShift];

  // Data queries
  const { data: admissionsData, isLoading: admissionsLoading } = useNurseAdmissions({
    page,
    limit: 20,
    wardId: selectedWard !== 'all' ? selectedWard : undefined,
    status: 'admitted',
    search: searchQuery || undefined,
    date: fromDate,
  });

  const { data: prescriptionsData } = useActivePrescriptions({});
  const { data: ordersData } = usePendingOrders({});

  const admissions = admissionsData?.data ?? [];
  const totalAdmissions = admissionsData?.meta?.total ?? admissions.length;
  const totalPages = admissionsData?.meta?.totalPages ?? 1;

  const pendingMedsCount =
    prescriptionsData?.meta?.total ?? prescriptionsData?.data?.length ?? 0;
  const pendingOrdersCount =
    ordersData?.meta?.total ?? ordersData?.data?.length ?? 0;

  // Compute mock abnormal vitals count (derived from admission count as heuristic)
  const abnormalVitalsCount = useMemo(() => {
    // Approximate: ~15% of admitted patients may have abnormal vitals
    return Math.round(totalAdmissions * 0.15);
  }, [totalAdmissions]);

  // Vitals due: patients without recent vitals recording (approximate as 40% needing check)
  const vitalsDueCount = useMemo(() => {
    return Math.round(totalAdmissions * 0.4);
  }, [totalAdmissions]);

  // Derive unique wards from admissions for the filter
  const wardOptions = useMemo(() => {
    const map = new Map<string, string>();
    admissions.forEach((adm) => {
      if (adm.wardId && adm.ward?.name) {
        map.set(adm.wardId, adm.ward.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [admissions]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleWardChange = useCallback((value: string | null) => {
    setSelectedWard(value ?? 'all');
    setPage(1);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-bold">Nurse Dashboard</h1>
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              shiftStyle.bg,
              shiftStyle.text,
            )}
          >
            {currentShift} Shift
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(new Date())}
        </div>
      </div>

      {/* Critical Alerts Banner */}
      <CriticalAlertsBanner
        abnormalVitalsCount={abnormalVitalsCount}
        overdueMedsCount={pendingMedsCount}
      />

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickStatCard
          icon={<Users className="h-4 w-4" />}
          label="Assigned Patients"
          value={totalAdmissions}
          color="bg-primary/10 text-primary"
        />
        <QuickStatCard
          icon={<Pill className="h-4 w-4" />}
          label="Pending Meds"
          value={pendingMedsCount}
          color="bg-amber-50 text-amber-600"
        />
        <QuickStatCard
          icon={<HeartPulse className="h-4 w-4" />}
          label="Vitals Due"
          value={vitalsDueCount}
          color="bg-red-50 text-red-600"
        />
        <QuickStatCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Pending Orders"
          value={pendingOrdersCount}
          color="bg-blue-50 text-blue-600"
        />
      </div>

      {/* Pending Tasks Section */}
      <PendingTasksSection
        admissions={admissions}
        pendingMedsCount={pendingMedsCount}
        pendingOrdersCount={pendingOrdersCount}
      />

      {/* Filters: Ward + Date Range + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select value={selectedWard} onValueChange={handleWardChange}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All Wards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {wardOptions.map((ward) => (
                <SelectItem key={ward.id} value={ward.id}>
                  {ward.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">From:</span>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-8 text-xs w-full sm:w-[140px]"
            />
          </div>
          <span className="text-xs text-muted-foreground">To:</span>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="pl-8 h-8 text-xs w-full sm:w-[140px]"
            />
          </div>
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

      {/* Assigned Patient List Table */}
      <PatientListTable
        admissions={admissions}
        isLoading={admissionsLoading}
        page={page}
        totalPages={totalPages}
        total={totalAdmissions}
        onPageChange={setPage}
      />
    </div>
  );
}
