'use client';

// ───────────────────────────────────────────────────────────────────────
// Consultation workspace
//
// Layout:
//   [ Sticky top bar: patient strip + primary actions                   ]
//   [ Banner: edit window / pre-consult / locked                        ]
//   [ Allergy flash (only when present)                                 ]
//   [ Latest Vitals — compact strip                                     ]
//   [ Clinical Record quick-cards (4 tiles)                             ]
//   [ ┌─ main column (8) ──────────┐ ┌─ sidebar (4) ─┐                 ]
//   [ │ PrescriptionPad / SOAP     │ │ Session       │                 ]
//   [ │ Orders (live status)       │ │ checklist     │                 ]
//   [ │ Visit timeline (compact)   │ │ Amendment hx  │                 ]
//   [ └────────────────────────────┘ └──────────────┘                 ]
// ───────────────────────────────────────────────────────────────────────

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Clock,
  FlaskConical,
  Heart,
  History,
  Loader2,
  Pill,
  Printer,
  Stethoscope,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { PrescriptionPad, clearConsultationDraft } from '@/components/doctor/prescription-pad';
import { DrugHistoryPanel } from '@/components/doctor/drug-history-panel';
import { CurrentMedicationsPanel } from '@/components/doctor/current-medications-panel';
import { MedicalHistoryPanel } from '@/components/doctor/medical-history-panel';
import { InvestigationHistoryPanel } from '@/components/doctor/investigation-history-panel';
import { LabOrderDialog } from '@/components/doctor/lab-order-dialog';
import { ImagingRequestDialog } from '@/components/doctor/imaging-request-dialog';
import { OrdersPanel } from '@/components/doctor/orders-panel';
import { AmendmentHistoryDialog } from '@/components/doctor/progress-notes-amendment-history';
import { cn } from '@/lib/utils';
import { usePatientDetail, useProgressNotes } from '@/hooks/use-doctor';
import { useLatestVitals as useLatestVitalsNurse } from '@/hooks/use-nurse';
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
  canOrder,
  isEditing,
  onCancelEdit,
}: {
  patient: Patient;
  onBack: () => void;
  onOrderLab: () => void;
  onOrderImaging: () => void;
  canOrder: boolean;
  isEditing: boolean;
  onCancelEdit?: () => void;
}) {
  const initials =
    `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() || 'P';
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
          <p className="text-sm font-bold truncate">
            {patient.firstName} {patient.lastName}
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
      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" />
        Print
      </Button>
    </div>
  );
}

// ── Latest Vitals strip ───────────────────────────────────────────────

function VitalsStrip({ patientId }: { patientId: string }) {
  const { data: latestResp, isLoading } = useLatestVitalsNurse(patientId);
  const v = (latestResp as any)?.data ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!v) {
    return (
      <p className="text-xs text-muted-foreground">
        No vitals recorded yet. Vitals are recorded by the nursing team — ask the assigned nurse to capture them.
      </p>
    );
  }

  const tiles = [
    {
      label: 'BP',
      value:
        v.bloodPressureSystolic && v.bloodPressureDiastolic
          ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
          : null,
      unit: 'mmHg',
      accent: 'text-error',
    },
    {
      label: 'Pulse',
      value: v.pulseRate ?? v.heartRate ?? null,
      unit: 'bpm',
      accent: 'text-tertiary',
    },
    {
      label: 'Temp',
      value: v.temperature ?? null,
      unit: '°C',
      accent: 'text-secondary',
    },
    {
      label: 'SpO₂',
      value: v.oxygenSaturation ?? null,
      unit: '%',
      accent: 'text-primary-container',
    },
    {
      label: 'RR',
      value: v.respiratoryRate ?? null,
      unit: '/min',
      accent: 'text-primary-container',
    },
    {
      label: 'Weight',
      value: v.weightKg ?? v.weight ?? null,
      unit: 'kg',
      accent: 'text-secondary',
    },
    {
      label: 'BGL',
      value: v.bloodSugar ?? null,
      unit: 'mg/dL',
      accent: 'text-error',
    },
  ].filter((t) => t.value !== null && t.value !== undefined && t.value !== '');

  if (tiles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No numeric vitals on record.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {tiles.map((t, i) => (
        <div
          key={i}
          className="flex items-baseline gap-1 rounded-lg bg-background/60 px-3 py-1.5"
        >
          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            {t.label}
          </span>
          <span className={cn('text-sm font-bold', t.accent)}>{String(t.value)}</span>
          <span className="text-[10px] text-muted-foreground">{t.unit}</span>
        </div>
      ))}
      {v.recordedAt && (
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatDateTimeAmPm(v.recordedAt)}
        </span>
      )}
    </div>
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

  const { data: prefillResponse } = useQuery({
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
  });
  const prefill = prefillResponse?.prefill;

  // Latest progress note for this patient — used for amendment history link
  // + session checklist badges when viewing a saved consultation.
  const { data: recentNotes } = useProgressNotes({ patientId, limit: 1 });
  const latestNote = recentNotes?.data?.[0] ?? null;

  const showForm = isInConsultation || isEditing;

  const guardedOrderLab = useMemo(
    () => () => {
      if (!activeVisitId) {
        toast.error('No active visit — start or check-in an appointment first');
        return;
      }
      setLabDialogOpen(true);
    },
    [activeVisitId],
  );
  const guardedOrderImaging = useMemo(
    () => () => {
      if (!activeVisitId) {
        toast.error('No active visit — start or check-in an appointment first');
        return;
      }
      setImagingDialogOpen(true);
    },
    [activeVisitId],
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
        canOrder={!!activeVisitId}
        isEditing={isEditing}
        onCancelEdit={isEditing ? cancelEdit : undefined}
      />

      <div className="px-4 py-4 lg:px-6 space-y-4">
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
              <span className="font-semibold text-foreground">Edit window closed.</span> OP notes
              can be amended for 24 hours after completion — older notes are now part of the MRD.
            </p>
          </div>
        )}

        {/* Allergies — inline flash */}
        {patient.allergies && patient.allergies.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border-l-4 border-error bg-error/5 px-4 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] font-semibold text-error mr-1">Allergies:</span>
              {patient.allergies.map((a: any, i: number) => (
                <span
                  key={a.id ?? i}
                  className="font-label text-[10px] font-bold text-error bg-background rounded-full px-2 py-0.5 border border-error/20"
                >
                  {a.allergen}
                  {a.severity && <span className="ml-1 opacity-70">· {a.severity}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Latest Vitals strip */}
        <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-primary p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-headline text-sm font-bold">Latest Vitals</h2>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Most recent snapshot
            </Badge>
          </div>
          <VitalsStrip patientId={patient.id} />
        </section>

        {/* Clinical Record quick cards */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h2 className="font-headline text-sm font-bold">Clinical Record</h2>
            </div>
            <span className="text-[10px] text-muted-foreground">Click any card for details</span>
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

        {/* Main column — full width; sidebar removed per user feedback */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-4 min-w-0">
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

                {isEditing && !prefill ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Loading saved consultation…
                    </span>
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

    </div>
  );
}
