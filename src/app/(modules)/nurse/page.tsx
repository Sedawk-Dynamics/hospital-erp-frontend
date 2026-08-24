'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toInputDateStr, formatDate, formatTime } from '@/lib/date-utils';
import {
  Search,
  CalendarIcon,
  Users,
  Pill,
  HeartPulse,
  ClipboardList,
  AlertTriangle,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  ArrowRightLeft,
  Sun,
  Sunset,
  Moon,
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
import {
  useNurseAdmissions,
  useActivePrescriptions,
  usePendingOrders,
  useAllVitals,
  useOverdueAdministrations,
  useHandovers,
  useDutyRoster,
  type NurseAdmission,
  type Vital,
  type ShiftHandover,
  type DutyRoster,
} from '@/hooks/use-nurse';
import { useMyAssignedDoctors, useMyPatients } from '@/hooks/use-nurse-doctor-assignments';
import { Stethoscope, Info } from 'lucide-react';
import { MyShiftAssignments } from '@/components/nurse/my-shift-assignments';
import { AdminHandoverBanner } from '@/components/nurse/admin-handover-banner';
import {
  useNurseAssignments,
  type ShiftType as AssignmentShiftType,
} from '@/hooks/use-nurse-assignments';
import { useActiveRoster } from '@/hooks/use-duty-rosters';
import { useAuthStore } from '@/stores/auth-store';
import { formatTemperature } from '@/lib/vitals-temperature';
import { useTemperatureUnitStore } from '@/stores/temperature-unit-store';

// ── Shift Detection ───────────────────────────────────────
//
// The nurse_admin's published DutyRoster is the source of truth. We pull the
// logged-in user's currently-active row from /hr/rosters/active and surface
// its shiftType + start/end. SHIFT_CONFIG is just a fallback for visual
// styling when the user is off-duty (clock-based detection).

type ShiftType = 'morning' | 'afternoon' | 'night' | 'general';

const SHIFT_CONFIG: Record<ShiftType, {
  label: string;
  icon: typeof Sun;
  start: string;
  end: string;
  bg: string;
  text: string;
}> = {
  morning: { label: 'Morning', icon: Sun, start: '06:00', end: '14:00', bg: 'bg-amber-100', text: 'text-amber-700' },
  afternoon: { label: 'Afternoon', icon: Sunset, start: '14:00', end: '22:00', bg: 'bg-orange-100', text: 'text-orange-700' },
  night: { label: 'Night', icon: Moon, start: '22:00', end: '06:00', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  general: { label: 'General', icon: Clock, start: '09:00', end: '17:00', bg: 'bg-sky-100', text: 'text-sky-700' },
};

const CLOCK_SHIFTS: ReadonlyArray<ShiftType> = ['morning', 'afternoon', 'night'];

function getCurrentShift(): ShiftType {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

// Prior shift in cycle: morning ← night ← afternoon ← morning. General shifts
// don't form a cycle, so they pair against themselves.
function getPreviousShift(current: ShiftType): ShiftType {
  if (current === 'morning') return 'night';
  if (current === 'afternoon') return 'morning';
  if (current === 'night') return 'afternoon';
  return 'general';
}

// ── Vital Abnormality Detection ───────────────────────────

interface VitalAlert {
  kind: 'bp_high' | 'bp_low' | 'spo2_low' | 'hr_high' | 'hr_low' | 'temp_high' | 'temp_low' | 'rr_abnormal';
  label: string;
}

function detectAbnormalities(v: Vital): VitalAlert[] {
  const alerts: VitalAlert[] = [];
  const sys = v.bloodPressureSystolic;
  const dia = v.bloodPressureDiastolic;
  if ((sys != null && sys >= 140) || (dia != null && dia >= 90)) {
    alerts.push({ kind: 'bp_high', label: `BP ${sys ?? '?'}/${dia ?? '?'}` });
  } else if ((sys != null && sys < 90) || (dia != null && dia < 60)) {
    alerts.push({ kind: 'bp_low', label: `BP ${sys ?? '?'}/${dia ?? '?'}` });
  }
  if (v.oxygenSaturation != null && v.oxygenSaturation < 94) {
    alerts.push({ kind: 'spo2_low', label: `SpO₂ ${v.oxygenSaturation}%` });
  }
  const hr = v.heartRate ?? v.pulseRate;
  if (hr != null && hr > 100) alerts.push({ kind: 'hr_high', label: `HR ${hr}` });
  else if (hr != null && hr < 60) alerts.push({ kind: 'hr_low', label: `HR ${hr}` });
  // Thresholds stay Celsius (that is what is stored); only the label is shown
  // in the reader's unit. Read straight off the store because this is a plain
  // helper, not a component — no hook to call.
  const tempUnit = useTemperatureUnitStore.getState().unit;
  if (v.temperature != null && v.temperature >= 38) {
    alerts.push({ kind: 'temp_high', label: `Temp ${formatTemperature(v.temperature, tempUnit)}` });
  } else if (v.temperature != null && v.temperature < 35) {
    alerts.push({ kind: 'temp_low', label: `Temp ${formatTemperature(v.temperature, tempUnit)}` });
  }
  if (v.respiratoryRate != null && (v.respiratoryRate > 20 || v.respiratoryRate < 12)) {
    alerts.push({ kind: 'rr_abnormal', label: `RR ${v.respiratoryRate}` });
  }
  return alerts;
}

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
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  sublabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-headline text-lg font-bold">{value}</p>
        <p className="font-label text-[10px] text-on-surface-variant truncate">{label}</p>
        {sublabel && <p className="text-[9px] text-muted-foreground">{sublabel}</p>}
      </div>
    </div>
  );
}

// ── Assigned Doctors Banner ───────────────────────────────

function AssignedDoctorsBanner({
  doctors,
  hasShiftAssignments,
}: {
  doctors: Array<{
    assignmentId: string;
    doctor: { id: string; user: { firstName: string; lastName: string | null } };
  }>;
  hasShiftAssignments: boolean;
}) {
  if (doctors.length === 0 && !hasShiftAssignments) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Info className="h-3.5 w-3.5" />
        <span>
          You haven&apos;t been assigned any doctors or shift beds yet. Nurse admin will hand
          patients over to you when the shift is set up.
        </span>
      </div>
    );
  }
  if (doctors.length === 0) {
    // Nurse has bed assignments but no doctor assignments — that's fine, just
    // let them know they're working off shift handovers only.
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <Stethoscope className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">
          Working from shift handover assignments — see beds assigned to you below.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
      <Stethoscope className="h-3.5 w-3.5 text-primary" />
      <span className="font-medium text-muted-foreground">Assigned to:</span>
      {doctors.map((d) => (
        <span
          key={d.assignmentId}
          className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"
        >
          Dr. {d.doctor.user.firstName} {d.doctor.user.lastName ?? ''}
        </span>
      ))}
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

// ── Abnormal Vitals List ──────────────────────────────────

interface AbnormalVitalRow {
  patientId: string;
  patientName: string;
  mrn?: string;
  alerts: VitalAlert[];
  recordedAt: string;
}

function AbnormalVitalsPanel({ rows }: { rows: AbnormalVitalRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
        <h2 className="font-headline text-sm font-bold mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          Abnormal Vitals
        </h2>
        <p className="text-xs text-muted-foreground">No abnormal vitals detected.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <h2 className="font-headline text-sm font-bold mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        Abnormal Vitals ({rows.length})
      </h2>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {rows.map((r) => (
          <div
            key={`${r.patientId}-${r.recordedAt}`}
            className="rounded-lg bg-red-50/50 border border-red-100 px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-foreground truncate">{r.patientName}</span>
              <span className="text-[10px] text-muted-foreground">{formatTime(r.recordedAt)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {r.alerts.map((a, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded-sm bg-red-100 text-red-700 font-medium text-[10px]"
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Handover Status Card ──────────────────────────────────

function HandoverStatusCard({
  
  pendingIncoming,
  currentShiftHandover,
  shiftStyle,
  isRostered,
}: {
  currentShift: ShiftType;
  pendingIncoming: ShiftHandover[];
  currentShiftHandover: ShiftHandover | null;
  shiftStyle: typeof SHIFT_CONFIG[ShiftType];
  isRostered: boolean;
}) {
  const cfg = shiftStyle;
  const Icon = cfg.icon;

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline text-sm font-bold flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          Handover Status
        </h2>
        <Link
          href="/nurse/handover"
          className="text-[10px] text-primary hover:underline font-medium"
        >
          View All →
        </Link>
      </div>

      {/* Current shift badge */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', cfg.bg)}>
          <Icon className={cn('h-3.5 w-3.5', cfg.text)} />
        </div>
        <div>
          <p className="font-medium text-foreground">
            {cfg.label} Shift
            {isRostered ? (
              <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-700">
                ROSTERED
              </span>
            ) : (
              <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">
                OFF DUTY
              </span>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {cfg.start} – {cfg.end}
            {isRostered ? ' · per nurse_admin roster' : ''}
          </p>
        </div>
      </div>

      {/* Pending incoming handovers (from previous shift) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pending acknowledgment</span>
          <span
            className={cn(
              'font-semibold px-1.5 py-0.5 rounded-sm text-[10px]',
              pendingIncoming.length > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700',
            )}
          >
            {pendingIncoming.length}
          </span>
        </div>

        {pendingIncoming.length > 0 ? (
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
            {pendingIncoming.slice(0, 3).map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-100 px-2 py-1.5 text-[11px]"
              >
                <Clock className="h-3 w-3 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {h.fromNurse
                      ? `${h.fromNurse.firstName} ${h.fromNurse.lastName ?? ''}`.trim()
                      : 'Unknown'}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {h.ward?.name ?? 'All wards'} · {h.shiftType}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            All caught up
          </div>
        )}
      </div>

      {/* My current shift handover */}
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">This shift&apos;s handover</span>
          {currentShiftHandover ? (
            <span
              className={cn(
                'font-semibold px-1.5 py-0.5 rounded-sm text-[10px] capitalize',
                currentShiftHandover.status === 'acknowledged'
                  ? 'bg-emerald-100 text-emerald-700'
                  : currentShiftHandover.status === 'submitted'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600',
              )}
            >
              {currentShiftHandover.status}
            </span>
          ) : (
            <span className="font-semibold px-1.5 py-0.5 rounded-sm text-[10px] bg-gray-100 text-gray-600">
              Not started
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Roster Card ───────────────────────────────────────────

function RosterCard({
  currentShift,
  roster,
  isLoading,
}: {
  currentShift: ShiftType;
  roster: DutyRoster[];
  isLoading: boolean;
}) {
  const currentShiftRoster = useMemo(
    () => roster.filter((r) => r.shiftType === currentShift),
    [roster, currentShift],
  );

  const cfg = SHIFT_CONFIG[currentShift];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-headline text-sm font-bold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          On Duty · {cfg.label}
        </h2>
        <Link
          href="/nurse/handover"
          className="text-[10px] text-primary hover:underline font-medium"
        >
          Full Roster →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : currentShiftRoster.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No one on duty for this shift.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {currentShiftRoster.map((r) => {
            const name = r.staff?.user
              ? `${r.staff.user.firstName} ${r.staff.user.lastName}`
              : 'Unknown';
            const initials = r.staff?.user
              ? `${r.staff.user.firstName[0] ?? ''}${r.staff.user.lastName[0] ?? ''}`.toUpperCase()
              : '?';
            return (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md bg-surface-container-low px-2 py-1.5 text-xs"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-foreground">{name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {r.department?.name ?? '-'}
                  </p>
                </div>
                <span className="text-[9px] text-muted-foreground flex-shrink-0">
                  {formatTime(r.startTime)}–{formatTime(r.endTime)}
                </span>
              </div>
            );
          })}
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
  href?: string;
}

function PendingTasksSection({
  vitalsDuePatients,
  overdueMedsCount,
  pendingMedsCount,
  pendingOrdersCount,
}: {
  vitalsDuePatients: { id: string; name: string }[];
  overdueMedsCount: number;
  pendingMedsCount: number;
  pendingOrdersCount: number;
}) {
  const tasks = useMemo<PendingTask[]>(() => {
    const items: PendingTask[] = [];

    // Overdue medications first (priority)
    if (overdueMedsCount > 0) {
      items.push({
        id: 'overdue-meds',
        type: 'medication',
        label: `${overdueMedsCount} overdue medication${overdueMedsCount !== 1 ? 's' : ''}`,
        patient: 'Multiple patients',
        time: 'Overdue',
        priority: 'high',
        // Straight to those doses across every patient. Linking to the bare
        // eMAR board left the nurse to guess which admission held them.
        href: '/nurse/emar?focus=overdue',
      });
    }

    // Upcoming medications (active prescriptions)
    if (pendingMedsCount > 0) {
      items.push({
        id: 'upcoming-meds',
        type: 'medication',
        label: `${pendingMedsCount} upcoming medication${pendingMedsCount !== 1 ? 's' : ''}`,
        patient: 'Scheduled eMAR rounds',
        time: 'Today',
        priority: 'normal',
        href: '/nurse/emar?focus=due',
      });
    }

    // Vitals due — list top 3 patients with no recent vitals
    vitalsDuePatients.slice(0, 3).forEach((p) => {
      items.push({
        id: `vitals-${p.id}`,
        type: 'vitals',
        label: 'Record vitals',
        patient: p.name,
        time: 'Due now',
        priority: 'high',
        href: `/nurse/vitals?patientId=${p.id}`,
      });
    });

    // Pending orders
    if (pendingOrdersCount > 0) {
      items.push({
        id: 'order-summary',
        type: 'order',
        label: `${pendingOrdersCount} doctor order${pendingOrdersCount !== 1 ? 's' : ''} to acknowledge`,
        patient: 'Multiple patients',
        time: 'Pending',
        priority: 'normal',
        href: '/nurse/orders',
      });
    }

    return items;
  }, [vitalsDuePatients, overdueMedsCount, pendingMedsCount, pendingOrdersCount]);

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
        {tasks.map((task) => {
          const body = (
            <>
              <div className={cn('h-2 w-2 rounded-full flex-shrink-0', priorityDot[task.priority])} />
              <div className="flex-shrink-0">{typeIcons[task.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{task.label}</p>
                <p className="text-muted-foreground truncate">{task.patient}</p>
              </div>
              <span className="text-muted-foreground flex-shrink-0">{task.time}</span>
            </>
          );
          return task.href ? (
            <Link
              key={task.id}
              href={task.href}
              className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-xs hover:bg-surface-container transition-colors"
            >
              {body}
            </Link>
          ) : (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-xs"
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── OPD Confirmed List ────────────────────────────────────

const APPT_STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Confirmed', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  checked_in: { label: 'Checked In', bg: 'bg-blue-100', text: 'text-blue-700' },
  waiting: { label: 'Waiting', bg: 'bg-amber-100', text: 'text-amber-700' },
  in_consultation: { label: 'In Consult', bg: 'bg-violet-100', text: 'text-violet-700' },
};

interface OpdRecord {
  id: string;
  appointmentId?: string;
  visitId?: string | null;
  patientId: string;
  patient: {
    id: string;
    mrn: string | null;
    firstName: string;
    lastName: string | null;
    gender?: string | null;
    phone?: string | null;
  };
  doctor: {
    id: string;
    user: { firstName: string; lastName: string | null };
  };
  status: string;
  appointmentDate?: string;
  startTime?: string;
}

function OpdConfirmedList({
  records,
  isLoading,
}: {
  records: OpdRecord[];
  isLoading: boolean;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          <h2 className="font-headline text-sm font-bold">OPD · Frontdesk-confirmed</h2>
          <span className="text-[10px] text-muted-foreground">
            ({records.length} patient{records.length !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/nurse/vitals?kind=opd"
            className="text-[10px] text-primary hover:underline font-medium"
          >
            Record vitals →
          </Link>
          <Link
            href="/nurse/forms"
            className="text-[10px] text-primary hover:underline font-medium"
          >
            Open forms →
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-center">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : records.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No frontdesk-confirmed OPD bookings under your assigned doctors today.
        </p>
      ) : (
        <ul className="divide-y">
          {records.map((r) => {
            const initials = `${r.patient.firstName?.[0] ?? ''}${r.patient.lastName?.[0] ?? ''}`.toUpperCase();
            const fullName = `${r.patient.firstName} ${r.patient.lastName ?? ''}`.trim();
            const statusCfg = APPT_STATUS_LABELS[r.status] ?? {
              label: r.status,
              bg: 'bg-gray-100',
              text: 'text-gray-700',
            };
            const targetParam = r.visitId
              ? `visitId=${r.visitId}`
              : `appointmentId=${r.appointmentId ?? r.id}`;
            return (
              <li key={r.id}>
                <Link
                  href={`/nurse/forms/${r.patientId}?${targetParam}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {initials || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {fullName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[
                        r.patient.mrn ? `MRN ${r.patient.mrn}` : null,
                        `Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName ?? ''}`.trim(),
                        r.startTime ? formatTime(r.startTime) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      statusCfg.bg,
                      statusCfg.text,
                    )}
                  >
                    {statusCfg.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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
  onRecordVitals,
}: {
  admissions: NurseAdmission[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onRecordVitals: (patientId: string) => void;
}) {
  const router = useRouter();
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

                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{doctorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {adm.doctor?.specialization || '-'}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground truncate max-w-[180px]">
                      {adm.diagnosis || adm.complaints || '-'}
                    </p>
                  </td>

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

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        title="View patient"
                        nativeButton={false}
                        render={<Link href={`/nurse/ip/${adm.id}`} />}
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
                          <DropdownMenuItem onClick={() => onRecordVitals(adm.patientId)}>
                            <HeartPulse className="mr-2 h-4 w-4" />
                            Record Vitals
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/nurse/emar?admissionId=${adm.id}`)}
                          >
                            <Pill className="mr-2 h-4 w-4" />
                            eMAR / Medications
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/nurse/charting?admissionId=${adm.id}&patientId=${adm.patientId}`)
                            }
                          >
                            <ClipboardList className="mr-2 h-4 w-4" />
                            Clinical Charting
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/nurse/ip/${adm.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Open IP Workspace
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

// A patient's vitals are "due" if their most recent reading is older than this.
const VITALS_DUE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4h

export default function NurseDashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState('all');
  const [fromDate, setFromDate] = useState(toInputDateStr());
  const [toDate, setToDate] = useState(toInputDateStr());
  const [page, setPage] = useState(1);

  // Source of truth = nurse_admin's roster. We fetch the nurse's currently
  // active row from /hr/rosters/active and use its shiftType + start/end
  // times. If the nurse isn't rostered right now, fall back to clock-based
  // detection so the page still renders (just labelled "off duty").
  const { user: authUserForShift } = useAuthStore();
  const { data: myActive } = useActiveRoster(
    authUserForShift?.id ? { userId: authUserForShift.id } : {},
  );
  const rosteredShift = (myActive?.mine?.shiftType ?? null) as ShiftType | null;
  const clockShift = useMemo(() => getCurrentShift(), []);
  // Source of truth: rostered shiftType if the nurse is currently on duty.
  // Otherwise fall back to clock-based detection so the page still has a
  // sensible "where in the day are we" anchor while off duty.
  const currentShift: ShiftType =
    rosteredShift && (rosteredShift in SHIFT_CONFIG)
      ? rosteredShift
      : clockShift;
  const prevShift = useMemo(() => getPreviousShift(currentShift), [currentShift]);
  const baseShiftStyle = SHIFT_CONFIG[currentShift];
  const isRostered = Boolean(myActive?.mine);
  // When rostered, surface the *actual* start/end stored on the roster row
  // (HH:MM in UTC). Otherwise fall back to the SHIFT_CONFIG defaults.
  const shiftStyle = useMemo(() => {
    if (!isRostered) return baseShiftStyle;
    const m = myActive!.mine!;
    const s = new Date(m.startTime);
    const e = new Date(m.endTime);
    const fmt = (d: Date) =>
      `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
    return { ...baseShiftStyle, start: fmt(s), end: fmt(e) };
  }, [isRostered, myActive, baseShiftStyle]);
  const today = useMemo(() => toInputDateStr(), []);

  // ── Core queries ─────────────────────────────────────────
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

  // Real abnormal-vitals: fetch recent vitals and inspect readings
  const { data: vitalsData } = useAllVitals({ limit: 100 });

  // Real overdue meds count
  const { data: overdueMedsData } = useOverdueAdministrations({ limit: 100 });

  // Incoming handovers (from previous shift, not yet acknowledged)
  const { data: incomingHandoversData } = useHandovers({
    shiftType: prevShift,
    shiftDate: today,
    isAcknowledged: 'false',
    limit: 20,
  });

  // Current shift's own handover (for status)
  const { data: currentHandoversData } = useHandovers({
    shiftType: currentShift,
    shiftDate: today,
    limit: 5,
  });

  // Today's roster for all shifts
  const { data: rosterData, isLoading: rosterLoading } = useDutyRoster({ date: today });

  // Doctors I'm currently assigned to. Per SOW, a nurse only handles patients
  // under their assigned doctors. Empty list ⇒ unassigned ⇒ show no patients.
  const { user: authUser } = useAuthStore();
  const { data: myDoctorsData } = useMyAssignedDoctors();
  const myDoctors = myDoctorsData?.data ?? [];
  const myDoctorIds = useMemo(
    () => new Set(myDoctors.map((d) => d.doctor.id)),
    [myDoctors],
  );

  // Bed-level assignments handed to me by nurse_admin for the current shift.
  // The dashboard surfaces these alongside doctor-based admissions so a nurse
  // who's just received a handover sees those patients without further setup.
  const { data: myShiftAssignmentsData } = useNurseAssignments({
    nurseId: authUser?.id,
    shiftDate: today,
    shiftType: currentShift as AssignmentShiftType,
    status: 'active',
    limit: 200,
  });
  const myAssignedAdmissionIds = useMemo(() => {
    const items = myShiftAssignmentsData?.items ?? [];
    return new Set(items.map((a) => a.admissionId));
  }, [myShiftAssignmentsData]);

  // OPD appointments where front-desk has confirmed the booking (status one
  // of confirmed | checked_in | waiting | in_consultation), scoped to the
  // nurse's assigned doctors. Server-side filter; the empty-doctors case
  // returns an empty list.
  const { data: opdData, isLoading: opdLoading } = useMyPatients({
    type: 'op',
    date: fromDate,
    search: searchQuery || undefined,
    limit: 50,
  });
  const opdRecords = opdData?.data ?? [];

  // ── Derive state ─────────────────────────────────────────
  const allAdmissions = admissionsData?.data ?? [];
  const admissions = useMemo(
    () =>
      allAdmissions.filter((a) => {
        const byDoctor = a.doctorId && myDoctorIds.has(a.doctorId);
        const byShift = myAssignedAdmissionIds.has(a.id);
        return byDoctor || byShift;
      }),
    [allAdmissions, myDoctorIds, myAssignedAdmissionIds],
  );
  const totalAdmissions = admissions.length;
  const totalPages = 1;

  const pendingMedsCount =
    prescriptionsData?.meta?.total ?? prescriptionsData?.data?.length ?? 0;
  const pendingOrdersCount =
    ordersData?.meta?.total ?? ordersData?.data?.length ?? 0;
  const overdueMedsCount =
    overdueMedsData?.meta?.total ?? overdueMedsData?.data?.length ?? 0;

  // Derive abnormal vitals per patient (take most recent reading per patient only)
  const abnormalVitalRows = useMemo<AbnormalVitalRow[]>(() => {
    const vitals = vitalsData?.data ?? [];
    const latestByPatient = new Map<string, typeof vitals[number]>();
    for (const v of vitals) {
      if (!v.createdAt) continue;
      const existing = latestByPatient.get(v.patientId);
      const vTime = new Date(v.createdAt).getTime();
      if (!existing || vTime > new Date(existing.createdAt!).getTime()) {
        latestByPatient.set(v.patientId, v);
      }
    }

    const rows: AbnormalVitalRow[] = [];
    latestByPatient.forEach((v) => {
      const alerts = detectAbnormalities(v);
      if (alerts.length === 0) return;
      const name = v.patient
        ? `${v.patient.firstName} ${v.patient.lastName}`
        : 'Unknown';
      rows.push({
        patientId: v.patientId,
        patientName: name,
        mrn: v.patient?.mrn,
        alerts,
        recordedAt: v.createdAt!,
      });
    });
    return rows;
  }, [vitalsData]);

  const abnormalVitalsCount = abnormalVitalRows.length;

  // Vitals due: admitted patients whose latest vital is older than threshold (or none)
  const vitalsDuePatients = useMemo<{ id: string; name: string }[]>(() => {
    const vitals = vitalsData?.data ?? [];
    const latestByPatient = new Map<string, number>();
    for (const v of vitals) {
      if (!v.createdAt) continue;
      const t = new Date(v.createdAt).getTime();
      const prev = latestByPatient.get(v.patientId);
      if (!prev || t > prev) latestByPatient.set(v.patientId, t);
    }
    const now = Date.now();
    return admissions
      .filter((adm) => {
        const last = latestByPatient.get(adm.patientId);
        return last == null || now - last > VITALS_DUE_THRESHOLD_MS;
      })
      .map((adm) => ({
        id: adm.patientId,
        name: adm.patient
          ? `${adm.patient.firstName} ${adm.patient.lastName}`
          : 'Unknown',
      }));
  }, [vitalsData, admissions]);

  const vitalsDueCount = vitalsDuePatients.length;

  // Handover data
  const pendingIncoming = incomingHandoversData?.data ?? [];
  const currentShiftHandover = currentHandoversData?.data?.[0] ?? null;

  const roster = rosterData?.data ?? [];

  // Ward options derived from admissions
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
              'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
              shiftStyle.bg,
              shiftStyle.text,
            )}
          >
            {shiftStyle.label} · {shiftStyle.start}–{shiftStyle.end}
          </span>
          {isRostered ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              On Duty
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Off Duty
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(new Date())}
        </div>
      </div>

      {/* Assigned doctors banner — defines which patients this nurse handles */}
      <AssignedDoctorsBanner
        doctors={myDoctors}
        hasShiftAssignments={myAssignedAdmissionIds.size > 0}
      />

      {/* Auto-populated handover plan from nurse_admin's roster-driven bulk
          handover. Shows incoming patients ("from Nurse X") and outgoing
          ("you handed off to Nurse Y") so the nurse never has to ask. */}
      <AdminHandoverBanner />

      {/* Critical Alerts Banner */}
      <CriticalAlertsBanner
        abnormalVitalsCount={abnormalVitalsCount}
        overdueMedsCount={overdueMedsCount}
      />

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <QuickStatCard
          icon={<Users className="h-4 w-4" />}
          label="IPD Patients"
          value={totalAdmissions}
          color="bg-primary/10 text-primary"
        />
        <QuickStatCard
          icon={<Stethoscope className="h-4 w-4" />}
          label="OPD Confirmed"
          value={opdRecords.length}
          color="bg-teal-50 text-teal-600"
          sublabel="Frontdesk confirmed"
        />
        <QuickStatCard
          icon={<Pill className="h-4 w-4" />}
          label="Overdue Meds"
          value={overdueMedsCount}
          color="bg-amber-50 text-amber-600"
          sublabel={pendingMedsCount > 0 ? `${pendingMedsCount} upcoming` : undefined}
        />
        <Link href="/nurse/vitals" className="block">
          <QuickStatCard
            icon={<HeartPulse className="h-4 w-4" />}
            label="Vitals Due"
            value={vitalsDueCount}
            color="bg-red-50 text-red-600"
          />
        </Link>
        <QuickStatCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Pending Orders"
          value={pendingOrdersCount}
          color="bg-blue-50 text-blue-600"
        />
      </div>

      {/* Two-column grid: Tasks+Alerts left, Handover+Roster right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PendingTasksSection
            vitalsDuePatients={vitalsDuePatients}
            overdueMedsCount={overdueMedsCount}
            pendingMedsCount={pendingMedsCount}
            pendingOrdersCount={pendingOrdersCount}
          />
          <AbnormalVitalsPanel rows={abnormalVitalRows} />
        </div>

        <div className="space-y-4">
          <MyShiftAssignments
            shiftDate={today}
            shiftType={currentShift as AssignmentShiftType}
            variant="compact"
          />
          <HandoverStatusCard
            currentShift={currentShift}
            pendingIncoming={pendingIncoming}
            currentShiftHandover={currentShiftHandover}
            shiftStyle={shiftStyle}
            isRostered={isRostered}
          />
          <RosterCard
            currentShift={currentShift}
            roster={roster}
            isLoading={rosterLoading}
          />
        </div>
      </div>

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

      {/* Assigned IPD Patient List Table */}
      <PatientListTable
        admissions={admissions}
        isLoading={admissionsLoading}
        page={page}
        totalPages={totalPages}
        total={totalAdmissions}
        onPageChange={setPage}
        onRecordVitals={(patientId) =>
          router.push(`/nurse/vitals?patientId=${patientId}`)
        }
      />

      {/* OPD: today's frontdesk-confirmed bookings under my assigned doctors. */}
      <OpdConfirmedList records={opdRecords as OpdRecord[]} isLoading={opdLoading} />
    </div>
  );
}
