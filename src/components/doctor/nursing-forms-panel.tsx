'use client';

// Read-only panel listing this patient's most recent dynamic-form
// submissions. Shown on the doctor's consultation page (and reusable
// anywhere a patient context exists). Each row opens a dialog rendering
// the submission's stored snapshot.

import { useState } from 'react';
import { ClipboardList, Eye, FileText, Loader2 } from 'lucide-react';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFormSubmissions, type FormSubmission } from '@/hooks/use-forms';
import { FormSubmissionView } from '@/components/forms/form-submission-view';

function nurseName(n?: { firstName: string; lastName: string | null } | null) {
  if (!n) return '—';
  return `${n.firstName} ${n.lastName ?? ''}`.trim();
}

interface NursingFormsPanelProps {
  patientId: string;
  // Cap how many to show inline; full list lives on the patient details page.
  limit?: number;
}

export function NursingFormsPanel({ patientId, limit = 8 }: NursingFormsPanelProps) {
  const { data, isLoading } = useFormSubmissions({ patientId, limit });
  const submissions = data?.data ?? [];
  const [open, setOpen] = useState<FormSubmission | null>(null);

  return (
    <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-secondary p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-secondary" />
          <h2 className="font-headline text-sm font-bold">Patient Forms</h2>
          {submissions.length > 0 && (
            <span className="rounded-full bg-secondary/10 text-secondary px-1.5 py-0.5 text-[10px] font-bold">
              {submissions.length}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          Read-only · captured by nursing
        </span>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-3" />
      ) : submissions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No form submissions recorded yet for this patient.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {submissions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpen(s)}
                className="group w-full text-left rounded-md border border-input bg-surface-container-low hover:bg-surface-container px-3 py-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant truncate">
                    {s.form?.category ?? 'form'}
                  </p>
                  <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm font-semibold mt-0.5 truncate flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  {s.form?.name ?? '—'}
                  {s.form?.archivedAt && (
                    <span className="ml-1 text-[10px] text-amber-700">(deleted form)</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  v{s.formVersion} · {formatDateTimeAmPm(s.createdAt)} · {nurseName(s.submittedBy)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open?.form?.name ?? 'Submission'}</DialogTitle>
            <DialogDescription>
              {open
                ? `Submitted ${formatDateTimeAmPm(open.createdAt)} · v${open.formVersion} · ${nurseName(open.submittedBy)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {open && <FormSubmissionView schema={open.formSnapshot} data={open.data} />}
          <div className="pt-3 border-t flex justify-end">
            <Button variant="outline" onClick={() => setOpen(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
