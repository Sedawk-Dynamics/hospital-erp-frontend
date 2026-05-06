'use client';

// Read-only render of a saved submission. Uses the form snapshot stored on
// the submission itself, not the current HospitalForm.schema, so the layout
// matches what the nurse actually saw at submit time even after a later
// admin edit or archive.

import { cn } from '@/lib/utils';
import type { FormField, FormSchema } from '@/hooks/use-forms';

interface FormSubmissionViewProps {
  schema: FormSchema;
  data: Record<string, unknown>;
  className?: string;
  // Compact variant for inline patient-detail panels.
  compact?: boolean;
}

function widthClass(w?: 'full' | 'half' | 'third') {
  if (w === 'half') return 'sm:col-span-6';
  if (w === 'third') return 'sm:col-span-4';
  return 'sm:col-span-12';
}

function renderValue(field: FormField, raw: unknown): React.ReactNode {
  if (raw === null || raw === undefined || raw === '') {
    return <span className="text-muted-foreground italic">—</span>;
  }
  switch (field.type) {
    case 'select':
    case 'radio': {
      const opt = (field.options ?? []).find((o) => o.value === raw);
      return <span>{opt?.label ?? String(raw)}</span>;
    }
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      const labels = arr.map((v) => (field.options ?? []).find((o) => o.value === v)?.label ?? v);
      return (
        <div className="flex flex-wrap gap-1">
          {labels.map((l) => (
            <span key={l} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]">
              {l}
            </span>
          ))}
        </div>
      );
    }
    case 'checkbox':
      return <span>{raw ? 'Yes' : 'No'}</span>;
    case 'date': {
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString();
    }
    case 'datetime': {
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString();
    }
    case 'number':
      return (
        <span>
          {String(raw)}
          {field.unit && <span className="ml-1 text-[11px] text-muted-foreground">{field.unit}</span>}
        </span>
      );
    case 'textarea':
      return <p className="whitespace-pre-wrap">{String(raw)}</p>;
    default:
      return <span>{String(raw)}</span>;
  }
}

export function FormSubmissionView({ schema, data, className, compact = false }: FormSubmissionViewProps) {
  return (
    <div className={cn('grid grid-cols-12 gap-3', className)}>
      {schema.fields.map((field) => {
        if (field.type === 'section') {
          return (
            <div key={field.id} className="col-span-12 mt-2">
              <h4 className={cn('font-semibold text-foreground border-b pb-1', compact ? 'text-xs' : 'text-sm')}>
                {field.label}
              </h4>
            </div>
          );
        }
        if (field.type === 'divider') {
          return <hr key={field.id} className="col-span-12 border-border my-1" />;
        }
        return (
          <div key={field.id} className={cn('col-span-12', widthClass(field.width))}>
            <p className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-[11px]')}>{field.label}</p>
            <div className={cn('mt-0.5', compact ? 'text-xs' : 'text-sm')}>
              {renderValue(field, data?.[field.key])}
            </div>
          </div>
        );
      })}
    </div>
  );
}
