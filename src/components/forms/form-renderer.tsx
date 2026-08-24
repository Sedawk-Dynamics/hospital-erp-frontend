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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DURATION_UNITS,
  type FormField,
  type FormSchema,
  type NumberDateValue,
  type PatientAutofillContext,
  type TextDurationValue,
} from '@/hooks/use-forms';

// `text_duration` and `number_date` store an object — their two halves are
// only meaningful together, so they travel as one answer.
type FormValue =
  | string
  | number
  | boolean
  | string[]
  | TextDurationValue
  | NumberDateValue
  | null;
type FormValues = Record<string, FormValue>;

// Clinical forms are filled at the bedside, often on a tablet and often one-
// handed. The 32px controls the admin tables use are too small to hit reliably
// there, so this renderer sets its own comfortable scale instead of inheriting
// the dense app default. Changing these two constants rescales every dynamic
// form in the system.
const CONTROL = 'h-10 text-sm';
const LABEL = 'text-sm font-medium';

// Beyond this many options a plain dropdown stops being scannable and we swap
// in the searchable one.
const SEARCHABLE_SELECT_THRESHOLD = 8;

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
  /**
   * The patient the form is being filled under. Fields marked with an
   * `autofill` source are prefilled from this. Omitted when the form is
   * opened outside a patient context (e.g. the builder's preview), in which
   * case those fields simply start blank.
   */
  patientContext?: PatientAutofillContext | null;
}

function widthClass(w?: 'full' | 'half' | 'third') {
  if (w === 'half') return 'sm:col-span-6';
  if (w === 'third') return 'sm:col-span-4';
  return 'sm:col-span-12';
}

/**
 * Turn a patient attribute into something the field's control can hold.
 * Returns undefined when there is nothing on file, so the caller falls through
 * to the field's own default rather than writing an empty string.
 */
function autofillValueFor(
  field: FormField,
  ctx: PatientAutofillContext | null | undefined,
): unknown {
  if (!field.autofill || !ctx) return undefined;
  const raw = ctx[field.autofill];
  if (raw === undefined || raw === null || raw === '') return undefined;

  // A date-shaped source landing in a date control needs the yyyy-MM-dd form
  // the native input expects; everywhere else the raw value is fine.
  if (field.type === 'date' && typeof raw === 'string') return raw.slice(0, 10);
  if (field.type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return raw;
}

function initialValueFor(field: FormField, override: unknown): FormValue {
  if (override !== undefined && override !== null) {
    if (field.type === 'multiselect' && Array.isArray(override)) return override.map(String);
    if (field.type === 'checkbox') return Boolean(override);
    if (field.type === 'yesno') return Boolean(override);
    if (field.type === 'text_duration') {
      const o = (override ?? {}) as Partial<TextDurationValue>;
      return {
        text: o.text ?? null,
        duration: o.duration ?? null,
        unit: o.unit ?? field.defaultDurationUnit ?? 'days',
      };
    }
    if (field.type === 'number_date') {
      const o = (override ?? {}) as Partial<NumberDateValue>;
      return { value: o.value ?? null, date: o.date ?? null };
    }
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
  // Composites always start as a shaped object so the control never has to
  // cope with half of itself being undefined.
  if (field.type === 'text_duration') {
    return { text: null, duration: null, unit: field.defaultDurationUnit ?? 'days' };
  }
  if (field.type === 'number_date') return { value: null, date: null };
  // yesno is deliberately null, not false — "not answered" is a real state.
  return null;
}

function buildInitialState(
  schema: FormSchema,
  defaults?: Record<string, unknown>,
  patientContext?: PatientAutofillContext | null,
): FormValues {
  const out: FormValues = {};
  for (const f of schema.fields) {
    if (f.type === 'section' || f.type === 'divider') continue;
    // An explicit value wins over autofill — when an old submission is being
    // re-opened, what was actually recorded must not be overwritten by the
    // patient's details as they stand today.
    const override = defaults?.[f.key] ?? autofillValueFor(f, patientContext);
    out[f.key] = initialValueFor(f, override);
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
  patientContext,
}: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(() =>
    buildInitialState(schema, defaultValues, patientContext),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset internal state if the schema reference changes (e.g. user picks a
  // different form in the same dialog instance).
  useEffect(() => {
    setValues(buildInitialState(schema, defaultValues, patientContext));
    setErrors({});
  }, [schema, defaultValues, patientContext]);

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
      // A composite is an object, so the scalar test below never sees it as
      // empty — it is answered when its PRIMARY half is filled (the text of a
      // symptom, the reading of a measurement); the other half qualifies it.
      const empty =
        f.type === 'text_duration'
          ? !(v as TextDurationValue | null)?.text
          : f.type === 'number_date'
            ? (v as NumberDateValue | null)?.value == null
            : v === null ||
              v === undefined ||
              v === '' ||
              (Array.isArray(v) && v.length === 0);
      if (f.required && empty) {
        e[f.key] = `${f.label} is required`;
        continue;
      }
      if ((f.type === 'number' || f.type === 'number_unit') && v !== null && v !== '') {
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
      <div className="grid grid-cols-12 gap-4">
        {schema.fields.map((field) => {
          if (field.type === 'section') {
            return (
              <div key={field.id} className="col-span-12 mt-2">
                <h3 className="text-base font-semibold text-foreground border-b pb-1.5">{field.label}</h3>
                {field.helpText && (
                  <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
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
            <Label className={LABEL}>
              {field.label}
              {field.required && <span className="ml-0.5 text-destructive">*</span>}
              {field.unit && <span className="ml-1 text-xs text-muted-foreground">({field.unit})</span>}
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
                  className={CONTROL}
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
                  className="text-sm"
                />
              );
              break;
            // A measurement renders exactly as a number — the unit is already
            // shown beside the label by `labelEl`, which reads field.unit for
            // every numeric type.
            case 'number':
            case 'number_unit':
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
                  className={CONTROL}
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
                  className={CONTROL}
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
                  className={CONTROL}
                />
              );
              break;
            case 'select': {
              const options = field.options ?? [];
              // Past a handful of choices a plain Select is unusable — Base-UI
              // gives it no search box, so a fifty-item diagnosis list can only
              // be scrolled. SearchableSelect puts the search on its own row
              // above the list so typing is never covered by the options.
              control =
                options.length > SEARCHABLE_SELECT_THRESHOLD ? (
                  <SearchableSelect
                    options={options.map((o) => ({ value: o.value, label: o.label }))}
                    value={(v as string) || null}
                    onChange={(value) => setField(field.key, value)}
                    placeholder={field.placeholder ?? 'Select…'}
                    searchPlaceholder={`Search ${field.label.toLowerCase()}…`}
                    disabled={readOnly}
                    clearable={!field.required}
                  />
                ) : (
                  <Select
                    value={(v as string) || null}
                    onValueChange={(value) => setField(field.key, value ?? null)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-10 w-full">
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
                          'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
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
                    <label key={o.value} className="flex items-center gap-2.5 text-sm cursor-pointer py-1">
                      <input
                        type="radio"
                        name={field.key}
                        value={o.value}
                        checked={v === o.value}
                        onChange={() => setField(field.key, o.value)}
                        disabled={readOnly}
                        className="h-[18px] w-[18px] accent-primary"
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
                <label className="flex items-center gap-2.5 text-sm cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={Boolean(v)}
                    onChange={(e) => setField(field.key, e.target.checked)}
                    disabled={readOnly}
                    className="h-[18px] w-[18px] accent-primary"
                  />
                  <span>{field.placeholder ?? 'Yes'}</span>
                </label>
              );
              break;
            case 'time':
              control = (
                <Input
                  type="time"
                  value={(v as string) ?? ''}
                  onChange={(e) => setField(field.key, e.target.value || null)}
                  disabled={readOnly}
                  className={CONTROL}
                />
              );
              break;
            case 'yesno': {
              // Three states, not two. `null` is "not answered" and stays
              // visually distinct from an explicit No — clicking the active
              // button again clears back to unanswered.
              const yes = field.yesLabel ?? 'Yes';
              const no = field.noLabel ?? 'No';
              control = (
                <div className="flex gap-2">
                  {([true, false] as const).map((choice) => {
                    const active = v === choice;
                    return (
                      <button
                        key={String(choice)}
                        type="button"
                        disabled={readOnly}
                        aria-pressed={active}
                        onClick={() => setField(field.key, active ? null : choice)}
                        className={cn(
                          'h-10 min-w-[88px] flex-1 rounded-xl border px-4 text-sm font-medium transition-colors sm:flex-none',
                          active && choice && 'border-primary bg-primary text-primary-foreground',
                          active && !choice && 'border-destructive bg-destructive text-white',
                          !active && 'border-border bg-surface-container-low hover:bg-surface-container',
                          readOnly && 'cursor-not-allowed opacity-70',
                        )}
                      >
                        {choice ? yes : no}
                      </button>
                    );
                  })}
                </div>
              );
              break;
            }
            case 'text_duration': {
              const dv = (v as TextDurationValue | null) ?? {
                text: null,
                duration: null,
                unit: field.defaultDurationUnit ?? 'days',
              };
              const units = field.durationUnits?.length ? field.durationUnits : DURATION_UNITS;
              control = (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={dv.text ?? ''}
                    onChange={(e) => setField(field.key, { ...dv, text: e.target.value || null })}
                    placeholder={field.placeholder ?? undefined}
                    maxLength={field.maxLength ?? undefined}
                    disabled={readOnly}
                    className={cn(CONTROL, 'sm:flex-1')}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={dv.duration ?? ''}
                      onChange={(e) =>
                        setField(field.key, {
                          ...dv,
                          duration: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      placeholder="For"
                      disabled={readOnly}
                      className={cn(CONTROL, 'w-20')}
                    />
                    <Select
                      value={dv.unit}
                      onValueChange={(u) => setField(field.key, { ...dv, unit: u ?? dv.unit })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-10 w-32">
                        <SelectValue>{(val) => (val ? String(val) : 'Unit')}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
              break;
            }
            case 'number_date': {
              const nd = (v as NumberDateValue | null) ?? { value: null, date: null };
              control = (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="number"
                    value={nd.value ?? ''}
                    onChange={(e) =>
                      setField(field.key, {
                        ...nd,
                        value: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder={field.placeholder ?? undefined}
                    min={field.min ?? undefined}
                    max={field.max ?? undefined}
                    step={field.step ?? undefined}
                    disabled={readOnly}
                    className={cn(CONTROL, 'sm:flex-1')}
                  />
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {field.dateLabel ?? 'on'}
                    </span>
                    <Input
                      type="date"
                      value={nd.date ? String(nd.date).slice(0, 10) : ''}
                      onChange={(e) => setField(field.key, { ...nd, date: e.target.value || null })}
                      disabled={readOnly}
                      className={cn(CONTROL, 'sm:w-44')}
                    />
                  </div>
                </div>
              );
              break;
            }
            default:
              control = null;
          }

          return (
            <div key={field.id} className={cn('col-span-12', widthClass(field.width))}>
              <div className="flex flex-col gap-1.5">
                {labelEl}
                {control}
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
                {err && <p className="text-xs text-destructive">{err}</p>}
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
