'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormBuilder, type FormBuilderSavePayload } from '@/components/forms/form-builder';
import { hospitalFormStatus } from '@/components/forms/form-status';
import {
  useDiscardHospitalFormDraft,
  useHospitalFormDetail,
  useUpdateHospitalForm,
} from '@/hooks/use-forms';

function errorMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export default function HospitalFormBuilderPage(props: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(props.params);
  const { data, isLoading } = useHospitalFormDetail(id);
  const updateForm = useUpdateHospitalForm(id);
  const publishForm = useUpdateHospitalForm(id);
  const discardDraft = useDiscardHospitalFormDraft(id);
  const form = data?.data;
  // Gap 304: a stable `initial` — a fresh object every render re-hydrated the
  // builder (wiping local edits) and made its dirty/live status unreliable.
  // The builder edits the unpublished draft when there is one; otherwise the
  // published (or never-published) schema.
  const initial = useMemo(
    () =>
      form
        ? {
            name: form.name,
            description: form.description ?? undefined,
            category: form.category,
            schema: form.draftSchema ?? form.schema,
            isPublished: form.isPublished,
          }
        : undefined,
    [form],
  );

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Form not found.{' '}
        <Button variant="link" onClick={() => router.push('/hospital/settings/forms')}>
          Back to forms
        </Button>
      </div>
    );
  }

  // Same server-derived status the forms list shows.
  const status = hospitalFormStatus(form);
  const publishedVersion = form.publishedVersion ?? (form.isPublished ? form.version : null);

  // Save without `isPublished`: on a published form a save only updates the
  // draft, and nurses keep the published version until Publish.
  function draftBody(payload: FormBuilderSavePayload) {
    return {
      name: payload.name,
      description: payload.description,
      category: payload.category,
      schema: payload.schema,
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/hospital/settings/forms')}
          className="gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All forms
        </Button>
        <div className="text-xs text-muted-foreground">
          {publishedVersion != null ? `Published v${publishedVersion}` : 'Not yet published'} ·{' '}
          {form._count?.submissions ?? 0} submission(s)
          {form.archivedAt && (
            <span className="ml-2 text-destructive font-semibold">Archived</span>
          )}
        </div>
      </div>

      {form.archivedAt && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This form is deleted (archived). Restore it from the Deleted tab to enable editing.
        </div>
      )}

      {!form.archivedAt && form.hasUnpublishedChanges && (
        <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          You are editing unpublished changes. Nurses still fill v{publishedVersion} until you publish.
        </div>
      )}

      <FormBuilder
        publishLabelMode="hospital"
        initial={initial}
        isSaving={updateForm.isPending}
        publication={{
          status,
          publishedVersion,
          hasUnpublishedChanges: !!form.hasUnpublishedChanges,
          isPublishing: publishForm.isPending,
          isDiscarding: discardDraft.isPending,
          disabled: !!form.archivedAt,
          onPublish: async (payload) => {
            if (form.archivedAt) {
              toast.error('Restore the form before publishing');
              return;
            }
            try {
              // One request: save the editor state and publish it.
              const res = await publishForm.mutateAsync({ ...draftBody(payload), isPublished: true });
              toast.success(`Published v${res.data?.version ?? ''} — nurses now see this version`);
            } catch (e: unknown) {
              toast.error(errorMessage(e, 'Publish failed'));
            }
          },
          onDiscardDraft: async () => {
            try {
              await discardDraft.mutateAsync();
              toast.success('Unpublished changes discarded');
            } catch (e: unknown) {
              toast.error(errorMessage(e, 'Discard failed'));
            }
          },
        }}
        onSave={async (payload) => {
          if (form.archivedAt) {
            toast.error('Restore the form before editing');
            return;
          }
          try {
            const res = await updateForm.mutateAsync(draftBody(payload));
            toast.success(
              res.data?.status === 'published_with_changes'
                ? 'Draft saved — not visible to nurses until published'
                : 'Form saved',
            );
          } catch (e: unknown) {
            toast.error(errorMessage(e, 'Save failed'));
          }
        }}
      />
    </div>
  );
}
