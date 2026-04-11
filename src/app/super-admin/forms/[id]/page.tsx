'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Save, Eye } from 'lucide-react';
import { useSystemForm, useUpdateSystemForm } from '@/hooks/use-forms';
import { FormBuilder } from '@/components/forms/form-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';
import { TRIGGER_LABELS, CATEGORY_LABELS, MODULE_LABELS, ROLE_OPTIONS, ROLE_SETTING_LABELS } from '@/types/forms';
import type { FormSchema, RoleSetting } from '@/types/forms';

export default function EditSystemFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: form, isLoading } = useSystemForm(id);
  const updateMutation = useUpdateSystemForm();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [roleSettings, setRoleSettings] = useState<Record<string, RoleSetting>>({});
  const [initialized, setInitialized] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize state from fetched form
  if (form && !initialized) {
    setName(form.name);
    setDescription(form.description || '');
    setSchema(form.schema);
    setRoleSettings(form.defaultRoleSettings || {});
    setInitialized(true);
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSave = async () => {
    if (!schema || schema.fields.length === 0) {
      toast.error('Form must have at least one field');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id,
        data: { name, description: description || undefined, schema, defaultRoleSettings: roleSettings },
      });
      toast.success('System form updated');
      router.push('/super-admin/forms');
    } catch {
      toast.error('Failed to update form');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/super-admin/forms')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-headline font-bold">Edit System Form</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{TRIGGER_LABELS[form.trigger] || form.trigger}</Badge>
            <Badge variant="secondary">{CATEGORY_LABELS[form.category] || form.category}</Badge>
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">{MODULE_LABELS[form.module] || form.module}</Badge>
            <span className="text-xs text-muted-foreground">ID: {form.id}</span>
          </div>
          <div className="flex flex-col gap-0.5 mt-1.5 text-xs text-muted-foreground">
            {form.appearsAt && (
              <p><span className="font-semibold text-foreground">Appears:</span> {form.appearsAt}</p>
            )}
            {form.resultsVisibleAt?.length > 0 && (
              <p><span className="font-semibold text-foreground">Results visible in:</span> {form.resultsVisibleAt.join(' · ')}</p>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowPreview(true)} className="gap-2" disabled={!schema}>
          <Eye className="h-4 w-4" />
          Preview
        </Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Separator />

      {/* Name & Description */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Form Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {/* Default Role Settings */}
      <div className="space-y-3">
        <h2 className="text-sm font-headline font-bold">Default Role Settings</h2>
        <p className="text-xs text-muted-foreground">
          Set the default role visibility for all hospitals. Hospitals can override these settings.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_OPTIONS.filter((r) => (form.applicableRoles ?? []).includes(r.slug)).map((role) => {
            const current = roleSettings[role.slug] || 'hidden';
            return (
              <div key={role.slug} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{role.label}</p>
                  <p className="text-[10px] text-muted-foreground">{role.description}</p>
                </div>
                <select
                  value={current}
                  onChange={(e) => setRoleSettings({ ...roleSettings, [role.slug]: e.target.value as RoleSetting })}
                  className="text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="hidden">Hidden</option>
                  <option value="optional">Optional</option>
                  <option value="required">Required</option>
                  <option value="view_only">View Only</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Form Builder */}
      <div className="space-y-3">
        <h2 className="text-sm font-headline font-bold">Form Fields</h2>
        {schema && (
          <FormBuilder value={schema} onChange={setSchema} />
        )}
      </div>

      {/* Preview Dialog */}
      {schema && (
        <FormPreviewDialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          schema={schema}
          title={name || form.name}
          description={description || form.description}
          meta={[
            { label: 'Trigger', value: TRIGGER_LABELS[form.trigger] || form.trigger },
            { label: 'Category', value: CATEGORY_LABELS[form.category] || form.category },
          ]}
        />
      )}
    </div>
  );
}
