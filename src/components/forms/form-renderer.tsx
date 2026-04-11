'use client';

import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/date-utils';
import type { FormField, FormSchema } from '@/types/forms';

// ─────────────────────────────────────────────────────────
// Build a Zod schema dynamically from the form blueprint
// ─────────────────────────────────────────────────────────

function buildZodSchema(schema: FormSchema): z.ZodType {
  const shape: Record<string, z.ZodType> = {};

  for (const f of schema.fields) {
    if (f.type === 'section_header') continue;

    let base: z.ZodType;

    switch (f.type) {
      case 'number': {
        let n: z.ZodNumber = z.number({ invalid_type_error: `${f.label} must be a number` } as never);
        if (f.validation?.min !== undefined) n = n.min(f.validation.min);
        if (f.validation?.max !== undefined) n = n.max(f.validation.max);
        base = n;
        break;
      }
      case 'email':
        base = z.string().email(`${f.label} must be a valid email`);
        break;
      case 'phone':
        base = z.string().min(7, `${f.label} too short`).max(20);
        break;
      case 'multi_select':
        base = z.array(z.string());
        break;
      case 'checkbox':
        base = z.boolean();
        break;
      case 'date':
      case 'time':
      case 'datetime':
      case 'file':
      case 'signature':
        base = z.string();
        break;
      default: {
        let s: z.ZodString = z.string();
        if (f.validation?.minLength !== undefined) s = s.min(f.validation.minLength);
        if (f.validation?.maxLength !== undefined) s = s.max(f.validation.maxLength);
        if (f.validation?.pattern) {
          try {
            const re = new RegExp(f.validation.pattern);
            s = s.regex(re, f.validation.patternMessage || 'Invalid format');
          } catch {
            // ignore bad regex
          }
        }
        base = s;
        break;
      }
    }

    if (f.required) {
      if (f.type === 'multi_select') {
        base = (base as z.ZodArray<z.ZodString>).min(1, `${f.label} is required`);
      } else if (f.type === 'checkbox') {
        base = (base as z.ZodBoolean).refine((v) => v === true, `${f.label} is required`);
      } else if (f.type !== 'number') {
        base = (base as z.ZodString).min(1, `${f.label} is required`);
      }
    } else {
      base = base.optional().or(z.literal('').or(z.null())) as never;
    }

    shape[f.id] = base;
  }

  return z.object(shape);
}

function widthClass(width: FormField['width']): string {
  switch (width) {
    case 'half':
      return 'sm:col-span-3';
    case 'third':
      return 'sm:col-span-2';
    default:
      return 'sm:col-span-6';
  }
}

interface FormRendererProps {
  schema: FormSchema;
  /** Pre-fill responses (used for read-only / verified views) */
  initialValues?: Record<string, unknown>;
  /** Read-only mode (for viewing submitted forms) */
  readOnly?: boolean;
  /** Called when the user submits the form */
  onSubmit?: (responses: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: string;
  /** Called when the user clicks Cancel (optional) */
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/**
 * Renders a form from a JSON blueprint.
 * - Builds a Zod validator on the fly from field definitions.
 * - Submits a flat { fieldId: value } responses object.
 * - Read-only mode renders fields as plain text (used for viewing submissions).
 */
export function FormRenderer({
  schema,
  initialValues,
  readOnly = false,
  onSubmit,
  submitLabel = 'Submit',
  onCancel,
  isSubmitting = false,
}: FormRendererProps) {
  const zodSchema = useMemo(() => buildZodSchema(schema), [schema]);
  const defaults = useMemo(() => {
    const d: Record<string, unknown> = {};
    for (const f of schema.fields) {
      if (f.type === 'section_header') continue;
      if (initialValues && f.id in initialValues) {
        d[f.id] = initialValues[f.id];
      } else if (f.defaultValue !== undefined) {
        d[f.id] = f.defaultValue;
      } else if (f.type === 'checkbox') {
        d[f.id] = false;
      } else if (f.type === 'multi_select') {
        d[f.id] = [];
      } else {
        d[f.id] = '';
      }
    }
    return d;
  }, [schema, initialValues]);

  const {
    handleSubmit,
    control,
    register,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(zodSchema as never),
    defaultValues: defaults,
  });

  // Group fields by section header for better visual hierarchy
  const sections = useMemo(() => groupBySection(schema.fields), [schema]);

  // ─────────────────────────────────────────────────────
  // READ-ONLY MODE — display submitted values
  // ─────────────────────────────────────────────────────
  if (readOnly) {
    return (
      <div className="space-y-6">
        {sections.map((section, si) => (
          <section key={si} className="space-y-3">
            {section.header && <SectionHeading field={section.header} />}
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              {section.fields.map((f) => {
                const value = initialValues?.[f.id];
                const display = formatReadOnlyValue(f, value);
                const hasValue = display !== '';
                return (
                  <div
                    key={f.id}
                    className={cn(
                      'rounded-lg border border-border/60 bg-card px-3.5 py-2.5',
                      widthClass(f.width),
                    )}
                  >
                    <div className="text-[10px] font-label uppercase tracking-wider text-muted-foreground/80 mb-1">
                      {f.label}
                    </div>
                    <div
                      className={cn(
                        'text-sm break-words leading-relaxed',
                        hasValue
                          ? 'font-medium text-foreground whitespace-pre-wrap'
                          : 'italic text-muted-foreground/60',
                      )}
                    >
                      {hasValue ? display : 'Not provided'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // INTERACTIVE MODE — fill the form
  // ─────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        if (onSubmit) await onSubmit(data as Record<string, unknown>);
      })}
      className="space-y-7"
    >
      {sections.map((section, si) => (
        <section key={si} className="space-y-4">
          {section.header && <SectionHeading field={section.header} />}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-4">
            {section.fields.map((f) => {
              const error = (errors as Record<string, { message?: string }>)[f.id];
              return (
                <div key={f.id} className={cn('space-y-1.5', widthClass(f.width))}>
                  <Label
                    htmlFor={f.id}
                    className="text-xs font-semibold text-foreground/90 flex items-center gap-1"
                  >
                    <span>{f.label}</span>
                    {f.required && (
                      <span className="text-destructive font-bold" aria-label="required">
                        *
                      </span>
                    )}
                  </Label>

                  {renderInput(f, control, register)}

                  {f.helpText && (
                    <p className="text-[10px] text-muted-foreground/80">{f.helpText}</p>
                  )}
                  {error?.message && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <span>⚠</span> {error.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────
// Section grouping & header rendering
// ─────────────────────────────────────────────────────────

interface FormSection {
  header: FormField | null;
  fields: FormField[];
}

function groupBySection(fields: FormField[]): FormSection[] {
  const sections: FormSection[] = [];
  let current: FormSection = { header: null, fields: [] };

  for (const f of fields) {
    if (f.type === 'section_header') {
      if (current.header || current.fields.length > 0) sections.push(current);
      current = { header: f, fields: [] };
    } else {
      current.fields.push(f);
    }
  }
  if (current.header || current.fields.length > 0) sections.push(current);
  return sections;
}

function SectionHeading({ field }: { field: FormField }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-1 bg-primary rounded-full" />
        <h3 className="font-headline text-sm font-bold uppercase tracking-wider text-foreground">
          {field.label}
        </h3>
      </div>
      {field.helpText && (
        <p className="text-xs text-muted-foreground ml-3.5">{field.helpText}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Per-field input renderers
// ─────────────────────────────────────────────────────────

function renderInput(
  f: FormField,
  control: ReturnType<typeof useForm>['control'],
  register: ReturnType<typeof useForm>['register'],
) {
  switch (f.type) {
    case 'textarea':
      return <Textarea id={f.id} placeholder={f.placeholder} rows={3} {...register(f.id)} />;
    case 'number':
      return (
        <Input
          id={f.id}
          type="number"
          placeholder={f.placeholder}
          {...register(f.id, { valueAsNumber: true })}
        />
      );
    case 'email':
      return <Input id={f.id} type="email" placeholder={f.placeholder} {...register(f.id)} />;
    case 'phone':
      return <Input id={f.id} type="tel" placeholder={f.placeholder} {...register(f.id)} />;
    case 'date':
      return <Input id={f.id} type="date" {...register(f.id)} />;
    case 'time':
      return <Input id={f.id} type="time" {...register(f.id)} />;
    case 'datetime':
      return <Input id={f.id} type="datetime-local" {...register(f.id)} />;
    case 'file':
      return <Input id={f.id} type="file" {...register(f.id)} />;
    case 'signature':
      return (
        <Input
          id={f.id}
          type="text"
          placeholder="Type your full name to sign"
          {...register(f.id)}
        />
      );
    case 'select':
      return (
        <Controller
          control={control}
          name={f.id}
          render={({ field }) => (
            <Select
              value={(field.value as string) || ''}
              onValueChange={(v) => field.onChange(v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder={f.placeholder || 'Select…'} />
              </SelectTrigger>
              <SelectContent>
                {(f.options || []).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      );
    case 'radio':
      return (
        <Controller
          control={control}
          name={f.id}
          render={({ field }) => (
            <div className="flex flex-wrap gap-3">
              {(f.options || []).map((o) => (
                <label key={o.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={f.id}
                    value={o.value}
                    checked={field.value === o.value}
                    onChange={() => field.onChange(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          )}
        />
      );
    case 'multi_select':
      return (
        <Controller
          control={control}
          name={f.id}
          render={({ field }) => {
            const selected = (field.value as string[]) || [];
            return (
              <div className="flex flex-wrap gap-3">
                {(f.options || []).map((o) => {
                  const checked = selected.includes(o.value);
                  return (
                    <label
                      key={o.value}
                      className="flex items-center gap-1.5 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) field.onChange([...selected, o.value]);
                          else field.onChange(selected.filter((v) => v !== o.value));
                        }}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            );
          }}
        />
      );
    case 'checkbox':
      return (
        <Controller
          control={control}
          name={f.id}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!field.value}
                onChange={(e) => field.onChange(e.target.checked)}
              />
              {f.placeholder || 'Yes'}
            </label>
          )}
        />
      );
    default:
      return <Input id={f.id} type="text" placeholder={f.placeholder} {...register(f.id)} />;
  }
}

function formatReadOnlyValue(f: FormField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  // Multi-valued fields
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (f.options) {
      return value
        .map((v) => f.options!.find((o) => o.value === v)?.label || String(v))
        .join(', ');
    }
    return value.join(', ');
  }

  // Booleans → Yes/No
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  // Dates → dd/MM/yyyy (project convention)
  if (f.type === 'date' && typeof value === 'string') {
    return formatDate(value);
  }
  if (f.type === 'datetime' && typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hh}:${mm}`;
      }
    } catch {
      // fall through
    }
    return value;
  }
  if (f.type === 'time' && typeof value === 'string') {
    return value;
  }

  // Single-value fields with options (select / radio) → label
  if (f.options) {
    const opt = f.options.find((o) => o.value === value);
    if (opt) return opt.label;
  }

  return String(value);
}
