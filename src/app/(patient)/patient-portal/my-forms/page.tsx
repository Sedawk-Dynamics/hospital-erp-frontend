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
//
// One-stop place where the patient can:
//   • See ALL forms hospitals have made visible to them (across every
//     hospital where they have a Patient record)
//   • Click any form to fill it on demand
//   • See their past submissions
//
// This is the safety-net surface so patients can always find their forms
// regardless of which workflow trigger the admin picked.
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

  // Group "to fill" forms by hospital
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
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Forms</h1>
            <p className="text-xs text-muted-foreground">
              Forms you can fill for hospitals you've visited.
            </p>
          </div>
        </div>
        {requiredCount > 0 && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-center shrink-0">
            <p className="font-headline text-lg font-bold text-amber-900">{requiredCount}</p>
            <p className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider">
              Required
            </p>
          </div>
        )}
      </div>

      {/* ── Forms to fill ── */}
      <section className="space-y-3">
        <h2 className="font-headline text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Forms to Fill
          {toFill.length > 0 && (
            <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
              {toFill.length}
            </span>
          )}
        </h2>

        {isLoading ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        ) : toFill.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium">No forms to fill right now</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              When a hospital you've booked with assigns a form to you, it'll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {formsByHospital.map(({ tenant, forms }) => (
              <div key={tenant.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-bold text-foreground">
                    {tenant.name}
                    {tenant.city && <span className="text-muted-foreground"> · {tenant.city}</span>}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {forms.map((f) => (
                    <div
                      key={f.assignmentId}
                      className={cn(
                        'rounded-xl border-2 bg-card p-4 flex flex-col gap-3',
                        f.isRequired ? 'border-amber-300 bg-amber-50/30' : 'border-border',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                            f.isRequired ? 'bg-amber-100' : 'bg-primary/10',
                          )}
                        >
                          {f.isRequired ? (
                            <AlertCircle className="h-4 w-4 text-amber-700" />
                          ) : (
                            <FileText className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm">{f.instance.name}</h3>
                          <p className="text-[10px] text-muted-foreground">
                            {TRIGGER_LABELS[f.trigger]} ·{' '}
                            {CATEGORY_LABELS[f.instance.category as FormCategory]}
                          </p>
                        </div>
                        {f.isRequired && (
                          <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      {f.instance.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
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

      {/* ── Submitted forms — patient sees their own submissions across all hospitals ── */}
      {submitted.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="font-headline text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Your Submitted Forms
            <span className="rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5">
              {submitted.length}
            </span>
          </h2>
          <div className="rounded-xl border bg-card divide-y">
            {submitted.map((f) => (
              <div
                key={f.assignmentId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{f.instance.name}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-2.5 w-2.5" />
                    {f.tenant.name} · {TRIGGER_LABELS[f.trigger]}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
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
              <div className="mt-3 rounded-lg border bg-muted/20 p-4">
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
              ? [{ label: 'Status', value: 'Required', badgeClass: 'bg-amber-100 text-amber-800' }]
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
