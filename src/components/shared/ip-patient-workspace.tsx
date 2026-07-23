'use client';

// IPPatientWorkspace
// ──────────────────────────────────────────────────────────────────────────
// Single shared "in-patient detail" view used by:
//   • /doctor/ip/[admissionId]
//   • /nurse/ip/[admissionId]
//   • /hospital/ip/[admissionId]
//
// Brings together the moving parts of an IP stay so doctors, nurses and admin
// staff can land on one URL and see everything tied to that admission:
// overview, vitals (nurses record from /nurse/charting; doctors capture inline),
// today's eMAR doses, active prescriptions, progress notes, lab + imaging
// orders, and patient demographics.
//
// Action buttons are role-aware: doctors get prescription / discharge-summary
// quick links, nurses get charting + eMAR shortcuts, admin gets transfer/
// discharge. Anyone can deep-link out to the dedicated pages with the
// admissionId / patientId pre-filled.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clipboard,
  ClipboardList,
  Clock,
  Droplets,
  FileText,
  FlaskConical,
  Heart,
  HeartPulse,
  ImageIcon,
  Loader2,
  Pill,
  PillBottle,
  Plus,
  Search,
  Stethoscope,
  Thermometer,
  User,
  Wind,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RecordVitalsDialog } from '@/components/shared/record-vitals-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Base-UI Button doesn't support `asChild`; use the `render` prop with a Link
// element so prefetching + accessibility on the underlying anchor still apply.
type LinkButtonProps = React.ComponentProps<typeof Button> & { href: string };
function LinkButton({ href, children, ...props }: LinkButtonProps) {
  return (
    <Button nativeButton={false} render={<Link href={href} />} {...props}>
      {children}
    </Button>
  );
}
import { formatDate, formatDateTime, formatTime } from '@/lib/date-utils';

import { useAdmissionDetail, usePatientVitals, useLatestVitals, useActivePrescriptions, useNursingNotes } from '@/hooks/use-nurse';
import { useEmarSchedules, type EmarSchedule } from '@/hooks/use-emar';
import { useProgressNotes, useLabOrders, useImagingRequests, usePatientDetail, type ProgressNote } from '@/hooks/use-doctor';
import { LabOrderDetailDialog } from '@/components/shared/lab-order-detail-dialog';
import { IpPrescriptionDialog } from '@/components/doctor/ip-prescription-dialog';
import { LabOrderDialog } from '@/components/doctor/lab-order-dialog';
import { ImagingRequestDialog } from '@/components/doctor/imaging-request-dialog';
import { IpLedgerPanel, IpActivityLog } from '@/components/shared/ip-ledger-panel';
import { IpProgressNoteComposer } from '@/components/doctor/ip-progress-note-composer';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

import type { NurseAdmission, NursingNote, Prescription, Vital } from '@/hooks/use-nurse';

// Hooks here return raw `ApiResponse<T>` — pull out the inner payload safely.
function unwrapList<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  const inner = (value as { data?: unknown }).data;
  if (Array.isArray(inner)) return inner as T[];
  return [];
}
function unwrapOne<T>(value: unknown): T | undefined {
  if (!value) return undefined;
  const inner = (value as { data?: unknown }).data;
  if (inner !== undefined && inner !== null) return inner as T;
  return value as T;
}

// ── Roles ──────────────────────────────────────────────────────────────────

export type WorkspaceRole = 'doctor' | 'nurse' | 'admin';

interface IPPatientWorkspaceProps {
  admissionId: string;
  role: WorkspaceRole;
  /** Where the back button should go (defaults to the IP home for the role). */
  backHref?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calcAge(dob?: string | null): string | null {
  if (!dob) return null;
  try {
    const birth = new Date(dob);
    const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return `${years}y`;
  } catch {
    return null;
  }
}

function bpAbnormal(s?: number, d?: number) {
  return (s != null && (s > 140 || s < 90)) || (d != null && (d > 90 || d < 60));
}
function tempAbnormal(t?: number) { return t != null && (t > 38.5 || t < 35.5); }
function spo2Abnormal(v?: number) { return v != null && v < 95; }
function pulseAbnormal(v?: number) { return v != null && (v > 100 || v < 60); }
function rrAbnormal(v?: number) { return v != null && (v > 20 || v < 12); }

function defaultBackHref(role: WorkspaceRole): string {
  if (role === 'doctor') return '/doctor/ip';
  if (role === 'nurse') return '/nurse';
  return '/hospital/ip';
}

// ── Sub-panels ─────────────────────────────────────────────────────────────

function HeaderStrip({
  admission,
  role,
  backHref,
  onNewRx,
}: {
  admission: NurseAdmission;
  role: WorkspaceRole;
  backHref: string;
  onNewRx?: () => void;
}) {

  const patient = admission.patient;
  const age = calcAge(patient?.dateOfBirth);
  const initials = `${patient?.firstName?.[0] ?? ''}${patient?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="flex items-start gap-3">
        <Link href={backHref} className="rounded-md p-1 hover:bg-surface-container">
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initials || <User className="h-5 w-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
              {patient?.firstName} {patient?.lastName}
            </h1>
            <span className="text-xs text-muted-foreground">
              {patient?.mrn ? `MRN ${patient.mrn}` : ''}
              {patient?.gender ? ` · ${patient.gender.toUpperCase()}` : ''}
              {age ? ` · ${age}` : ''}
              {patient?.phone ? ` · ${patient.phone}` : ''}
              {patient?.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-mono">
              IP {admission.ipNumber || admission.id.slice(0, 8).toUpperCase()}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {admission.ward?.name ?? '—'} / Bed {admission.bed?.bedNumber ?? '—'}
            </span>
            {admission.doctor?.user && (
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="h-3.5 w-3.5" />
                Dr. {admission.doctor.user.firstName} {admission.doctor.user.lastName}
              </span>
            )}
            {(() => {
              const na = (admission as unknown as { nurseAssignments?: Array<{ nurse?: { firstName?: string; lastName?: string }; shiftType?: string }> }).nurseAssignments?.[0];
              if (!na?.nurse) return null;
              return (
                <span className="inline-flex items-center gap-1" title="Assigned nurse">
                  <HeartPulse className="h-3.5 w-3.5" />
                  {`Nurse ${na.nurse.firstName ?? ''} ${na.nurse.lastName ?? ''}`.trim()}{na.shiftType ? ` · ${na.shiftType}` : ''}
                </span>
              );
            })()}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Admitted {formatDate(admission.admissionDate)}
            </span>
            <Badge
              className={cn(
                'capitalize',
                admission.status === 'admitted' && 'bg-blue-100 text-blue-700 hover:bg-blue-100',
                admission.status === 'discharged' && 'bg-green-100 text-green-700 hover:bg-green-100',
                admission.status === 'transferred' && 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
                admission.status === 'absconded' && 'bg-red-100 text-red-700 hover:bg-red-100',
              )}
              variant="outline"
            >
              {admission.status}
            </Badge>
          </div>
        </div>

        {/* Role-aware quick actions */}
        <div className="hidden md:flex items-center gap-1.5">
          {role === 'doctor' && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onNewRx}>
                <Pill className="h-3.5 w-3.5" />
                Prescribe
              </Button>
              <LinkButton variant="outline" size="sm" className="gap-1.5" href={`/doctor/discharge-summary?admissionId=${admission.id}`}>
                <FileText className="h-3.5 w-3.5" />
                Discharge Summary
              </LinkButton>
            </>
          )}
          {role === 'nurse' && (
            <>
              <LinkButton variant="outline" size="sm" className="gap-1.5" href={`/nurse/charting?admissionId=${admission.id}&patientId=${admission.patientId}`}>
                <ClipboardList className="h-3.5 w-3.5" />
                Open Charting
              </LinkButton>
              <LinkButton variant="outline" size="sm" className="gap-1.5" href={`/nurse/emar?admissionId=${admission.id}`}>
                <PillBottle className="h-3.5 w-3.5" />
                Open eMAR
              </LinkButton>
            </>
          )}
          {role === 'admin' && (
            <LinkButton variant="outline" size="sm" className="gap-1.5" href={`/hospital/ip`}>
              <BedDouble className="h-3.5 w-3.5" />
              Manage IP
            </LinkButton>
          )}
        </div>
      </div>

      <AllergyBanner patientId={admission.patientId} />
    </div>
  );
}

function AllergyBanner({ patientId }: { patientId: string }) {
  const { data: patient } = usePatientDetail(patientId);
  if (!patient?.allergies || patient.allergies.length === 0) return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
      <div className="flex flex-wrap gap-1.5">
        {patient.allergies.map((a) => (
          <Badge key={a.id} variant="destructive" className="text-[10px]">
            {a.allergen}{a.severity ? ` (${a.severity})` : ''}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ── Latest vitals strip ────────────────────────────────────────────────────

function LatestVitalsStrip({ patientId, role, admissionId }: { patientId: string; role: WorkspaceRole; admissionId: string }) {
  const { data, isLoading } = useLatestVitals(patientId);
  const latest = useMemo(() => unwrapOne<Vital>(data), [data]);
  const [recordOpen, setRecordOpen] = useState(false);

  const cards = [
    { label: 'BP', value: latest?.bloodPressureSystolic ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic ?? '-'}` : null, unit: 'mmHg', icon: Activity, abnormal: bpAbnormal(latest?.bloodPressureSystolic, latest?.bloodPressureDiastolic) },
    { label: 'Temp', value: latest?.temperature ?? null, unit: '°C', icon: Thermometer, abnormal: tempAbnormal(latest?.temperature) },
    { label: 'Pulse', value: latest?.pulseRate ?? latest?.heartRate ?? null, unit: 'bpm', icon: Heart, abnormal: pulseAbnormal(latest?.pulseRate ?? latest?.heartRate) },
    { label: 'RR', value: latest?.respiratoryRate ?? null, unit: '/min', icon: Wind, abnormal: rrAbnormal(latest?.respiratoryRate) },
    { label: 'SpO₂', value: latest?.oxygenSaturation ?? null, unit: '%', icon: Droplets, abnormal: spo2Abnormal(latest?.oxygenSaturation) },
    { label: 'Weight', value: latest?.weightKg ?? latest?.weight ?? null, unit: 'kg', icon: HeartPulse, abnormal: false },
  ];

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <RecordVitalsDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        patientId={patientId}
        admissionId={admissionId}
      />
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Latest Vitals</h2>
        <div className="flex items-center gap-2">
          {latest && (
            <span className="text-[10px] text-muted-foreground">
              recorded {formatDateTime(latest.createdAt)}
            </span>
          )}
          {role === 'nurse' ? (
            <LinkButton size="sm" variant="ghost" className="h-7 gap-1 text-xs" href={`/nurse/vitals?patientId=${patientId}&kind=ipd`}>
              <Plus className="h-3 w-3" />
              Record
            </LinkButton>
          ) : role === 'doctor' ? (
            // The treating doctor examines at the bedside too — capture the
            // reading against this admission without leaving the workspace.
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => setRecordOpen(true)}
            >
              <Plus className="h-3 w-3" />
              Record
            </Button>
          ) : null}
          <LinkButton size="sm" variant="ghost" className="h-7 gap-1 text-xs" href={`/nurse/charting?admissionId=${admissionId}&patientId=${patientId}`}>
            View trends
          </LinkButton>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
        </div>
      ) : !latest ? (
        <p className="text-xs text-muted-foreground">No vitals recorded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {cards.map(({ label, value, unit, icon: Icon, abnormal }) => (
            <div
              key={label}
              className={cn(
                'rounded-lg px-3 py-2 text-center ring-1',
                abnormal ? 'bg-red-50 ring-red-300' : 'bg-surface-container-low ring-transparent',
              )}
            >
              <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3 w-3" /> {label}
              </p>
              <p className={cn('text-lg font-semibold', abnormal ? 'text-red-600' : 'text-foreground')}>
                {value ?? '–'}
              </p>
              <p className="text-[10px] text-muted-foreground">{unit}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── eMAR today panel ───────────────────────────────────────────────────────

function EmarTodayPanel({ admissionId, role }: { admissionId: string; role: WorkspaceRole }) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

  const { data, isLoading } = useEmarSchedules({
    admissionId,
    fromDate: startOfDay,
    toDate: endOfDay,
    limit: 200,
  });

  const schedules = useMemo(() => unwrapList<EmarSchedule>(data), [data]);

  const counts = useMemo(() => {
    let pending = 0, given = 0, missed = 0, due = 0, overdue = 0;
    for (const s of schedules) {
      if (s.status === 'cancelled') continue;
      if (s.status === 'pending') pending++;
      else if (s.status === 'given' || s.status === 'given_late') given++;
      else if (s.status === 'missed') missed++;
      else if (s.status === 'due') due++;
      else if (s.status === 'overdue') overdue++;
    }
    return { pending, given, missed, due, overdue, total: schedules.length };
  }, [schedules]);

  const upcoming = useMemo(() => {
    return [...schedules]
      .filter((s) => s.status === 'pending' || s.status === 'due' || s.status === 'overdue')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 6);
  }, [schedules]);

  const recent = useMemo(() => {
    return [...schedules]
      .filter((s) => s.actionedAt)
      .sort((a, b) => new Date(b.actionedAt!).getTime() - new Date(a.actionedAt!).getTime())
      .slice(0, 6);
  }, [schedules]);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PillBottle className="h-4 w-4 text-primary" />
          eMAR — Today ({formatDate(today)})
        </h2>
        <LinkButton size="sm" variant="outline" className="h-7 gap-1 text-xs" href={`/nurse/emar?admissionId=${admissionId}`}>
          {role === 'nurse' ? 'Administer doses' : 'Open eMAR board'}
        </LinkButton>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading schedule...
        </div>
      ) : counts.total === 0 ? (
        <p className="text-xs text-muted-foreground">
          No medication doses scheduled for today.
          {role === 'doctor' && ' Add an IP prescription to populate the eMAR board.'}
        </p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-5 gap-2 text-center text-xs">
            <Stat label="Pending" value={counts.pending} className="bg-gray-100 text-gray-700" />
            <Stat label="Due" value={counts.due} className="bg-blue-100 text-blue-700" />
            <Stat label="Overdue" value={counts.overdue} className="bg-yellow-100 text-yellow-800" />
            <Stat label="Given" value={counts.given} className="bg-green-100 text-green-700" />
            <Stat label="Missed" value={counts.missed} className="bg-red-100 text-red-700" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DoseList title="Next due" items={upcoming} emptyText="Nothing due." />
            <DoseList title="Recently actioned" items={recent} showTimestamp emptyText="No doses logged today." />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={cn('rounded-md px-2 py-1.5', className)}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-base font-bold leading-tight">{value}</p>
    </div>
  );
}

function DoseList({
  title,
  items,
  showTimestamp,
  emptyText,
}: {
  title: string;
  items: Array<{
    id: string;
    drugName: string;
    dosage: string;
    route: string;
    scheduledAt: string;
    status: string;
    actionedAt: string | null;
  }>;
  showTimestamp?: boolean;
  emptyText: string;
}) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-surface-container-low/50">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {s.drugName} <span className="text-muted-foreground">{s.dosage}{s.route ? ` · ${s.route}` : ''}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {showTimestamp && s.actionedAt ? `actioned ${formatTime(s.actionedAt)}` : `scheduled ${formatTime(s.scheduledAt)}`}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {s.status.replace('_', ' ')}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Active prescriptions panel ─────────────────────────────────────────────


function PrescriptionsPanel({ admissionId, patientId, role, onNewRx }: { admissionId: string; patientId: string; role: WorkspaceRole; onNewRx?: () => void }) {
  const { data, isLoading } = useActivePrescriptions({
    admissionId,
    prescriptionType: 'ip',
    status: 'active',
  });

  const prescriptions = useMemo(() => unwrapList<Prescription>(data), [data]);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Pill className="h-4 w-4 text-primary" />
          Active IP Prescriptions
        </h2>
        <div className="flex items-center gap-2">
          {role === 'doctor' && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onNewRx}>
              <Plus className="h-3 w-3" /> New Rx
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : prescriptions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active IP prescriptions.</p>
      ) : (
        <div className="space-y-2">
          {prescriptions.flatMap((rx) =>
            rx.items.map((item, idx) => (
              <div
                key={`${rx.id}-${idx}`}
                className="flex items-start justify-between rounded-md border bg-card px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {item.drugName} <span className="font-normal text-muted-foreground">{item.dosage}</span>
                    {item.isPrn && (
                      <Badge variant="outline" className="ml-2 text-[9px] uppercase">PRN</Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {item.frequency}{item.route ? ` · ${item.route}` : ''}{item.duration ? ` · ${item.duration}` : ''}
                  </p>
                  {item.instructions && (
                    <p className="mt-0.5 italic text-muted-foreground">{item.instructions}</p>
                  )}
                </div>
                <div className="ml-3 text-right text-[10px] text-muted-foreground">
                  {idx === 0 && rx.doctor?.user && (
                    <p>Dr. {rx.doctor.user.firstName} {rx.doctor.user.lastName}</p>
                  )}
                  {idx === 0 && <p>{formatDate(rx.createdAt)}</p>}
                </div>
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}

// ── Progress notes panel ───────────────────────────────────────────────────

const drLabel = (n: ProgressNote): string =>
  n.doctor?.user ? `Dr. ${n.doctor.user.firstName} ${n.doctor.user.lastName}`.trim() : 'Doctor';

// Local yyyy-mm-dd key for date comparisons (IST/local).
const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// IP round notes are composed as "[Progress: <status>]\nS (Subjective): …\n
// O (Objective): …\nA (Assessment): …\nP (Plan): …" (see IpProgressNoteComposer).
// Parse that back into a progress status + SOAP sections so it renders as clean
// labelled blocks instead of raw markers. Free-text notes fall back verbatim.
const PROGRESS_TONE: Record<string, string> = {
  improving: 'bg-emerald-100 text-emerald-700',
  stable: 'bg-sky-100 text-sky-700',
  unchanged: 'bg-slate-100 text-slate-700',
  deteriorating: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};
const SOAP_MARKERS = [
  { key: 'S', label: 'Subjective', token: 'S (Subjective):' },
  { key: 'O', label: 'Objective', token: 'O (Objective):' },
  { key: 'A', label: 'Assessment', token: 'A (Assessment):' },
  { key: 'P', label: 'Plan', token: 'P (Plan):' },
];
interface ParsedNote {
  progress: string | null;
  tone: string;
  sections: Array<{ key: string; label: string; text: string }>;
  fallback: string | null;
}
function parseProgressNote(content: string): ParsedNote {
  const text = content ?? '';
  const pm = text.match(/\[Progress:\s*([^\]]+)\]/i);
  const progress = pm ? pm[1].trim() : null;
  const tone = PROGRESS_TONE[(progress ?? '').toLowerCase()] ?? 'bg-primary/10 text-primary';

  const found = SOAP_MARKERS
    .map((mk) => ({ ...mk, idx: text.indexOf(mk.token) }))
    .filter((mk) => mk.idx !== -1)
    .sort((a, b) => a.idx - b.idx);
  const sections = found.map((f, i) => {
    const start = f.idx + f.token.length;
    const end = i + 1 < found.length ? found[i + 1].idx : text.length;
    return { key: f.key, label: f.label, text: text.slice(start, end).trim() };
  });

  // Nothing structured → show the raw content (legacy / free-text notes).
  const fallback = !progress && sections.length === 0 ? text.trim() : null;
  return { progress, tone, sections, fallback };
}
const noteSnippet = (p: ParsedNote): string =>
  p.fallback ?? p.sections.map((s) => `${s.key}: ${s.text}`).join('   ·   ');

function ProgressNotesPanel({ admissionId, patientId, role, admissionDate }: { admissionId: string; patientId: string; role: WorkspaceRole; admissionDate?: string }) {
  const { data, isLoading, refetch } = useProgressNotes({ admissionId, limit: 100 });
  // IP running log — this admission's notes, newest first.
  const ipNotes = useMemo<ProgressNote[]>(() => data?.data ?? [], [data]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [openNote, setOpenNote] = useState<ProgressNote | null>(null);

  // ── Filters (scoped to this panel only) ─────────────────────
  const [search, setSearch] = useState('');
  const [doctorId, setDoctorId] = useState<string>('all');
  const [dateMode, setDateMode] = useState<'all' | 'day' | 'range'>('all');
  const [day, setDay] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Distinct doctors present in this admission's notes, for the doctor filter.
  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of ipNotes) if (n.doctorId) map.set(n.doctorId, drLabel(n));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [ipNotes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ipNotes.filter((n) => {
      if (doctorId !== 'all' && n.doctorId !== doctorId) return false;
      if (q) {
        const hay = `${n.content ?? ''} ${drLabel(n)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateMode === 'day' && day) {
        if (dayKey(n.createdAt) !== day) return false;
      } else if (dateMode === 'range') {
        const k = dayKey(n.createdAt);
        if (fromDate && k < fromDate) return false;
        if (toDate && k > toDate) return false;
      }
      return true;
    });
  }, [ipNotes, search, doctorId, dateMode, day, fromDate, toDate]);

  const hasActiveFilter = !!search || doctorId !== 'all' || dateMode !== 'all';
  const clearFilters = () => {
    setSearch(''); setDoctorId('all'); setDateMode('all'); setDay(''); setFromDate(''); setToDate('');
  };

  // ── Group notes by admission day (Day 1 = admission date) ──
  const admissionDayKey = admissionDate ? dayKey(admissionDate) : null;
  const groupedDays = useMemo(() => {
    const byDay = new Map<string, ProgressNote[]>();
    for (const n of filtered) {
      const k = dayKey(n.createdAt);
      const arr = byDay.get(k);
      if (arr) arr.push(n); else byDay.set(k, [n]);
    }
    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // most recent day first
      .map(([key, notes]) => {
        let dayNumber: number | null = null;
        if (admissionDayKey) {
          const diff = Math.round((new Date(key + 'T00:00:00').getTime() - new Date(admissionDayKey + 'T00:00:00').getTime()) / 86_400_000);
          dayNumber = diff + 1;
        }
        return { key, notes, dayNumber: dayNumber && dayNumber >= 1 ? dayNumber : null, date: notes[0].createdAt };
      });
  }, [filtered, admissionDayKey]);

  // Collapsible day sections — default: only the most recent day open. While a
  // filter is active, force every day open so matches are never hidden.
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && groupedDays.length) {
      setOpenDays(new Set([groupedDays[0].key]));
      seeded.current = true;
    }
  }, [groupedDays]);
  const isDayOpen = (key: string) => hasActiveFilter || openDays.has(key);
  const toggleDay = (key: string) =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            IP Progress Notes
          </h2>
          <p className="text-[11px] text-muted-foreground">Running clinical log for the whole admission — a note per visit / round.</p>
        </div>
        {role === 'doctor' && (
          <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={() => setComposerOpen(true)}>
            <Plus className="h-3 w-3" /> Add visit note
          </Button>
        )}
      </div>

      {/* ── Search + filters (progress notes only) ── */}
      {ipNotes.length > 0 && (
        <div className="mb-3 space-y-2 rounded-lg border border-outline-variant/40 bg-surface-container-low/40 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes or doctor name…"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Doctor filter */}
            <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? 'all')}>
              <SelectTrigger className="h-8 w-auto min-w-[130px] gap-1 text-xs">
                <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
                {doctorOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date mode */}
            <Select value={dateMode} onValueChange={(v) => setDateMode((v as 'all' | 'day' | 'range') ?? 'all')}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] gap-1 text-xs">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="day">Specific day</SelectItem>
                <SelectItem value="range">Date range</SelectItem>
              </SelectContent>
            </Select>

            {dateMode === 'day' && (
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-8 w-auto text-xs" />
            )}
            {dateMode === 'range' && (
              <div className="flex items-center gap-1">
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-auto text-xs" aria-label="From date" />
                <span className="text-xs text-muted-foreground">–</span>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-auto text-xs" aria-label="To date" />
              </div>
            )}

            {hasActiveFilter && (
              <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {filtered.length} of {ipNotes.length} note{ipNotes.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : ipNotes.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center">
          <p className="text-xs text-muted-foreground">No progress notes yet for this admission.</p>
          {role === 'doctor' && (
            <Button size="sm" variant="outline" className="mt-2 h-7 gap-1 text-xs" onClick={() => setComposerOpen(true)}>
              <Plus className="h-3 w-3" /> Write the first visit note
            </Button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center">
          <p className="text-xs text-muted-foreground">No notes match these filters.</p>
          <Button size="sm" variant="ghost" className="mt-1 h-7 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {groupedDays.map((g) => {
            const open = isDayOpen(g.key);
            return (
              <div key={g.key} className="overflow-hidden rounded-lg border border-outline-variant/40">
                {/* Day header — click to expand/collapse the notes under it */}
                <button
                  type="button"
                  onClick={() => toggleDay(g.key)}
                  className="flex w-full items-center justify-between gap-2 bg-surface-container-low/60 px-3 py-2 text-left transition-colors hover:bg-surface-container-high"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      {g.dayNumber != null ? `Day ${g.dayNumber}` : formatDate(g.date)}
                    </span>
                    {g.dayNumber != null && (
                      <span className="text-[10px] text-muted-foreground">{formatDate(g.date)}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {g.notes.length} note{g.notes.length !== 1 ? 's' : ''}
                    </span>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                  </span>
                </button>

                {open && (
                  <ul className="space-y-2 p-2">
                    {g.notes.map((n) => {
                      const parsed = parseProgressNote(n.content ?? '');
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => setOpenNote(n)}
                            className="group w-full rounded-md border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-surface-container-high"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 font-medium text-foreground">
                                {drLabel(n)}
                                {parsed.progress && (
                                  <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold', parsed.tone)}>{parsed.progress}</span>
                                )}
                                {n.status === 'finalized' && (
                                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">Signed</Badge>
                                )}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                <Clock className="h-3 w-3" />
                                {formatTime(n.createdAt)}
                                <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                              </span>
                            </div>
                            <p className="line-clamp-2 text-muted-foreground">
                              {noteSnippet(parsed) || '—'}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProgressNoteDetailDialog note={openNote} onClose={() => setOpenNote(null)} />

      {role === 'doctor' && (
        <IpProgressNoteComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          patientId={patientId}
          admissionId={admissionId}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}

// Read a single progress note in full (opened from the running-log list).
function ProgressNoteDetailDialog({ note, onClose }: { note: ProgressNote | null; onClose: () => void }) {
  return (
    <Dialog open={!!note} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {note && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                Progress Note
                {note.status === 'finalized' && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">Signed</Badge>}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <span className="inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" />{drLabel(note)}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(note.createdAt)}</span>
                {note.noteType && <span className="capitalize">{note.noteType.replace(/_/g, ' ')}</span>}
              </DialogDescription>
            </DialogHeader>

            {(() => {
              const parsed = parseProgressNote(note.content ?? '');
              if (parsed.fallback !== null) {
                return (
                  <div className="rounded-lg border bg-surface-container-low/40 p-3">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                      {parsed.fallback || 'No content recorded.'}
                    </p>
                  </div>
                );
              }
              return (
                <div className="space-y-2.5">
                  {parsed.progress && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</span>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', parsed.tone)}>{parsed.progress}</span>
                    </div>
                  )}
                  {parsed.sections.map((s) => (
                    <div key={s.key} className="rounded-lg border bg-surface-container-low/40 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">{s.key}</span>
                        <span className="text-[12px] font-semibold text-foreground">{s.label}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{s.text || '—'}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {(note.impressions || note.discussions || note.conclusions) && (
              <div className="space-y-2 text-[12px]">
                {note.impressions && (<div><p className="font-semibold text-foreground">Impressions</p><p className="whitespace-pre-wrap text-muted-foreground">{note.impressions}</p></div>)}
                {note.discussions && (<div><p className="font-semibold text-foreground">Discussion</p><p className="whitespace-pre-wrap text-muted-foreground">{note.discussions}</p></div>)}
                {note.conclusions && (<div><p className="font-semibold text-foreground">Conclusion</p><p className="whitespace-pre-wrap text-muted-foreground">{note.conclusions}</p></div>)}
              </div>
            )}

            {note.amendments && note.amendments.length > 0 && (
              <div className="text-[11px]">
                <p className="mb-1 font-semibold text-foreground">Amendments ({note.amendments.length})</p>
                <ul className="space-y-1">
                  {note.amendments.map((a) => (
                    <li key={a.id} className="rounded border bg-card px-2 py-1 text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize text-foreground">{a.fieldName.replace(/_/g, ' ')}</span>
                        <span className="text-[10px]">{formatDateTime(a.createdAt)}</span>
                      </div>
                      {a.reason && <p className="whitespace-pre-wrap">Reason: {a.reason}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Nursing notes panel (for doctor view: see nurse-led observations) ─────

function NursingNotesPanel({ patientId, admissionId }: { patientId: string; admissionId: string }) {
  const { data, isLoading } = useNursingNotes({ patientId, limit: 10 });
  const notes = useMemo(() => unwrapList<NursingNote>(data), [data]);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clipboard className="h-4 w-4 text-primary" />
          Nursing Notes
        </h2>
        <LinkButton size="sm" variant="outline" className="h-7 gap-1 text-xs" href={`/nurse/charting?admissionId=${admissionId}&patientId=${patientId}`}>
          Open charting
        </LinkButton>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No nursing notes recorded.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border bg-card px-3 py-2 text-xs">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Badge variant="outline" className="text-[9px] capitalize">
                    {n.noteType.replace('_', ' ')}
                  </Badge>
                  {n.createdBy && (
                    <span className="text-muted-foreground">
                      {n.createdBy.firstName} {n.createdBy.lastName}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDateTime(n.createdAt)}
                </span>
              </div>
              <p className="line-clamp-2 whitespace-pre-wrap text-muted-foreground">
                {n.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Orders panel ───────────────────────────────────────────────────────────

function OrdersPanel({ admissionId, patientId, role }: { admissionId: string; patientId: string; role: WorkspaceRole }) {
  const { data: labData, isLoading: labLoading } = useLabOrders({ patientId, limit: 10 });
  const { data: imagingData, isLoading: imgLoading } = useImagingRequests({ patientId, limit: 10 });

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [labOpen, setLabOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const canOrder = role === 'doctor';

  // Resolve the patient's active IP visit — the lab / imaging order dialogs bind
  // the order to a visit.
  const { data: visitData } = useQuery({
    queryKey: ['ipws-active-visit', patientId],
    queryFn: async () => (await apiGet<Array<{ id: string; visitType: string }>>('/clinical/visits', { params: { patientId, status: 'active', limit: 5 } })).data ?? [],
    enabled: canOrder && !!patientId,
  });
  const visitId = (visitData?.find((v) => v.visitType === 'ip') ?? visitData?.[0])?.id ?? '';

  const labs = labData?.data ?? [];
  const imaging = imagingData?.data ?? [];

  // Surface any lab order with at least one attachment so clinicians can spot
  // a reportable file at a glance. The list endpoint ships a tenant-scoped
  // `_count.attachments` for the badge; we fall back to the array length if
  // the full attachment list is hydrated.
  const attachmentCount = (o: any): number =>
    typeof o?._count?.attachments === 'number'
      ? o._count.attachments
      : Array.isArray(o?.attachments)
        ? o.attachments.length
        : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FlaskConical className="h-4 w-4 text-primary" />
            Lab Orders
          </h2>
          {canOrder && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setLabOpen(true)} disabled={!visitId} title={visitId ? 'Order labs' : 'No active visit'}>
              <Plus className="h-3 w-3" /> Order
            </Button>
          )}
        </div>

        {labLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : labs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No lab orders.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {labs.slice(0, 8).map((o) => {
              const att = attachmentCount(o);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(o.id)}
                    className="flex w-full items-center justify-between rounded border bg-card px-2 py-1.5 text-left hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {o.tests?.map((t) => t.name).join(', ')
                          || o.labOrderItems?.map((it) => it.test?.testName).filter(Boolean).join(', ')
                          || o.orderNumber || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(o.createdAt)}
                        {att > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-primary">
                            · {att} file{att > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{o.status}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <LabOrderDetailDialog
          orderId={openOrderId}
          onOpenChange={(open) => !open && setOpenOrderId(null)}
        />
      </div>

      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ImageIcon className="h-4 w-4 text-primary" />
            Imaging Requests
          </h2>
          {canOrder && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setImgOpen(true)} disabled={!visitId} title={visitId ? 'Request imaging' : 'No active visit'}>
              <Plus className="h-3 w-3" /> Request
            </Button>
          )}
        </div>

        {imgLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : imaging.length === 0 ? (
          <p className="text-xs text-muted-foreground">No imaging requests.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {imaging.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border bg-card px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {r.imagingType || '—'}{r.bodyPart ? ` · ${r.bodyPart}` : ''}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(r.createdAt)}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canOrder && (
        <>
          <LabOrderDialog open={labOpen} onOpenChange={setLabOpen} patientId={patientId} visitId={visitId} />
          <ImagingRequestDialog open={imgOpen} onOpenChange={setImgOpen} patientId={patientId} visitId={visitId} />
        </>
      )}
    </div>
  );
}

// ── Vitals trend / history (mini) ──────────────────────────────────────────

function VitalsHistoryPanel({ patientId, admissionId }: { patientId: string; admissionId: string }) {
  const { data, isLoading } = usePatientVitals(patientId, { limit: 10 });
  const vitals = useMemo(() => unwrapList<Vital>(data), [data]);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="h-4 w-4 text-primary" />
          Recent Vitals
        </h2>
        <LinkButton size="sm" variant="outline" className="h-7 gap-1 text-xs" href={`/nurse/charting?admissionId=${admissionId}&patientId=${patientId}`}>
          Charting view
        </LinkButton>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : vitals.length === 0 ? (
        <p className="text-xs text-muted-foreground">No vitals recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-2 pr-2">Time</th>
                <th className="pb-2 pr-2">BP</th>
                <th className="pb-2 pr-2">Temp</th>
                <th className="pb-2 pr-2">Pulse</th>
                <th className="pb-2 pr-2">RR</th>
                <th className="pb-2 pr-2">SpO₂</th>
                <th className="pb-2 pr-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vitals.map((v) => (
                <tr key={v.id} className="text-foreground">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
                  <td className="py-1.5 pr-2">
                    {v.bloodPressureSystolic != null ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic ?? '-'}` : '–'}
                  </td>
                  <td className="py-1.5 pr-2">{v.temperature ?? '–'}</td>
                  <td className="py-1.5 pr-2">{v.pulseRate ?? v.heartRate ?? '–'}</td>
                  <td className="py-1.5 pr-2">{v.respiratoryRate ?? '–'}</td>
                  <td className="py-1.5 pr-2">{v.oxygenSaturation ?? '–'}</td>
                  <td className="py-1.5 pr-2 max-w-[200px] truncate text-muted-foreground">{v.notes || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Patient demographics panel ─────────────────────────────────────────────

function PatientRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || '–'}</span>
    </div>
  );
}

function PatientPanel({ patientId }: { patientId: string }) {
  const { data: patient, isLoading } = usePatientDetail(patientId);

  if (isLoading || !patient) {
    return (
      <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <User className="h-4 w-4 text-primary" />
        Patient Information
      </h2>
      <Separator className="mb-2" />
      <PatientRow label="Full name" value={`${patient.firstName} ${patient.lastName}`} />
      <PatientRow label="MRN" value={patient.mrn} />
      <PatientRow label="Date of birth" value={patient.dateOfBirth ? formatDate(patient.dateOfBirth) : '–'} />
      <PatientRow label="Gender" value={patient.gender} />
      <PatientRow label="Phone" value={patient.phone} />
      <PatientRow label="Email" value={patient.email} />
      <PatientRow label="Blood group" value={patient.bloodGroup} />
      <PatientRow label="Address" value={patient.address} />
      {patient.allergies && patient.allergies.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Allergies</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {patient.allergies.map((a) => (
              <Badge key={a.id} variant="destructive" className="text-[10px]">
                {a.allergen}{a.severity ? ` (${a.severity})` : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function IPPatientWorkspace({ admissionId, role, backHref }: IPPatientWorkspaceProps) {
  const back = backHref ?? defaultBackHref(role);
  const { user } = useAuthStore();
  const [rxOpen, setRxOpen] = useState(false);
  const { data: admissionResp, isLoading, error } = useAdmissionDetail(admissionId);

  const admission = useMemo(
    () => unwrapOne<NurseAdmission>(admissionResp),
    [admissionResp],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error || !admission) {
    return (
      <div className="rounded-xl bg-surface-container-lowest p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-error" />
        <p className="mt-2 text-sm text-foreground">Could not load admission.</p>
        <LinkButton variant="outline" size="sm" className="mt-3" href={back}>
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back
        </LinkButton>
      </div>
    );
  }

  const patientId = admission.patientId;
  const onNewRx = role === 'doctor' ? () => setRxOpen(true) : undefined;
  const rxPatientName = `${admission.patient?.firstName ?? ''} ${admission.patient?.lastName ?? ''}`.trim() || 'Patient';

  return (
    <div className="space-y-4 animate-fade-in-up">
      {role === 'doctor' && (
        <IpPrescriptionDialog
          open={rxOpen}
          onOpenChange={setRxOpen}
          patientId={patientId}
          patientName={rxPatientName}
          mrn={admission.patient?.mrn}
          doctorUserId={user?.id ?? ''}
        />
      )}
      <HeaderStrip admission={admission} role={role} backHref={back} onNewRx={onNewRx} />
      <LatestVitalsStrip patientId={patientId} role={role} admissionId={admissionId} />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="emar">eMAR</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
          <TabsTrigger value="charting">Nursing Charting</TabsTrigger>
          <TabsTrigger value="progress">Progress Notes</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="ledger">Billing / Ledger</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="patient">Patient Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <EmarTodayPanel admissionId={admissionId} role={role} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PrescriptionsPanel admissionId={admissionId} patientId={patientId} role={role} onNewRx={onNewRx} />
            <ProgressNotesPanel admissionId={admissionId} patientId={patientId} role={role} admissionDate={admission.admissionDate} />
          </div>
        </TabsContent>

        <TabsContent value="emar" className="pt-4">
          <EmarTodayPanel admissionId={admissionId} role={role} />
        </TabsContent>

        <TabsContent value="prescriptions" className="pt-4">
          <PrescriptionsPanel admissionId={admissionId} patientId={patientId} role={role} onNewRx={onNewRx} />
        </TabsContent>

        <TabsContent value="vitals" className="pt-4">
          <VitalsHistoryPanel patientId={patientId} admissionId={admissionId} />
        </TabsContent>

        <TabsContent value="charting" className="pt-4">
          <NursingNotesPanel patientId={patientId} admissionId={admissionId} />
        </TabsContent>

        <TabsContent value="progress" className="pt-4">
          <ProgressNotesPanel admissionId={admissionId} patientId={patientId} role={role} />
        </TabsContent>

        <TabsContent value="orders" className="pt-4">
          <OrdersPanel admissionId={admissionId} patientId={patientId} role={role} />
        </TabsContent>

        <TabsContent value="ledger" className="pt-4">
          <IpLedgerPanel admissionId={admissionId} patientId={patientId} role={role} />
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <IpActivityLog admissionId={admissionId} />
        </TabsContent>

        <TabsContent value="patient" className="pt-4">
          <PatientPanel patientId={patientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
