'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useFormSubmissions, useSystemForm } from '@/hooks/use-forms';
import { FormRenderer } from './form-renderer';
import { SubmissionContextCard } from './submission-context-card';
import { cn } from '@/lib/utils';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { TRIGGER_LABELS, type FormSubmission } from '@/types/forms';

interface PatientFormSubmissionsPanelProps {
  /** Filter by patient (shows all forms ever filled for this patient) */
  patientId?: string;
  /** Filter by appointment (shows only forms tied to this booking) */
  appointmentId?: string;
  /** Title shown above the list */
  title?: string;
  /** Compact mode for small side panels */
  compact?: boolean;
  /** @deprecated No longer used — role-based filtering is automatic */
  viewLocation?: string;
}

/**
 * Read-only viewer for form submissions filtered by patient or appointment.
 * Role-based visibility is enforced automatically by the backend.
 */
export function PatientFormSubmissionsPanel({
  patientId,
  appointmentId,
  title = 'Patient Forms',
  compact = false,
}: PatientFormSubmissionsPanelProps) {
  const { data, isLoading } = useFormSubmissions({
    patientId,
    appointmentId,
    limit: 50,
  });

  const submissions = data?.data ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center">
        <FileText className="h-6 w-6 text-muted-foreground/50 mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">No forms submitted yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className={cn('font-headline font-bold', compact ? 'text-sm' : 'text-base')}>
          {title}
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {submissions.length} submission{submissions.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="divide-y">
        {submissions.map((sub) => {
          const isExpanded = expandedId === sub.id;
          const triggerLabel = sub.trigger ? TRIGGER_LABELS[sub.trigger] : 'Manual';
          return (
            <div key={sub.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{sub.systemForm?.name || sub.instance?.name || 'Form'}</p>
                    <span className="rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5">
                      {triggerLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDateTimeAmPm(sub.submittedAt)}
                    {sub.submitter &&
                      ` · by ${sub.submitter.firstName} ${sub.submitter.lastName || ''}`}
                    {sub.patient &&
                      ` · ${sub.patient.firstName} ${sub.patient.lastName || ''} (${sub.patient.mrn})`}
                  </p>
                </div>
              </button>

              {isExpanded && <ExpandedSubmission submission={sub} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpandedSubmission({ submission }: { submission: FormSubmission }) {
  const formId = submission.formId ?? undefined;
  const { data: systemForm, isLoading } = useSystemForm(formId);

  if (isLoading) {
    return (
      <div className="p-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
      </div>
    );
  }
  if (!systemForm) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Couldn&apos;t load form definition.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-muted/20 space-y-3">
      <SubmissionContextCard submission={submission} compact />
      <FormRenderer schema={systemForm.schema} initialValues={submission.responses} readOnly />
    </div>
  );
}
