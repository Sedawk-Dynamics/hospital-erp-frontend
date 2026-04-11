'use client';

import { use, useState } from 'react';
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
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

import {
  usePatientDetail,
  usePatientVitals,
  usePrescriptions,
  useLabOrders,
  useProgressNotes,
} from '@/hooks/use-doctor';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';
import { TriggerFormsGate } from '@/components/forms/trigger-forms-gate';
import { useFormSubmissions, useSystemForm } from '@/hooks/use-forms';
import { FormRenderer } from '@/components/forms/form-renderer';
import { TRIGGER_LABELS } from '@/types/forms';

import type { Patient } from '@/types';
import type { FormSubmission } from '@/types/forms';
import type {
  Vital,
  Prescription,
  LabOrder,
  ProgressNote,
} from '@/hooks/use-doctor';

// ============================================================
// Patient Demographics
// ============================================================

function PatientDemographics({ patient }: { patient: Patient }) {
  const age = patient.dateOfBirth
    ? Math.floor(
        (Date.now() - new Date(patient.dateOfBirth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <div className="flex items-start gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary font-headline text-lg font-bold shrink-0">
        {patient.firstName?.[0]}
        {patient.lastName?.[0]}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <h2 className="font-headline text-lg font-bold leading-tight">
          {patient.firstName} {patient.lastName}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{patient.mrn}</span>
          {patient.gender && <span className="capitalize">{patient.gender}</span>}
          {age !== null && <span>{age} yrs</span>}
          {patient.bloodGroup && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {patient.bloodGroup}
            </Badge>
          )}
          {patient.phone && <span>{patient.phone}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Allergy Banner
// ============================================================

function AllergyBanner({ allergies }: { allergies?: Array<{ allergen: string; severity: string }> }) {
  if (!allergies || allergies.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-destructive">Known Allergies</p>
        <p className="text-[11px] text-destructive/80 mt-0.5">
          {allergies.map((a) => `${a.allergen} (${a.severity})`).join(' · ')}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Vital card
// ============================================================

function VitalCard({
  icon: Icon,
  label,
  value,
  unit,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  alert?: boolean;
}) {
  if (value === null || value === undefined) return null;
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${alert ? 'border-destructive/40 bg-destructive/5' : ''}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${alert ? 'text-destructive' : 'text-primary'}`} />
      <div>
        <p className="text-[10px] text-muted-foreground font-label uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-bold font-headline leading-tight">
          {value}
          {unit && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

function LatestVitals({ patientId }: { patientId: string }) {
  const { data: vitals } = usePatientVitals(patientId);
  const latest = vitals?.[0] as Vital | undefined;
  if (!latest) {
    return <p className="text-xs text-muted-foreground italic">No vitals recorded</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      <VitalCard icon={Thermometer} label="Temp" value={latest.temperature} unit="°F" alert={latest.temperature ? Number(latest.temperature) > 100.4 : false} />
      <VitalCard icon={Heart} label="Pulse" value={latest.pulseRate ?? latest.heartRate} unit="bpm" alert={latest.pulseRate ? latest.pulseRate > 100 || latest.pulseRate < 60 : false} />
      <VitalCard icon={Activity} label="BP" value={latest.bloodPressureSystolic && latest.bloodPressureDiastolic ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}` : null} unit="mmHg" />
      <VitalCard icon={Droplets} label="SpO₂" value={latest.oxygenSaturation} unit="%" alert={latest.oxygenSaturation ? latest.oxygenSaturation < 95 : false} />
      <VitalCard icon={Weight} label="Weight" value={latest.weightKg} unit="kg" />
    </div>
  );
}

// ============================================================
// Active Medications
// ============================================================

function ActiveMedications({ patientId }: { patientId: string }) {
  const { data } = usePrescriptions({ patientId });
  const prescriptions = data?.data ?? [];
  const active = prescriptions.filter((p: Prescription) => p.status === 'active');
  if (active.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No active medications</p>;
  }
  const allItems = active.flatMap((p: Prescription) => p.items ?? []);
  return (
    <div className="flex flex-wrap gap-1.5">
      {allItems.slice(0, 8).map((item, i) => (
        <Badge key={i} variant="secondary" className="text-[10px] gap-1 py-0.5">
          <Pill className="h-3 w-3" />
          {item.drugName} {item.dosage}
        </Badge>
      ))}
      {allItems.length > 8 && (
        <Badge variant="outline" className="text-[10px]">+{allItems.length - 8} more</Badge>
      )}
    </div>
  );
}

// ============================================================
// Latest Form Submissions (inline)
// ============================================================

function LatestFormSubmissions({ patientId, appointmentId }: { patientId: string; appointmentId?: string | null }) {
  const { data, isLoading } = useFormSubmissions({
    patientId,
    appointmentId: appointmentId ?? undefined,
    limit: 5,
  });
  const submissions = data?.data ?? [];

  if (isLoading || submissions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-on-surface-variant">
        Submitted Forms
      </h3>
      <div className="space-y-1">
        {submissions.map((sub) => (
          <InlineSubmission key={sub.id} submission={sub} />
        ))}
      </div>
    </div>
  );
}

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
        <span className="text-sm font-medium flex-1 truncate">{formName}</span>
        {triggerLabel && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
            {triggerLabel}
          </Badge>
        )}
        <Badge
          className={`text-[9px] px-1.5 py-0 shrink-0 ${
            submission.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
            submission.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
            submission.status === 'rejected' ? 'bg-red-100 text-red-700' :
            'bg-muted text-muted-foreground'
          }`}
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
// Tabs
// ============================================================

function VisitHistoryTab({ patientId }: { patientId: string }) {
  const { data } = useProgressNotes({ patientId });
  const notes = data?.data ?? [];
  if (notes.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-4">No visit history</p>;
  }
  return (
    <div className="space-y-2">
      {notes.slice(0, 10).map((note: ProgressNote) => (
        <div key={note.id} className="rounded-lg border px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">{note.noteType?.replace(/_/g, ' ')}</p>
            <span className="text-[10px] text-muted-foreground">{formatDate(note.createdAt)}</span>
          </div>
          {note.subjective && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.subjective}</p>}
        </div>
      ))}
    </div>
  );
}

function PrescriptionsTab({ patientId }: { patientId: string }) {
  const { data } = usePrescriptions({ patientId });
  const prescriptions = data?.data ?? [];
  if (prescriptions.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-4">No prescriptions</p>;
  }
  return (
    <div className="space-y-2">
      {prescriptions.slice(0, 10).map((rx: Prescription) => (
        <div key={rx.id} className="rounded-lg border px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">{rx.items?.map(i => `${i.drugName} ${i.dosage}`).join(', ') || 'Prescription'}</p>
            <Badge variant={rx.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
              {rx.status}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(rx.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

function LabResultsTab({ patientId }: { patientId: string }) {
  const { data } = useLabOrders({ patientId });
  const labOrders = data?.data ?? [];
  if (labOrders.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-4">No lab orders</p>;
  }
  return (
    <div className="space-y-2">
      {labOrders.slice(0, 10).map((order: LabOrder) => (
        <div key={order.id} className="rounded-lg border px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">{order.tests?.map(t => t.name).join(', ') || order.orderNumber || 'Lab Order'}</p>
            <Badge variant="outline" className="text-[10px]">{order.status}</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(order.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

function ImagingTab() {
  return <p className="text-xs text-muted-foreground italic py-4">No imaging records</p>;
}

function DocumentsTab() {
  return <p className="text-xs text-muted-foreground italic py-4">No documents</p>;
}

// ============================================================
// Loading & Empty
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-headline text-xl font-bold">Patient Consultation</h1>
      </div>

      {/* Pending pre-consultation forms gate */}
      <TriggerFormsGate
        trigger="pre_consultation"
        context={{ patientId: patient.id, appointmentId }}
        bannerHeading="Pre-consultation forms required"
      />

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — patient info + forms */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <PatientDemographics patient={patient} />
            <AllergyBanner allergies={patient.allergies} />
          </div>

          {/* Latest Vitals */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-on-surface-variant">
              Latest Vitals
            </h3>
            <LatestVitals patientId={patient.id} />
          </div>

          {/* Active Medications */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-on-surface-variant">
              Active Medications
            </h3>
            <ActiveMedications patientId={patient.id} />
          </div>

          {/* Submitted Forms for this appointment */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <LatestFormSubmissions patientId={patient.id} appointmentId={appointmentId} />
          </div>
        </div>

        {/* Right column — tabbed history */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card p-4">
            <Tabs defaultValue="visits" className="w-full">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="visits" className="gap-1">
                  <FileText className="size-3.5" />
                  Visit History
                </TabsTrigger>
                <TabsTrigger value="prescriptions" className="gap-1">
                  <Pill className="size-3.5" />
                  Prescriptions
                </TabsTrigger>
                <TabsTrigger value="lab" className="gap-1">
                  <FlaskConical className="size-3.5" />
                  Lab Results
                </TabsTrigger>
                <TabsTrigger value="imaging" className="gap-1">
                  <ImageIcon className="size-3.5" />
                  Imaging
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1">
                  <FolderOpen className="size-3.5" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="forms" className="gap-1">
                  <ClipboardList className="size-3.5" />
                  All Forms
                </TabsTrigger>
              </TabsList>

              <TabsContent value="visits" className="pt-3">
                <VisitHistoryTab patientId={patient.id} />
              </TabsContent>

              <TabsContent value="prescriptions" className="pt-3">
                <PrescriptionsTab patientId={patient.id} />
              </TabsContent>

              <TabsContent value="lab" className="pt-3">
                <LabResultsTab patientId={patient.id} />
              </TabsContent>

              <TabsContent value="imaging" className="pt-3">
                <ImagingTab />
              </TabsContent>

              <TabsContent value="documents" className="pt-3">
                <DocumentsTab />
              </TabsContent>

              <TabsContent value="forms" className="pt-3">
                <PatientFormSubmissionsPanel
                  patientId={patient.id}
                  title="All Patient Forms (All Visits)"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
