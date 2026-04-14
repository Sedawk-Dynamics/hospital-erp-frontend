import { useState, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
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
      const { formData, patientId, appointmentId, doctorProfileId, doctorUserId } = params;
      setIsSubmitting(true);
      setError(null);

      try {
        // ── 1. Find or create visit ──
        setCurrentStep('Creating visit record...');
        let visitId: string;

        // Look for an existing active visit for this patient+appointment
        const visitsRes = await apiGet<Array<{ id: string; status: string }>>('/clinical/visits', {
          params: { patientId, status: 'active', limit: 5 },
        });
        const existingVisit = visitsRes.data?.find((v) => v.status === 'active');

        if (existingVisit) {
          visitId = existingVisit.id;
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

        // ── 2. Record vitals (if any filled) ──
        const v = formData.vitals;
        // Filter: only send values that are real positive numbers within DB column limits
        const num = (val: unknown, max = 999.9): number | undefined => {
          const n = Number(val);
          return n > 0 && !isNaN(n) && n <= max ? n : undefined;
        };
        const int = (val: unknown, max = 999): number | undefined => {
          const n = Number(val);
          return n > 0 && !isNaN(n) && n <= max ? Math.round(n) : undefined;
        };
        const vitalsPayload = {
          temperature: num(v.temperature, 999.9),         // Decimal(4,1)
          bloodPressureSystolic: int(v.bloodPressureSystolic, 400),
          bloodPressureDiastolic: int(v.bloodPressureDiastolic, 300),
          pulseRate: int(v.pulseRate, 300),
          respiratoryRate: int(v.respiratoryRate, 100),
          oxygenSaturation: num(v.oxygenSaturation, 100), // Decimal(4,1), max 100%
          weightKg: num(v.weightKg, 999.99),              // Decimal(5,2)
          heightCm: num(v.heightCm, 300),                 // Decimal(5,1), max 300cm
          bloodSugar: num(v.bloodSugar, 9999.99),         // Decimal(6,2)
        };
        const hasVitals = Object.values(vitalsPayload).some((val) => val !== undefined);

        if (hasVitals) {
          setCurrentStep('Recording vital signs...');
          const vitalsBody = { patientId, visitId, ...vitalsPayload };
          const cleanVitals = Object.fromEntries(
            Object.entries(vitalsBody).filter(([, val]) => val !== undefined),
          );
          await apiPost('/clinical/vitals', cleanVitals);
        }

        // ── 3. Add diagnoses ──
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

        // ── 4. Create prescription (if medicines added OR follow-up set) ──
        let prescriptionId: string | undefined;
        const hasMedicines = formData.medicines.length > 0;
        const hasFollowUp = !!formData.followUpDate;
        if (hasMedicines || hasFollowUp) {
          setCurrentStep('Creating prescription...');
          const items = hasMedicines
            ? formData.medicines.map((med) => ({
                drugId: med.drugId || undefined,
                drugName: med.drugName,
                dosage: med.dose || med.strength || med.dosage || '',
                frequency: encodeFrequency(med.frequency, med.timing, med.isPrn),
                duration: med.durationValue ? encodeDuration(med.durationValue, med.durationUnit) : undefined,
                route: med.route || 'oral',
                instructions: med.instructions || undefined,
                quantity: typeof med.quantity === 'number' ? med.quantity : undefined,
              }))
            : undefined;

          const rxRes = await apiPost<{ id: string }>('/prescriptions', {
            patientId,
            doctorId: doctorProfileId,
            visitId,
            prescriptionType: 'op',
            notes: formData.advice || formData.followUpNotes || undefined,
            followUpDate: formData.followUpDate || undefined,
            items,
          });
          prescriptionId = rxRes.data?.id;
        }

        // ── 5. Create & sign progress note ──
        setCurrentStep('Saving consultation notes...');
        const noteContent = buildProgressNoteContent(formData);
        const noteRes = await apiPost<{ id: string }>('/progress-notes', {
          patientId,
          visitId,
          noteType: 'general',
          content: noteContent,
          pinToDischargeSummary: false,
        });
        const progressNoteId = noteRes.data?.id;

        // Try to auto-sign the note (may fail if user lacks approve permission — non-blocking)
        if (progressNoteId) {
          try {
            await apiPatch(`/progress-notes/${progressNoteId}/sign`);
          } catch {
            // Signing requires progress_notes:approve permission — skip silently
          }
        }

        // ── 6. Close visit ──
        setCurrentStep('Closing visit...');
        await apiPatch(`/clinical/visits/${visitId}/close`);

        // ── 7. Update appointment status to completed ──
        setCurrentStep('Completing appointment...');
        await apiPatch(`/appointments/${appointmentId}/status`, { status: 'completed' });

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

  // Vitals summary
  const v = data.vitals;
  const vitalLines: string[] = [];
  if (v.temperature) vitalLines.push(`Temperature: ${v.temperature}°C`);
  if (v.bloodPressureSystolic || v.bloodPressureDiastolic)
    vitalLines.push(`BP: ${v.bloodPressureSystolic || '-'}/${v.bloodPressureDiastolic || '-'} mmHg`);
  if (v.pulseRate) vitalLines.push(`Pulse: ${v.pulseRate} bpm`);
  if (v.respiratoryRate) vitalLines.push(`RR: ${v.respiratoryRate}/min`);
  if (v.oxygenSaturation) vitalLines.push(`SpO₂: ${v.oxygenSaturation}%`);
  if (v.weightKg) vitalLines.push(`Weight: ${v.weightKg} kg`);
  if (v.heightCm) vitalLines.push(`Height: ${v.heightCm} cm`);
  if (v.bloodSugar) vitalLines.push(`Blood Sugar: ${v.bloodSugar} mg/dL`);
  if (vitalLines.length > 0) {
    sections.push(`**Vitals:**\n${vitalLines.join('\n')}`);
  }

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
  if (data.additionalNotes) {
    sections.push(`**Additional Notes:**\n${data.additionalNotes}`);
  }

  return sections.join('\n\n');
}
