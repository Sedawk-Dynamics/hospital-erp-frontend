'use client';

// ───────────────────────────────────────────────────────────────────────
// Consultation Form Sheet
//
// Inline right-side panel that hosts the PrescriptionPad with the new
// per-section pin functionality, so the doctor can run a consultation
// without leaving their home queue. Mirrors the same data wiring as
// /doctor/consultation/[patientId] (active visit lookup, edit-window
// detection, lab/imaging order shortcuts, consultation summary panel)
// in a compact, sheet-friendly layout.
// ───────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock,
  FlaskConical,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api';
import { formatDateTimeAmPm } from '@/lib/date-utils';

import { PrescriptionPad, clearConsultationDraft } from '@/components/doctor/prescription-pad';
import { LabOrderDialog } from '@/components/doctor/lab-order-dialog';
import { ImagingRequestDialog } from '@/components/doctor/imaging-request-dialog';
import { ConsultationSummaryPanel } from '@/components/doctor/consultation-summary-panel';
import { usePatientDetail, useProgressNotes } from '@/hooks/use-doctor';
import type { Appointment, Patient } from '@/types';

interface ConsultationFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  appointmentId: string | null;
}

function calculateAge(dob: string): string {
  try {
    const birth = new Date(dob);
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return `${age}y`;
  } catch {
    return '';
  }
}

function PatientStrip({ patient }: { patient: Patient }) {
  const initials =
    `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() || 'P';
  const allergies = (patient.allergies ?? []) as Array<{ allergen: string; severity?: string }>;

  return (
    <div className="flex items-start gap-3 border-b border-outline-variant/30 px-5 py-3 bg-card/95">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="text-sm font-bold text-primary">{initials}</span>
      </div>
      <div className="min-w-0 flex-1">
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
        {allergies.length > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-error/30 bg-error/10 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 text-error" />
            <span className="text-[10px] font-bold text-error">
              {allergies.map((a) => a.allergen).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConsultationFormSheet({
  open,
  onOpenChange,
  patientId,
  appointmentId,
}: ConsultationFormSheetProps) {
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [imagingDialogOpen, setImagingDialogOpen] = useState(false);
  const [editRequested, setEditRequested] = useState(false);

  const { data: patient, isLoading: patientLoading } = usePatientDetail(patientId ?? '');

  const { data: appointment } = useQuery({
    queryKey: ['doctor', 'appointments', 'detail', appointmentId],
    queryFn: async () => {
      const response = await apiGet<Appointment>(`/appointments/${appointmentId}`);
      return response.data;
    },
    enabled: !!appointmentId && open,
  });

  // Active visit for lab/imaging order context.
  const { data: activeVisitId } = useQuery({
    queryKey: ['doctor', 'active-visit', patientId],
    queryFn: async () => {
      const response = await apiGet<Array<{ id: string; status?: string }>>('/clinical/visits', {
        params: { patientId, status: 'active', limit: 1 },
      });
      return response.data?.[0]?.id ?? null;
    },
    enabled: !!patientId && open,
  });

  const isInConsultation = appointment?.status === 'in_consultation';
  const isCompleted = appointment?.status === 'completed';
  const completedAt = appointment?.updatedAt ? new Date(appointment.updatedAt).getTime() : null;
  const withinEditWindow = !!completedAt && Date.now() - completedAt < 24 * 60 * 60 * 1000;
  const canEdit = isCompleted && withinEditWindow;
  const isEditing = canEdit && editRequested;

  // Reset transient edit-mode flag whenever the sheet closes / target changes.
  useEffect(() => {
    if (!open) setEditRequested(false);
  }, [open, appointmentId]);

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

  const { data: recentNotes } = useProgressNotes(
    activeVisitId ? { visitId: activeVisitId, limit: 1 } : patientId ? { patientId, limit: 1 } : undefined,
  );
  const latestNote = recentNotes?.data?.[0] ?? null;

  const showForm = isInConsultation || isEditing;

  const guardedOrderLab = useMemo(
    () => () => {
      if (!activeVisitId) {
        toast.error('No active visit — start the consultation first');
        return;
      }
      setLabDialogOpen(true);
    },
    [activeVisitId],
  );
  const guardedOrderImaging = useMemo(
    () => () => {
      if (!activeVisitId) {
        toast.error('No active visit — start the consultation first');
        return;
      }
      setImagingDialogOpen(true);
    },
    [activeVisitId],
  );

  const startEdit = () => setEditRequested(true);
  const cancelEdit = () => {
    if (prefill?.visitId && appointmentId) clearConsultationDraft(appointmentId, prefill.visitId);
    setEditRequested(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl lg:max-w-4xl p-0 flex flex-col gap-0 overflow-hidden"
        >
          <SheetHeader className="px-5 pt-5 pb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Stethoscope className="h-4 w-4" />
              </div>
              {isEditing
                ? 'Edit Consultation'
                : isCompleted
                  ? 'Consultation Summary'
                  : isInConsultation
                    ? 'Active Consultation'
                    : 'Consultation'}
            </SheetTitle>
          </SheetHeader>

          {patientLoading || !patient ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <PatientStrip patient={patient} />

              <div className="flex items-center gap-2 px-5 py-2 border-b border-outline-variant/30 bg-background/60">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={guardedOrderLab}
                  disabled={!activeVisitId}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Order Lab
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={guardedOrderImaging}
                  disabled={!activeVisitId}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Order Imaging
                </Button>
                {canEdit && !isEditing && completedAt !== null && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant font-label">
                      <Clock className="h-3 w-3" />
                      Edit window open · {formatDateTimeAmPm(new Date(completedAt + 24 * 60 * 60 * 1000).toISOString())}
                    </span>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={startEdit}>
                      Edit
                    </Button>
                  </div>
                )}
                {isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 ml-auto text-xs border-secondary/40 text-secondary hover:bg-secondary/10"
                    onClick={cancelEdit}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {showForm ? (
                  isEditing && !prefill ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Loading saved consultation…
                      </span>
                    </div>
                  ) : (
                    <PrescriptionPad
                      key={isEditing ? `edit-${prefill?.visitId}` : `new-${appointmentId}`}
                      patientId={patient.id}
                      patientName={`${patient.firstName} ${patient.lastName}`}
                      patientAge={patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : undefined}
                      patientGender={patient.gender}
                      patientPhone={patient.phone}
                      appointmentId={appointmentId || ''}
                      doctorProfileId={appointment?.doctorId || ''}
                      doctorUserId={appointment?.doctor?.userId || ''}
                      onComplete={() => {
                        if (isEditing) {
                          cancelEdit();
                        } else {
                          onOpenChange(false);
                        }
                      }}
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
                  )
                ) : isCompleted && latestNote ? (
                  <ConsultationSummaryPanel note={latestNote} canSign />
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-8 text-center">
                    <Stethoscope className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-semibold mb-1">
                      Consultation hasn&apos;t started yet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Move this appointment to <strong>In Consultation</strong> to record SOAP
                      notes, prescriptions, and pin sections for the patient summary.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <LabOrderDialog
        open={labDialogOpen}
        onOpenChange={setLabDialogOpen}
        patientId={patient?.id || ''}
        visitId={activeVisitId || ''}
      />
      <ImagingRequestDialog
        open={imagingDialogOpen}
        onOpenChange={setImagingDialogOpen}
        patientId={patient?.id || ''}
        visitId={activeVisitId || ''}
      />
    </>
  );
}

export default ConsultationFormSheet;
