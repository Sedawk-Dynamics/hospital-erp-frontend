'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormBuilder } from '@/components/forms/form-builder';
import { useHospitalFormDetail, useUpdateHospitalForm } from '@/hooks/use-forms';

export default function HospitalFormBuilderPage(props: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(props.params);
  const { data, isLoading } = useHospitalFormDetail(id);
  const updateForm = useUpdateHospitalForm(id);
  const form = data?.data;

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
          v{form.version} · {form._count?.submissions ?? 0} submission(s)
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

      <FormBuilder
        publishLabelMode="hospital"
        initial={{
          name: form.name,
          description: form.description ?? undefined,
          category: form.category,
          schema: form.schema,
          isPublished: form.isPublished,
        }}
        isSaving={updateForm.isPending}
        onSave={async (payload) => {
          if (form.archivedAt) {
            toast.error('Restore the form before editing');
            return;
          }
          try {
            await updateForm.mutateAsync(payload);
            toast.success('Form saved');
          } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
            toast.error(msg);
          }
        }}
      />
    </div>
  );
}
