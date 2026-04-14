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

/** Section label → color mapping */
const SECTION_COLORS: Record<string, string> = {
  'Chief Complaint': 'text-blue-600',
  'Symptoms': 'text-blue-600',
  'Diagnosis': 'text-red-600',
  'Prescription': 'text-emerald-600',
  'Medicines': 'text-emerald-600',
  'Vitals': 'text-orange-600',
  'Advice': 'text-purple-600',
  'Follow-up': 'text-cyan-600',
  'General Examination': 'text-teal-600',
  'Systemic Examination': 'text-teal-600',
  'Referral': 'text-indigo-600',
  'Additional Notes': 'text-gray-600',
  'Lab Orders': 'text-amber-600',
  'Imaging': 'text-pink-600',
  'Documents': 'text-slate-600',
  'Forms': 'text-violet-600',
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
  appointment,
  onBack,
}: {
  patient: Patient;
  appointment?: Appointment | null;
  onBack: () => void;
}) {
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
  const status = appointment?.status ? STATUS_STYLES[appointment.status] : null;

  return (
    <div className="sticky top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2.5 bg-white/85 backdrop-blur-md border-b shadow-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-white font-headline text-xs font-bold shrink-0 shadow-md shadow-primary/30">
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-sm font-bold truncate">
                {patient.firstName} {patient.lastName}
              </h1>
              {status && (
                <Badge className={`text-[9px] px-1.5 py-0 font-semibold ${status.className}`}>
                  {status.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground leading-tight">
              <span className="font-semibold text-primary">{patient.mrn}</span>
              {patient.gender && <><span>·</span><span className="capitalize">{patient.gender}</span></>}
              {age && <><span>·</span><span>{age}</span></>}
              {patient.bloodGroup && <><span>·</span><span className="font-semibold text-rose-600">{patient.bloodGroup}</span></>}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {appointment?.reason && (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            <span className="truncate max-w-xs">{appointment.reason}</span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 h-8 border-primary/20 text-primary hover:bg-primary/5"
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

function VitalsStrip({ patientId }: { patientId: string }) {
  const { data: vitals, isLoading } = usePatientVitals(patientId);
  const latest = (vitals as Vital[] | undefined)?.[0];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl border border-primary/10 bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-dashed border-muted bg-muted/20 py-4 text-center">
        <Activity className="h-4 w-4 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-[11px] text-muted-foreground italic">No vitals recorded</p>
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
      <div className="rounded-xl border border-dashed border-muted bg-muted/20 py-4 text-center">
        <Activity className="h-4 w-4 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-[11px] text-muted-foreground italic">No vitals recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              'rounded-xl border p-2.5 transition-all hover:shadow-md hover:-translate-y-0.5',
              item.alert
                ? 'border-destructive/40 bg-gradient-to-br from-destructive/10 to-destructive/5'
                : 'border-primary/15 bg-gradient-to-br from-primary/5 to-transparent',
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md',
                  item.alert ? 'bg-destructive/15' : 'bg-primary/15',
                )}
              >
                <Icon className={cn('h-3 w-3', item.alert ? 'text-destructive' : 'text-primary')} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn('text-base font-bold leading-none', item.alert && 'text-destructive')}>
                {item.value}
              </span>
              <span className="text-[9px] text-muted-foreground">{item.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
    {latest.createdAt && (
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          Recorded {formatDateTimeAmPm(latest.createdAt)}
        </span>
        <span className="text-[9px] font-semibold text-primary">
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
  if (lines.length === 0) return <span className="text-[11px]">{content}</span>;

  return (
    <div className="space-y-0.5">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^-\s*/, '');
        const parts = cleaned.split(' | ');
        const drugName = parts[0] || cleaned;
        const rest = parts.slice(1).join(' · ');
        return (
          <span key={idx} className="text-[11px] block">
            {idx + 1}. <span className="font-medium">{drugName}</span>
            {rest && <span className="text-muted-foreground"> {rest}</span>}
          </span>
        );
      })}
    </div>
  );
}

function VitalsGrid({ content }: { content: string }) {
  const lines = content.split('\n').filter((l) => l.trim());
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
      {lines.map((line, idx) => {
        const [label, value] = line.split(':').map((s) => s.trim());
        return (
          <span key={idx} className="text-[11px]">
            <span className="text-muted-foreground">{label}:</span> <span className="font-semibold">{value}</span>
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
              <Badge variant="outline" className={cn(
                'text-[8px] px-1 py-0 capitalize ml-1',
                diagType === 'primary' ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-500',
              )}>
                {diagType}
              </Badge>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-2.5">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Visits</span>
            </div>
            <p className="text-base font-bold text-foreground mt-0.5 leading-none">{totalVisits}</p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-emerald-100/60 to-transparent p-2.5">
            <div className="flex items-center gap-1.5">
              <Pill className="h-3 w-3 text-emerald-600" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Rx Items</span>
            </div>
            <p className="text-base font-bold text-emerald-700 mt-0.5 leading-none">{totalRx}</p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-amber-100/60 to-transparent p-2.5">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3 text-amber-600" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Labs</span>
            </div>
            <p className="text-base font-bold text-amber-700 mt-0.5 leading-none">{totalLabs}</p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-pink-100/60 to-transparent p-2.5">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3 text-pink-600" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Imaging</span>
            </div>
            <p className="text-base font-bold text-pink-700 mt-0.5 leading-none">{totalImaging}</p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-blue-100/60 to-transparent p-2.5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-blue-600" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Last Visit</span>
            </div>
            <p className="text-[11px] font-bold text-blue-700 mt-0.5 leading-tight truncate">{lastVisitDate ?? '—'}</p>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {visits.length === 0 && unattachedLabs.length === 0 && unattachedImaging.length === 0 && (
        <EmptyState icon={Clock} message="No visit history found for this patient" />
      )}

      {visits.length > 0 && (
      <div className="relative pl-7">
        {/* rail */}
        <div className="absolute left-3 top-3 bottom-3 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" aria-hidden />
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
                      <Badge variant="outline" className={cn(
                        'text-[8px] px-1 py-0 capitalize ml-1',
                        d.diagnosisType === 'primary' ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-500',
                      )}>
                        {d.diagnosisType}
                      </Badge>
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
              <div className="space-y-0.5">
                {visit.rxItems.map((item: any, idx: number) => (
                  <span key={idx} className="text-[11px] block">
                    {idx + 1}. <span className="font-medium">{item.drugName}</span>
                    <span className="text-muted-foreground"> {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}</span>
                  </span>
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
                    <FlaskConical className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="font-medium">{lab.tests?.map((t) => t.name).join(', ') || lab.orderNumber || '—'}</span>
                    <Badge
                      variant={lab.status === 'completed' ? 'default' : 'secondary'}
                      className="text-[8px] px-1 py-0 capitalize"
                    >
                      {lab.status}
                    </Badge>
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
                    <ImageIcon className="h-3 w-3 text-pink-500 shrink-0" />
                    <span className="font-medium">{img.type || img.modality || '—'}</span>
                    {img.bodyPart && <span className="text-muted-foreground">({img.bodyPart})</span>}
                    <Badge
                      variant={img.status === 'completed' ? 'default' : 'secondary'}
                      className="text-[8px] px-1 py-0 capitalize"
                    >
                      {img.status}
                    </Badge>
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
                    <ClipboardList className="h-3 w-3 text-violet-500 shrink-0" />
                    <span className="font-medium">{sub.systemForm?.name || 'Form'}</span>
                    <Badge className={cn(
                      'text-[8px] px-1 py-0',
                      sub.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                      sub.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                      'bg-muted text-muted-foreground',
                    )}>
                      {sub.status}
                    </Badge>
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
                'absolute -left-[18px] top-3 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background shadow-md',
                i === 0 ? 'bg-primary animate-pulse' : 'bg-primary/60',
              )}
              aria-hidden
            >
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>

            <div className={cn(
              'rounded-xl border bg-card overflow-hidden shadow-sm transition-all',
              isExpanded ? 'shadow-md ring-1 ring-primary/20' : 'hover:shadow-md',
              i === 0 && 'border-primary/30',
            )}>
              {/* Visit header */}
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                onClick={() => setExpandedVisit(isExpanded ? null : i)}
              >
                <Badge className={cn(
                  'text-[9px] px-1.5 py-0 font-bold shrink-0',
                  i === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                )}>
                  #{visitNumber}
                </Badge>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold text-foreground">{visit.date}</span>
                  {visit.doctorName && (
                    <span className="text-[10px] text-muted-foreground">{visit.doctorName}</span>
                  )}
                </div>
                <div className="flex-1" />

                {/* Summary count chips */}
                <div className="hidden sm:flex items-center gap-1 mr-1">
                  {visit.rxItems.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold">
                      <Pill className="h-2.5 w-2.5" />{visit.rxItems.length}
                    </span>
                  )}
                  {visit.labs.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[9px] font-bold">
                      <FlaskConical className="h-2.5 w-2.5" />{visit.labs.length}
                    </span>
                  )}
                  {visit.imaging.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-pink-50 text-pink-700 px-1.5 py-0.5 text-[9px] font-bold">
                      <ImageIcon className="h-2.5 w-2.5" />{visit.imaging.length}
                    </span>
                  )}
                  {visit.diagnoses.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-red-50 text-red-700 px-1.5 py-0.5 text-[9px] font-bold">
                      Dx {visit.diagnoses.length}
                    </span>
                  )}
                </div>

                {visit.rxStatus && (
                  <Badge variant="outline" className="text-[9px] capitalize">{visit.rxStatus}</Badge>
                )}
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
              </button>

            {/* Collapsed summary */}
            {!isExpanded && items.length > 0 && (
              <div className="px-4 py-1.5 border-t border-dashed text-[11px] text-muted-foreground truncate">
                {items.slice(0, 4).map((item, idx) => (
                  <span key={item.label}>
                    {idx > 0 && <span className="mx-1.5">·</span>}
                    <span className={cn('font-semibold', item.color)}>{item.label}</span>
                  </span>
                ))}
                {items.length > 4 && <span className="ml-1.5 text-muted-foreground/50">+{items.length - 4} more</span>}
              </div>
            )}

            {/* Expanded: all sections flat */}
            {isExpanded && (
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.label} className="px-4 py-2.5">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wide', item.color)}>{item.label}</span>
                    <div className="mt-0.5 text-foreground/80 leading-relaxed">{item.content}</div>
                  </div>
                ))}
                {items.length === 0 && visit.noteContent && (
                  <div className="px-4 py-2.5">
                    <p className="text-[11px] text-muted-foreground whitespace-pre-line">{visit.noteContent}</p>
                  </div>
                )}
                {items.length === 0 && !visit.noteContent && (
                  <div className="px-4 py-2.5 text-center">
                    <p className="text-[11px] text-muted-foreground">No details recorded for this visit</p>
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
    <div className="min-h-screen bg-gradient-to-b from-muted/20 via-background to-muted/10">
      {/* ── Sticky Top Bar ── */}
      <ConsultationTopBar
        patient={patient}
        appointment={appointment}
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

        {/* ── Clinical Record Quick Cards (top) ── */}
        <div className="mb-4">
          <div className="flex items-center gap-2 px-1 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Clinical Record
            </h3>
            <span className="text-[10px] text-muted-foreground">· click any card to view details</span>
            <div className="h-px flex-1 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'medications' as const, title: 'Current Medications', subtitle: 'Active prescriptions', icon: Stethoscope, tint: 'emerald', gradFrom: 'from-emerald-50', gradVia: 'via-emerald-100/40', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', text: 'text-emerald-700', hover: 'hover:border-emerald-400 hover:shadow-emerald-100' },
              { key: 'history' as const, title: 'Medical History', subtitle: 'Conditions & surgeries', icon: Heart, tint: 'rose', gradFrom: 'from-rose-50', gradVia: 'via-rose-100/40', border: 'border-rose-200', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', text: 'text-rose-700', hover: 'hover:border-rose-400 hover:shadow-rose-100' },
              { key: 'investigations' as const, title: 'Investigation History', subtitle: 'Labs & imaging', icon: FlaskConical, tint: 'amber', gradFrom: 'from-amber-50', gradVia: 'via-amber-100/40', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', text: 'text-amber-700', hover: 'hover:border-amber-400 hover:shadow-amber-100' },
              { key: 'drugs' as const, title: 'Drug History', subtitle: 'Past meds & adherence', icon: Pill, tint: 'blue', gradFrom: 'from-blue-50', gradVia: 'via-blue-100/40', border: 'border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', text: 'text-blue-700', hover: 'hover:border-blue-400 hover:shadow-blue-100' },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => openClinical(c.key)}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br to-transparent p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
                    c.gradFrom, c.gradVia, c.border, c.hover,
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shadow-sm shrink-0', c.iconBg)}>
                      <Icon className={cn('h-5 w-5', c.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className={cn('text-[13px] font-bold leading-tight truncate', c.text)}>{c.title}</h4>
                        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5', c.iconColor)} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{c.subtitle}</p>
                      <p className={cn('text-[9px] font-bold uppercase tracking-wider mt-1.5 opacity-70', c.text)}>View details →</p>
                    </div>
                  </div>
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
              <section className="relative">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-primary/40 via-primary/20 to-transparent opacity-60 blur-sm" aria-hidden />
                <div className="relative rounded-2xl border-2 border-primary/30 bg-card overflow-hidden shadow-xl shadow-primary/10">
                  {/* Form header bar */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/15">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-white shadow-md shadow-primary/20">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-bold text-primary leading-tight">
                        {isEditing ? 'Editing Consultation' : 'Active Consultation'}
                      </h2>
                      <p className="text-[10px] text-muted-foreground leading-tight">
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
                        className="h-8 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Cancel Edit
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 font-bold gap-1 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </Badge>
                    )}
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
                </div>
              </section>
            )}

            {/* VISIT TIMELINE */}
            <section>
              <div className="flex items-center gap-2 px-1 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Visit Timeline
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent" />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <FlaskConical className="h-3 w-3" />
                  Order Lab
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7 border-pink-300 text-pink-700 hover:bg-pink-50"
                >
                  <ImageIcon className="h-3 w-3" />
                  Request Imaging
                </Button>
              </div>
              <VisitTimeline patientId={patient.id} patient={patient} appointmentId={appointmentId} />
            </section>
          </div>

          {/* ═══════ SIDEBAR ═══════ */}
          <aside className="xl:col-span-4 space-y-4">
            <div className="xl:sticky xl:top-20 space-y-4">
              {/* Appointment */}
              <AppointmentCard patient={patient} appointment={appointment} />

              {/* Allergies */}
              {patient.allergies && patient.allergies.length > 0 && (
                <div className="rounded-2xl border-2 border-destructive/30 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive text-white shadow-sm">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-destructive uppercase tracking-wide">
                      Allergies
                    </span>
                    <Badge variant="destructive" className="ml-auto text-[9px] px-1.5 py-0">
                      {patient.allergies.length}
                    </Badge>
                  </div>
                  <div className="p-3 flex flex-wrap gap-1.5">
                    {patient.allergies.map((a, i) => (
                      <Badge
                        key={a.id ?? i}
                        variant="destructive"
                        className="text-[10px] font-semibold py-0.5 px-2"
                      >
                        {a.allergen}
                        {a.severity && <span className="ml-1 opacity-75">· {a.severity}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Vitals */}
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b flex items-center gap-2 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                    Latest Vitals
                  </span>
                </div>
                <div className="p-3">
                  <VitalsStrip patientId={patient.id} />
                </div>
              </div>

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
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-emerald-700 px-6 py-4 text-white shrink-0">
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="relative flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-2 ring-white/20">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight text-white">
                  Clinical Record
                </DialogTitle>
                <DialogDescription className="text-[11px] text-white/70 mt-0.5">
                  Complete medical context — read-only view
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Scrollable Body — only the clicked section is rendered */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/20 to-background p-5">
            {activeClinical === 'medications' && (
              <section className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-50 to-transparent border-b">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                    <Stethoscope className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-700">Current Medications</h3>
                    <p className="text-[11px] text-muted-foreground">Active prescriptions</p>
                  </div>
                </div>
                <div className="p-4">
                  <CurrentMedicationsPanel patientId={patient.id} />
                </div>
              </section>
            )}

            {activeClinical === 'history' && (
              <section className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-50 to-transparent border-b">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100">
                    <Heart className="h-4.5 w-4.5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-rose-700">Medical History</h3>
                    <p className="text-[11px] text-muted-foreground">Conditions, surgeries & family hx</p>
                  </div>
                </div>
                <div className="p-4">
                  <MedicalHistoryPanel patientId={patient.id} />
                </div>
              </section>
            )}

            {activeClinical === 'investigations' && (
              <section className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-50 to-transparent border-b">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                    <FlaskConical className="h-4.5 w-4.5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-700">Investigation History</h3>
                    <p className="text-[11px] text-muted-foreground">Lab results & imaging reports</p>
                  </div>
                </div>
                <div className="p-4">
                  <InvestigationHistoryPanel patientId={patient.id} />
                </div>
              </section>
            )}

            {activeClinical === 'drugs' && (
              <section className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-transparent border-b">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                    <Pill className="h-4.5 w-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-blue-700">Drug History</h3>
                    <p className="text-[11px] text-muted-foreground">Past medications & adherence</p>
                  </div>
                </div>
                <div className="p-4">
                  <DrugHistoryPanel patientId={patient.id} />
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="border-t bg-muted/30 px-5 py-3 flex items-center justify-between shrink-0">
            <p className="text-[11px] text-muted-foreground">
              Data is read-only here. Record new findings in the consultation form.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setClinicalOpen(false)}
              className="h-8"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
