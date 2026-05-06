'use client';

// /nurse/forms/[patientId] — per-patient dynamic form workspace.
// Tabs by category: each tab shows the hospital's published forms in that
// category with a "+ New submission" button. Below: this patient's recent
// submissions across all forms; click to open a read-only view.

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { usePatientDetail } from '@/hooks/use-doctor';
import {
  useHospitalForms,
  useFormSubmissions,
  useCreateSubmission,
  FORM_CATEGORIES,
  type HospitalForm,
  type FormSubmission,
} from '@/hooks/use-forms';
import { FormRenderer } from '@/components/forms/form-renderer';
import { FormSubmissionView } from '@/components/forms/form-submission-view';

export default function NursePatientFormsPage(props: { params: Promise<{ patientId: string }> }) {
  const router = useRouter();
  const { patientId } = use(props.params);
  const searchParams = useSearchParams();
  const visitId = searchParams.get('visitId') ?? undefined;
  const admissionId = searchParams.get('admissionId') ?? undefined;
  const appointmentId = searchParams.get('appointmentId') ?? undefined;

  const { data: patient, isLoading: patientLoading } = usePatientDetail(patientId);
  const formsQ = useHospitalForms({ status: 'active', limit: 200 });
  const submissionsQ = useFormSubmissions({ patientId, limit: 100 });

  const [openFill, setOpenFill] = useState<HospitalForm | null>(null);
  const [openView, setOpenView] = useState<FormSubmission | null>(null);

  const forms = useMemo(
    () => (formsQ.data?.data ?? []).filter((f) => f.isPublished && !f.archivedAt),
    [formsQ.data],
  );
  const formsByCategory = useMemo(() => {
    const map = new Map<string, HospitalForm[]>();
    for (const f of forms) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return map;
  }, [forms]);
  const visibleCats = FORM_CATEGORIES.filter((c) => formsByCategory.has(c.value));

  const submissionsByFormId = useMemo(() => {
    const map = new Map<string, FormSubmission[]>();
    for (const s of submissionsQ.data?.data ?? []) {
      const arr = map.get(s.formId) ?? [];
      arr.push(s);
      map.set(s.formId, arr);
    }
    return map;
  }, [submissionsQ.data]);

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
  const defaultTab = visibleCats[0]?.value ?? 'recent';

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
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{fullName}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {[patient.mrn ? `MRN ${patient.mrn}` : null, patient.gender, patient.phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {!hasContext && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No active visit/admission was selected. Pick a patient from the list so the entry is bound
          to the right encounter.
        </div>
      )}

      {/* Tabs by category + a Recent submissions tab */}
      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {visibleCats.map((c) => (
            <TabsTrigger key={c.value} value={c.value} className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {c.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="recent" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Recent submissions
          </TabsTrigger>
        </TabsList>

        {visibleCats.map((c) => (
          <TabsContent key={c.value} value={c.value} className="mt-3">
            <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
              <p className="text-xs text-muted-foreground mb-3">
                Forms in <span className="font-semibold">{c.label}</span>. Click any form to fill a new submission.
              </p>
              <ul className="divide-y">
                {(formsByCategory.get(c.value) ?? []).map((f) => {
                  const subs = submissionsByFormId.get(f.id) ?? [];
                  return (
                    <li key={f.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{f.name}</p>
                          {f.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{f.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            v{f.version} · {subs.length} submission(s) for this patient
                          </p>
                        </div>
                        <Button size="sm" onClick={() => setOpenFill(f)} className="gap-1">
                          <Plus className="h-3.5 w-3.5" />
                          New
                        </Button>
                      </div>
                      {subs.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-3 border-l-2 border-border">
                          {subs.slice(0, 3).map((s) => (
                            <li key={s.id}>
                              <button
                                onClick={() => setOpenView(s)}
                                className="text-left w-full text-[11px] text-muted-foreground hover:text-primary"
                              >
                                {formatDateTimeAmPm(s.createdAt)} · by{' '}
                                {s.submittedBy ? `${s.submittedBy.firstName} ${s.submittedBy.lastName ?? ''}` : '—'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </TabsContent>
        ))}

        {/* Recent submissions tab — chronological feed across all forms */}
        <TabsContent value="recent" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            {submissionsQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto my-4" />
            ) : (submissionsQ.data?.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No form submissions yet for this patient.
              </p>
            ) : (
              <ul className="divide-y">
                {(submissionsQ.data?.data ?? []).map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setOpenView(s)}
                      className="block w-full text-left py-2 -mx-2 px-2 rounded-md hover:bg-surface-container-low"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{s.form?.name ?? '—'}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTimeAmPm(s.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        v{s.formVersion} · by{' '}
                        {s.submittedBy ? `${s.submittedBy.firstName} ${s.submittedBy.lastName ?? ''}` : '—'}
                        {s.form?.archivedAt && (
                          <span className="ml-1 text-amber-700">(form deleted)</span>
                        )}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Fill dialog */}
      {openFill && (
        <FillFormDialog
          form={openFill}
          patientId={patientId}
          ctx={{ visitId, admissionId, appointmentId }}
          onClose={() => setOpenFill(null)}
        />
      )}

      {/* View submission dialog */}
      <Dialog open={!!openView} onOpenChange={(open) => !open && setOpenView(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openView?.form?.name ?? 'Submission'}</DialogTitle>
            <DialogDescription>
              {openView ? `Submitted ${formatDateTimeAmPm(openView.createdAt)}` : null}
            </DialogDescription>
          </DialogHeader>
          {openView && <FormSubmissionView schema={openView.formSnapshot} data={openView.data} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FillFormDialog({
  form,
  patientId,
  ctx,
  onClose,
}: {
  form: HospitalForm;
  patientId: string;
  ctx: { visitId?: string; admissionId?: string; appointmentId?: string };
  onClose: () => void;
}) {
  const create = useCreateSubmission(form.id);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.name}</DialogTitle>
          {form.description && <DialogDescription>{form.description}</DialogDescription>}
        </DialogHeader>
        <FormRenderer
          schema={form.schema}
          isSubmitting={create.isPending}
          submitLabel="Save submission"
          onCancel={onClose}
          onSubmit={async (values) => {
            try {
              await create.mutateAsync({ patientId, ...ctx, data: values });
              toast.success('Submission saved');
              onClose();
            } catch (e: unknown) {
              const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
              toast.error(msg);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
