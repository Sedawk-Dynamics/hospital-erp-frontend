'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FormRenderer } from './form-renderer';
import { useFormsForTrigger, useCreateFormSubmission } from '@/hooks/use-forms';
import type { FormTrigger } from '@/types/forms';
import { toast } from 'sonner';

interface IntakeFormsModalProps {
  open: boolean;
  trigger: FormTrigger;
  tenantId?: string | null;
  context?: {
    patientId?: string;
    appointmentId?: string;
    visitId?: string;
    admissionId?: string;
  };
  onComplete: () => void;
  allowSkip?: boolean;
}

/**
 * Auto-discovers system forms for a workflow trigger and walks the user through them.
 * Used after appointment booking, admission, etc.
 */
export function IntakeFormsModal({
  open,
  trigger,
  tenantId,
  context,
  onComplete,
  allowSkip = true,
}: IntakeFormsModalProps) {
  const { data: resolvedForms, isLoading } = useFormsForTrigger(open ? trigger : null, tenantId);
  const submitMutation = useCreateFormSubmission();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Only show forms the user can fill
  const fillableForms = (resolvedForms ?? []).filter((f) => f.canFill);

  // Reset on close / re-open
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setCompletedIds(new Set());
    }
  }, [open]);

  // No forms → finish immediately
  useEffect(() => {
    if (open && !isLoading && fillableForms.length === 0) {
      onComplete();
    }
  }, [open, isLoading, fillableForms.length, onComplete]);

  if (!open) return null;

  const total = fillableForms.length;
  const current = fillableForms[currentIndex];
  const allRequiredFilled = fillableForms.every(
    (f) => !f.isRequired || completedIds.has(f.form.id),
  );

  const handleSubmit = async (responses: Record<string, unknown>) => {
    if (!current) return;
    try {
      await submitMutation.mutateAsync({
        formId: current.form.id,
        trigger,
        responses,
        tenantId: tenantId ?? undefined,
        ...context,
      });
      toast.success(`"${current.form.name}" saved`);
      setCompletedIds((prev) => new Set(prev).add(current.form.id));

      if (currentIndex < total - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to save form');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !allRequiredFilled) {
          toast.error('Please complete the required forms first.');
          return;
        }
        if (!o) onComplete();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Intake Forms
          </DialogTitle>
          <DialogDescription>
            Please complete the following form{total > 1 ? 's' : ''} for the hospital.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : !current ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium">All set!</p>
          </div>
        ) : (
          <>
            {/* Progress */}
            {total > 1 && (
              <div className="flex items-center gap-1.5 mb-3">
                {fillableForms.map((f, i) => (
                  <div
                    key={f.form.id}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < currentIndex || completedIds.has(f.form.id)
                        ? 'bg-emerald-500'
                        : i === currentIndex
                          ? 'bg-primary'
                          : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            )}

            <div className="mb-2">
              <h3 className="font-headline text-base font-bold">{current.form.name}</h3>
              {current.form.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {current.form.description}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Form {currentIndex + 1} of {total}
                {current.isRequired && (
                  <span className="ml-2 text-destructive font-semibold">Required</span>
                )}
              </p>
            </div>

            <FormRenderer
              schema={current.effectiveSchema}
              onSubmit={handleSubmit}
              isSubmitting={submitMutation.isPending}
              submitLabel={currentIndex < total - 1 ? 'Save & Next \u2192' : 'Finish'}
            />

            {allowSkip && allRequiredFilled && currentIndex < total - 1 && (
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => onComplete()}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Skip remaining forms
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
