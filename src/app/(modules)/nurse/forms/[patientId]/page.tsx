'use client';

// /nurse/forms/[patientId] — per-patient nurse workspace.
//
// Two tabs:
//   • Forms   — the hospital's dynamic form catalogue (shared
//               <PatientFormsPanel/>, identical to the IP workspace tab).
//   • History — the patient's personal / family / medical-surgical history and
//               allergies (shared <PatientHistoryPanel/>, identical to what the
//               doctor sees in an OP consultation).
//
// Reached from the OPD list, the IP/emergency/day-care list and the temporary
// patient list, so every encounter type lands on the same page. The encounter
// is carried in the query string (visitId | admissionId | appointmentId); a
// temporary patient with no encounter yet is allowed through — the server
// anchors the submission to the patient's latest encounter, or to the patient
// alone when there is none.

import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ClipboardList, HeartPulse, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePatientDetail } from '@/hooks/use-doctor';
import { PatientFormsPanel } from '@/components/shared/patient-forms-panel';
import { PatientHistoryPanel } from '@/components/shared/patient-history-panel';

export default function NursePatientFormsPage(props: { params: Promise<{ patientId: string }> }) {
  const router = useRouter();
  const { patientId } = use(props.params);
  const searchParams = useSearchParams();
  const visitId = searchParams.get('visitId') ?? undefined;
  const admissionId = searchParams.get('admissionId') ?? undefined;
  const appointmentId = searchParams.get('appointmentId') ?? undefined;
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'forms';

  const { data: patient, isLoading: patientLoading } = usePatientDetail(patientId);

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/nurse/forms')} className="gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase();
  const fullName = `${patient.firstName} ${patient.lastName ?? ''}`.trim();
  const hasContext = !!(visitId || admissionId || appointmentId);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/nurse/forms')}
          className="h-8 gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Patients
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{fullName}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {[patient.mrn ? `MRN ${patient.mrn}` : null, patient.gender, patient.phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {!hasContext && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No encounter was selected. Anything recorded here is filed against the patient's most
          recent visit or admission — or against the patient record itself if they have none yet
          (a temporary patient the front desk has not routed).
        </div>
      )}

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="forms" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Forms
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <HeartPulse className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="pt-4">
          <PatientFormsPanel
            patientId={patientId}
            ctx={{ visitId, admissionId, appointmentId }}
          />
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            <PatientHistoryPanel patientId={patientId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
