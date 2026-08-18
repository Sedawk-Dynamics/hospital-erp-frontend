'use client';

// Drag-free form builder. Field palette on the left, ordered field list in
// the middle, selected-field property panel on the right. Clicking a field
// type in the palette appends a new field to the canvas with sensible
// defaults; selecting a row reveals its property editor.
//
// Submit calls `onSave` with the full FormSchema + name/category. The parent
// page (super-admin or hospital admin) owns the actual mutation call.

import { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  CalendarClock,
  CalendarRange,
  CheckSquare,
  ChevronsDown,
  Circle,
  Clock,
  Copy,
  Eye,
  Hash,
  Layers,
  ListChecks,
  Minus,
  Plus,
  Save,
  TextCursorInput,
  Timer,
  ToggleLeft,
  Trash2,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  DURATION_UNITS,
  FORM_CATEGORIES,
  PATIENT_AUTOFILL_FIELDS,
  type DurationUnit,
  type FormCategory,
  type FormField,
  type FormFieldType,
  type FormSchema,
  type PatientAutofillKey,
} from '@/hooks/use-forms';
import { FormRenderer } from './form-renderer';

// ─── helpers ───────────────────────────────────────────────────

function uid() {
  // Crypto.randomUUID isn't safe to call during SSR; the builder is 'use client'
  // so we're fine.
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `f-${Math.random().toString(36).slice(2, 11)}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || `field_${Math.random().toString(36).slice(2, 6)}`;
}

const FIELD_PALETTE: { type: FormFieldType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'text', label: 'Text', Icon: Type },
  { type: 'textarea', label: 'Textarea', Icon: AlignLeft },
  { type: 'number', label: 'Number', Icon: Hash },
  { type: 'date', label: 'Date', Icon: Calendar },
  { type: 'datetime', label: 'Date & time', Icon: CalendarClock },
  { type: 'time', label: 'Time only', Icon: Clock },
  { type: 'select', label: 'Dropdown', Icon: ChevronsDown },
  { type: 'multiselect', label: 'Multi-select', Icon: ListChecks },
  { type: 'radio', label: 'Radio', Icon: Circle },
  { type: 'checkbox', label: 'Checkbox', Icon: CheckSquare },
  { type: 'yesno', label: 'Yes / No', Icon: ToggleLeft },
  { type: 'text_duration', label: 'Text + duration', Icon: Timer },
  { type: 'number_date', label: 'Number + date', Icon: CalendarRange },
  { type: 'section', label: 'Section', Icon: Layers },
  { type: 'divider', label: 'Divider', Icon: Minus },
];

function defaultFieldFor(type: FormFieldType, existingKeys: Set<string>): FormField {
  const baseKey = type === 'section' ? 'section' : type === 'divider' ? 'divider' : type;
  let key = baseKey;
  let n = 1;
  while (existingKeys.has(key)) {
    n += 1;
    key = `${baseKey}_${n}`;
  }
  const base = {
    id: uid(),
    key,
    label: type === 'section' ? 'Section heading' : type === 'divider' ? 'Divider' : 'Untitled',
    required: false,
    width: 'full' as const,
  };
  switch (type) {
    case 'select':
    case 'radio':
      return { ...base, type, options: [{ value: 'option_1', label: 'Option 1' }] };
    case 'multiselect':
      return { ...base, type, options: [{ value: 'option_1', label: 'Option 1' }] };
    case 'number':
      return { ...base, type, step: 1 };
    case 'number_date':
      return { ...base, type, step: 1, dateLabel: 'on' };
    case 'yesno':
      return { ...base, type, yesLabel: 'Yes', noLabel: 'No' };
    case 'text_duration':
      return { ...base, type, defaultDurationUnit: 'days' as const };
    case 'textarea':
      return { ...base, type, rows: 3 };
    default:
      return { ...base, type };
  }
}

// ─── builder ───────────────────────────────────────────────────

export interface FormBuilderInitial {
  name?: string;
  description?: string;
  category?: FormCategory;
  schema?: FormSchema;
  isPublished?: boolean;
}

interface FormBuilderProps {
  initial?: FormBuilderInitial;
  isSaving?: boolean;
  onSave: (payload: {
    name: string;
    description?: string | null;
    category: FormCategory;
    schema: FormSchema;
    isPublished: boolean;
  }) => void | Promise<void>;
  // Distinguishes "Publish" semantics: super-admin templates default to draft;
  // hospital forms default to published.
  publishLabelMode?: 'template' | 'hospital';
}

export function FormBuilder({ initial, onSave, isSaving = false, publishLabelMode = 'hospital' }: FormBuilderProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<FormCategory>(initial?.category ?? 'other');
  const [isPublished, setIsPublished] = useState<boolean>(
    initial?.isPublished ?? (publishLabelMode === 'hospital'),
  );
  const [fields, setFields] = useState<FormField[]>(initial?.schema?.fields ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Re-hydrate when parent swaps the initial payload (loading async).
  useEffect(() => {
    if (initial) {
      setName(initial.name ?? '');
      setDescription(initial.description ?? '');
      setCategory(initial.category ?? 'other');
      setIsPublished(initial.isPublished ?? (publishLabelMode === 'hospital'));
      setFields(initial.schema?.fields ?? []);
    }
  }, [initial, publishLabelMode]);

  const selected = useMemo(() => fields.find((f) => f.id === selectedId) ?? null, [fields, selectedId]);
  const usedKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  function addField(type: FormFieldType) {
    const f = defaultFieldFor(type, usedKeys);
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? ({ ...f, ...patch } as FormField) : f)));
  }

  function deleteField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateField(id: string) {
    const idx = fields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const orig = fields[idx];
    const clone: FormField = { ...orig, id: uid(), key: defaultFieldFor(orig.type, usedKeys).key };
    setFields((prev) => [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)]);
    setSelectedId(clone.id);
  }

  function moveField(id: string, direction: -1 | 1) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) {
      // Defer toast wiring to parent; just bail.
      alert('Please give the form a name');
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      category,
      schema: { fields, version: initial?.schema?.version ?? 1 },
      isPublished,
    });
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6">
            <Label className="text-xs font-medium">Name *</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Admission Assessment"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs font-medium">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory((v as FormCategory) ?? 'other')}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Select…">
                  {(val) => FORM_CATEGORIES.find((c) => c.value === val)?.label ?? val}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FORM_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 flex flex-col">
            <Label className="text-xs font-medium">Status</Label>
            <label className="mt-3 inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span>{publishLabelMode === 'template' ? 'Publish to hospitals' : 'Published (visible to nurses)'}</span>
            </label>
          </div>
          <div className="md:col-span-12">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="Optional. What is this form used for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Builder + Preview tabs */}
      <Tabs defaultValue="build">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="build" className="gap-1.5">
            <TextCursorInput className="h-3.5 w-3.5" />
            Build
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Palette */}
            <aside className="lg:col-span-3 rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">
                Field types
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                {FIELD_PALETTE.map(({ type, label, Icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addField(type)}
                    className="flex items-center gap-2 rounded-md border bg-surface-container-low px-2.5 py-2 text-xs hover:bg-surface-container transition-colors text-left"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {label}
                  </button>
                ))}
              </div>
            </aside>

            {/* Field list */}
            <section className="lg:col-span-5 rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">
                Fields ({fields.length})
              </p>
              {fields.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  Click a field type from the left to add it.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {fields.map((f, i) => {
                    const isSel = f.id === selectedId;
                    return (
                      <li
                        key={f.id}
                        className={cn(
                          'rounded-md border bg-surface-container-low px-2.5 py-2 text-xs flex items-center gap-2',
                          isSel ? 'border-primary ring-1 ring-primary/40' : 'border-border',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(f.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="font-semibold truncate">
                            {f.label || <span className="italic text-muted-foreground">untitled</span>}{' '}
                            {f.required && <span className="text-destructive">*</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {f.type}
                            {f.type !== 'section' && f.type !== 'divider' && ` · ${f.key}`}
                          </p>
                        </button>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveField(f.id, -1)}
                            disabled={i === 0}
                            className="p-1 rounded hover:bg-surface-container disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(f.id, 1)}
                            disabled={i === fields.length - 1}
                            className="p-1 rounded hover:bg-surface-container disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateField(f.id)}
                            className="p-1 rounded hover:bg-surface-container"
                            aria-label="Duplicate"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteField(f.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Property panel */}
            <aside className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-3 shadow-sanctuary">
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">
                Field properties
              </p>
              {!selected ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Select a field to edit its properties.
                </p>
              ) : (
                <PropertyEditor
                  field={selected}
                  onChange={(patch) => updateField(selected.id, patch)}
                  usedKeys={usedKeys}
                />
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sanctuary">
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Add at least one field to preview.
              </p>
            ) : (
              <FormRenderer
                schema={{ fields, version: initial?.schema?.version ?? 1 }}
                onSubmit={() => {
                  alert('Preview submit — values not saved.');
                }}
                submitLabel="Preview submit"
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── property editor (right pane) ──────────────────────────────

function PropertyEditor({
  field,
  onChange,
  usedKeys,
}: {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
  usedKeys: Set<string>;
}) {
  const isLayout = field.type === 'section' || field.type === 'divider';

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium">Label</Label>
        <Input
          className="mt-1"
          value={field.label}
          onChange={(e) => {
            const newLabel = e.target.value;
            // Auto-derive key from label if user hasn't customised it yet (key
            // still matches old slug). Saves a click for the common case.
            const oldSlug = slugify(field.label);
            const shouldSync = field.key === oldSlug;
            const next: Partial<FormField> = { label: newLabel };
            if (shouldSync && !isLayout) {
              const desired = slugify(newLabel);
              let candidate = desired;
              let n = 1;
              while (usedKeys.has(candidate) && candidate !== field.key) {
                n += 1;
                candidate = `${desired}_${n}`;
              }
              next.key = candidate;
            }
            onChange(next);
          }}
        />
      </div>

      {!isLayout && (
        <div>
          <Label className="text-xs font-medium">Field key</Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={field.key}
            onChange={(e) => onChange({ key: slugify(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Used as the data key. snake_case, must be unique.
          </p>
        </div>
      )}

      <div>
        <Label className="text-xs font-medium">Help text</Label>
        <Textarea
          className="mt-1"
          rows={2}
          value={field.helpText ?? ''}
          onChange={(e) => onChange({ helpText: e.target.value || null })}
        />
      </div>

      {!isLayout && (
        <>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={!!field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            Required
          </label>

          <div>
            <Label className="text-xs font-medium">Width</Label>
            <Select
              value={(field.width ?? 'full') as string}
              onValueChange={(v) => onChange({ width: ((v as 'full' | 'half' | 'third') ?? 'full') })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Width">{(val) => val ?? 'full'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="half">Half</SelectItem>
                <SelectItem value="third">Third</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {(field.type === 'text' || field.type === 'textarea' || field.type === 'select' || field.type === 'number' || field.type === 'text_duration' || field.type === 'number_date') && (
        <div>
          <Label className="text-xs font-medium">Placeholder</Label>
          <Input
            className="mt-1"
            value={field.placeholder ?? ''}
            onChange={(e) => onChange({ placeholder: e.target.value || null })}
          />
        </div>
      )}

      {(field.type === 'number' || field.type === 'number_date') && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] font-medium">Min</Label>
            <Input
              type="number"
              className="mt-1"
              value={field.min ?? ''}
              onChange={(e) => onChange({ min: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-[10px] font-medium">Max</Label>
            <Input
              type="number"
              className="mt-1"
              value={field.max ?? ''}
              onChange={(e) => onChange({ max: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-[10px] font-medium">Step</Label>
            <Input
              type="number"
              className="mt-1"
              value={field.step ?? ''}
              onChange={(e) => onChange({ step: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {field.type === 'textarea' && (
        <div>
          <Label className="text-xs font-medium">Rows</Label>
          <NumberInput
            className="mt-1"
            min={2}
            max={20}
            value={field.rows ?? 3}
            onValueChange={(v) => onChange({ rows: v })}
          />
        </div>
      )}

      {/* The unit shown beside the label — "Weight (kg)". The schema and the
          renderer have always supported this; there was simply no way to set
          it, so every numeric field came out unitless. */}
      {(field.type === 'number' || field.type === 'number_date') && (
        <div>
          <Label className="text-xs font-medium">Unit</Label>
          <Input
            className="mt-1"
            placeholder="kg, mmHg, mL…"
            maxLength={20}
            value={field.unit ?? ''}
            onChange={(e) => onChange({ unit: e.target.value || null })}
          />
        </div>
      )}

      {field.type === 'number_date' && (
        <div>
          <Label className="text-xs font-medium">Date label</Label>
          <Input
            className="mt-1"
            placeholder="on, taken on, last dose…"
            maxLength={60}
            value={field.dateLabel ?? ''}
            onChange={(e) => onChange({ dateLabel: e.target.value || null })}
          />
        </div>
      )}

      {field.type === 'yesno' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] font-medium">Yes label</Label>
            <Input
              className="mt-1"
              maxLength={30}
              value={field.yesLabel ?? 'Yes'}
              onChange={(e) => onChange({ yesLabel: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-[10px] font-medium">No label</Label>
            <Input
              className="mt-1"
              maxLength={30}
              value={field.noLabel ?? 'No'}
              onChange={(e) => onChange({ noLabel: e.target.value })}
            />
          </div>
        </div>
      )}

      {field.type === 'text_duration' && (
        <div>
          <Label className="text-xs font-medium">Default duration unit</Label>
          <Select
            value={field.defaultDurationUnit ?? 'days'}
            onValueChange={(v) => onChange({ defaultDurationUnit: (v as DurationUnit) ?? 'days' })}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue>{(val) => (val ? String(val) : 'days')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DURATION_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Prefill from the patient the form is opened under. Layout-only types
          have nothing to prefill, so the picker is hidden for them. */}
      {field.type !== 'section' && field.type !== 'divider' && (
        <div>
          <Label className="text-xs font-medium">Prefill from patient</Label>
          <Select
            value={field.autofill ?? null}
            onValueChange={(v) => onChange({ autofill: (v as PatientAutofillKey) ?? null })}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="Do not prefill">
                {(val) =>
                  val
                    ? (PATIENT_AUTOFILL_FIELDS.find((f) => f.key === val)?.label ?? String(val))
                    : 'Do not prefill'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PATIENT_AUTOFILL_FIELDS.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.autofill && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Filled in when the form opens; the nurse can still change it.
            </p>
          )}
        </div>
      )}

      {(field.type === 'select' || field.type === 'multiselect' || field.type === 'radio') && (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(options) => onChange({ options })}
        />
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: { value: string; label: string }[];
  onChange: (next: { value: string; label: string }[]) => void;
}) {
  function update(i: number, patch: Partial<{ value: string; label: string }>) {
    const next = options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onChange(next);
  }
  function add() {
    const n = options.length + 1;
    onChange([...options, { value: `option_${n}`, label: `Option ${n}` }]);
  }
  function remove(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Options</Label>
      <div className="space-y-1.5">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              className="text-xs"
              placeholder="Label"
              value={o.label}
              onChange={(e) => {
                const newLabel = e.target.value;
                // Auto-sync value from label slug if user hasn't customised
                const oldSlug = slugify(o.label);
                const sync = o.value === oldSlug;
                update(i, { label: newLabel, ...(sync ? { value: slugify(newLabel) } : {}) });
              }}
            />
            <Input
              className="text-xs font-mono w-24"
              placeholder="value"
              value={o.value}
              onChange={(e) => update(i, { value: slugify(e.target.value) })}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1 rounded hover:bg-destructive/10 text-destructive"
              aria-label="Remove option"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add option
      </button>
    </div>
  );
}
