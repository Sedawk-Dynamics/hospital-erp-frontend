'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings,
  Eye,
  EyeOff,
  Type,
  AlignLeft,
  Hash,
  Mail,
  Phone,
  Calendar,
  Clock,
  CalendarClock,
  ListOrdered,
  CheckSquare,
  CircleDot,
  Square,
  Upload,
  PenLine,
  Heading,
} from 'lucide-react';
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
import { FormRenderer } from './form-renderer';
import {
  FIELD_TYPE_LABELS,
  type FormField,
  type FormFieldType,
  type FormFieldWidth,
  type FormSchema,
} from '@/types/forms';

const FIELD_PALETTE: { type: FormFieldType; icon: typeof Type; label: string }[] = [
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'textarea', icon: AlignLeft, label: 'Long Text' },
  { type: 'number', icon: Hash, label: 'Number' },
  { type: 'email', icon: Mail, label: 'Email' },
  { type: 'phone', icon: Phone, label: 'Phone' },
  { type: 'date', icon: Calendar, label: 'Date' },
  { type: 'time', icon: Clock, label: 'Time' },
  { type: 'datetime', icon: CalendarClock, label: 'Date & Time' },
  { type: 'select', icon: ListOrdered, label: 'Dropdown' },
  { type: 'multi_select', icon: CheckSquare, label: 'Multi-Select' },
  { type: 'radio', icon: CircleDot, label: 'Radio' },
  { type: 'checkbox', icon: Square, label: 'Checkbox' },
  { type: 'file', icon: Upload, label: 'File Upload' },
  { type: 'signature', icon: PenLine, label: 'Signature' },
  { type: 'section_header', icon: Heading, label: 'Section Header' },
];

function makeFieldId(): string {
  return `f_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultFieldFor(type: FormFieldType): FormField {
  return {
    id: makeFieldId(),
    type,
    label: FIELD_TYPE_LABELS[type],
    placeholder: '',
    helpText: '',
    required: false,
    options:
      type === 'select' || type === 'multi_select' || type === 'radio'
        ? [
            { value: 'option_1', label: 'Option 1' },
            { value: 'option_2', label: 'Option 2' },
          ]
        : undefined,
    width: 'full',
  };
}

interface FormBuilderProps {
  /** Current schema being edited */
  value: FormSchema;
  /** Called whenever the schema changes */
  onChange: (next: FormSchema) => void;
  /** When true, restricts what can be edited (used for hospital admin editing a clone). Currently informational. */
  restricted?: boolean;
}

/**
 * Visual form schema editor.
 * Layout:
 *   ┌──────────────┬──────────────────────────┬──────────────┐
 *   │  Field       │  Canvas (drag/order)     │  Field       │
 *   │  Palette     │                          │  Settings    │
 *   └──────────────┴──────────────────────────┴──────────────┘
 *
 * Uses click-to-add + move up/down arrows instead of full drag-drop
 * to avoid pulling in a heavy DnD library.
 */
export function FormBuilder({ value, onChange, restricted = false }: FormBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    value.fields[0]?.id ?? null,
  );
  const [previewMode, setPreviewMode] = useState(false);

  const selectedField = value.fields.find((f) => f.id === selectedFieldId) || null;

  function update(next: Partial<FormSchema>) {
    onChange({ ...value, ...next });
  }

  function addField(type: FormFieldType) {
    const f = defaultFieldFor(type);
    update({ fields: [...value.fields, f] });
    setSelectedFieldId(f.id);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    update({
      fields: value.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function removeField(id: string) {
    const next = value.fields.filter((f) => f.id !== id);
    update({ fields: next });
    if (selectedFieldId === id) setSelectedFieldId(next[0]?.id ?? null);
  }

  function moveField(id: string, dir: -1 | 1) {
    const idx = value.fields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= value.fields.length) return;
    const next = [...value.fields];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    update({ fields: next });
  }

  if (previewMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-lg font-bold">Preview</h3>
          <Button variant="outline" size="sm" onClick={() => setPreviewMode(false)}>
            <EyeOff className="h-4 w-4 mr-1.5" />
            Exit Preview
          </Button>
        </div>
        <div className="rounded-xl border bg-card p-6">
          {value.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Add at least one field to preview the form.
            </p>
          ) : (
            <FormRenderer
              schema={value}
              onSubmit={() => {
                /* no-op in preview */
              }}
              submitLabel="Submit (preview only)"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Palette */}
      <aside className="lg:col-span-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-label text-xs font-bold uppercase text-muted-foreground">
            Add Field
          </h3>
          <Button variant="outline" size="sm" onClick={() => setPreviewMode(true)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FIELD_PALETTE.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => addField(p.type)}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}
        </div>
        {restricted && (
          <p className="text-[10px] text-muted-foreground mt-2">
            You're editing a hospital copy. Changes only affect your hospital.
          </p>
        )}
      </aside>

      {/* Canvas */}
      <section className="lg:col-span-6 space-y-2">
        <h3 className="font-label text-xs font-bold uppercase text-muted-foreground">
          Form Layout ({value.fields.length} fields)
        </h3>
        <div className="rounded-xl border bg-card p-4 min-h-[300px]">
          {value.fields.length === 0 ? (
            <div className="text-center py-10">
              <Plus className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Click any field type on the left to add it to the form.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {value.fields.map((f, i) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                    selectedFieldId === f.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:border-primary/50',
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(f.id, -1);
                      }}
                      className="text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={i === value.fields.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(f.id, 1);
                      }}
                      className="text-muted-foreground hover:text-primary disabled:opacity-30"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {f.label}
                      {f.required && <span className="text-destructive ml-1">*</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {FIELD_TYPE_LABELS[f.type]} · {f.width}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(f.id);
                    }}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove field"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Settings panel */}
      <aside className="lg:col-span-3 space-y-2">
        <h3 className="font-label text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          Field Settings
        </h3>
        <div className="rounded-xl border bg-card p-4 space-y-3">
          {!selectedField ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Select a field on the left to edit it.
            </p>
          ) : (
            <FieldSettings field={selectedField} onChange={(p) => updateField(selectedField.id, p)} />
          )}
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Field-settings sub-component
// ─────────────────────────────────────────────────────────

function FieldSettings({
  field,
  onChange,
}: {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const supportsOptions =
    field.type === 'select' || field.type === 'multi_select' || field.type === 'radio';

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>

      {field.type !== 'section_header' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Placeholder</Label>
            <Input
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Help Text</Label>
            <Textarea
              rows={2}
              value={field.helpText || ''}
              onChange={(e) => onChange({ helpText: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Width</Label>
            <Select
              value={field.width}
              onValueChange={(v) => onChange({ width: (v as FormFieldWidth) ?? 'full' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Width</SelectItem>
                <SelectItem value="half">Half (1/2)</SelectItem>
                <SelectItem value="third">Third (1/3)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            Required field
          </label>
        </>
      )}

      {supportsOptions && (
        <div className="space-y-1.5 pt-2 border-t">
          <Label className="text-xs">Options</Label>
          <div className="space-y-1.5">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  value={opt.label}
                  placeholder="Label"
                  onChange={(e) => {
                    const next = [...(field.options || [])];
                    next[i] = { ...next[i], label: e.target.value };
                    onChange({ options: next });
                  }}
                  className="text-xs h-8"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = (field.options || []).filter((_, idx) => idx !== i);
                    onChange({ options: next });
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => {
                const next = [...(field.options || [])];
                next.push({
                  value: `option_${next.length + 1}`,
                  label: `Option ${next.length + 1}`,
                });
                onChange({ options: next });
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Option
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
