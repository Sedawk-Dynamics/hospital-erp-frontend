import { useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { doctorKeys } from '@/hooks/use-doctor';
import { clinicalKeys } from '@/hooks/use-clinical';
import type { ConsultationFormData } from './consultation-completion-schema';
import { encodeFrequency, encodeDuration } from './consultation-completion-schema';

interface SubmitParams {
  formData: ConsultationFormData;
  patientId: string;
  appointmentId: string;
  doctorProfileId: string;
  doctorUserId: string;
  /**
   * When set, updates existing records in-place instead of creating new ones
   * and does NOT change the appointment status or close the visit. Used for
   * the 24h edit window on completed consultations.
   */
  editMode?: {
    visitId: string;
    progressNoteId?: string;
    prescriptionId?: string;
  };
}

interface SubmitResult {
  visitId: string;
  prescriptionId?: string;
  progressNoteId?: string;
}

export function useConsultationCompletion() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState('');
  const queryClient = useQueryClient();

  const submitConsultation = useCallback(
    async (params: SubmitParams): Promise<SubmitResult> => {
      const { formData, patientId, appointmentId, doctorProfileId, doctorUserId, editMode } = params;
      setIsSubmitting(true);
      setError(null);

      try {
        // ── 1. Find or create visit ──
        let visitId: string;
        if (editMode?.visitId) {
          visitId = editMode.visitId;
          // Keep the visit's chief complaint in sync when editing. Without
          // this, the prefill on next reload re-reads the stale value
          // stored at first-create time.
          if (formData.chiefComplaint !== undefined) {
            try {
              await apiPut(`/clinical/visits/${visitId}`, {
                chiefComplaint: formData.chiefComplaint,
              });
            } catch {
              /* non-fatal — the note's SOAP JSON still carries it */
            }
          }
        } else {
          setCurrentStep('Creating visit record...');
          const visitsRes = await apiGet<Array<{ id: string; status: string }>>('/clinical/visits', {
            params: { patientId, status: 'active', limit: 5 },
          });
          const existingVisit = visitsRes.data?.find((v) => v.status === 'active');
          if (existingVisit) {
            visitId = existingVisit.id;
            // New consultation but reusing an active visit — write the
            // chief complaint so the visit reflects what the doctor typed.
            if (formData.chiefComplaint) {
              try {
                await apiPut(`/clinical/visits/${visitId}`, {
                  chiefComplaint: formData.chiefComplaint,
                });
              } catch {
                /* non-fatal */
              }
            }
          } else {
            const newVisit = await apiPost<{ id: string }>('/clinical/visits', {
              patientId,
              doctorId: doctorProfileId,
              appointmentId,
              visitType: 'op',
              visitDate: new Date().toISOString(),
              chiefComplaint: formData.chiefComplaint,
            });
            visitId = newVisit.data!.id;
          }
        }

        // ── 2. Vitals — intentionally NOT recorded here. ──
        // Vitals are owned by the nursing team; the doctor's consultation flow
        // displays the latest nurse-recorded reading read-only and never POSTs
        // to /clinical/vitals. The backend also rejects writes from the doctor
        // role as defense-in-depth.

        // ── 3. Diagnoses ──
        // In edit mode we replace: delete existing for this visit, then re-insert.
        // This keeps the list in sync with what the doctor sees in the form.
        if (editMode?.visitId) {
          setCurrentStep('Updating diagnoses...');
          try {
            const existingRes = await apiGet<Array<{ id: string }>>('/clinical/diagnoses', {
              params: { visitId, limit: 100 },
            });
            for (const d of existingRes.data ?? []) {
              try { await apiDelete(`/clinical/diagnoses/${d.id}`); } catch { /* ignore */ }
            }
          } catch { /* ignore */ }
        }
        if (formData.diagnoses.length > 0) {
          setCurrentStep('Saving diagnoses...');
          for (const diag of formData.diagnoses) {
            if (!diag.diagnosisName) continue;
            await apiPost('/clinical/diagnoses', {
              patientId,
              visitId,
              icdCode: diag.icdCode || undefined,
              diagnosisName: diag.diagnosisName,
              diagnosisType: diag.diagnosisType,
            });
          }
        }

        // ── 4. Prescription ──
        let prescriptionId: string | undefined = editMode?.prescriptionId;
        const hasMedicines = formData.medicines.length > 0;
        const hasFollowUp = !!formData.followUpDate;
        const rxBuildItems = () =>
          formData.medicines.map((med) => ({
            drugId: med.drugId || undefined,
            drugName: med.drugName,
            dosage: med.dose || med.strength || med.dosage || '',
            frequency: encodeFrequency(med.frequency, med.timing, med.isPrn),
            duration: med.durationValue ? encodeDuration(med.durationValue, med.durationUnit) : undefined,
            route: med.route || 'oral',
            instructions: med.instructions || undefined,
            quantity: typeof med.quantity === 'number' ? med.quantity : undefined,
            isPrn: med.isPrn ?? false,
          }));

        if (editMode?.prescriptionId) {
          // Single PUT that updates header fields + atomically replaces
          // items in a transaction. Avoids the old delete-then-recreate
          // pattern which created duplicate rows whenever the doctor role
          // lacked `prescriptions:delete` permission.
          setCurrentStep('Updating prescription...');
          await apiPut(`/prescriptions/${editMode.prescriptionId}`, {
            notes: formData.advice || formData.followUpNotes || undefined,
            followUpDate: formData.followUpDate || null,
            items: hasMedicines ? rxBuildItems() : [],
          });
        } else if (hasMedicines || hasFollowUp) {
          setCurrentStep('Creating prescription...');
          const rxRes = await apiPost<{ id: string }>('/prescriptions', {
            patientId,
            doctorId: doctorProfileId,
            visitId,
            prescriptionType: 'op',
            notes: formData.advice || formData.followUpNotes || undefined,
            followUpDate: formData.followUpDate || undefined,
            items: hasMedicines ? rxBuildItems() : undefined,
          });
          prescriptionId = rxRes.data?.id;
        }

        // ── 5. Progress note (with SOAP JSON + impressions + pins) ──
        const noteContent = buildProgressNoteContent(formData);
        const soap = buildSoapPayload(formData);
        const cleanPins = (formData.pins ?? []).filter((p) => p.content && p.content.trim());
        const notePayload: any = {
          noteType: 'general',
          content: noteContent,
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
          impressions: formData.impression || null,
          pins: cleanPins.length > 0 ? cleanPins : undefined,
          // weightKgAtEntry was previously sourced from the doctor's own vitals
          // input. Vitals are now nurse-only, so we omit it here. The progress
          // note backend treats it as optional.
        };
        let progressNoteId: string | undefined = editMode?.progressNoteId;
        if (editMode?.progressNoteId) {
          setCurrentStep('Updating consultation notes...');
          await apiPut(`/progress-notes/${editMode.progressNoteId}`, notePayload);
        } else {
          setCurrentStep('Saving consultation notes...');
          const noteRes = await apiPost<{ id: string }>('/progress-notes', {
            patientId,
            visitId,
            ...notePayload,
          });
          progressNoteId = noteRes.data?.id;
          // Don't auto-sign here. The spec's OP rule is "editable for 24
          // hours → then LOCKED". Matching that, the note stays `active`
          // so within-window edits don't require an amendment reason; the
          // OP auto-archive cron flips it to `archived` after 24h. For
          // notes the doctor wants to finalize early, surface an explicit
          // Sign action in the consultation UI.
        }

        // ── 6-7. Close visit + complete appointment — only on initial submit ──
        if (!editMode) {
          setCurrentStep('Closing visit...');
          await apiPatch(`/clinical/visits/${visitId}/close`);
          setCurrentStep('Completing appointment...');
          await apiPatch(`/appointments/${appointmentId}/status`, { status: 'completed' });
        }

        // ── 8. Invalidate queries ──
        queryClient.invalidateQueries({ queryKey: doctorKeys.appointments.all });
        queryClient.invalidateQueries({ queryKey: doctorKeys.vitals.all });
        queryClient.invalidateQueries({ queryKey: doctorKeys.diagnoses.all });
        queryClient.invalidateQueries({ queryKey: doctorKeys.prescriptions.all });
        queryClient.invalidateQueries({ queryKey: doctorKeys.progressNotes.all });
        queryClient.invalidateQueries({ queryKey: clinicalKeys.visits.all });

        setIsSubmitting(false);
        setCurrentStep('');
        return { visitId, prescriptionId, progressNoteId };
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || 'Failed to complete consultation';
        setError(message);
        setIsSubmitting(false);
        setCurrentStep('');
        throw new Error(message);
      }
    },
    [queryClient],
  );

  return { submitConsultation, isSubmitting, error, currentStep };
}

// ── Build progress note content from form data ─────────────

function buildProgressNoteContent(data: ConsultationFormData): string {
  const sections: string[] = [];

  sections.push(`**Chief Complaint:**\n${data.chiefComplaint}`);

  if (data.generalExamination) {
    sections.push(`**General Examination:**\n${data.generalExamination}`);
  }
  if (data.systemicExamination) {
    sections.push(`**Systemic Examination:**\n${data.systemicExamination}`);
  }

  // Vitals are recorded separately by the nursing team and surfaced in the
  // patient's vitals history. They are intentionally not duplicated into the
  // doctor's progress-note narrative.

  // Diagnoses
  if (data.diagnoses.length > 0) {
    const diagLines = data.diagnoses
      .filter((d) => d.diagnosisName)
      .map((d) => `- ${d.diagnosisName}${d.icdCode ? ` (${d.icdCode})` : ''} [${d.diagnosisType}]`);
    sections.push(`**Diagnosis:**\n${diagLines.join('\n')}`);
  }

  // Medicines prescribed
  if (data.medicines.length > 0) {
    const medLines = data.medicines.map((m) => {
      const dose = m.dose || m.strength || m.dosage || '';
      const freq = m.frequency || '';
      const timing = m.timing || '';
      const dur = m.durationValue ? `${m.durationValue} ${m.durationUnit}` : '';
      const parts = [m.drugName, dose, freq, timing, dur].filter(Boolean);
      return `- ${parts.join(' | ')}${m.instructions ? ` | ${m.instructions}` : ''}`;
    });
    sections.push(`**Prescription:**\n${medLines.join('\n')}`);
  }

  // Advice
  if (data.advice) {
    sections.push(`**Advice:**\n${data.advice}`);
  }
  if (data.followUpDate || data.followUpDuration) {
    const parts: string[] = [];
    if (data.followUpDuration && data.followUpDurationUnit) {
      parts.push(`After ${data.followUpDuration} ${data.followUpDurationUnit}`);
    }
    if (data.followUpDate) {
      const dateObj = new Date(data.followUpDate);
      const formatted = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      parts.push(formatted);
    }
    if (data.followUpNotes) {
      parts.push(data.followUpNotes);
    }
    sections.push(`**Follow-up:** ${parts.join(' — ')}`);
  }
  if (data.referralNotes) {
    sections.push(`**Referral:**\n${data.referralNotes}`);
  }

  if (data.physicalObservations && data.physicalObservations.length > 0) {
    const lines = data.physicalObservations.map((po) => `- ${po.value}`);
    sections.push(`**Physical Observations:**\n${lines.join('\n')}`);
  }

  if (data.impression) {
    sections.push(`**Impression:**\n${data.impression}`);
  }

  return sections.join('\n\n');
}

// Map consultation form data onto the structured SOAP JSON payload the
// ProgressNote backend expects (written to the `subjective/objective/
// assessment/plan` columns). Free-text fields go directly; multi-row
// fields are preserved as structured arrays so the future split-view
// discharge renderer can slot them back into individual fields.
function buildSoapPayload(data: ConsultationFormData) {
  return {
    subjective: {
      chiefComplaints: data.chiefComplaint || '',
      presentIllness: '',
    },
    objective: {
      vitalsSummary: '',
      physicalObservations: (data.physicalObservations ?? []).map((po) => ({
        source: po.source,
        catalogId: po.catalogId,
        value: po.value,
        system: po.system,
      })),
      generalExamination: data.generalExamination || '',
      systemicExamination: data.systemicExamination || '',
      investigations: '',
    },
    assessment: {
      diagnoses: (data.diagnoses ?? []).map((d) => ({
        icdCode: d.icdCode || '',
        diagnosisName: d.diagnosisName,
        diagnosisType: d.diagnosisType,
      })),
      certainty: 'provisional',
      differential: '',
    },
    plan: {
      medicationsSummary: (data.medicines ?? []).map((m) => m.drugName).filter(Boolean).join(', '),
      advice: data.advice || '',
      followUpDate: data.followUpDate || '',
      followUpNotes: data.followUpNotes || '',
      referralNotes: data.referralNotes || '',
    },
  };
}
