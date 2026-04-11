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
  Plus,
  Stethoscope,
  Printer,
  UserRound,
  Phone,
  Calendar,
  Clock,
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
import { formatDate, formatTime, formatDateTimeAmPm } from '@/lib/date-utils';
import { PatientFormSubmissionsPanel } from '@/components/forms/patient-form-submissions-panel';
import { TriggerFormsGate } from '@/components/forms/trigger-forms-gate';
import { ConsultationCompletionInline } from '@/components/doctor/consultation-completion';
import { useFormSubmissions, useSystemForm } from '@/hooks/use-forms';
import { FormRenderer } from '@/components/forms/form-renderer';
import { TRIGGER_LABELS } from '@/types/forms';

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

// ============================================================
// Patient Header Banner
// ============================================================

function PatientBanner({
  patient,
  appointment,
}: {
  patient: Patient;
  appointment?: Appointment | null;
}) {
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
  const status = appointment?.status ? STATUS_STYLES[appointment.status] : null;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Avatar */}
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-headline text-sm font-bold shrink-0">
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
          <Separator orientation="vertical" className="h-3" />
          {patient.gender && <span className="capitalize">{patient.gender}</span>}
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
              <span className="text-foreground">
                Reason: {appointment.reason}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Print */}
      <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
        <Printer className="h-3.5 w-3.5" />
        Print
      </Button>
    </div>
  );
}

// ============================================================
// Allergy Banner
// ============================================================

function AllergyBanner({ allergies }: { allergies?: Array<{ id?: string; allergen: string; severity: string }> }) {
  if (!allergies || allergies.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/8 border border-destructive/25 px-3 py-2">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <span className="text-xs font-semibold text-destructive mr-1">Allergies:</span>
      <div className="flex flex-wrap gap-1.5">
        {allergies.map((a, i) => (
          <Badge key={a.id ?? i} variant="destructive" className="text-[10px] font-medium py-0">
            {a.allergen}
            {a.severity && <span className="ml-1 opacity-75">({a.severity})</span>}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Vitals Strip (inline compact)
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
    return <span className="text-xs text-muted-foreground italic">No vitals recorded</span>;
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
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        if (item.value == null) return null;
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
              item.alert ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/40'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${item.alert ? 'text-destructive' : 'text-primary'}`} />
            <span className="font-medium">{item.value}</span>
            <span className="text-muted-foreground text-[10px]">{item.unit}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Empty / Loading states
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}

// ============================================================
// Tab: Visit History (progress notes as table)
// ============================================================

function VisitHistoryTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useProgressNotes({ patientId });
  const notes: ProgressNote[] = data?.data ?? [];

  if (isLoading) return <TabLoading />;
  if (notes.length === 0) return <EmptyState message="No visit history found" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-muted-foreground">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Doctor</th>
            <th className="pb-2 pr-4">Chief Complaint</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {notes.map((note) => (
            <tr key={note.id} className="text-foreground hover:bg-muted/30 transition-colors">
              <td className="py-2.5 pr-4 whitespace-nowrap text-xs">{formatDate(note.createdAt)}</td>
              <td className="py-2.5 pr-4 text-xs capitalize">{note.noteType?.replace(/_/g, ' ') || '—'}</td>
              <td className="py-2.5 pr-4 text-xs">{getDoctorName(note.doctor)}</td>
              <td className="py-2.5 pr-4 text-xs max-w-[250px] truncate">
                {note.subjective || note.content || '—'}
              </td>
              <td className="py-2.5">
                <Badge
                  variant={note.status === 'finalized' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {note.status === 'finalized' ? 'Signed' : 'Active'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Tab: Prescriptions (table with drug details)
// ============================================================

function PrescriptionsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePrescriptions({ patientId });
  const prescriptions: Prescription[] = data?.data ?? [];

  if (isLoading) return <TabLoading />;
  if (prescriptions.length === 0) return <EmptyState message="No prescriptions found" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-muted-foreground">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Drug</th>
            <th className="pb-2 pr-4">Dosage</th>
            <th className="pb-2 pr-4">Frequency</th>
            <th className="pb-2 pr-4">Duration</th>
            <th className="pb-2 pr-4">Prescriber</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {prescriptions.flatMap((rx) =>
            (rx.items ?? (rx as any).prescriptionItems ?? []).map((item: any, idx: number) => (
              <tr key={`${rx.id}-${idx}`} className="text-foreground hover:bg-muted/30 transition-colors">
                <td className="py-2.5 pr-4 whitespace-nowrap text-xs">
                  {idx === 0 ? formatDate(rx.createdAt) : ''}
                </td>
                <td className="py-2.5 pr-4 text-xs font-medium">{item.drugName}</td>
                <td className="py-2.5 pr-4 text-xs">{item.dosage}</td>
                <td className="py-2.5 pr-4 text-xs">{item.frequency}</td>
                <td className="py-2.5 pr-4 text-xs">{item.duration}</td>
                <td className="py-2.5 pr-4 text-xs">
                  {idx === 0 ? getDoctorName(rx.doctor) : ''}
                </td>
                <td className="py-2.5">
                  {idx === 0 && (
                    <Badge
                      variant={rx.status === 'active' ? 'default' : 'secondary'}
                      className="text-[10px] capitalize"
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

// ============================================================
// Tab: Lab Results (table)
// ============================================================

function LabResultsTab({ patientId }: { patientId: string }) {
  const { data, isLoading } = useLabOrders({ patientId });
  const orders: LabOrder[] = data?.data ?? [];

  if (isLoading) return <TabLoading />;
  if (orders.length === 0) return <EmptyState message="No lab orders found" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-muted-foreground">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Test</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2">Priority</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((order) => (
            <tr key={order.id} className="text-foreground hover:bg-muted/30 transition-colors">
              <td className="py-2.5 pr-4 whitespace-nowrap text-xs">{formatDate(order.createdAt)}</td>
              <td className="py-2.5 pr-4 text-xs">
                {order.tests?.map((t) => t.name).join(', ') || order.orderNumber || '—'}
              </td>
              <td className="py-2.5 pr-4">
                <Badge
                  variant={
                    order.status === 'completed' ? 'default' :
                    order.status === 'cancelled' ? 'destructive' :
                    'secondary'
                  }
                  className="text-[10px] capitalize"
                >
                  {order.status}
                </Badge>
              </td>
              <td className="py-2.5">
                {order.priority && (
                  <Badge
                    variant={order.priority === 'urgent' || order.priority === 'stat' ? 'destructive' : 'outline'}
                    className="text-[10px] capitalize"
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

// ============================================================
// Tab: Imaging
// ============================================================

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

  if (isLoading) return <TabLoading />;

  const requests: ImagingRequest[] = Array.isArray(imagingData) ? imagingData : [];
  if (requests.length === 0) return <EmptyState message="No imaging requests found" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-label font-medium text-muted-foreground">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Body Part</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2">Findings</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {requests.map((req) => (
            <tr key={req.id} className="text-foreground hover:bg-muted/30 transition-colors">
              <td className="py-2.5 pr-4 whitespace-nowrap text-xs">{formatDate(req.createdAt)}</td>
              <td className="py-2.5 pr-4 text-xs">{req.type || req.modality || '—'}</td>
              <td className="py-2.5 pr-4 text-xs">{req.bodyPart || '—'}</td>
              <td className="py-2.5 pr-4">
                <Badge
                  variant={
                    req.status === 'completed' ? 'default' :
                    req.status === 'cancelled' ? 'destructive' :
                    'secondary'
                  }
                  className="text-[10px] capitalize"
                >
                  {req.status}
                </Badge>
              </td>
              <td className="py-2.5 text-xs max-w-[200px] truncate">{req.findings || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Tab: Documents
// ============================================================

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
          className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{doc.title || doc.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {doc.type} &middot; {formatDate(doc.createdAt)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
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
// Tab: Forms (inline submissions)
// ============================================================

function FormsTab({ patientId, appointmentId }: { patientId: string; appointmentId?: string | null }) {
  const { data, isLoading } = useFormSubmissions({
    patientId,
    appointmentId: appointmentId ?? undefined,
    limit: 20,
  });
  const submissions = data?.data ?? [];

  if (isLoading) return <TabLoading />;
  if (submissions.length === 0) return <EmptyState message="No form submissions for this visit" />;

  return (
    <div className="space-y-1.5">
      {submissions.map((sub) => (
        <InlineSubmission key={sub.id} submission={sub} />
      ))}
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

  // Fetch appointment details if we have an appointmentId
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

  return (
    <div className="space-y-4">
      {/* ── Top Bar: Back + Patient Banner ── */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5 h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <PatientBanner patient={patient} appointment={appointment} />
          </div>
        </div>

        {/* Allergy Banner */}
        <AllergyBanner allergies={patient.allergies} />

        {/* Vitals Strip */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-label font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            Vitals
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

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <FlaskConical className="h-3.5 w-3.5" />
          Order Lab
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          Request Imaging
        </Button>
      </div>

      {/* ── Consultation Completion (Inline) — only during active consultation ── */}
      {appointment?.status === 'in_consultation' && (
        <ConsultationCompletionInline
          appointment={appointment}
          patient={patient}
          onComplete={() => router.back()}
        />
      )}

      {/* ── Main Tabs ── */}
      <div className="rounded-xl border bg-card">
        <Tabs defaultValue="visits" className="w-full">
          <TabsList variant="line" className="w-full justify-start px-4 pt-2">
            <TabsTrigger value="visits" className="gap-1.5">
              <FileText className="size-3.5" />
              Visit History
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="gap-1.5">
              <Pill className="size-3.5" />
              Prescriptions
            </TabsTrigger>
            <TabsTrigger value="lab" className="gap-1.5">
              <FlaskConical className="size-3.5" />
              Lab Results
            </TabsTrigger>
            <TabsTrigger value="imaging" className="gap-1.5">
              <ImageIcon className="size-3.5" />
              Imaging
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FolderOpen className="size-3.5" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="forms" className="gap-1.5">
              <ClipboardList className="size-3.5" />
              Forms
            </TabsTrigger>
          </TabsList>

          <div className="p-4">
            <TabsContent value="visits">
              <VisitHistoryTab patientId={patient.id} />
            </TabsContent>

            <TabsContent value="prescriptions">
              <PrescriptionsTab patientId={patient.id} />
            </TabsContent>

            <TabsContent value="lab">
              <LabResultsTab patientId={patient.id} />
            </TabsContent>

            <TabsContent value="imaging">
              <ImagingTab patientId={patient.id} />
            </TabsContent>

            <TabsContent value="documents">
              <DocumentsTab patient={patient} />
            </TabsContent>

            <TabsContent value="forms">
              <FormsTab patientId={patient.id} appointmentId={appointmentId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
