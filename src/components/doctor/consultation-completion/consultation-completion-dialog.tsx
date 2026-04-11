'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Stethoscope, Pill, ClipboardList, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  consultationCompletionSchema,
  defaultFormValues,
  type ConsultationFormData,
} from './consultation-completion-schema';
import { useConsultationCompletion } from './use-consultation-completion';
import { StepExamination } from './step-examination';
import { StepPrescription } from './step-prescription';
import { StepAdvice } from './step-advice';
import { useDoctorProfile } from '@/hooks/use-doctor';
import { useAuthStore } from '@/stores/auth-store';
import type { Appointment, Patient } from '@/types';

// ── Draft persistence helpers ──────────────────────────────

const DRAFT_PREFIX = 'consultation_draft_';

interface DraftData {
  formData: ConsultationFormData;
  step: number;
  savedAt: number;
}

function getDraftKey(appointmentId: string): string {
  return `${DRAFT_PREFIX}${appointmentId}`;
}

function saveDraft(appointmentId: string, formData: ConsultationFormData, step: number): void {
  try {
    const draft: DraftData = { formData, step, savedAt: Date.now() };
    localStorage.setItem(getDraftKey(appointmentId), JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function loadDraft(appointmentId: string): DraftData | null {
  try {
    const raw = localStorage.getItem(getDraftKey(appointmentId));
    if (!raw) return null;
    const draft: DraftData = JSON.parse(raw);
    // Discard drafts older than 24 hours
    if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getDraftKey(appointmentId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function clearDraft(appointmentId: string): void {
  try {
    localStorage.removeItem(getDraftKey(appointmentId));
  } catch {
    // ignore
  }
}

// ── Component ──────────────────────────────────────────────

interface ConsultationCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  patient?: Patient | null;
  onComplete?: () => void;
  initialStep?: number;
}

const STEPS = [
  { number: 1, label: 'Examination', icon: Stethoscope },
  { number: 2, label: 'Prescription', icon: Pill },
  { number: 3, label: 'Advice', icon: ClipboardList },
] as const;

export function ConsultationCompletionDialog({
  open,
  onOpenChange,
  appointment,
  patient,
  onComplete,
  initialStep = 1,
}: ConsultationCompletionDialogProps) {
  const [step, setStep] = useState(initialStep);
  const [hasDraft, setHasDraft] = useState(false);
  const { user } = useAuthStore();
  const { data: doctorProfile } = useDoctorProfile();
  const { submitConsultation, isSubmitting, currentStep: submissionStep } = useConsultationCompletion();

  const form = useForm<ConsultationFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(consultationCompletionSchema) as any,
    defaultValues: {
      ...defaultFormValues,
      chiefComplaint: appointment?.reason || '',
    },
    mode: 'onTouched',
  });

  // ── Restore draft on open ──
  useEffect(() => {
    if (!open || !appointment?.id) return;

    const draft = loadDraft(appointment.id);
    if (draft) {
      form.reset(draft.formData);
      setStep(draft.step);
      setHasDraft(true);
      toast.info('Draft restored — your previous entries have been loaded', {
        duration: 3000,
      });
    } else {
      form.reset({
        ...defaultFormValues,
        chiefComplaint: appointment.reason || '',
      });
      setStep(initialStep);
      setHasDraft(false);
    }
  }, [open, appointment?.id]);

  // ── Auto-save draft on form changes (debounced) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !appointment?.id) return;

    const subscription = form.watch(() => {
      // Debounce: save 500ms after last change
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveDraft(appointment.id, form.getValues(), step);
      }, 500);
    });

    return () => {
      subscription.unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [open, appointment?.id, step, form]);

  // Also save when step changes
  useEffect(() => {
    if (open && appointment?.id) {
      saveDraft(appointment.id, form.getValues(), step);
    }
  }, [step]);

  // ── Clear draft helper ──
  const handleClearDraft = useCallback(() => {
    if (!appointment?.id) return;
    clearDraft(appointment.id);
    form.reset({
      ...defaultFormValues,
      chiefComplaint: appointment.reason || '',
    });
    setStep(1);
    setHasDraft(false);
    toast.success('Draft cleared');
  }, [appointment?.id, appointment?.reason, form]);

  const patientId = appointment?.patientId || patient?.id || '';
  const patientName = appointment?.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName || ''}`
    : patient
      ? `${patient.firstName} ${patient.lastName || ''}`
      : '';

  // ── Step navigation ──
  const goNext = async () => {
    let valid = true;
    if (step === 1) {
      valid = await form.trigger(['chiefComplaint', 'diagnoses']);
    }
    if (valid && step < 3) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // ── Submit handler ──
  const handleComplete = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast.error('Please fill in all required fields');
      const errors = form.formState.errors;
      if (errors.chiefComplaint || errors.diagnoses) setStep(1);
      return;
    }

    if (!appointment || !doctorProfile) {
      toast.error('Missing appointment or doctor profile');
      return;
    }

    try {
      await submitConsultation({
        formData: form.getValues(),
        patientId,
        appointmentId: appointment.id,
        doctorProfileId: doctorProfile.id,
        doctorUserId: user?.id || '',
      });

      // Clear draft on successful submission
      clearDraft(appointment.id);

      toast.success('Consultation completed successfully');
      onOpenChange(false);
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete consultation');
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-headline font-bold flex items-center gap-2">
                <Stethoscope className="h-4.5 w-4.5 text-primary" />
                Complete Consultation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {patientName && `Patient: ${patientName}`}
                {appointment?.patient?.mrn && ` · MRN: ${appointment.patient.mrn}`}
              </DialogDescription>
            </div>
            {hasDraft && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearDraft}
              >
                <RotateCcw className="h-3 w-3" />
                Clear Draft
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-center gap-0">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isActive = step === s.number;
              const isComplete = step > s.number;
              return (
                <div key={s.number} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isComplete || isActive) setStep(s.number);
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      isActive && 'bg-primary text-primary-foreground',
                      isComplete && 'bg-primary/10 text-primary cursor-pointer',
                      !isActive && !isComplete && 'text-muted-foreground',
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'h-px w-8 mx-1',
                        step > s.number ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && <StepExamination form={form} />}
          {step === 2 && <StepPrescription form={form} patientId={patientId} />}
          {step === 3 && <StepAdvice form={form} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between shrink-0">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goBack}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSubmitting && (
              <span className="text-xs text-muted-foreground animate-pulse">
                {submissionStep}
              </span>
            )}

            {step < 3 ? (
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                className="gap-1.5"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleComplete}
                disabled={isSubmitting}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Complete Consultation
              </Button>
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium">{submissionStep || 'Saving consultation...'}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
