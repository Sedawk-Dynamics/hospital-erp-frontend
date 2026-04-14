'use client';

import { useState } from 'react';
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
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import type { FormSubmission } from '@/types/forms';
import { ClipboardList, ChevronDown, ChevronRight, History, Stethoscope, HeartPulse } from 'lucide-react';
import { DrugHistoryPanel } from './drug-history-panel';
import { MedicalHistoryPanel } from './medical-history-panel';
import { InvestigationHistoryPanel } from './investigation-history-panel';
import { CurrentMedicationsPanel } from './current-medications-panel';

import type { Patient } from '@/types';
import type {
  Vital,
  Prescription,
  LabOrder,
  ProgressNote,
} from '@/hooks/use-doctor';

// ============================================================
// Props
// ============================================================

interface PatientConsultationViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  appointmentId?: string | null;
}

// ============================================================
// Helpers
// ============================================================

function calculateAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    return `${years - 1} yrs`;
  }
  return `${years} yrs`;
}

function getDoctorName(doctor?: { id: string; user?: { firstName: string; lastName: string } }): string {
  if (!doctor?.user) return '—';
  return `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`;
}

// ============================================================
// Sub-components
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}

// --- Patient Demographics ---

function PatientDemographics({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-1">
      <h2 className="font-headline text-lg font-semibold text-foreground">
        {patient.firstName} {patient.lastName}
      </h2>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
        <span className="font-label font-medium">MRN: {patient.mrn}</span>
        <Separator orientation="vertical" className="h-3.5" />
        <span>{calculateAge(patient.dateOfBirth)}</span>
        <Separator orientation="vertical" className="h-3.5" />
        <span className="capitalize">{patient.gender}</span>
        {patient.phone && (
          <>
            <Separator orientation="vertical" className="h-3.5" />
            <span>{patient.phone}</span>
          </>
        )}
        {patient.bloodGroup && (
          <>
            <Separator orientation="vertical" className="h-3.5" />
            <Badge variant="outline" className="text-xs">
              {patient.bloodGroup}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}

// --- Allergy Banner ---

function AllergyBanner({ allergies }: { allergies: Patient['allergies'] }) {
  if (!allergies || allergies.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
      <div className="flex flex-wrap gap-2">
        {allergies.map((allergy) => (
          <Badge
            key={allergy.id}
            variant="destructive"
            className="text-xs font-medium"
          >
            {allergy.allergen}
            {allergy.severity && (
              <span className="ml-1 opacity-75">({allergy.severity})</span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// --- Latest Vitals ---

function LatestVitals({ patientId }: { patientId: string }) {
  const { data: vitals, isLoading } = usePatientVitals(patientId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Loading vitals...
      </div>
    );
  }

  const latest: Vital | undefined = Array.isArray(vitals) ? vitals[0] : undefined;

  if (!latest) {
    return (
      <p className="text-xs text-muted-foreground">No vitals recorded</p>
    );
  }

  const vitalCards = [
    {
      icon: Activity,
      label: 'BP',
      value:
        latest.bloodPressureSystolic && latest.bloodPressureDiastolic
          ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`
          : null,
      unit: 'mmHg',
    },
    {
      icon: Heart,
      label: 'HR',
      value: latest.pulseRate ?? latest.heartRate,
      unit: 'bpm',
    },
    {
      icon: Thermometer,
      label: 'Temp',
      value: latest.temperature,
      unit: '°F',
    },
    {
      icon: Droplets,
      label: 'SpO2',
      value: latest.oxygenSaturation,
      unit: '%',
    },
    {
      icon: Weight,
      label: 'Weight',
      value: latest.weightKg ?? latest.weight,
      unit: 'kg',
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {vitalCards.map((card) => {
        if (card.value == null) return null;
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-1.5 rounded-md border bg-surface-container-lowest px-2.5 py-1.5"
          >
            <Icon className="size-3.5 text-primary" />
            <div className="text-xs">
              <span className="font-medium text-foreground">
                {card.value}
              </span>{' '}
              <span className="text-muted-foreground">{card.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Tab Content Components
// ============================================================

function VisitHistoryTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useProgressNotes({ patientId });

  if (isLoading) return <LoadingSpinner />;

  const notes: ProgressNote[] = data?.data ?? [];

  if (notes.length === 0) {
    return <EmptyState message="No visit history found" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-on-surface-variant">
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3">Doctor</th>
            <th className="pb-2 pr-3">Chief Complaint</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {notes.map((note) => (
            <tr key={note.id} className="text-foreground">
              <td className="py-2 pr-3 whitespace-nowrap">
                {formatDate(note.createdAt)}
              </td>
              <td className="py-2 pr-3">{getDoctorName(note.doctor)}</td>
              <td className="py-2 pr-3 max-w-[200px] truncate">
                {note.subjective || note.content || '—'}
              </td>
              <td className="py-2">
                <Badge variant={note.status === 'finalized' ? 'default' : 'secondary'} className="text-xs">
                  {note.status === 'finalized' ? 'Signed' : 'Draft'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrescriptionsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePrescriptions({ patientId });

  if (isLoading) return <LoadingSpinner />;

  const prescriptions: Prescription[] = data?.data ?? [];

  if (prescriptions.length === 0) {
    return <EmptyState message="No prescriptions found" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-on-surface-variant">
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3">Drug</th>
            <th className="pb-2 pr-3">Dosage</th>
            <th className="pb-2 pr-3">Frequency</th>
            <th className="pb-2 pr-3">Duration</th>
            <th className="pb-2 pr-3">Prescriber</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {prescriptions.flatMap((rx) =>
            rx.items.map((item, idx) => (
              <tr key={`${rx.id}-${idx}`} className="text-foreground">
                <td className="py-2 pr-3 whitespace-nowrap">
                  {idx === 0 ? formatDate(rx.createdAt) : ''}
                </td>
                <td className="py-2 pr-3 font-medium">{item.drugName}</td>
                <td className="py-2 pr-3">{item.dosage}</td>
                <td className="py-2 pr-3">{item.frequency}</td>
                <td className="py-2 pr-3">{item.duration}</td>
                <td className="py-2 pr-3">
                  {idx === 0 ? getDoctorName(rx.doctor) : ''}
                </td>
                <td className="py-2">
                  {idx === 0 && (
                    <Badge
                      variant={rx.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs capitalize"
                    >
                      {rx.status}
                    </Badge>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LabResultsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useLabOrders({ patientId });

  if (isLoading) return <LoadingSpinner />;

  const orders: LabOrder[] = data?.data ?? [];

  if (orders.length === 0) {
    return <EmptyState message="No lab orders found" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-on-surface-variant">
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3">Test</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2">Priority</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((order) => (
            <tr key={order.id} className="text-foreground">
              <td className="py-2 pr-3 whitespace-nowrap">
                {formatDate(order.createdAt)}
              </td>
              <td className="py-2 pr-3">
                {order.tests?.map((t) => t.name).join(', ') || order.orderNumber || '—'}
              </td>
              <td className="py-2 pr-3">
                <Badge
                  variant={
                    order.status === 'completed'
                      ? 'default'
                      : order.status === 'cancelled'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="text-xs capitalize"
                >
                  {order.status}
                </Badge>
              </td>
              <td className="py-2">
                {order.priority && (
                  <Badge
                    variant={order.priority === 'urgent' || order.priority === 'stat' ? 'destructive' : 'outline'}
                    className="text-xs capitalize"
                  >
                    {order.priority}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ImagingRequest {
  id: string;
  type?: string;
  modality?: string;
  bodyPart?: string;
  status: string;
  findings?: string;
  createdAt: string;
}

function ImagingTab({ patientId }: { patientId: string }) {
  const { data: imagingData, isLoading } = useQuery({
    queryKey: ['doctor', 'imaging', patientId],
    queryFn: async () => {
      const response = await apiGet<ImagingRequest[]>('/imaging/requests', {
        params: { patientId },
      });
      return response.data ?? [];
    },
    enabled: !!patientId,
  });

  if (isLoading) return <LoadingSpinner />;

  const requests: ImagingRequest[] = Array.isArray(imagingData)
    ? imagingData
    : [];

  if (requests.length === 0) {
    return <EmptyState message="No imaging requests found" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-on-surface-variant">
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3">Type</th>
            <th className="pb-2 pr-3">Body Part</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2">Findings</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {requests.map((req) => (
            <tr key={req.id} className="text-foreground">
              <td className="py-2 pr-3 whitespace-nowrap">
                {formatDate(req.createdAt)}
              </td>
              <td className="py-2 pr-3">{req.type || req.modality || '—'}</td>
              <td className="py-2 pr-3">{req.bodyPart || '—'}</td>
              <td className="py-2 pr-3">
                <Badge
                  variant={
                    req.status === 'completed'
                      ? 'default'
                      : req.status === 'cancelled'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="text-xs capitalize"
                >
                  {req.status}
                </Badge>
              </td>
              <td className="py-2 max-w-[180px] truncate">
                {req.findings || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab({ patient }: { patient: Patient }) {
  const documents = patient.documents;

  if (!documents || documents.length === 0) {
    return <EmptyState message="No documents uploaded" />;
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-md border bg-surface-container-lowest px-3 py-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {doc.title || doc.fileName}
              </p>
              <p className="text-xs text-muted-foreground">
                {doc.type} &middot; {formatDate(doc.createdAt)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            render={<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" />}
          >
            Download
          </Button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Latest Form Submissions (inline with patient details)
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
// Main Component
// ============================================================

export function PatientConsultationView({
  open,
  onOpenChange,
  patientId,
  appointmentId,
}: PatientConsultationViewProps) {
  const { data: patient, isLoading: patientLoading } = usePatientDetail(
    patientId ?? ''
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle>Patient Details</SheetTitle>
        </SheetHeader>

        {patientLoading || !patientId ? (
          <LoadingSpinner />
        ) : !patient ? (
          <EmptyState message="Patient not found" />
        ) : (
          <div className="flex flex-col gap-4 px-5 pb-5">
            {/* Pending pre-consultation forms gate — auto-prompts the doctor
                to fill any forms the hospital admin has assigned to the
                pre_consultation trigger for this patient. Sticky across refreshes. */}
            <TriggerFormsGate
              trigger="pre_consultation"
              context={{ patientId: patient.id, appointmentId }}
              bannerHeading="Pre-consultation forms required"
            />

            {/* ----- Profile Header ----- */}
            <div className="space-y-3 pt-2">
              <PatientDemographics patient={patient} />
              <AllergyBanner allergies={patient.allergies} />
            </div>

            <Separator />

            {/* Latest Vitals */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-on-surface-variant">
                Latest Vitals
              </h3>
              <LatestVitals patientId={patient.id} />
            </div>

            {/* Active medications moved to the "Current Meds" tab below to avoid duplication. */}

            {/* Latest Form Submissions — inline with patient details */}
            <LatestFormSubmissions patientId={patient.id} appointmentId={appointmentId} />

            <Separator />

            {/* ----- Tabbed History Panel ----- */}
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
                <TabsTrigger value="drug-history" className="gap-1">
                  <History className="size-3.5" />
                  Drug History
                </TabsTrigger>
                <TabsTrigger value="current-meds" className="gap-1">
                  <Stethoscope className="size-3.5" />
                  Current Meds
                </TabsTrigger>
                <TabsTrigger value="investigations" className="gap-1">
                  <FlaskConical className="size-3.5" />
                  Investigations
                </TabsTrigger>
                <TabsTrigger value="medical-history" className="gap-1">
                  <HeartPulse className="size-3.5" />
                  Medical History
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
                <ImagingTab patientId={patient.id} />
              </TabsContent>

              <TabsContent value="documents" className="pt-3">
                <DocumentsTab patient={patient} />
              </TabsContent>

              <TabsContent value="drug-history" className="pt-3">
                <DrugHistoryPanel patientId={patient.id} />
              </TabsContent>

              <TabsContent value="current-meds" className="pt-3">
                <CurrentMedicationsPanel patientId={patient.id} />
              </TabsContent>

              <TabsContent value="investigations" className="pt-3">
                <InvestigationHistoryPanel patientId={patient.id} />
              </TabsContent>

              <TabsContent value="medical-history" className="pt-3">
                <MedicalHistoryPanel patientId={patient.id} />
              </TabsContent>

              <TabsContent value="forms" className="pt-3">
                <PatientFormSubmissionsPanel
                  patientId={patient.id}
                  title="All Patient Forms (All Visits)"
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default PatientConsultationView;
