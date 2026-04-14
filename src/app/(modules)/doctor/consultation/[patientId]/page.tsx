'use client';

import { use, useState, useMemo } from 'react';
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
  usePatientDetail,
  usePatientVitals,
  usePrescriptions,
  useLabOrders,
  useProgressNotes,
  usePatientDiagnoses,
} from '@/hooks/use-doctor';
import { apiGet } from '@/lib/api';
import { formatDate, formatTime, formatDateTimeAmPm } from '@/lib/date-utils';
import { TriggerFormsGate } from '@/components/forms/trigger-forms-gate';
import { PrescriptionPad } from '@/components/doctor/prescription-pad';
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
// Patient Header (compact, connected)
// ============================================================

function PatientHeader({
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
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* Avatar */}
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-headline text-sm font-bold shrink-0">
        {patient.firstName?.[0]}
        {patient.lastName?.[0]}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-headline text-lg font-bold leading-tight">
            {patient.firstName} {patient.lastName}
          </h1>
          {status && (
            <Badge className={`text-[10px] px-2 py-0.5 font-medium ${status.className}`}>
              {status.label}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
          <span className="font-semibold text-foreground">{patient.mrn}</span>
          {patient.gender && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="capitalize">{patient.gender}</span>
            </>
          )}
          {age && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span>{age}</span>
            </>
          )}
          {patient.bloodGroup && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                {patient.bloodGroup}
              </Badge>
            </>
          )}
          {patient.phone && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {patient.phone}
              </span>
            </>
          )}
          {appointment?.reason && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-foreground">{appointment.reason}</span>
            </>
          )}
        </div>
      </div>

      <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
        <Printer className="h-3.5 w-3.5" />
        Print
      </Button>
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Loading vitals…
      </div>
    );
  }

  if (!latest) {
    return <span className="text-[11px] text-muted-foreground italic">No vitals recorded</span>;
  }

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
      value: latest.pulseRate ?? latest.heartRate,
      unit: 'bpm',
      alert: (latest.pulseRate ?? latest.heartRate) ? ((latest.pulseRate ?? latest.heartRate)! > 100 || (latest.pulseRate ?? latest.heartRate)! < 60) : false,
    },
    {
      icon: Activity,
      label: 'BP',
      value: latest.bloodPressureSystolic && latest.bloodPressureDiastolic
        ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`
        : null,
      unit: 'mmHg',
    },
    {
      icon: Droplets,
      label: 'SpO₂',
      value: latest.oxygenSaturation,
      unit: '%',
      alert: latest.oxygenSaturation ? latest.oxygenSaturation < 95 : false,
    },
    {
      icon: Weight,
      label: 'Wt',
      value: latest.weightKg ?? latest.weight,
      unit: 'kg',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => {
        if (item.value == null) return null;
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
              item.alert ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/40'
            }`}
          >
            <Icon className={`h-3 w-3 ${item.alert ? 'text-destructive' : 'text-primary'}`} />
            <span className="font-medium">{item.value}</span>
            <span className="text-muted-foreground text-[9px]">{item.unit}</span>
          </div>
        );
      })}
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
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <span className={cn('shrink-0', color)}>{icon}</span>
        <span className={cn('text-sm font-semibold flex-1', color)}>{title}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{badge}</Badge>
        )}
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t">{children}</div>}
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

  return (
    <div className="space-y-3">
      {/* ── Visit Cards ── */}
      {visits.length === 0 && unattachedLabs.length === 0 && unattachedImaging.length === 0 && (
        <EmptyState icon={Clock} message="No visit history found for this patient" />
      )}

      {visits.map((visit, i) => {
        const isExpanded = expandedVisit === i;

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
          <div key={visit.id} className="rounded-xl border bg-card overflow-hidden">
            {/* Visit header */}
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
              onClick={() => setExpandedVisit(isExpanded ? null : i)}
            >
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-bold text-primary">{visit.date}</span>
              {visit.doctorName && (
                <span className="text-[11px] text-muted-foreground">· {visit.doctorName}</span>
              )}
              <div className="flex-1" />
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
        );
      })}

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

  const { data: patient, isLoading: patientLoading } = usePatientDetail(patientId);

  const { data: appointment } = useQuery({
    queryKey: ['doctor', 'appointments', 'detail', appointmentId],
    queryFn: async () => {
      const response = await apiGet<Appointment>(`/appointments/${appointmentId}`);
      return response.data;
    },
    enabled: !!appointmentId,
  });

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

  const isInConsultation = appointment?.status === 'in_consultation';

  return (
    <div className="space-y-3">
      {/* ── Unified Patient Header Card ── */}
      <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
        <PatientHeader patient={patient} appointment={appointment} onBack={() => router.back()} />
        <AllergyBanner allergies={patient.allergies} />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-label font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
            Latest Vitals
          </span>
          <VitalsStrip patientId={patient.id} />
        </div>
      </div>

      {/* ── Pre-consultation forms gate ── */}
      <TriggerFormsGate
        trigger="pre_consultation"
        context={{ patientId: patient.id, appointmentId }}
        bannerHeading="Pre-consultation forms required"
      />

      {/* ── Prescription Pad (during active consultation) ── */}
      {isInConsultation ? (
        <PrescriptionPad
          patientId={patient.id}
          patientName={`${patient.firstName} ${patient.lastName}`}
          patientAge={patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : undefined}
          patientGender={patient.gender}
          patientPhone={patient.phone}
          appointmentId={appointmentId || ''}
          doctorProfileId={appointment?.doctorId || ''}
          doctorUserId={appointment?.doctor?.userId || ''}
          onComplete={() => router.back()}
          hideHeader
        />
      ) : (
        <>
          {/* ── Quick Actions ── */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FlaskConical className="h-3.5 w-3.5" />
              Order Lab
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ImageIcon className="h-3.5 w-3.5" />
              Request Imaging
            </Button>
          </div>

          {/* ── Unified Visit Timeline (everything together) ── */}
          <VisitTimeline patientId={patient.id} patient={patient} appointmentId={appointmentId} />
        </>
      )}
    </div>
  );
}
