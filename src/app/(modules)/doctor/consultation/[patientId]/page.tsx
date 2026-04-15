'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  AlertTriangle,
  Heart,
  Thermometer,
  Activity,
  Droplets,
  Weight,
  Pill,
  FileText,
  FlaskConical,
  ImageIcon,
  FolderOpen,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Stethoscope,
  Printer,
  Phone,
  Calendar,
  CalendarDays,
  Clock,
  Eye,
  StickyNote,
  MessageSquare,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import {
  usePatientDetail,
  usePatientVitals,
  usePrescriptions,
  useLabOrders,
  useProgressNotes,
  usePatientDiagnoses,
} from '@/hooks/use-doctor';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { Edit3 } from 'lucide-react';
import { formatDate, formatTime, formatDateTimeAmPm } from '@/lib/date-utils';
import { TriggerFormsGate } from '@/components/forms/trigger-forms-gate';
import { PrescriptionPad } from '@/components/doctor/prescription-pad';
import { DrugHistoryPanel } from '@/components/doctor/drug-history-panel';
import { CurrentMedicationsPanel } from '@/components/doctor/current-medications-panel';
import { MedicalHistoryPanel } from '@/components/doctor/medical-history-panel';
import { InvestigationHistoryPanel } from '@/components/doctor/investigation-history-panel';
import { useFormSubmissions, useSystemForm } from '@/hooks/use-forms';
import { FormRenderer } from '@/components/forms/form-renderer';
import { TRIGGER_LABELS } from '@/types/forms';
import { cn } from '@/lib/utils';

import type { Patient, Appointment } from '@/types';
import type { FormSubmission } from '@/types/forms';
import type {
  Vital,
  Prescription,
  LabOrder,
  ProgressNote,
} from '@/hooks/use-doctor';

// ============================================================
// Helpers
// ============================================================

function calculateAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years--;
  }
  return `${years}Y`;
}

function getDoctorName(doctor?: { id: string; user?: { firstName: string; lastName: string } }): string {
  if (!doctor?.user) return '—';
  return `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending_payment: { label: 'Pending Payment', className: 'bg-orange-100 text-orange-700' },
  booked: { label: 'Booked', className: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', className: 'bg-cyan-100 text-cyan-700' },
  checked_in: { label: 'Checked In', className: 'bg-amber-100 text-amber-700' },
  in_consultation: { label: 'In Consultation', className: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  no_show: { label: 'No Show', className: 'bg-gray-100 text-gray-700' },
};

/** Section label → color mapping (M3 tokens) */
const SECTION_COLORS: Record<string, string> = {
  'Chief Complaint': 'text-primary',
  'Symptoms': 'text-primary',
  'Diagnosis': 'text-error',
  'Prescription': 'text-primary',
  'Medicines': 'text-primary',
  'Vitals': 'text-secondary',
  'Advice': 'text-tertiary',
  'Follow-up': 'text-primary-container',
  'General Examination': 'text-primary',
  'Systemic Examination': 'text-primary',
  'Referral': 'text-tertiary',
  'Additional Notes': 'text-on-surface-variant',
  'Lab Orders': 'text-secondary',
  'Imaging': 'text-tertiary',
  'Documents': 'text-on-surface-variant',
  'Forms': 'text-primary-container',
};

/** Parse a progress note's markdown content into sections */
function parseNoteContent(content?: string): Record<string, string> {
  if (!content) return {};
  const sections: Record<string, string> = {};
  const blocks = content.split(/\n\n/);
  let currentKey = '';
  for (const block of blocks) {
    const headerMatch = block.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
    if (headerMatch) {
      currentKey = headerMatch[1].trim();
      sections[currentKey] = headerMatch[2]?.trim() || '';
    } else if (currentKey) {
      sections[currentKey] = (sections[currentKey] ? sections[currentKey] + '\n' : '') + block.trim();
    }
  }
  return sections;
}

// ============================================================
// Sticky Top Navigation Bar
// ============================================================

function ConsultationTopBar({
  patient,
  onBack,
}: {
  patient: Patient;
  onBack: () => void;
}) {
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;

  return (
    <div className="sticky top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-background/80 backdrop-blur-xl border-b border-outline-variant/30">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container font-headline text-sm font-bold shrink-0">
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <h1 className="font-headline text-base font-extrabold tracking-tight text-on-surface truncate">
              {patient.firstName} {patient.lastName}
            </h1>
            <div className="flex items-center gap-1.5 font-label text-[11px] text-on-surface-variant leading-tight">
              <span className="font-semibold text-primary">{patient.mrn}</span>
              {patient.gender && <><span className="text-outline-variant">·</span><span className="capitalize">{patient.gender}</span></>}
              {age && <><span className="text-outline-variant">·</span><span>{age}</span></>}
              {patient.bloodGroup && <><span className="text-outline-variant">·</span><span className="font-semibold text-error">{patient.bloodGroup}</span></>}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 h-9 rounded-lg border-outline-variant/40 font-label font-bold text-xs text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Order Lab</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 h-9 rounded-lg border-outline-variant/40 font-label font-bold text-xs text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Request Imaging</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 h-9 rounded-lg border-outline-variant/40 font-label font-bold text-xs text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Print</span>
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Patient Profile Card (sidebar)
// ============================================================

function AppointmentCard({ patient, appointment }: { patient: Patient; appointment?: Appointment | null }) {
  const hasContent = patient.phone || appointment?.appointmentDate || appointment?.doctor || appointment?.reason;
  if (!hasContent) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b flex items-center gap-2 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
          <Calendar className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-foreground">
          Appointment
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        {appointment?.appointmentDate && (
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 shrink-0">
              <Clock className="h-3 w-3 text-purple-600" />
            </div>
            <span className="font-medium">{formatDate(appointment.appointmentDate)}{appointment.startTime ? ` · ${appointment.startTime}` : ''}</span>
          </div>
        )}
        {appointment?.doctor && (
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 shrink-0">
              <Stethoscope className="h-3 w-3 text-emerald-600" />
            </div>
            <span className="font-medium truncate">{getDoctorName(appointment.doctor)}</span>
          </div>
        )}
        {patient.phone && (
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 shrink-0">
              <Phone className="h-3 w-3 text-blue-600" />
            </div>
            <span className="font-medium">{patient.phone}</span>
          </div>
        )}
        {appointment?.reason && (
          <div className="flex items-start gap-2 text-[11px] pt-1.5 border-t">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 shrink-0">
              <StickyNote className="h-3 w-3 text-amber-600" />
            </div>
            <span className="text-muted-foreground leading-snug">{appointment.reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Allergy Banner (inline)
// ============================================================

function AllergyBanner({ allergies }: { allergies?: Array<{ id?: string; allergen: string; severity: string }> }) {
  if (!allergies || allergies.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/8 border border-destructive/25 px-3 py-1.5">
      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
      <span className="text-[11px] font-semibold text-destructive">Allergies:</span>
      <div className="flex flex-wrap gap-1">
        {allergies.map((a, i) => (
          <Badge key={a.id ?? i} variant="destructive" className="text-[9px] font-medium py-0">
            {a.allergen}
            {a.severity && <span className="ml-1 opacity-75">({a.severity})</span>}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Vitals Strip (compact horizontal pills)
// ============================================================

function VitalsStrip({ patientId, variant = 'sidebar' }: { patientId: string; variant?: 'sidebar' | 'top' }) {
  const { data: vitals, isLoading } = usePatientVitals(patientId);
  const latest = (vitals as Vital[] | undefined)?.[0];

  const gridCols =
    variant === 'top'
      ? 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9'
      : 'grid-cols-2';

  if (isLoading) {
    return (
      <div className={cn('grid gap-2', gridCols)}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl border border-primary/10 bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low py-6 text-center">
        <Activity className="h-4 w-4 text-on-surface-variant/40 mx-auto mb-1" />
        <p className="font-label text-[11px] text-on-surface-variant italic">No vitals recorded</p>
      </div>
    );
  }

  const heightVal = latest.heightCm ?? latest.height;
  const weightVal = latest.weightKg ?? latest.weight;
  const bmiVal = latest.bmi ?? (heightVal && weightVal ? +(weightVal / Math.pow(heightVal / 100, 2)).toFixed(1) : undefined);
  const pulseVal = latest.pulseRate ?? latest.heartRate;

  const items: { icon: React.ElementType; label: string; value: string | number | null | undefined; unit: string; alert?: boolean }[] = [
    {
      icon: Thermometer,
      label: 'Temp',
      value: latest.temperature,
      unit: '°F',
      alert: latest.temperature ? Number(latest.temperature) > 100.4 : false,
    },
    {
      icon: Heart,
      label: 'Pulse',
      value: pulseVal,
      unit: 'bpm',
      alert: pulseVal ? (pulseVal > 100 || pulseVal < 60) : false,
    },
    {
      icon: Activity,
      label: 'BP',
      value: latest.bloodPressureSystolic && latest.bloodPressureDiastolic
        ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`
        : null,
      unit: 'mmHg',
      alert: latest.bloodPressureSystolic ? (latest.bloodPressureSystolic > 140 || latest.bloodPressureSystolic < 90) : false,
    },
    {
      icon: Droplets,
      label: 'SpO₂',
      value: latest.oxygenSaturation,
      unit: '%',
      alert: latest.oxygenSaturation ? latest.oxygenSaturation < 95 : false,
    },
    {
      icon: Activity,
      label: 'Resp',
      value: latest.respiratoryRate,
      unit: '/min',
      alert: latest.respiratoryRate ? (latest.respiratoryRate > 20 || latest.respiratoryRate < 12) : false,
    },
    {
      icon: Droplets,
      label: 'Sugar',
      value: latest.bloodSugar,
      unit: 'mg/dL',
      alert: latest.bloodSugar ? (latest.bloodSugar > 180 || latest.bloodSugar < 70) : false,
    },
    {
      icon: Weight,
      label: 'Weight',
      value: weightVal,
      unit: 'kg',
    },
    {
      icon: Activity,
      label: 'Height',
      value: heightVal,
      unit: 'cm',
    },
    {
      icon: Activity,
      label: 'BMI',
      value: bmiVal,
      unit: 'kg/m²',
      alert: bmiVal ? (bmiVal >= 30 || bmiVal < 18.5) : false,
    },
  ];

  const visibleItems = items.filter((i) => i.value != null && i.value !== '');

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low py-6 text-center">
        <Activity className="h-4 w-4 text-on-surface-variant/40 mx-auto mb-1" />
        <p className="font-label text-[11px] text-on-surface-variant italic">No vitals recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
    <div className={cn('grid gap-3', gridCols)}>
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              'rounded-xl bg-surface-container-low p-3 border-l-4 transition-all hover:bg-surface-container',
              item.alert ? 'border-error' : 'border-primary',
            )}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className={cn('h-3.5 w-3.5', item.alert ? 'text-error' : 'text-primary')} />
              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {item.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn('font-headline text-lg font-extrabold leading-none', item.alert ? 'text-error' : 'text-on-surface')}>
                {item.value}
              </span>
              <span className="font-label text-[10px] text-on-surface-variant">{item.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
    {latest.createdAt && (
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="font-label text-[10px] text-on-surface-variant flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          Recorded {formatDateTimeAmPm(latest.createdAt)}
        </span>
        <span className="font-label text-[10px] font-bold uppercase tracking-wider text-primary">
          {visibleItems.length} vital{visibleItems.length === 1 ? '' : 's'}
        </span>
      </div>
    )}
    </div>
  );
}

// ============================================================
// Collapsible Section
// ============================================================

function CollapsibleSection({
  icon,
  title,
  badge,
  children,
  defaultOpen = false,
  color = 'text-foreground',
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  color?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <span className={cn('shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-current/10', color)}>
          <span className={cn('[&>svg]:h-4 [&>svg]:w-4', color)}>{icon}</span>
        </span>
        <span className={cn('text-sm font-semibold flex-1', color)}>{title}</span>
        {badge && (
          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 font-bold', color)}>{badge}</Badge>
        )}
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t bg-muted/10">{children}</div>}
    </div>
  );
}

// ============================================================
// Loading / Empty helpers
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon?: React.ElementType; message: string }) {
  return (
    <div className="py-6 text-center">
      {Icon && <Icon className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />}
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================================
// Content rendering helpers (from progress note markdown)
// ============================================================

function PrescriptionLines({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim().startsWith('-'));
  if (lines.length === 0) return <span className="font-label text-[11px] text-on-surface">{content}</span>;

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^-\s*/, '');
        const parts = cleaned.split(' | ');
        const drugName = parts[0] || cleaned;
        const rest = parts.slice(1).join(' · ');
        return (
          <div key={idx} className="flex items-baseline gap-1.5 font-label text-[11px]">
            <span className="font-bold text-primary min-w-[1rem]">{idx + 1}.</span>
            <span className="font-headline font-bold text-on-surface">{drugName}</span>
            {rest && <span className="text-on-surface-variant">{rest}</span>}
          </div>
        );
      })}
    </div>
  );
}

function VitalsGrid({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim());
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {lines.map((line, idx) => {
        const [label, value] = line.split(':').map((s) => s.trim());
        return (
          <span key={idx} className="inline-flex items-baseline gap-1 font-label text-[11px]">
            <span className="text-on-surface-variant">{label}:</span>
            <span className="font-headline font-bold text-on-surface">{value}</span>
          </span>
        );
      })}
    </div>
  );
}

function DiagnosisList({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim().startsWith('-'));
  if (lines.length === 0) return <span className="text-[11px]">{content}</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^-\s*/, '');
        const typeMatch = cleaned.match(/\[(\w+)\]$/);
        const diagType = typeMatch?.[1];
        const nameOnly = cleaned.replace(/\s*\[\w+\]\s*$/, '');

        return (
          <span key={idx} className="text-[11px]">
            {nameOnly}
            {diagType && (
              <span className={cn(
                'inline-flex items-center rounded-full border font-label text-[9px] font-bold px-1.5 py-0 capitalize ml-1',
                diagType === 'primary'
                  ? 'border-error/30 bg-error/5 text-error'
                  : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant',
              )}>
                {diagType}
              </span>
            )}
            {idx < lines.length - 1 && ','}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================
// Unified Visit Timeline — all per-visit data together
// ============================================================

interface ImagingRequest {
  id: string;
  type?: string;
  modality?: string;
  bodyPart?: string;
  status: string;
  findings?: string;
  createdAt: string;
  visitId?: string;
}

function VisitTimeline({ patientId, patient, appointmentId }: { patientId: string; patient: Patient; appointmentId?: string | null }) {
  const { data: notesData, isLoading: notesLoading } = useProgressNotes({ patientId });
  const { data: rxData, isLoading: rxLoading } = usePrescriptions({ patientId });
  const { data: diagData } = usePatientDiagnoses(patientId);
  const { data: vitalsData } = usePatientVitals(patientId);
  const { data: labData, isLoading: labLoading } = useLabOrders({ patientId });
  const { data: imagingData, isLoading: imagingLoading } = useQuery({
    queryKey: ['doctor', 'imaging', patientId],
    queryFn: async () => {
      const response = await apiGet<ImagingRequest[]>('/imaging/requests', { params: { patientId } });
      return response.data ?? [];
    },
    enabled: !!patientId,
  });
  const { data: formData } = useFormSubmissions({
    patientId,
    appointmentId: appointmentId ?? undefined,
    limit: 50,
  });

  const notesList: any[] = notesData?.data ?? [];
  const rxList: any[] = rxData?.data ?? [];
  const diagList: any[] = Array.isArray(diagData) ? diagData : (diagData as any)?.data ?? [];
  const vitalsList: Vital[] = (vitalsData as Vital[] | undefined) ?? [];
  const labOrders: LabOrder[] = labData?.data ?? [];
  const imagingRequests: ImagingRequest[] = Array.isArray(imagingData) ? imagingData : [];
  const submissions: FormSubmission[] = formData?.data ?? [];
  const documents = patient.documents ?? [];

  const [expandedVisit, setExpandedVisit] = useState<number | null>(0);

  const isLoading = notesLoading || rxLoading;

  // Build unified visit list
  const visits = useMemo(() => {
    type VisitItem = {
      id: string;
      date: string;
      dateObj: Date;
      doctorName: string;
      noteContent?: string;
      sections: Record<string, string>;
      diagnoses: any[];
      rxItems: any[];
      rxStatus?: string;
      vitals?: Vital;
      labs: LabOrder[];
      imaging: ImagingRequest[];
      forms: FormSubmission[];
    };

    const visitMap = new Map<string, VisitItem>();

    // Start with progress notes
    for (const note of notesList) {
      const visitId = note.visitId || note.id;
      const sections = parseNoteContent(note.content);
      visitMap.set(visitId, {
        id: visitId,
        date: note.createdAt
          ? new Date(note.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Visit',
        dateObj: new Date(note.createdAt || 0),
        doctorName: note.doctor?.user ? `Dr. ${note.doctor.user.firstName} ${note.doctor.user.lastName}` : '',
        noteContent: note.content,
        sections,
        diagnoses: [],
        rxItems: [],
        vitals: undefined,
        labs: [],
        imaging: [],
        forms: [],
      });
    }

    // Add standalone prescriptions
    for (const rx of rxList) {
      const visitId = rx.visitId || rx.id;
      if (!visitMap.has(visitId)) {
        visitMap.set(visitId, {
          id: visitId,
          date: rx.createdAt
            ? new Date(rx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Prescription',
          dateObj: new Date(rx.createdAt || 0),
          doctorName: rx.doctor?.user ? `Dr. ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}` : '',
          sections: {},
          diagnoses: [],
          rxItems: [],
          vitals: undefined,
          labs: [],
          imaging: [],
          forms: [],
        });
      }
      const existing = visitMap.get(visitId)!;
      const items = rx.items || rx.prescriptionItems || [];
      existing.rxItems = items;
      existing.rxStatus = rx.status;
    }

    // Attach diagnoses
    for (const diag of diagList) {
      const visitId = diag.visitId;
      if (visitId && visitMap.has(visitId)) {
        visitMap.get(visitId)!.diagnoses.push(diag);
      }
    }

    // Attach vitals (match by visitId)
    for (const vital of vitalsList) {
      const visitId = (vital as any).visitId;
      if (visitId && visitMap.has(visitId)) {
        visitMap.get(visitId)!.vitals = vital;
      }
    }

    // Attach lab orders
    for (const lab of labOrders) {
      const visitId = (lab as any).visitId;
      if (visitId && visitMap.has(visitId)) {
        visitMap.get(visitId)!.labs.push(lab);
      }
    }

    // Attach imaging
    for (const img of imagingRequests) {
      const visitId = img.visitId;
      if (visitId && visitMap.has(visitId)) {
        visitMap.get(visitId)!.imaging.push(img);
      }
    }

    // Attach forms (via appointment or general match)
    for (const sub of submissions) {
      // Try to match forms to visits — for now just add to first visit
      const visitId = (sub as any).visitId;
      if (visitId && visitMap.has(visitId)) {
        visitMap.get(visitId)!.forms.push(sub);
      }
    }

    return Array.from(visitMap.values()).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [notesList, rxList, diagList, vitalsList, labOrders, imagingRequests, submissions]);

  // Collect unattached items (not linked to any visit)
  const unattachedLabs = useMemo(() => {
    const visitIds = new Set(visits.map((v) => v.id));
    return labOrders.filter((lab) => !(lab as any).visitId || !visitIds.has((lab as any).visitId));
  }, [labOrders, visits]);

  const unattachedImaging = useMemo(() => {
    const visitIds = new Set(visits.map((v) => v.id));
    return imagingRequests.filter((img) => !img.visitId || !visitIds.has(img.visitId));
  }, [imagingRequests, visits]);

  const unattachedForms = useMemo(() => {
    const visitIds = new Set(visits.map((v) => v.id));
    return submissions.filter((sub) => !(sub as any).visitId || !visitIds.has((sub as any).visitId));
  }, [submissions, visits]);

  if (isLoading) return <SectionLoading />;

  // ── Stats
  const totalVisits = visits.length;
  const totalRx = visits.reduce((sum, v) => sum + v.rxItems.length, 0);
  const totalLabs = labOrders.length;
  const totalImaging = imagingRequests.length;
  const lastVisitDate = visits[0]?.date;

  return (
    <div className="space-y-3">
      {/* ── Stats Strip ── */}
      {visits.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Visits', value: totalVisits, icon: CalendarDays, accent: 'border-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary' },
            { label: 'Rx Items', value: totalRx, icon: Pill, accent: 'border-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary' },
            { label: 'Labs', value: totalLabs, icon: FlaskConical, accent: 'border-secondary', iconBg: 'bg-secondary/10', iconColor: 'text-secondary' },
            { label: 'Imaging', value: totalImaging, icon: ImageIcon, accent: 'border-tertiary', iconBg: 'bg-tertiary/10', iconColor: 'text-tertiary' },
            { label: 'Last Visit', value: lastVisitDate ?? '—', icon: Clock, accent: 'border-primary-container', iconBg: 'bg-primary-container/10', iconColor: 'text-primary-container', wide: true },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className={cn(
                  'rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary border-l-4',
                  s.accent,
                  s.wide && 'col-span-2 md:col-span-1',
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className={cn('p-1.5 rounded-lg', s.iconBg, s.iconColor)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="font-label text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">{s.label}</p>
                <p className="font-headline text-lg font-extrabold tracking-tight text-on-surface leading-tight truncate mt-0.5">{s.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty ── */}
      {visits.length === 0 && unattachedLabs.length === 0 && unattachedImaging.length === 0 && (
        <EmptyState icon={Clock} message="No visit history found for this patient" />
      )}

      {visits.length > 0 && (
      <div className="relative pl-7">
        {/* rail */}
        <div className="absolute left-3 top-4 bottom-4 w-px bg-outline-variant/40" aria-hidden />
        <div className="space-y-3">
      {visits.map((visit, i) => {
        const isExpanded = expandedVisit === i;
        const visitNumber = visits.length - i;

        // Build display items for this visit
        const items: { label: string; color: string; content: React.ReactNode }[] = [];

        // Chief Complaint / Symptoms
        if (visit.sections['Chief Complaint']) {
          items.push({ label: 'Symptoms', color: SECTION_COLORS['Chief Complaint'], content: <span className="text-[11px]">{visit.sections['Chief Complaint']}</span> });
        }

        // Examination
        if (visit.sections['General Examination']) {
          items.push({ label: 'General Examination', color: SECTION_COLORS['General Examination'], content: <span className="text-[11px]">{visit.sections['General Examination']}</span> });
        }
        if (visit.sections['Systemic Examination']) {
          items.push({ label: 'Systemic Examination', color: SECTION_COLORS['Systemic Examination'], content: <span className="text-[11px]">{visit.sections['Systemic Examination']}</span> });
        }

        // Vitals
        if (visit.sections['Vitals']) {
          items.push({ label: 'Vitals', color: SECTION_COLORS['Vitals'], content: <VitalsGrid content={visit.sections['Vitals']} /> });
        }

        // Diagnosis
        if (visit.sections['Diagnosis']) {
          items.push({ label: 'Diagnosis', color: SECTION_COLORS['Diagnosis'], content: <DiagnosisList content={visit.sections['Diagnosis']} /> });
        } else if (visit.diagnoses.length > 0) {
          items.push({
            label: 'Diagnosis', color: SECTION_COLORS['Diagnosis'],
            content: (
              <div className="flex flex-wrap gap-1.5">
                {visit.diagnoses.map((d: any, idx: number) => (
                  <span key={d.id || idx} className="text-[11px]">
                    {d.diagnosisName}{d.icdCode ? ` (${d.icdCode})` : ''}
                    {d.diagnosisType && (
                      <span className={cn(
                        'inline-flex items-center rounded-full border font-label text-[9px] font-bold px-1.5 py-0 capitalize ml-1',
                        d.diagnosisType === 'primary'
                          ? 'border-error/30 bg-error/5 text-error'
                          : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant',
                      )}>
                        {d.diagnosisType}
                      </span>
                    )}
                    {idx < visit.diagnoses.length - 1 && ','}
                  </span>
                ))}
              </div>
            ),
          });
        }

        // Prescription
        if (visit.sections['Prescription']) {
          items.push({ label: `Medicines`, color: SECTION_COLORS['Prescription'], content: <PrescriptionLines content={visit.sections['Prescription']} /> });
        } else if (visit.rxItems.length > 0) {
          items.push({
            label: `Medicines (${visit.rxItems.length})`, color: SECTION_COLORS['Medicines'],
            content: (
              <div className="space-y-1">
                {visit.rxItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-baseline gap-1.5 font-label text-[11px]">
                    <span className="font-bold text-primary min-w-[1rem]">{idx + 1}.</span>
                    <span className="font-headline font-bold text-on-surface">{item.drugName}</span>
                    <span className="text-on-surface-variant">{[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
              </div>
            ),
          });
        }

        // Lab Orders for this visit
        if (visit.labs.length > 0) {
          items.push({
            label: `Lab Orders (${visit.labs.length})`, color: SECTION_COLORS['Lab Orders'],
            content: (
              <div className="space-y-0.5">
                {visit.labs.map((lab) => (
                  <div key={lab.id} className="flex items-center gap-2 text-[11px]">
                    <FlaskConical className="h-3 w-3 text-secondary shrink-0" />
                    <span className="font-medium">{lab.tests?.map((t) => t.name).join(', ') || lab.orderNumber || '—'}</span>
                    <span className={cn(
                      'inline-flex items-center rounded-full font-label text-[9px] font-bold px-1.5 py-0.5 capitalize',
                      lab.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant',
                    )}>
                      {lab.status}
                    </span>
                  </div>
                ))}
              </div>
            ),
          });
        }

        // Imaging for this visit
        if (visit.imaging.length > 0) {
          items.push({
            label: `Imaging (${visit.imaging.length})`, color: SECTION_COLORS['Imaging'],
            content: (
              <div className="space-y-0.5">
                {visit.imaging.map((img) => (
                  <div key={img.id} className="flex items-center gap-2 text-[11px]">
                    <ImageIcon className="h-3 w-3 text-tertiary shrink-0" />
                    <span className="font-medium">{img.type || img.modality || '—'}</span>
                    {img.bodyPart && <span className="text-on-surface-variant">({img.bodyPart})</span>}
                    <span className={cn(
                      'inline-flex items-center rounded-full font-label text-[9px] font-bold px-1.5 py-0.5 capitalize',
                      img.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant',
                    )}>
                      {img.status}
                    </span>
                  </div>
                ))}
              </div>
            ),
          });
        }

        // Advice, Follow-up, Referral, Additional Notes
        for (const key of ['Advice', 'Follow-up', 'Referral', 'Additional Notes']) {
          if (visit.sections[key]) {
            items.push({ label: key, color: SECTION_COLORS[key] || 'text-gray-600', content: <span className="text-[11px]">{visit.sections[key]}</span> });
          }
        }

        // Forms for this visit
        if (visit.forms.length > 0) {
          items.push({
            label: `Forms (${visit.forms.length})`, color: SECTION_COLORS['Forms'],
            content: (
              <div className="space-y-0.5">
                {visit.forms.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 text-[11px]">
                    <ClipboardList className="h-3 w-3 text-primary-container shrink-0" />
                    <span className="font-medium">{sub.systemForm?.name || 'Form'}</span>
                    <span className={cn(
                      'inline-flex items-center rounded-full font-label text-[9px] font-bold px-1.5 py-0.5 capitalize',
                      sub.status === 'verified' ? 'bg-primary/10 text-primary' :
                      sub.status === 'submitted' ? 'bg-primary-container/10 text-primary-container' :
                      'bg-surface-container-high text-on-surface-variant',
                    )}>
                      {sub.status}
                    </span>
                  </div>
                ))}
              </div>
            ),
          });
        }

        return (
          <div key={visit.id} className="relative">
            {/* timeline dot */}
            <div
              className={cn(
                'absolute -left-[18px] top-4 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background',
                i === 0 ? 'bg-primary animate-pulse' : 'bg-primary/50',
              )}
              aria-hidden
            >
              <div className="h-1.5 w-1.5 rounded-full bg-surface-container-lowest" />
            </div>

            <div className={cn(
              'rounded-xl bg-surface-container-lowest overflow-hidden shadow-sanctuary transition-all border-l-4',
              i === 0 ? 'border-primary' : 'border-outline-variant/30',
              isExpanded && i !== 0 && 'border-primary/50',
            )}>
              {/* Visit header */}
              <button
                type="button"
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low transition-colors text-left"
                onClick={() => setExpandedVisit(isExpanded ? null : i)}
              >
                <span className={cn(
                  'inline-flex h-6 min-w-[28px] items-center justify-center rounded-full font-label text-[10px] font-bold px-2 shrink-0',
                  i === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
                )}>
                  #{visitNumber}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="font-headline text-sm font-extrabold tracking-tight text-on-surface">{visit.date}</span>
                  {visit.doctorName && (
                    <span className="font-label text-[10px] text-on-surface-variant">{visit.doctorName}</span>
                  )}
                </div>
                <div className="flex-1" />

                {/* Summary count chips */}
                <div className="hidden sm:flex items-center gap-1.5 mr-1">
                  {visit.rxItems.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-label text-[10px] font-bold">
                      <Pill className="h-2.5 w-2.5" />{visit.rxItems.length}
                    </span>
                  )}
                  {visit.labs.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 text-secondary px-2 py-0.5 font-label text-[10px] font-bold">
                      <FlaskConical className="h-2.5 w-2.5" />{visit.labs.length}
                    </span>
                  )}
                  {visit.imaging.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 text-tertiary px-2 py-0.5 font-label text-[10px] font-bold">
                      <ImageIcon className="h-2.5 w-2.5" />{visit.imaging.length}
                    </span>
                  )}
                  {visit.diagnoses.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-error/10 text-error px-2 py-0.5 font-label text-[10px] font-bold">
                      Dx {visit.diagnoses.length}
                    </span>
                  )}
                </div>

                {visit.rxStatus && (
                  <span className="inline-flex items-center rounded-full border border-outline-variant/40 bg-surface-container-low px-2 py-0.5 font-label text-[10px] font-bold capitalize text-on-surface-variant">
                    {visit.rxStatus}
                  </span>
                )}
                <ChevronDown className={cn('h-4 w-4 text-on-surface-variant transition-transform', isExpanded && 'rotate-180')} />
              </button>

            {/* Collapsed summary */}
            {!isExpanded && items.length > 0 && (
              <div className="px-5 py-2 border-t border-outline-variant/20 font-label text-[11px] text-on-surface-variant truncate">
                {items.slice(0, 4).map((item, idx) => (
                  <span key={item.label}>
                    {idx > 0 && <span className="mx-1.5 text-outline-variant">·</span>}
                    <span className={cn('font-bold', item.color)}>{item.label}</span>
                  </span>
                ))}
                {items.length > 4 && <span className="ml-1.5 text-on-surface-variant/60">+{items.length - 4} more</span>}
              </div>
            )}

            {/* Expanded: all sections flat */}
            {isExpanded && (
              <div className="border-t border-outline-variant/20 divide-y divide-outline-variant/20 bg-surface-container-low/40">
                {items.map((item) => (
                  <div key={item.label} className="px-5 py-3">
                    <span className={cn('font-label text-[10px] font-bold uppercase tracking-widest', item.color)}>{item.label}</span>
                    <div className="mt-1 text-on-surface leading-relaxed">{item.content}</div>
                  </div>
                ))}
                {items.length === 0 && visit.noteContent && (
                  <div className="px-5 py-3">
                    <p className="font-label text-[11px] text-on-surface-variant whitespace-pre-line">{visit.noteContent}</p>
                  </div>
                )}
                {items.length === 0 && !visit.noteContent && (
                  <div className="px-5 py-3 text-center">
                    <p className="font-label text-[11px] text-on-surface-variant italic">No details recorded for this visit</p>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        );
      })}
        </div>
      </div>
      )}

      {/* ── Unattached Lab Orders ── */}
      {unattachedLabs.length > 0 && (
        <CollapsibleSection
          icon={<FlaskConical className="h-4 w-4" />}
          title="Lab Orders"
          badge={`${unattachedLabs.length}`}
          color="text-amber-600"
        >
          <div className="divide-y">
            {unattachedLabs.map((lab) => (
              <div key={lab.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{lab.tests?.map((t) => t.name).join(', ') || lab.orderNumber || '—'}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(lab.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={lab.status === 'completed' ? 'default' : lab.status === 'cancelled' ? 'destructive' : 'secondary'}
                    className="text-[9px] capitalize"
                  >
                    {lab.status}
                  </Badge>
                  {lab.priority && (lab.priority === 'urgent' || lab.priority === 'stat') && (
                    <Badge variant="destructive" className="text-[9px] capitalize">{lab.priority}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Unattached Imaging ── */}
      {unattachedImaging.length > 0 && (
        <CollapsibleSection
          icon={<ImageIcon className="h-4 w-4" />}
          title="Imaging"
          badge={`${unattachedImaging.length}`}
          color="text-pink-600"
        >
          <div className="divide-y">
            {unattachedImaging.map((req) => (
              <div key={req.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{req.type || req.modality || '—'} {req.bodyPart && `(${req.bodyPart})`}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(req.createdAt)}</p>
                  {req.findings && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{req.findings}</p>}
                </div>
                <Badge
                  variant={req.status === 'completed' ? 'default' : req.status === 'cancelled' ? 'destructive' : 'secondary'}
                  className="text-[9px] capitalize shrink-0"
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Documents ── */}
      {documents.length > 0 && (
        <CollapsibleSection
          icon={<FolderOpen className="h-4 w-4" />}
          title="Documents"
          badge={`${documents.length}`}
          color="text-slate-600"
        >
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.title || doc.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">{doc.type} · {formatDate(doc.createdAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-[11px] h-7"
                  render={<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" />}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Unattached Form Submissions ── */}
      {unattachedForms.length > 0 && (
        <CollapsibleSection
          icon={<ClipboardList className="h-4 w-4" />}
          title="Form Submissions"
          badge={`${unattachedForms.length}`}
          color="text-violet-600"
        >
          <div className="space-y-1 p-3">
            {unattachedForms.map((sub) => (
              <InlineSubmission key={sub.id} submission={sub} />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ============================================================
// Inline Form Submission (expandable)
// ============================================================

function InlineSubmission({ submission }: { submission: FormSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const formId = submission.formId ?? undefined;
  const { data: systemForm } = useSystemForm(expanded ? formId : undefined);
  const formName = submission.systemForm?.name || submission.instance?.name || 'Form';
  const triggerLabel = submission.trigger ? TRIGGER_LABELS[submission.trigger] : '';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <ClipboardList className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium flex-1 truncate">{formName}</span>
        {triggerLabel && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{triggerLabel}</Badge>
        )}
        <Badge
          className={cn(
            'text-[9px] px-1.5 py-0 shrink-0',
            submission.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
            submission.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
            submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
            'bg-muted text-muted-foreground',
          )}
        >
          {submission.status}
        </Badge>
      </button>
      {expanded && systemForm && (
        <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
          <FormRenderer schema={systemForm.schema} initialValues={submission.responses} readOnly />
        </div>
      )}
      {expanded && !systemForm && formId && (
        <div className="px-3 py-2 border-t">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary mx-auto" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Edit Banner (completed consultation, still inside 24h edit window)
// ============================================================

function EditWindowBanner({
  isEditing,
  completedAt,
  onStartEdit,
  onCancelEdit,
}: {
  isEditing: boolean;
  completedAt: number;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [, force] = useState(0);
  // Tick once per minute so the remaining-time label stays accurate
  useEffect(() => {
    const t = setInterval(() => force((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const remaining = 24 * 60 * 60 * 1000 - (Date.now() - completedAt);
  const hrs = Math.max(0, Math.floor(remaining / (60 * 60 * 1000)));
  const mins = Math.max(0, Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)));

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
        <Clock className="h-4 w-4 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          Edit window: {hrs}h {mins}m remaining
        </p>
        <p className="text-[11px] text-amber-700 mt-0.5">
          {isEditing
            ? 'Editing consultation — your changes will update the existing records in place.'
            : 'This consultation is completed but still editable for 24 hours.'}
        </p>
      </div>
      {isEditing ? (
        <Button size="sm" variant="outline" onClick={onCancelEdit} className="shrink-0">
          Cancel Edit
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onStartEdit}
          className="gap-1.5 bg-amber-600 hover:bg-amber-700 shrink-0"
        >
          <Edit3 className="h-3.5 w-3.5" />
          Edit Consultation
        </Button>
      )}
    </div>
  );
}

// ============================================================
// Full-Page Consultation View
// ============================================================

export default function PatientConsultationPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  const [clinicalOpen, setClinicalOpen] = useState(false);
  const [activeClinical, setActiveClinical] = useState<'medications' | 'history' | 'investigations' | 'drugs' | null>(null);

  const openClinical = (key: 'medications' | 'history' | 'investigations' | 'drugs') => {
    setActiveClinical(key);
    setClinicalOpen(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(`clinical-${key}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    });
  };

  const { data: patient, isLoading: patientLoading } = usePatientDetail(patientId);

  const { data: appointment } = useQuery({
    queryKey: ['doctor', 'appointments', 'detail', appointmentId],
    queryFn: async () => {
      const response = await apiGet<Appointment>(`/appointments/${appointmentId}`);
      return response.data;
    },
    enabled: !!appointmentId,
  });

  const isInConsultation = appointment?.status === 'in_consultation';
  const isCompleted = appointment?.status === 'completed';

  // Client-side edit-window check (server re-checks on every mutation)
  const completedAt = appointment?.updatedAt ? new Date(appointment.updatedAt).getTime() : null;
  const withinEditWindow = !!completedAt && Date.now() - completedAt < 24 * 60 * 60 * 1000;
  const canEdit = isCompleted && withinEditWindow;
  const editWindowClosed = isCompleted && !withinEditWindow;

  // ?edit=1 enables the editable form over a completed consultation (24h window)
  const editParam = searchParams.get('edit') === '1';
  const isEditing = canEdit && editParam;

  // Fetch prefill data when editing a completed consultation
  // IMPORTANT: This hook must run on every render (before any early return)
  // to keep hook order stable across renders.
  const { data: prefillResponse } = useQuery({
    queryKey: ['doctor', 'consultation-form-data', appointmentId],
    queryFn: async () => {
      const res = await apiGet<{ canEdit: boolean; reason?: string; prefill: any; appointmentStatus: string }>(
        `/appointments/${appointmentId}/consultation-form-data`,
      );
      return res.data;
    },
    enabled: !!appointmentId && isEditing,
  });
  const prefill = prefillResponse?.prefill;

  if (patientLoading) return <LoadingSpinner />;

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm text-muted-foreground">Patient not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const startEdit = () => router.push(`/doctor/consultation/${patient.id}?appointmentId=${appointmentId}&edit=1`);
  const cancelEdit = () => router.push(`/doctor/consultation/${patient.id}?appointmentId=${appointmentId}`);

  const showForm = isInConsultation || isEditing;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Top Bar ── */}
      <ConsultationTopBar
        patient={patient}
        onBack={() => router.back()}
      />

      <div className="px-4 lg:px-6 py-4">
        {/* ── Edit window banner / closed banner / pre-consult gate (full width) ── */}
        {canEdit && completedAt !== null && (
          <div className="mb-4">
            <EditWindowBanner
              isEditing={isEditing}
              completedAt={completedAt}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
            />
          </div>
        )}
        {editWindowClosed && (
          <div className="mb-4 rounded-xl border-2 border-muted bg-muted/30 px-4 py-3 flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Edit window closed.</span>{' '}
              OP consultations can be amended for 24 hours after completion. Contact an administrator
              for corrections.
            </div>
          </div>
        )}
        <div className="mb-4">
          <TriggerFormsGate
            trigger="pre_consultation"
            context={{ patientId: patient.id, appointmentId }}
            bannerHeading="Pre-consultation forms required"
          />
        </div>

        {/* ── Latest Vitals (top) ── */}
        <div className="mb-6 rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-primary overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="font-headline text-base font-extrabold tracking-tight text-on-surface">Latest Vitals</h2>
              <p className="font-label text-[11px] text-on-surface-variant">Most recent measurements snapshot</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="px-6 pb-5">
            <VitalsStrip patientId={patient.id} variant="top" />
          </div>
        </div>

        {/* ── Clinical Record Quick Cards (top) ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-headline text-base font-extrabold tracking-tight text-on-surface">Clinical Record</h2>
              <p className="font-label text-[11px] text-on-surface-variant">Click any card to view details</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { key: 'medications' as const, title: 'Current Medications', subtitle: 'Active prescriptions', icon: Stethoscope, accent: 'border-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary', badge: 'text-primary bg-primary/5' },
              { key: 'history' as const, title: 'Medical History', subtitle: 'Conditions & surgeries', icon: Heart, accent: 'border-secondary', iconBg: 'bg-secondary/10', iconColor: 'text-secondary', badge: 'text-secondary bg-secondary/5' },
              { key: 'investigations' as const, title: 'Investigation History', subtitle: 'Labs & imaging', icon: FlaskConical, accent: 'border-primary-container', iconBg: 'bg-primary-container/10', iconColor: 'text-primary-container', badge: 'text-primary-container bg-primary-container/5' },
              { key: 'drugs' as const, title: 'Drug History', subtitle: 'Past meds & adherence', icon: Pill, accent: 'border-tertiary', iconBg: 'bg-tertiary/10', iconColor: 'text-tertiary', badge: 'text-tertiary bg-tertiary/5' },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => openClinical(c.key)}
                  className={cn(
                    'group bg-surface-container-lowest p-6 rounded-xl shadow-sanctuary border-l-4 text-left transition-transform hover:-translate-y-0.5',
                    c.accent,
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn('p-2 rounded-lg', c.iconBg, c.iconColor)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn('text-[10px] font-label font-bold px-2 py-1 rounded-full', c.badge)}>View →</span>
                  </div>
                  <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">{c.subtitle}</p>
                  <h3 className="font-headline text-base font-extrabold tracking-tight text-on-surface leading-tight">{c.title}</h3>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2-Column Dashboard Layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* ═══════ MAIN COLUMN ═══════ */}
          <div className="xl:col-span-8 space-y-4 min-w-0">
            {/* CONSULTATION FORM — only when active/editing */}
            {showForm && (
              <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-primary overflow-hidden">
                  {/* Form header bar */}
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant/30">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-headline text-base font-extrabold tracking-tight text-on-surface leading-tight">
                        {isEditing ? 'Editing Consultation' : 'Active Consultation'}
                      </h2>
                      <p className="font-label text-[11px] text-on-surface-variant leading-tight mt-0.5">
                        {isEditing
                          ? 'Amend the saved consultation — changes update existing records'
                          : 'Record symptoms, vitals, diagnosis & prescription'}
                      </p>
                    </div>
                    {isEditing ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        className="h-8 gap-1.5 rounded-lg border-outline-variant/40 font-label font-bold text-xs text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Cancel Edit
                      </Button>
                    ) : null}
                  </div>

                  {/* Form body */}
                  {isEditing && !prefill ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading saved consultation…</span>
                    </div>
                  ) : (
                    <>
                      <PrescriptionPad
                        key={isEditing ? `edit-${prefill?.visitId}` : 'new'}
                        patientId={patient.id}
                        patientName={`${patient.firstName} ${patient.lastName}`}
                        patientAge={patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : undefined}
                        patientGender={patient.gender}
                        patientPhone={patient.phone}
                        appointmentId={appointmentId || ''}
                        doctorProfileId={appointment?.doctorId || ''}
                        doctorUserId={appointment?.doctor?.userId || ''}
                        onComplete={() => (isEditing ? cancelEdit() : router.back())}
                        hideHeader
                        initialValues={isEditing && prefill ? prefill : undefined}
                        editMode={
                          isEditing && prefill?.visitId
                            ? {
                                visitId: prefill.visitId,
                                progressNoteId: prefill.progressNoteId,
                                prescriptionId: prefill.prescriptionId,
                              }
                            : undefined
                        }
                      />
                      {isEditing && (
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-primary/15 bg-gradient-to-r from-amber-50/40 via-transparent to-transparent">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Unsaved edits will be discarded.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            className="h-8 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Cancel Edit
                          </Button>
                        </div>
                      )}
                    </>
                  )}
              </section>
            )}

            {/* VISIT TIMELINE */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-headline text-base font-extrabold tracking-tight text-on-surface">Visit Timeline</h2>
                  <p className="font-label text-[11px] text-on-surface-variant">Past visits & clinical events</p>
                </div>
              </div>
              <VisitTimeline patientId={patient.id} patient={patient} appointmentId={appointmentId} />
            </section>
          </div>

          {/* ═══════ SIDEBAR ═══════ */}
          <aside className="xl:col-span-4 space-y-4">
            <div className="xl:sticky xl:top-20 space-y-4">
              {/* Allergies */}
              {patient.allergies && patient.allergies.length > 0 && (
                <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-error overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-headline text-base font-extrabold tracking-tight text-on-surface">Allergies</h3>
                      <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">{patient.allergies.length} known</p>
                    </div>
                    <div className="p-2 bg-error/10 rounded-lg text-error">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex flex-wrap gap-1.5">
                    {patient.allergies.map((a, i) => (
                      <span
                        key={a.id ?? i}
                        className="font-label text-[10px] font-bold text-error bg-error/5 border border-error/20 rounded-full px-2.5 py-1"
                      >
                        {a.allergen}
                        {a.severity && <span className="ml-1 opacity-70">· {a.severity}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>

      {/* ═══════════ Clinical Record Popup ═══════════ */}
      <Dialog
        open={clinicalOpen}
        onOpenChange={(o) => {
          setClinicalOpen(o);
          if (!o) setActiveClinical(null);
        }}
      >
        <DialogContent className="max-w-5xl w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col sm:max-w-5xl">
          {(() => {
            const map = {
              medications: { title: 'Current Medications', subtitle: 'Active prescriptions', icon: Stethoscope, iconBg: 'bg-primary/10', iconColor: 'text-primary', panel: <CurrentMedicationsPanel patientId={patient.id} /> },
              history: { title: 'Medical History', subtitle: 'Conditions, surgeries & family hx', icon: Heart, iconBg: 'bg-secondary/10', iconColor: 'text-secondary', panel: <MedicalHistoryPanel patientId={patient.id} /> },
              investigations: { title: 'Investigation History', subtitle: 'Lab results & imaging reports', icon: FlaskConical, iconBg: 'bg-primary-container/10', iconColor: 'text-primary-container', panel: <InvestigationHistoryPanel patientId={patient.id} /> },
              drugs: { title: 'Drug History', subtitle: 'Past medications & adherence', icon: Pill, iconBg: 'bg-tertiary/10', iconColor: 'text-tertiary', panel: <DrugHistoryPanel patientId={patient.id} /> },
            } as const;
            const entry = activeClinical ? map[activeClinical] : null;
            if (!entry) return null;
            const Icon = entry.icon;
            return (
              <>
                {/* Header */}
                <div className="px-6 py-5 bg-surface-container-lowest border-b border-outline-variant/30 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-lg', entry.iconBg, entry.iconColor)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="font-headline text-lg font-extrabold tracking-tight text-on-surface">
                        {entry.title}
                      </DialogTitle>
                      <DialogDescription className="font-label text-[11px] text-on-surface-variant mt-0.5">
                        {entry.subtitle}
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto bg-background p-6">
                  {entry.panel}
                </div>
              </>
            );
          })()}

          {/* Footer */}
          <div className="border-t border-outline-variant/30 bg-surface-container-low px-6 py-3 flex items-center justify-between shrink-0">
            <p className="font-label text-[11px] text-on-surface-variant">
              Data is read-only here. Record new findings in the consultation form.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setClinicalOpen(false)}
              className="h-8 rounded-lg border-outline-variant/40 font-label font-bold text-xs text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
