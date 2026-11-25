'use client';

import { useState } from 'react';
import { ChevronDown, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { specialtyLabel } from '@/lib/constants/specialities/doctor-specialties';
import {
  SPECIALTY_FIELDS,
  SPECIALTY_CATEGORY_LABELS,
  type SpecialtyField,
} from '@/lib/constants/specialities';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSaveSpecialityData } from '@/hooks/use-speciality';
import { toast } from 'sonner';

interface SpecialityInputsProps {
  speciality: string;
  visitId: string | undefined;
}

export function SpecialityInputs({ speciality, visitId }: SpecialityInputsProps) {
  const [open, setOpen] = useState(true);
  const [activeCat, setActiveCat] = useState('');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const setValue = (key: string, v: unknown) =>
    setValues((prev) => ({ ...prev, [key]: v }));
  const categories = SPECIALTY_FIELDS[speciality];
  const categoryLabels = SPECIALTY_CATEGORY_LABELS[speciality] ?? {};
  const categoryKeys = categories ? Object.keys(categories) : [];
  const active = activeCat || categoryKeys[0];
  const activeGroups = categories?.[active] ?? [];

  const save = useSaveSpecialityData();
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!visitId) return; // no visit yet — nothing to attach to
    try {
      save.mutate({ visitId, speciality, data: values });
    } catch (error) {
      toast.error('error in adding the speciality data');
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-primary/10"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold leading-tight">Specialty Details</h3>
          <p className="text-xs text-muted-foreground">{specialtyLabel(speciality)}</p>
        </div>
        {categoryKeys.length > 0 && (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!visitId || save.isPending}
            onClick={handleSave}
          >
            {save.isPending ? 'Saving…' : save.isSuccess ? 'Saved ✓' : 'Save'}
          </Button>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>

      {open && (
        <div className="border-t border-primary/15 px-4 py-4">
          {categoryKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No specialty inputs configured yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {categoryKeys.map((catKey) => {
                const isActive = catKey === active;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setActiveCat(catKey)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-primary/10',
                    )}
                  >
                    {categoryLabels[catKey] ?? catKey}
                  </button>
                );
              })}
            </div>
          )}

          {activeGroups.map((group, gi) => (
            <div key={gi} className="mt-5 space-y-3">
              {group.heading && (
                <div className="flex items-center gap-2 border-l-4 border-primary bg-primary/10 px-3 py-2">
                  <h4 className="text-sm font-bold text-primary">{group.heading}</h4>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.inputs.map((field) => (
                  <SpecialtyFieldInput
                    key={field.key}
                    field={field}
                    values={values}
                    setValue={setValue}
                  />
                ))}
              </div>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}






type FieldProps = {
  field: SpecialtyField;
  values: Record<string, unknown>;
  setValue: (key: string, v: unknown) => void;
};

function SpecialtyFieldInput({ field, values, setValue }: FieldProps) {
  const value = values[field.key];

  // 1. Checkbox — inline label + (optional) nested fields. Spans full row.
  if (field.type === 'checkbox') {
    return (
      <div className="col-span-full space-y-2 rounded-lg border bg-card p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={Boolean(value)}
            onChange={(e) => setValue(field.key, e.target.checked)}
          />
          {field.label}
        </label>
        {field.fields && field.fields.length > 0 && (
          <div className="ml-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field.fields.map((sub) => (
              <SpecialtyFieldInput key={sub.key} field={sub} values={values} setValue={setValue} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const control =
    field.type === 'select' ? (
      <Select value={(value as string) || undefined} onValueChange={(v) => setValue(field.key, v)}>
        <SelectTrigger className="h-8 w-full">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : field.type === 'multiselect' ? (
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((o) => {
          const selected = Array.isArray(value) ? (value as string[]) : [];
          return (
            <label key={o} className="cursor-pointer">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={selected.includes(o)}
                onChange={(e) =>
                  setValue(
                    field.key,
                    e.target.checked ? [...selected, o] : selected.filter((x) => x !== o),
                  )
                }
              />
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                {o}
              </span>
            </label>
          );
        })}
      </div>
    ) : (
      <Input
        type={
          field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text'
        }
        className="h-8"
        value={(value as string | number) ?? ''}
        onChange={(e) => setValue(field.key, e.target.value)}
      />
    );

  return (
    <div className={cn('grid gap-1', field.type === 'multiselect' && 'col-span-full')}>
      <Label className="text-xs text-muted-foreground">
        {field.label}
        {field.unit ? ` (${field.unit})` : ''}
      </Label>
      {control}
    </div>
  );
}





