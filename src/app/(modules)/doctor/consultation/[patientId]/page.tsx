'use client';

// ───────────────────────────────────────────────────────────────────────
// Consultation workspace
//
// Layout (80 / 20):
//   [ Sticky top bar: patient strip + primary actions                   ]
//   [ ┌─ main column (4/5 = 80%) ─────┐ ┌─ aside (1/5 = 20%) ─┐         ]
//   [ │ Banner: edit window / locked  │ │ Vitals (compact)    │         ]
//   [ │ Clinical Record quick-cards   │ │ Family Hx           │         ]
//   [ │ Nursing forms summary         │ │ Allergies           │         ]
//   [ │ PrescriptionPad / SOAP        │ │  (sticky scroll)    │         ]
//   [ │ Orders (live status)          │ │                     │         ]
//   [ └───────────────────────────────┘ └─────────────────────┘         ]
// ───────────────────────────────────────────────────────────────────────

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  BedDouble,
  Clock,
  FlaskConical,
  Heart,
  History,
  Loader2,
  Pill,
  Printer,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { PrescriptionPad, clearConsultationDraft } from '@/components/doctor/prescription-pad';
import { DrugHistoryPanel } from '@/components/doctor/drug-history-panel';
import { CurrentMedicationsPanel } from '@/components/doctor/current-medications-panel';
import { MedicalHistoryPanel } from '@/components/doctor/medical-history-panel';
import { familyKey, LIVE } from '@/components/shared/patient-history-panel';
import { PatientSafetyBanner } from '@/components/doctor/patient-safety-banner';
import { InvestigationHistoryPanel } from '@/components/doctor/investigation-history-panel';
import { LabOrderDialog } from '@/components/doctor/lab-order-dialog';
import { ImagingRequestDialog } from '@/components/doctor/imaging-request-dialog';
import { AdmissionRequestDialog } from '@/components/doctor/admission-request-dialog';
import { OrdersPanel } from '@/components/doctor/orders-panel';
import { AmendmentHistoryDialog } from '@/components/doctor/progress-notes-amendment-history';
import { cn } from '@/lib/utils';
import { usePatientDetail, useProgressNotes, usePrescriptions } from '@/hooks/use-doctor';
import { useAdmissions } from '@/hooks/use-clinical';
import { openPrescriptionPdf } from '@/lib/print-prescription';
import { useLatestVitals as useLatestVitalsNurse } from '@/hooks/use-nurse';
import { NursingFormsPanel } from '@/components/doctor/nursing-forms-panel';
import { ConsultationSummaryPanel } from '@/components/doctor/consultation-summary-panel';
import { PatientAiAssistant } from '@/components/doctor/patient-ai-assistant';
import { useAiStatus } from '@/hooks/use-ai';
import { Sparkles, Plus } from 'lucide-react';
import { RecordVitalsDialog } from '@/components/shared/record-vitals-dialog';
import type { Patient, Appointment } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────

function calculateAge(dob: string): string {
  try {
    const birth = new Date(dob);
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return `${age}y`;
  } catch {
    return '';
  }
}

// ── Top bar ────────────────────────────────────────────────────────────

function TopBar({
  patient,
  onBack,
  onOrderLab,
  onOrderImaging,
  onRequestIp,
  canOrder,
  isEditing,
  onCancelEdit,
}: {
  patient: Patient;
  onBack: () => void;
  onOrderLab: () => void;
  onOrderImaging: () => void;
  onRequestIp: () => void;
  canOrder: boolean;
  isEditing: boolean;
  onCancelEdit?: () => void;
}) {
  const initials =
    `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() || 'P';
  const [aiOpen, setAiOpen] = useState(false);
  const { data: aiStatus } = useAiStatus();
  // Is this patient currently an inpatient? Drives the OP/IP indicator and stops
  // a duplicate "Request IP" on an already-admitted patient.
  const { data: admResp } = useAdmissions({ patientId: patient.id, status: 'admitted', limit: 1 });
  const activeAdmission = admResp?.data?.[0] ?? null;
  const patientName = `${patient.firstName} ${patient.lastName ?? ''}`.trim();

  // "Print" opens the patient's LATEST prescription as the hospital-branded PDF
  // (letterhead/accent/footer from the PDF Builder) — not the raw page.
  const { data: rxData } = usePrescriptions({ patientId: patient.id, limit: 5 });
  const latestRx = useMemo(() => {
    const list = rxData?.data ?? [];
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [rxData]);
  const [printing, setPrinting] = useState(false);
  const handlePrintLatest = async () => {
    if (!latestRx) {
      toast.error('No prescription to print yet for this patient.');
      return;
    }
    setPrinting(true);
    try {
      await openPrescriptionPdf(latestRx.id);
    } catch {
      toast.error('Could not open the prescription PDF.');
    } finally {
      setPrinting(false);
    }
  };
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline-variant/30 bg-card/95 px-4 py-2 backdrop-blur-md print:hidden">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="text-sm font-bold text-primary">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate flex items-center gap-1.5">
            {patient.firstName} {patient.lastName}
            <span
              className={
                activeAdmission
                  ? 'shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700'
                  : 'shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700'
              }
              title={activeAdmission ? 'Inpatient (currently admitted)' : 'Outpatient'}
            >
              {activeAdmission ? 'IP · Admitted' : 'OP'}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {[
              patient.mrn && `MRN: ${patient.mrn}`,
              patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null,
              patient.gender,
              patient.phone,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
      <div className="flex-1" />
      {isEditing && onCancelEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCancelEdit}
          className="h-8 gap-1 text-xs border-secondary/40 text-secondary hover:bg-secondary/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cancel edit
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={onOrderLab}
        disabled={!canOrder}
      >
        <FlaskConical className="h-3.5 w-3.5" />
        Order Lab
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={onOrderImaging}
        disabled={!canOrder}
      >
        <Activity className="h-3.5 w-3.5" />
        Order Imaging
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={onRequestIp}
        disabled={!!activeAdmission}
        title={activeAdmission ? 'Patient is already admitted' : 'Raise an IP admission request'}
      >
        <BedDouble className="h-3.5 w-3.5" />
        {activeAdmission ? 'Admitted' : 'Request IP'}
      </Button>
      {aiStatus?.features.patientChat && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs border-primary/40 text-primary hover:bg-primary/5"
          onClick={() => setAiOpen(true)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Assistant
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={handlePrintLatest}
        disabled={printing}
        title="Print the patient's latest prescription (hospital-branded PDF)"
      >
        {printing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        Print
      </Button>

      {/* UC2: in-context patient AI assistant — opens as a right-side chat panel
          so the doctor keeps the consultation in view while asking the assistant. */}
      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-outline-variant/40 p-4 pr-12 pb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI Assistant — {patientName}
            </SheetTitle>
            <SheetDescription className="sr-only">
              AI decision-support chat for this patient
            </SheetDescription>
          </SheetHeader>
          <PatientAiAssistant
            patientId={patient.id}
            patientName={patientName}
            className="min-h-0 flex-1 p-4 pt-3"
            scrollClassName="min-h-0"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Compact sidebar card shell ────────────────────────────────────────

function SidebarCard({
  title,
  icon: Icon,
  accent = 'border-primary',
  iconAccent = 'text-primary',
  children,
  trailing,
}: {
  title: string;
  icon: React.ElementType;
  accent?: string;
  iconAccent?: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 p-3',
        accent,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-3.5 w-3.5', iconAccent)} />
        <h3 className="font-headline text-xs font-bold uppercase tracking-wide">{title}</h3>
        {trailing && <span className="ml-auto">{trailing}</span>}
      </div>
      {children}
    </section>
  );
}

// ── Sidebar: Vitals (vertical, compact) ───────────────────────────────

function VitalsSidebar({
  patientId,
  appointmentId,
  visitId,
}: {
  patientId: string;
  appointmentId?: string | null;
  visitId?: string | null;
}) {
  const { data: latestResp, isLoading } = useLatestVitalsNurse(patientId);
  const v = (latestResp as any)?.data ?? null;
  const [recordOpen, setRecordOpen] = useState(false);
  // The treating doctor examines the patient and may record their own reading
  // (nursing still owns routine rounds). Needs an encounter to hang the vital
  // off, so require an appointment or active visit.
  const canRecord = Boolean(patientId && (appointmentId || visitId));

  const recordButton = canRecord ? (
    <button
      type="button"
      onClick={() => setRecordOpen(true)}
      className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10"
    >
      <Plus className="h-3 w-3" /> Record
    </button>
  ) : null;

  const dialog = canRecord ? (
    <RecordVitalsDialog
      open={recordOpen}
      onOpenChange={setRecordOpen}
      patientId={patientId}
      appointmentId={appointmentId ?? undefined}
      visitId={visitId ?? undefined}
    />
  ) : null;

  if (isLoading) {
    return (
      <SidebarCard title="Vitals" icon={Activity} trailing={recordButton}>
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        {dialog}
      </SidebarCard>
    );
  }
  if (!v) {
    return (
      <SidebarCard title="Vitals" icon={Activity} trailing={recordButton}>
        <p className="text-[11px] text-muted-foreground italic leading-snug">
          No vitals recorded yet. Nursing records these on rounds — or tap Record
          to capture a reading at examination.
        </p>
        {dialog}
      </SidebarCard>
    );
  }

  const rows = [
    {
      label: 'BP',
      value:
        v.bloodPressureSystolic && v.bloodPressureDiastolic
          ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
          : null,
      unit: 'mmHg',
      accent: 'text-error',
    },
    { label: 'Pulse', value: v.pulseRate ?? v.heartRate ?? null, unit: 'bpm', accent: 'text-tertiary' },
    { label: 'Temp', value: v.temperature ?? null, unit: '°C', accent: 'text-secondary' },
    { label: 'SpO₂', value: v.oxygenSaturation ?? null, unit: '%', accent: 'text-primary' },
    { label: 'RR', value: v.respiratoryRate ?? null, unit: '/min', accent: 'text-primary' },
    { label: 'Weight', value: v.weightKg ?? v.weight ?? null, unit: 'kg', accent: 'text-secondary' },
    { label: 'BGL', value: v.bloodSugar ?? null, unit: 'mg/dL', accent: 'text-error' },
  ].filter((t) => t.value !== null && t.value !== undefined && t.value !== '');

  return (
    <SidebarCard
      title="Vitals"
      icon={Activity}
      trailing={
        <span className="flex items-center gap-1.5">
          {v.recordedAt && (
            <span className="text-[9px] text-muted-foreground font-normal normal-case tracking-normal">
              {formatDateTimeAmPm(v.recordedAt)}
            </span>
          )}
          {recordButton}
        </span>
      }
    >
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No numeric vitals on record.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/30">
          {rows.map((t, i) => (
            <li key={i} className="flex items-baseline justify-between py-1">
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                {t.label}
              </span>
              <span className="flex items-baseline gap-1">
                <span className={cn('text-xs font-bold', t.accent)}>{String(t.value)}</span>
                <span className="text-[9px] text-muted-foreground">{t.unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </SidebarCard>
  );
}

// ── Sidebar: Family Medical History (read-only, compact) ──────────────

function FamilyHistorySidebar({ patientId }: { patientId: string }) {
  // Shares PatientHistoryPanel's key so an edit in the History tab — or by the
  // patient in their portal — refreshes this sidebar too.
  const { data, isLoading } = useQuery({
    queryKey: familyKey(patientId),
    queryFn: async () => {
      const res = await apiGet<any[]>(`/medical-history/${patientId}/family`);
      return res.data ?? [];
    },
    ...LIVE,
  });
  const entries = data ?? [];

  return (
    <SidebarCard
      title="Family History"
      icon={Users}
      accent="border-secondary"
      iconAccent="text-secondary"
      trailing={
        entries.length > 0 ? (
          <span className="rounded-full bg-secondary/10 text-secondary px-1.5 py-0.5 text-[9px] font-bold">
            {entries.length}
          </span>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No family history recorded.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e: any) => (
            <li key={e.id} className="rounded-md bg-background/60 px-2 py-1.5">
              <p className="text-[11px] font-semibold leading-tight truncate">{e.conditionName}</p>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {e.relationSide && (
                  <span className="font-label text-[9px] uppercase tracking-wider text-on-surface-variant rounded-full bg-secondary/10 text-secondary px-1.5 py-0.5">
                    {e.relationSide}
                  </span>
                )}
                {e.relationship && (
                  <span className="text-[10px] text-muted-foreground">{e.relationship}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}

// ── Sidebar: Allergies (read-only, compact) ───────────────────────────

function AllergiesSidebar({ patient }: { patient: Patient }) {
  const allergies = (patient.allergies ?? []) as any[];
  const hasAny = allergies.length > 0;

  return (
    <SidebarCard
      title="Allergies"
      icon={AlertTriangle}
      accent={hasAny ? 'border-error' : 'border-outline-variant'}
      iconAccent={hasAny ? 'text-error' : 'text-muted-foreground'}
      trailing={
        hasAny ? (
          <span className="rounded-full bg-error/10 text-error px-1.5 py-0.5 text-[9px] font-bold">
            {allergies.length}
          </span>
        ) : null
      }
    >
      {!hasAny ? (
        <p className="text-[11px] text-muted-foreground italic">No known allergies.</p>
      ) : (
        <ul className="space-y-1.5">
          {allergies.map((a: any, i: number) => (
            <li
              key={a.id ?? i}
              className="rounded-md border border-error/20 bg-error/5 px-2 py-1.5"
            >
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-error" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-error leading-tight">{a.allergen}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {a.allergyType && (
                      <span className="font-label text-[9px] uppercase tracking-wider rounded-full bg-error/10 text-error px-1.5 py-0.5">
                        {a.allergyType}
                      </span>
                    )}
                    {a.severity && (
                      <span className="text-[10px] text-error/80 capitalize">{a.severity}</span>
                    )}
                  </div>
                  {a.reaction && (
                    <p className="text-[10px] text-foreground/70 mt-0.5 leading-snug">
                      {a.reaction}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SidebarCard>
  );
}

// ── Edit-window banner with live countdown ────────────────────────────

function EditBanner({
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
  const [left, setLeft] = useState(() =>
    Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - completedAt)),
  );
  useEffect(() => {
    const interval = setInterval(() => setLeft((p) => Math.max(0, p - 1000)), 1000);
    return () => clearInterval(interval);
  }, []);
  const hours = Math.floor(left / (1000 * 60 * 60));
  const mins = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 px-4 py-3',
        isEditing ? 'border-secondary bg-secondary/5' : 'border-primary/40 bg-primary/5',
      )}
    >
      <Clock className="h-4 w-4 shrink-0" />
      <div className="flex-1 text-xs">
        <p className="font-semibold">
          {isEditing
            ? 'Editing saved consultation — append-only amendment trail active'
            : `Edit window open — ${hours}h ${mins}m remaining`}
        </p>
        <p className="text-muted-foreground">
          {isEditing
            ? 'Every changed field is logged. Cancel to discard unsaved edits.'
            : 'OP consultations can be amended for 24 hours after completion.'}
        </p>
      </div>
      {isEditing ? (
        <Button size="sm" variant="outline" onClick={onCancelEdit} className="h-7 text-xs">
          Cancel edit
        </Button>
      ) : (
        <Button size="sm" onClick={onStartEdit} className="h-7 text-xs">
          Edit consultation
        </Button>
      )}
    </div>
  );
}

// ── Clinical Record quick-card (4 tiles row) ──────────────────────────

function ClinicalCard({
  label,
  subtitle,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary text-left border-l-4 transition-transform hover:-translate-y-0.5 hover:shadow-md',
        accent,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg', accent.replace('border-', 'bg-').replace(/$/, '/10'))}>
          <Icon className={cn('h-4 w-4', accent.replace('border-', 'text-'))} />
        </div>
        <span className="text-[9px] font-label font-bold text-muted-foreground group-hover:text-primary">
          View →
        </span>
      </div>
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-0.5">
        {subtitle}
      </p>
      <h3 className="font-headline text-sm font-bold leading-tight">{label}</h3>
    </button>
  );
}


// ── Main page ─────────────────────────────────────────────────────────

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
  const [activeClinical, setActiveClinical] = useState<
    'medications' | 'history' | 'investigations' | 'drugs' | null
  >(null);
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [imagingDialogOpen, setImagingDialogOpen] = useState(false);
  const [admissionRequestOpen, setAdmissionRequestOpen] = useState(false);
  const [amendmentOpen, setAmendmentOpen] = useState(false);

  const openClinical = (key: 'medications' | 'history' | 'investigations' | 'drugs') => {
    setActiveClinical(key);
    setClinicalOpen(true);
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

  const queryClient = useQueryClient();
  const { data: activeVisitId } = useQuery({
    queryKey: ['doctor', 'active-visit', patientId],
    queryFn: async () => {
      const response = await apiGet<Array<{ id: string; status?: string }>>('/clinical/visits', {
        params: { patientId, status: 'active', limit: 1 },
      });
      return response.data?.[0]?.id ?? null;
    },
    enabled: !!patientId,
  });

  const isInConsultation = appointment?.status === 'in_consultation';
  const isCompleted = appointment?.status === 'completed';

  // Lab + imaging orders need a visit row. Visits historically only got
  // created when the doctor finished writing the SOAP note, which left the
  // "Order Lab" / "Order Imaging" buttons disabled for the entire
  // consultation. Eagerly ensure a visit exists as soon as the appointment
  // is in_consultation so the buttons work from the start.
  useEffect(() => {
    if (!appointmentId || !isInConsultation || activeVisitId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiPost<{ id: string }>(
          '/clinical/visits/ensure-for-appointment',
          { appointmentId },
        );
        if (!cancelled && res.data?.id) {
          queryClient.setQueryData(['doctor', 'active-visit', patientId], res.data.id);
        }
      } catch {
        /* surface via the existing toast on click; non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, isInConsultation, activeVisitId, patientId, queryClient]);

  const completedAt = appointment?.updatedAt ? new Date(appointment.updatedAt).getTime() : null;
  const withinEditWindow = !!completedAt && Date.now() - completedAt < 24 * 60 * 60 * 1000;
  const canEdit = isCompleted && withinEditWindow;
  const editWindowClosed = isCompleted && !withinEditWindow;

  const [editRequested, setEditRequested] = useState<boolean>(searchParams.get('edit') === '1');
  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.delete('edit');
      const qs = params.toString();
      router.replace(`/doctor/consultation/${patientId}${qs ? `?${qs}` : ''}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isEditing = canEdit && editRequested;

  const {
    data: prefillResponse,
    isLoading: prefillLoading,
    isFetching: prefillFetching,
    error: prefillError,
  } = useQuery({
    queryKey: ['doctor', 'consultation-form-data', appointmentId],
    queryFn: async () => {
      const res = await apiGet<{
        canEdit: boolean;
        reason?: string;
        prefill: any;
        appointmentStatus: string;
      }>(`/appointments/${appointmentId}/consultation-form-data`);
      return res.data;
    },
    enabled: !!appointmentId && isEditing,
    retry: 1,
  });
  const prefill = prefillResponse?.prefill;
  const prefillReason = prefillResponse?.reason;
  // Distinguish "fetch in flight" from "fetch finished but server has nothing"
  // — the old `!prefill` check conflated the two and hung the form forever.
  const prefillIsLoading = isEditing && (prefillLoading || (prefillFetching && !prefillResponse));
  const prefillUnavailable = isEditing && !prefillIsLoading && !prefill;

  // Progress note for the active visit — drives the amendment-history link,
  // session-checklist badges, and (after the appointment is completed) the
  // Consultation Summary panel + sign action. Falls back to the most recent
  // note for this patient when the active visit hasn't been resolved yet.
  const { data: recentNotes } = useProgressNotes(
    activeVisitId ? { visitId: activeVisitId, limit: 1 } : { patientId, limit: 1 },
  );
  const latestNote = recentNotes?.data?.[0] ?? null;

  const showForm = isInConsultation || isEditing;

  // Synchronously resolve a visit before opening the order dialog. The
  // useEffect above is usually fast enough, but the user may click the
  // button on the very first render — in that case we resolve here so the
  // dialog opens with a valid visitId.
  const ensureVisit = async (): Promise<string | null> => {
    if (activeVisitId) return activeVisitId;
    if (!appointmentId) {
      toast.error('No appointment context — open this from the OP queue');
      return null;
    }
    try {
      const res = await apiPost<{ id: string }>(
        '/clinical/visits/ensure-for-appointment',
        { appointmentId },
      );
      const id = res.data?.id ?? null;
      if (id) queryClient.setQueryData(['doctor', 'active-visit', patientId], id);
      return id;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start a visit for this appointment');
      return null;
    }
  };

  const guardedOrderLab = useMemo(
    () => async () => {
      const id = await ensureVisit();
      if (!id) return;
      setLabDialogOpen(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeVisitId, appointmentId],
  );
  const guardedOrderImaging = useMemo(
    () => async () => {
      const id = await ensureVisit();
      if (!id) return;
      setImagingDialogOpen(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeVisitId, appointmentId],
  );

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm text-muted-foreground">Patient not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const startEdit = () => setEditRequested(true);
  const cancelEdit = () => {
    if (prefill?.visitId) clearConsultationDraft(appointmentId || '', prefill.visitId);
    setEditRequested(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        patient={patient}
        onBack={() => router.back()}
        onOrderLab={guardedOrderLab}
        onOrderImaging={guardedOrderImaging}
        onRequestIp={() => setAdmissionRequestOpen(true)}
        canOrder={!!activeVisitId || !!appointmentId}
        isEditing={isEditing}
        onCancelEdit={isEditing ? cancelEdit : undefined}
      />

      <div className="px-4 py-4 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* ── Main column (80%) ─────────────────────────────────── */}
          <div className="space-y-4 min-w-0 lg:col-span-4">
            {/* Allergies + family disorders — on screen from the moment the
                consultation opens, not buried in a history sub-tab. */}
            <PatientSafetyBanner patientId={patient.id} />

            {/* Banners */}
            {canEdit && completedAt !== null && (
              <EditBanner
                isEditing={isEditing}
                completedAt={completedAt}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
              />
            )}
            {editWindowClosed && (
              <div className="flex items-center gap-3 rounded-xl border-2 border-muted bg-muted/30 px-4 py-3">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Edit window closed.</span> OP
                  notes can be amended for 24 hours after completion — older notes are now part of
                  the MRD.
                </p>
              </div>
            )}

            {/* Clinical Record quick cards */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <h2 className="font-headline text-sm font-bold">Clinical Record</h2>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Click any card for details
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <ClinicalCard
                  label="Current Medications"
                  subtitle="Active prescriptions"
                  icon={Pill}
                  accent="border-primary"
                  onClick={() => openClinical('medications')}
                />
                <ClinicalCard
                  label="Medical History"
                  subtitle="Conditions & surgeries"
                  icon={Heart}
                  accent="border-secondary"
                  onClick={() => openClinical('history')}
                />
                <ClinicalCard
                  label="Investigations"
                  subtitle="Past labs & imaging"
                  icon={FlaskConical}
                  accent="border-primary-container"
                  onClick={() => openClinical('investigations')}
                />
                <ClinicalCard
                  label="Drug History"
                  subtitle="Past meds & adherence"
                  icon={Pill}
                  accent="border-tertiary"
                  onClick={() => openClinical('drugs')}
                />
              </div>
            </section>

            {/* Nursing Forms — read-only summary captured by the nursing team */}
            <NursingFormsPanel patientId={patient.id} />

            {/* Active consultation form */}
            {showForm ? (
              <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-primary">
                <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-headline text-base font-bold">
                      {isEditing ? 'Editing Consultation' : 'Active Consultation'}
                    </h2>
                    <p className="font-label text-[11px] text-on-surface-variant">
                      {isEditing
                        ? 'Amend existing records · edits are logged'
                        : 'Record SOAP progress note · sign & save when done'}
                    </p>
                  </div>
                  {isEditing && latestNote?._count?.amendments ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      onClick={() => setAmendmentOpen(true)}
                    >
                      <History className="h-2.5 w-2.5" />
                      {latestNote._count.amendments} amendment
                      {latestNote._count.amendments === 1 ? '' : 's'}
                    </button>
                  ) : null}
                </div>

                {prefillIsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Loading saved consultation…
                    </span>
                  </div>
                ) : prefillUnavailable ? (
                  <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                    <p className="font-semibold text-amber-900">
                      Couldn't load this consultation for editing.
                    </p>
                    <p className="text-amber-800 mt-1 text-xs">
                      {prefillError
                        ? (prefillError as any)?.response?.data?.message ||
                          (prefillError as Error).message ||
                          'The server returned an error.'
                        : prefillReason ||
                          'There is no saved progress note linked to this appointment yet — there is nothing to edit.'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        Exit edit mode
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => router.back()}>
                        Back to queue
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-4">
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
                  </div>
                )}
              </section>
            ) : null}

            {/* Consultation Summary — shows for completed appointments and
                lets the doctor sign the note (which finalizes it and opens
                it up to the patient via the portal). */}
            {isCompleted && !isEditing && latestNote ? (
              <ConsultationSummaryPanel note={latestNote} canSign />
            ) : null}

            <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="h-4 w-4 text-secondary" />
                <h2 className="font-headline text-sm font-bold">Orders</h2>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Labs & imaging · live status
                </span>
              </div>
              <OrdersPanel patientId={patient.id} visitId={activeVisitId || undefined} />
            </section>
          </div>

          {/* ── Right aside (20%) ─────────────────────────────────── */}
          <aside className="lg:col-span-1 lg:sticky lg:top-14 lg:self-start lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto print:hidden">
            <div className="space-y-3">
              <VitalsSidebar
                patientId={patient.id}
                appointmentId={appointmentId}
                visitId={activeVisitId}
              />
              <FamilyHistorySidebar patientId={patient.id} />
              <AllergiesSidebar patient={patient} />
            </div>
          </aside>
        </div>
      </div>

      {/* Clinical Record popup */}
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
              medications: {
                title: 'Current Medications',
                subtitle: 'Active prescriptions',
                icon: Pill,
                panel: <CurrentMedicationsPanel patientId={patient.id} />,
              },
              history: {
                title: 'Medical History',
                subtitle: 'Conditions, surgeries & family hx',
                icon: Heart,
                panel: <MedicalHistoryPanel patientId={patient.id} />,
              },
              investigations: {
                title: 'Investigation History',
                subtitle: 'Lab results & imaging reports',
                icon: FlaskConical,
                panel: <InvestigationHistoryPanel patientId={patient.id} />,
              },
              drugs: {
                title: 'Drug History',
                subtitle: 'Past medications & adherence',
                icon: Pill,
                panel: <DrugHistoryPanel patientId={patient.id} />,
              },
            } as const;
            const entry = activeClinical ? map[activeClinical] : null;
            if (!entry) return null;
            const Icon = entry.icon;
            return (
              <>
                <div className="px-6 py-5 bg-surface-container-lowest border-b border-outline-variant/30 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="font-headline text-lg font-bold">
                        {entry.title}
                      </DialogTitle>
                      <DialogDescription className="font-label text-[11px] text-on-surface-variant mt-0.5">
                        {entry.subtitle}
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-background p-6">{entry.panel}</div>
              </>
            );
          })()}
          <div className="border-t border-outline-variant/30 bg-surface-container-low px-6 py-3 flex items-center justify-between shrink-0">
            <p className="font-label text-[11px] text-on-surface-variant">
              Data is read-only here. Record new findings in the consultation form.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setClinicalOpen(false)}
              className="h-8 rounded-lg text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LabOrderDialog
        open={labDialogOpen}
        onOpenChange={setLabDialogOpen}
        patientId={patient.id}
        visitId={activeVisitId || ''}
      />
      <ImagingRequestDialog
        open={imagingDialogOpen}
        onOpenChange={setImagingDialogOpen}
        patientId={patient.id}
        visitId={activeVisitId || ''}
      />
      <AmendmentHistoryDialog
        open={amendmentOpen}
        onOpenChange={setAmendmentOpen}
        noteId={latestNote?.id ?? null}
      />
      <AdmissionRequestDialog
        open={admissionRequestOpen}
        onOpenChange={setAdmissionRequestOpen}
        patientId={patient.id}
        patientName={`${patient.firstName} ${patient.lastName}`}
        visitId={activeVisitId || undefined}
      />

    </div>
  );
}
