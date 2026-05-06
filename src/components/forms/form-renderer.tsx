'use client';

// Renders a dynamic form schema as an editable form. Used by:
//   - the form builder's preview pane
//   - the nurse "+ New submission" dialog
//
// Validation philosophy: keep it minimal here — required + type checks +
// option whitelist. The backend re-validates everything in
// `forms.service.ts:validateAndNormalizeSubmissionData`, so this is just
// for fast UX feedback.

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormField, FormSchema } from '@/hooks/use-forms';

type FormValue = string | number | boolean | string[] | null;
type FormValues = Record<string, FormValue>;

interface FormRendererProps {
  schema: FormSchema;
  defaultValues?: Record<string, unknown>;
  onSubmit: (values: FormValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  // When true, renders fields read-only (used by FormSubmissionView).
  readOnly?: boolean;
}

function widthClass(w?: 'full' | 'half' | 'third') {
  if (w === 'half') return 'sm:col-span-6';
  if (w === 'third') return 'sm:col-span-4';
  return 'sm:col-span-12';
}

function initialValueFor(field: FormField, override: unknown): FormValue {
  if (override !== undefined && override !== null) {
    if (field.type === 'multiselect' && Array.isArray(override)) return override.map(String);
    if (field.type === 'checkbox') return Boolean(override);
    if (field.type === 'number') {
      const n = typeof override === 'number' ? override : Number(override);
      return Number.isFinite(n) ? n : null;
    }
    return String(override);
  }
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    if (field.type === 'multiselect' && Array.isArray(field.defaultValue)) {
      return (field.defaultValue as string[]).slice();
    }
    if (field.type === 'checkbox') return Boolean(field.defaultValue);
    if (field.type === 'number') {
      const n = Number(field.defaultValue);
      return Number.isFinite(n) ? n : null;
    }
    return String(field.defaultValue);
  }
  if (field.type === 'multiselect') return [];
  if (field.type === 'checkbox') return false;
  return null;
}

function buildInitialState(schema: FormSchema, defaults?: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of schema.fields) {
    if (f.type === 'section' || f.type === 'divider') continue;
    out[f.key] = initialValueFor(f, defaults?.[f.key]);
  }
  return out;
}

export function FormRenderer({
  schema,
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  readOnly = false,
}: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(() => buildInitialState(schema, defaultValues));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset internal state if the schema reference changes (e.g. user picks a
  // different form in the same dialog instance).
  useEffect(() => {
    setValues(buildInitialState(schema, defaultValues));
    setErrors({});
  }, [schema, defaultValues]);

  const dataFields = useMemo(
    () => schema.fields.filter((f) => f.type !== 'section' && f.type !== 'divider'),
    [schema],
  );

  function setField(key: string, v: FormValue) {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  function validate(): { ok: boolean; errors: Record<string, string> } {
    const e: Record<string, string> = {};
    for (const f of dataFields) {
      const v = values[f.key];
      const empty =
        v === null ||
        v === undefined ||
        v === '' ||
        (Array.isArray(v) && v.length === 0);
      if (f.required && empty) {
        e[f.key] = `${f.label} is required`;
        continue;
      }
      if (f.type === 'number' && v !== null && v !== '') {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) {
          e[f.key] = 'Must be a number';
        } else if (f.min != null && n < f.min) {
          e[f.key] = `Must be ≥ ${f.min}`;
        } else if (f.max != null && n > f.max) {
          e[f.key] = `Must be ≤ ${f.max}`;
        }
      }
    }
    return { ok: Object.keys(e).length === 0, errors: e };
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (readOnly) return;
    const { ok, errors: errs } = validate();
    if (!ok) {
      setErrors(errs);
      return;
    }
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-12 gap-3">
        {schema.fields.map((field) => {
          if (field.type === 'section') {
            return (
              <div key={field.id} className="col-span-12 mt-2">
                <h3 className="text-sm font-semibold text-foreground border-b pb-1">{field.label}</h3>
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{field.helpText}</p>
                )}
              </div>
            );
          }
          if (field.type === 'divider') {
            return <hr key={field.id} className="col-span-12 border-border my-1" />;
          }

          const v = values[field.key];
          const err = errors[field.key];
          const labelEl = (
            <Label className="text-xs font-medium">
              {field.label}
              {field.required && <span className="ml-0.5 text-destructive">*</span>}
              {field.unit && <span className="ml-1 text-[10px] text-muted-foreground">({field.unit})</span>}
            </Label>
          );

          let control: React.ReactNode;
          switch (field.type) {
            case 'text':
              control = (
                <Input
                  value={(v as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder ?? undefined}
                  maxLength={field.maxLength ?? undefined}
                  disabled={readOnly}
                />
              );
              break;
            case 'textarea':
              control = (
                <Textarea
                  value={(v as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder ?? undefined}
                  rows={field.rows ?? 3}
                  maxLength={field.maxLength ?? undefined}
                  disabled={readOnly}
                />
              );
              break;
            case 'number':
              control = (
                <Input
                  type="number"
                  value={v === null || v === undefined ? '' : String(v)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setField(field.key, raw === '' ? null : Number(raw));
                  }}
                  placeholder={field.placeholder ?? undefined}
                  min={field.min ?? undefined}
                  max={field.max ?? undefined}
                  step={field.step ?? undefined}
                  disabled={readOnly}
                />
              );
              break;
            case 'date':
              control = (
                <Input
                  type="date"
                  value={(v as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value || null)}
                  disabled={readOnly}
                />
              );
              break;
            case 'datetime':
              control = (
                <Input
                  type="datetime-local"
                  value={(v as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value || null)}
                  disabled={readOnly}
                />
              );
              break;
            case 'select': {
              const options = field.options ?? [];
              control = (
                <Select
                  value={(v as string) || null}
                  onValueChange={(value) => setField(field.key, value ?? null)}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={field.placeholder ?? 'Select…'}>
                      {(val) => {
                        if (!val) return null;
                        const opt = options.find((o) => o.value === val);
                        return opt?.label ?? val;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
              break;
            }
            case 'multiselect': {
              const options = field.options ?? [];
              const selected = Array.isArray(v) ? (v as string[]) : [];
              control = (
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o) => {
                    const active = selected.includes(o.value);
                    return (
                      <button
                        type="button"
                        key={o.value}
                        disabled={readOnly}
                        onClick={() => {
                          const next = active
                            ? selected.filter((s) => s !== o.value)
                            : [...selected, o.value];
                          setField(field.key, next);
                        }}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-surface-container-low border-border hover:bg-surface-container',
                          readOnly && 'opacity-70 cursor-not-allowed',
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              );
              break;
            }
            case 'radio': {
              const options = field.options ?? [];
              control = (
                <div className="flex flex-col gap-1.5">
                  {options.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={field.key}
                        value={o.value}
                        checked={v === o.value}
                        onChange={() => setField(field.key, o.value)}
                        disabled={readOnly}
                        className="h-4 w-4 accent-primary"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              );
              break;
            }
            case 'checkbox':
              control = (
                <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={Boolean(v)}
                    onChange={(e) => setField(field.key, e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{field.placeholder ?? 'Yes'}</span>
                </label>
              );
              break;
            default:
              control = null;
          }

          return (
            <div key={field.id} className={cn('col-span-12', widthClass(field.width))}>
              <div className="flex flex-col gap-1.5">
                {labelEl}
                {control}
                {field.helpText && (
                  <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                )}
                {err && <p className="text-[11px] text-destructive">{err}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex justify-end gap-2 pt-2 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
