'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  Loader2,
  Inbox,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FormRenderer } from '@/components/forms/form-renderer';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';
import { useCreateFormSubmission } from '@/hooks/use-forms';
import {
  CATEGORY_LABELS,
  TRIGGER_LABELS,
  type FormCategory,
  type FormTrigger,
  type FormSchema,
} from '@/types/forms';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────
// Patient Portal — My Forms (Unified Inbox)
// ─────────────────────────────────────────────────────────

interface AvailableForm {
  assignmentId: string;
  trigger: FormTrigger;
  isRequired: boolean;
  isSubmitted: boolean;
  tenant: { id: string; name: string; slug: string; city: string | null };
  patientId: string | null;
  instance: {
    id: string;
    name: string;
    description?: string | null;
    category: FormCategory;
    schema: FormSchema;
  };
}

export default function PatientMyFormsPage() {
  const [selectedForm, setSelectedForm] = useState<AvailableForm | null>(null);
  const [previewForm, setPreviewForm] = useState<AvailableForm | null>(null);

  const { data: availableForms, isLoading, refetch } = useQuery({
    queryKey: ['patient', 'available-forms'],
    queryFn: async () => {
      const res = await apiGet<AvailableForm[]>('/patient-portal/available-forms');
      return res.data ?? [];
    },
  });

  const submitMutation = useCreateFormSubmission();

  const allForms = (availableForms ?? []) as AvailableForm[];
  const toFill = allForms.filter((f) => !f.isSubmitted);
  const submitted = allForms.filter((f) => f.isSubmitted);

  const formsByHospital = useMemo(() => {
    const map = new Map<string, { tenant: AvailableForm['tenant']; forms: AvailableForm[] }>();
    for (const f of toFill) {
      if (!map.has(f.tenant.id)) map.set(f.tenant.id, { tenant: f.tenant, forms: [] });
      map.get(f.tenant.id)!.forms.push(f);
    }
    return Array.from(map.values());
  }, [toFill]);

  const requiredCount = toFill.filter((f) => f.isRequired).length;

  const handleSubmit = async (responses: Record<string, unknown>) => {
    if (!selectedForm) return;
    try {
      await submitMutation.mutateAsync({
        formId: selectedForm.instance.id,
        trigger: selectedForm.trigger,
        responses,
        tenantId: selectedForm.tenant.id,
        patientId: selectedForm.patientId ?? undefined,
      });
      toast.success(`"${selectedForm.instance.name}" submitted`);
      setSelectedForm(null);
      refetch();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to submit form');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">
            Care Records
          </p>
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            My Forms
          </h1>
          <p className="font-label text-sm text-on-surface-variant mt-1.5">
            Forms you can fill for hospitals you&apos;ve visited
          </p>
        </div>
        {requiredCount > 0 && (
          <div className="rounded-xl bg-secondary-fixed/50 border-l-4 border-secondary px-4 py-3 shadow-sanctuary text-center shrink-0">
            <p className="font-headline text-2xl font-extrabold text-on-surface leading-none">
              {requiredCount}
            </p>
            <p className="font-label text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">
              Required
            </p>
          </div>
        )}
      </div>

      {/* ── Forms to fill ── */}
      <section className="space-y-3">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Forms to Fill
          {toFill.length > 0 && (
            <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
              {toFill.length}
            </span>
          )}
        </h2>

        {isLoading ? (
          <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : toFill.length === 0 ? (
          <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-10 text-center">
            <div className="w-12 h-12 mx-auto bg-surface-container-high rounded-full flex items-center justify-center text-outline mb-3">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="font-label text-sm font-semibold text-on-surface">
              No forms to fill right now
            </p>
            <p className="font-label text-xs text-on-surface-variant mt-1 max-w-md mx-auto">
              When a hospital you&apos;ve booked with assigns a form to you, it&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {formsByHospital.map(({ tenant, forms }) => (
              <div key={tenant.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-on-surface-variant" />
                  <p className="font-label text-xs font-bold text-on-surface">
                    {tenant.name}
                    {tenant.city && (
                      <span className="text-on-surface-variant font-normal"> · {tenant.city}</span>
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {forms.map((f) => (
                    <div
                      key={f.assignmentId}
                      className={cn(
                        'rounded-xl shadow-sanctuary p-5 flex flex-col gap-3',
                        f.isRequired
                          ? 'border-l-4 border-secondary bg-secondary-fixed/30'
                          : 'bg-surface-container-lowest',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
                            f.isRequired
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-primary/10 text-primary',
                          )}
                        >
                          {f.isRequired ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-label font-bold text-sm text-on-surface">
                            {f.instance.name}
                          </h3>
                          <p className="font-label text-[10px] text-on-surface-variant">
                            {TRIGGER_LABELS[f.trigger]} ·{' '}
                            {CATEGORY_LABELS[f.instance.category as FormCategory]}
                          </p>
                        </div>
                        {f.isRequired && (
                          <span className="rounded-full bg-secondary/10 text-secondary px-2 py-0.5 text-[9px] font-bold font-label tracking-wider">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      {f.instance.description && (
                        <p className="font-label text-xs text-on-surface-variant line-clamp-2">
                          {f.instance.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setPreviewForm(f)}
                        >
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => setSelectedForm(f)}
                        >
                          Fill Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Submitted forms ── */}
      {submitted.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Your Submitted Forms
            <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
              {submitted.length}
            </span>
          </h2>
          <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary divide-y divide-surface-container/50 overflow-hidden">
            {submitted.map((f) => (
              <div
                key={f.assignmentId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label text-sm font-bold text-on-surface">{f.instance.name}</p>
                  <p className="font-label text-[10px] text-on-surface-variant flex items-center gap-1">
                    <Building2 className="h-2.5 w-2.5" />
                    {f.tenant.name} · {TRIGGER_LABELS[f.trigger]}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold font-label">
                  Submitted
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Fill-form dialog ── */}
      <Dialog
        open={!!selectedForm}
        onOpenChange={(o) => {
          if (!o) setSelectedForm(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {selectedForm && (
            <>
              <DialogTitle className="font-headline text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {selectedForm.instance.name}
              </DialogTitle>
              <DialogDescription className="space-y-1">
                <span className="block">
                  {selectedForm.instance.description || 'Please fill in the form below.'}
                </span>
                <span className="block text-[10px] flex items-center gap-1.5 mt-1">
                  <Building2 className="h-3 w-3" />
                  {selectedForm.tenant.name}
                </span>
              </DialogDescription>
              <div className="mt-3 rounded-lg bg-surface-container-low p-4">
                <FormRenderer
                  schema={selectedForm.instance.schema}
                  onSubmit={handleSubmit}
                  isSubmitting={submitMutation.isPending}
                  submitLabel="Submit Form"
                  onCancel={() => setSelectedForm(null)}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Preview dialog ── */}
      {previewForm && (
        <FormPreviewDialog
          open={!!previewForm}
          onClose={() => setPreviewForm(null)}
          schema={previewForm.instance.schema}
          title={previewForm.instance.name}
          description={previewForm.instance.description}
          meta={[
            { label: 'Hospital', value: previewForm.tenant.name },
            { label: 'Trigger', value: TRIGGER_LABELS[previewForm.trigger] },
            ...(previewForm.isRequired
              ? [{ label: 'Status', value: 'Required', badgeClass: 'bg-secondary/10 text-secondary' }]
              : []),
          ]}
          primaryAction={{
            label: 'Fill Now',
            icon: FileText,
            onClick: () => {
              setSelectedForm(previewForm);
              setPreviewForm(null);
            },
          }}
        />
      )}
    </div>
  );
}
