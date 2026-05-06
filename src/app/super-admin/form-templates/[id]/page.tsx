'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormBuilder } from '@/components/forms/form-builder';
import { useTemplateDetail, useUpdateTemplate } from '@/hooks/use-forms';

export default function SuperAdminFormTemplateBuilderPage(
  props: { params: Promise<{ id: string }> },
) {
  const router = useRouter();
  const { id } = use(props.params);
  const { data, isLoading } = useTemplateDetail(id);
  const updateTpl = useUpdateTemplate(id);
  const tpl = data?.data;

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  if (!tpl) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Template not found.{' '}
        <Button variant="link" onClick={() => router.push('/super-admin/form-templates')}>
          Back to list
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
          onClick={() => router.push('/super-admin/form-templates')}
          className="gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All templates
        </Button>
        <div className="text-xs text-muted-foreground">
          v{tpl.version} · {tpl._count?.hospitalForms ?? 0} hospital clone(s)
        </div>
      </div>

      <FormBuilder
        publishLabelMode="template"
        initial={{
          name: tpl.name,
          description: tpl.description ?? undefined,
          category: tpl.category,
          schema: tpl.schema,
          isPublished: tpl.isPublished,
        }}
        isSaving={updateTpl.isPending}
        onSave={async (payload) => {
          try {
            await updateTpl.mutateAsync(payload);
            toast.success('Template saved');
          } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
            toast.error(msg);
          }
        }}
      />
    </div>
  );
}
