'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Save, RotateCcw, Eye } from 'lucide-react';
import { useSystemForm, useUpsertHospitalFormConfig } from '@/hooks/use-forms';
import { FormBuilder } from '@/components/forms/form-builder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FormPreviewDialog } from '@/components/forms/form-preview-dialog';
import { TRIGGER_LABELS, CATEGORY_LABELS, MODULE_LABELS, ROLE_OPTIONS } from '@/types/forms';
import type { FormSchema, RoleSetting } from '@/types/forms';

export default function EditHospitalFormConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: form, isLoading } = useSystemForm(id);
  const upsertMutation = useUpsertHospitalFormConfig();

  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [roleSettings, setRoleSettings] = useState<Record<string, RoleSetting>>({});
  const [initialized, setInitialized] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize from fetched form + hospital config
  if (form && !initialized) {
    const config = form.hospitalConfigs?.[0];
    setSchema(config?.schemaOverride || form.schema);
    setRoleSettings(config?.roleSettings || form.defaultRoleSettings || {});
    setIsCustomized(!!config?.schemaOverride);
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
      await upsertMutation.mutateAsync({
        formId: id,
        schemaOverride: isCustomized ? schema : null,
        roleSettings,
      });
      toast.success('Form configuration saved');
      router.push('/hospital/settings/forms');
    } catch {
      toast.error('Failed to save configuration');
    }
  };

  const handleResetToDefault = () => {
    setSchema(form.schema);
    setIsCustomized(false);
    toast.info('Schema reset to system default. Save to apply.');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/hospital/settings/forms')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-headline font-bold">Customize: {form.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{TRIGGER_LABELS[form.trigger] || form.trigger}</Badge>
            <Badge variant="secondary">{CATEGORY_LABELS[form.category] || form.category}</Badge>
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">{MODULE_LABELS[form.module] || form.module}</Badge>
            {isCustomized && <Badge className="bg-amber-100 text-amber-800">Custom Schema</Badge>}
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
        <Button onClick={handleSave} disabled={upsertMutation.isPending} className="gap-2">
          {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      <Separator />

      {/* Role Settings */}
      <div className="space-y-3">
        <h2 className="text-sm font-headline font-bold">Role Settings for Your Hospital</h2>
        <p className="text-xs text-muted-foreground">
          Override the default role visibility for this form in your hospital.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_OPTIONS.filter((r) => (form.applicableRoles ?? []).includes(r.slug)).map((role) => {
            const defaultVal = form.defaultRoleSettings?.[role.slug] || 'hidden';
            const current = roleSettings[role.slug] || defaultVal;
            return (
              <div key={role.slug} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{role.label}</p>
                  <p className="text-[10px] text-muted-foreground">Default: {defaultVal}</p>
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

      {/* Form Fields (Schema Override) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-headline font-bold">Form Fields</h2>
            <p className="text-xs text-muted-foreground">
              {isCustomized ? 'Using custom schema for your hospital.' : 'Using system default schema. Edit to customize.'}
            </p>
          </div>
          {isCustomized && (
            <Button variant="outline" size="sm" onClick={handleResetToDefault} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Default
            </Button>
          )}
        </div>
        {schema && (
          <FormBuilder
            value={schema}
            onChange={(s) => { setSchema(s); setIsCustomized(true); }}
          />
        )}
      </div>

      {/* Preview Dialog */}
      {schema && (
        <FormPreviewDialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          schema={schema}
          title={form.name}
          description={form.description}
          meta={[
            { label: 'Trigger', value: TRIGGER_LABELS[form.trigger] || form.trigger },
            { label: 'Category', value: CATEGORY_LABELS[form.category] || form.category },
          ]}
        />
      )}
    </div>
  );
}
