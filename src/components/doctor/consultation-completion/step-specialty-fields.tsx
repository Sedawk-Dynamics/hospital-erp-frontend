'use client';

import { type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ClipboardList } from 'lucide-react';
import type { ConsultationFormData } from './consultation-completion-schema';
import { SPECIALTY_FIELDS, type SpecialtyField } from '@/lib/constants/specialty-fields';

interface StepSpecialtyFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ConsultationFormData, any, any>;
  /** The doctor's specialty code — selects which field set to render. */
  specialty?: string | null;
}

type Register = UseFormReturn<ConsultationFormData>['register'];

// Fields that span the full row (vs. the two-column default).
const FULL_WIDTH: SpecialtyField['type'][] = ['select', 'textarea'];

const inputClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring';

// Group the flat field list by its `section` heading, preserving order.
function groupBySection(fields: SpecialtyField[]) {
  const groups: { section: string; fields: SpecialtyField[] }[] = [];
  for (const field of fields) {
    const section = field.section ?? 'Details';
    const last = groups.at(-1);
    if (last?.section === section) last.fields.push(field);
    else groups.push({ section, fields: [field] });
  }
  return groups;
}

function SpecialtyFieldRow({ field, register }: { field: SpecialtyField; register: Register }) {
  const name = `specialtyData.${field.id}` as const;

  if (field.type === 'boolean') {
    return (
      <label htmlFor={name} className="flex items-center gap-2 text-sm cursor-pointer">
        <input id={name} type="checkbox" className="size-4 rounded border-input accent-primary" {...register(name)} />
        <span>{field.label}</span>
      </label>
    );
  }

  const control =
    field.type === 'select' ? (
      <select id={name} className={`h-9 ${inputClass}`} {...register(name)}>
        <option value="">Select…</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : field.type === 'textarea' ? (
      <textarea id={name} rows={3} placeholder={field.placeholder} {...register(name)} className={`resize-none ${inputClass}`} />
    ) : (
      <Input id={name} type={field.type === 'number' ? 'number' : 'text'} placeholder={field.placeholder} {...register(name)} />
    );

  return (
    <div className={`space-y-1.5 ${FULL_WIDTH.includes(field.type) ? 'sm:col-span-2' : ''}`}>
      <Label htmlFor={name} className="text-xs">
        {field.label}
        {field.unit ? ` (${field.unit})` : ''}
      </Label>
      {control}
    </div>
  );
}

export function StepSpecialtyFields({ form, specialty }: StepSpecialtyFieldsProps) {
  const fields = (specialty && SPECIALTY_FIELDS[specialty as keyof typeof SPECIALTY_FIELDS]) || [];

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No specialty-specific fields for this doctor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupBySection(fields).map((group) => (
        <div key={group.section} className="space-y-3">
          <div>
            <Label className="text-sm font-semibold">{group.section}</Label>
            <Separator className="mt-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {group.fields.map((field) => (
              <SpecialtyFieldRow key={field.id} field={field} register={form.register} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
