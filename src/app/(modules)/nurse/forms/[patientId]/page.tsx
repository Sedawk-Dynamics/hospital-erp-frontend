'use client';

// /nurse/forms/[patientId] — per-patient dynamic form workspace.
// Layout: search bar, then category tabs (All + each category that has at
// least one form + Recent submissions). Each tab renders a card grid of
// the available forms, with Preview + Fill actions and the latest
// submission for this patient inlined on the card.

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  Eye,
  FileText,
  History,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { usePatientDetail } from '@/hooks/use-doctor';
import {
  useHospitalForms,
  useFormSubmissions,
  useCreateSubmission,
  FORM_CATEGORIES,
  type FormCategory,
  type HospitalForm,
  type FormSubmission,
} from '@/hooks/use-forms';
import { FormRenderer } from '@/components/forms/form-renderer';
import { FormSubmissionView } from '@/components/forms/form-submission-view';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';

// Soft category accent so each card visually anchors to a category. Using
// HSL-ish utility classes already in the design system rather than
// importing new tokens.
const CATEGORY_TINT: Record<FormCategory, string> = {
  assessment: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  screening: 'bg-violet-50 text-violet-700 ring-violet-200',
  intake: 'bg-sky-50 text-sky-700 ring-sky-200',
  vitals: 'bg-rose-50 text-rose-700 ring-rose-200',
  daily_note: 'bg-amber-50 text-amber-700 ring-amber-200',
  procedure: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  discharge: 'bg-teal-50 text-teal-700 ring-teal-200',
  other: 'bg-slate-100 text-slate-700 ring-slate-200',
};

// Pill-tab styling. Overrides the global TabsTrigger defaults
// (flex-1 + bg-primary on active) using the `!` important modifier so the
// active state can take a per-category tint instead.
const TAB_BASE =
  '!flex-none rounded-full px-3.5 py-1.5 text-[11px] gap-1.5 !bg-transparent ring-1 ring-inset ring-border/60 text-muted-foreground hover:!bg-surface-container-low hover:!text-foreground transition-all data-active:!shadow-sm';

const CATEGORY_TAB_ACTIVE: Record<FormCategory, string> = {
  assessment:
    'data-active:!bg-emerald-100 data-active:!text-emerald-800 data-active:!ring-emerald-300',
  screening:
    'data-active:!bg-violet-100 data-active:!text-violet-800 data-active:!ring-violet-300',
  intake: 'data-active:!bg-sky-100 data-active:!text-sky-800 data-active:!ring-sky-300',
  vitals: 'data-active:!bg-rose-100 data-active:!text-rose-800 data-active:!ring-rose-300',
  daily_note:
    'data-active:!bg-amber-100 data-active:!text-amber-800 data-active:!ring-amber-300',
  procedure:
    'data-active:!bg-indigo-100 data-active:!text-indigo-800 data-active:!ring-indigo-300',
  discharge: 'data-active:!bg-teal-100 data-active:!text-teal-800 data-active:!ring-teal-300',
  other: 'data-active:!bg-slate-200 data-active:!text-slate-800 data-active:!ring-slate-300',
};

const TAB_ALL_ACTIVE =
  'data-active:!bg-primary/10 data-active:!text-primary data-active:!ring-primary/40';
const TAB_RECENT_ACTIVE =
  'data-active:!bg-slate-100 data-active:!text-slate-800 data-active:!ring-slate-300';

function categoryLabel(c: FormCategory): string {
  return FORM_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

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

  const [search, setSearch] = useState('');
  const [openFill, setOpenFill] = useState<HospitalForm | null>(null);
  const [openView, setOpenView] = useState<FormSubmission | null>(null);
  const [previewForm, setPreviewForm] = useState<HospitalForm | null>(null);

  const forms = useMemo(
    () => (formsQ.data?.data ?? []).filter((f) => f.isPublished && !f.archivedAt),
    [formsQ.data],
  );

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) =>
      [f.name, f.description ?? '', categoryLabel(f.category)]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [forms, search]);

  const formsByCategory = useMemo(() => {
    const map = new Map<FormCategory, HospitalForm[]>();
    for (const f of filteredForms) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return map;
  }, [filteredForms]);
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
  const recentCount = submissionsQ.data?.data?.length ?? 0;

  function renderFormCard(f: HospitalForm) {
    const subs = submissionsByFormId.get(f.id) ?? [];
    const latest = subs[0];
    return (
      <div
        key={f.id}
        className="group flex flex-col rounded-xl border bg-surface-container-lowest p-3.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset',
              CATEGORY_TINT[f.category],
            )}
          >
            {categoryLabel(f.category)}
          </span>
          <span className="rounded-full border bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            v{f.version}
          </span>
        </div>

        <div className="mt-2 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{f.name}</h3>
          {f.description ? (
            <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{f.description}</p>
          ) : (
            <p className="mt-1 text-[11px] italic text-muted-foreground/60">No description</p>
          )}
        </div>

        {/* Latest activity for this patient */}
        <div className="mt-3 rounded-md border border-dashed bg-surface-container-low/60 px-2.5 py-1.5">
          {latest ? (
            <button
              type="button"
              onClick={() => setOpenView(latest)}
              className="flex w-full items-center gap-1.5 text-left text-[11px] text-muted-foreground hover:text-primary"
            >
              <History className="h-3 w-3 shrink-0" />
              <span className="truncate">
                Last: {formatDateTimeAmPm(latest.createdAt)} ·{' '}
                {subs.length} total
              </span>
            </button>
          ) : (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <ClipboardList className="h-3 w-3" />
              No submissions yet
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreviewForm(f)}
            className="h-8 flex-1 gap-1 text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={() => setOpenFill(f)}
            className="h-8 flex-1 gap-1 text-xs"
            disabled={!hasContext}
            title={!hasContext ? 'Pick a visit/admission first' : undefined}
          >
            <Plus className="h-3.5 w-3.5" />
            Fill out
          </Button>
        </div>
      </div>
    );
  }

  function renderGrid(cat: FormCategory) {
    const list = formsByCategory.get(cat) ?? [];
    if (list.length === 0) return null;
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(renderFormCard)}
      </div>
    );
  }

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

      {/* Form catalogue */}
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-headline text-sm font-bold text-foreground">Pick a form to fill</h2>
            <p className="text-[11px] text-muted-foreground">
              {forms.length} form{forms.length === 1 ? '' : 's'} available · {recentCount} prior
              submission{recentCount === 1 ? '' : 's'} for this patient
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search forms by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="mt-4">
          <div className="-mx-1 overflow-x-auto pb-1">
            <TabsList className="!h-auto w-max items-center gap-1.5 !rounded-none !bg-transparent px-1 py-1">
              <TabsTrigger value="all" className={cn(TAB_BASE, TAB_ALL_ACTIVE)}>
                <LayoutGrid className="h-3.5 w-3.5" />
                All
                <span className="ml-0.5 rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  {filteredForms.length}
                </span>
              </TabsTrigger>

              {/* subtle separator between All and the category chips */}
              <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />

              {visibleCats.map((c) => {
                const count = formsByCategory.get(c.value)?.length ?? 0;
                return (
                  <TabsTrigger
                    key={c.value}
                    value={c.value}
                    className={cn(TAB_BASE, CATEGORY_TAB_ACTIVE[c.value])}
                  >
                    {c.label}
                    <span className="ml-0.5 rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}

              {/* separator before the audit-feed tab */}
              <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />

              <TabsTrigger value="recent" className={cn(TAB_BASE, TAB_RECENT_ACTIVE)}>
                <ClipboardList className="h-3.5 w-3.5" />
                Recent
                <span className="ml-0.5 rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  {recentCount}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* All tab — every form grouped by category */}
          <TabsContent value="all" className="mt-4">
            {formsQ.isLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredForms.length === 0 ? (
              <EmptyState
                title={search ? 'No forms match your search' : 'No forms available'}
                hint={
                  search
                    ? 'Try a different keyword.'
                    : 'Ask your hospital admin to publish forms under Settings → Patient Forms.'
                }
              />
            ) : (
              <div className="space-y-6">
                {visibleCats.map((c) => (
                  <section key={c.value}>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset',
                          CATEGORY_TINT[c.value],
                        )}
                      >
                        {c.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formsByCategory.get(c.value)?.length ?? 0} form
                        {(formsByCategory.get(c.value)?.length ?? 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                    {renderGrid(c.value)}
                  </section>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Per-category tabs */}
          {visibleCats.map((c) => (
            <TabsContent key={c.value} value={c.value} className="mt-4">
              {renderGrid(c.value)}
            </TabsContent>
          ))}

          {/* Recent submissions tab */}
          <TabsContent value="recent" className="mt-4">
            {submissionsQ.isLoading ? (
              <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-primary" />
            ) : (submissionsQ.data?.data ?? []).length === 0 ? (
              <EmptyState
                title="No submissions yet"
                hint="Pick a form above and tap Fill out to record the first one."
              />
            ) : (
              <ul className="divide-y rounded-lg border bg-surface-container-lowest">
                {(submissionsQ.data?.data ?? []).map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setOpenView(s)}
                      className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {s.form?.name ?? '—'}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatDateTimeAmPm(s.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        v{s.formVersion} · by{' '}
                        {s.submittedBy
                          ? `${s.submittedBy.firstName} ${s.submittedBy.lastName ?? ''}`
                          : '—'}
                        {s.form?.archivedAt && (
                          <span className="ml-1 text-amber-700">(form deleted)</span>
                        )}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Fill dialog */}
      {openFill && (
        <FillFormDialog
          form={openFill}
          patientId={patientId}
          ctx={{ visitId, admissionId, appointmentId }}
          onClose={() => setOpenFill(null)}
        />
      )}

      {/* Preview dialog */}
      <FormPreviewDialog
        open={!!previewForm}
        onOpenChange={(open) => !open && setPreviewForm(null)}
        name={previewForm?.name ?? ''}
        description={previewForm?.description}
        category={previewForm?.category ?? 'other'}
        version={previewForm?.version}
        schema={previewForm?.schema}
      />

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

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-surface-container-low/40 p-10 text-center">
      <FileText className="mx-auto h-6 w-6 text-muted-foreground/60" />
      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
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
