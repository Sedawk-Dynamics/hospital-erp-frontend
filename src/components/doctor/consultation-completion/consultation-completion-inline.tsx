'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Stethoscope, Pill, ClipboardList } from 'lucide-react';
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

interface ConsultationCompletionInlineProps {
  appointment: Appointment | null;
  patient?: Patient | null;
  onComplete?: () => void;
  initialStep?: number;
}

const STEPS = [
  { number: 1, label: 'Examination', icon: Stethoscope },
  { number: 2, label: 'Prescription', icon: Pill },
  { number: 3, label: 'Advice & Follow-up', icon: ClipboardList },
] as const;

export function ConsultationCompletionInline({
  appointment,
  patient,
  onComplete,
  initialStep = 1,
}: ConsultationCompletionInlineProps) {
  const [step, setStep] = useState(initialStep);
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

  const patientId = appointment?.patientId || patient?.id || '';

  // ── Step navigation ──
  const goNext = async () => {
    let valid = true;
    // Vitals are nurse-recorded; not part of the doctor's form anymore.
    if (step === 1) valid = await form.trigger(['chiefComplaint', 'diagnoses']);
    if (valid && step < 3) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // ── Submit ──
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
      // Clear form after successful submission
      form.reset(defaultFormValues);
      setStep(1);
      toast.success('Consultation completed successfully');
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete consultation');
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden relative">
      {/* ── Header with step indicator ── */}
      <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = step === s.number;
            const isComplete = step > s.number;
            return (
              <div key={s.number} className="flex items-center">
                <button
                  type="button"
                  onClick={() => { if (isComplete || isActive) setStep(s.number); }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    isActive && 'bg-primary text-primary-foreground',
                    isComplete && 'bg-primary/10 text-primary cursor-pointer',
                    !isActive && !isComplete && 'text-muted-foreground',
                  )}
                >
                  {isComplete ? <CheckCircle className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-px w-6 mx-0.5', step > s.number ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step Content ── */}
      <div className="p-5">
        {step === 1 && <StepExamination form={form} patientId={patientId} />}
        {step === 2 && <StepPrescription form={form} patientId={patientId} />}
        {step === 3 && <StepAdvice form={form} />}
      </div>

      {/* ── Footer: navigation + submit ── */}
      <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-between">
        <div>
          {step > 1 && (
            <Button type="button" variant="outline" size="sm" onClick={goBack} disabled={isSubmitting} className="gap-1.5">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSubmitting && (
            <span className="text-xs text-muted-foreground animate-pulse">{submissionStep}</span>
          )}

          {step < 3 ? (
            <Button type="button" size="sm" onClick={goNext} className="gap-1.5">
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleComplete}
              disabled={isSubmitting}
              className="gap-1.5 bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Complete Consultation
            </Button>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">{submissionStep || 'Saving consultation...'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
