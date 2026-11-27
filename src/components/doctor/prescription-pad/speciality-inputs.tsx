'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ClipboardSignature, Delete, Plus, Stethoscope, Trash, X } from 'lucide-react';
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
import { useSaveSpecialityData, useSpecialityData } from '@/hooks/use-speciality';
import { toast } from 'sonner';

interface SpecialityInputsProps {
  speciality: string;
  visitId: string | undefined;
}

export function SpecialityInputs({ speciality, visitId }: SpecialityInputsProps) {
  const [open, setOpen] = useState(true);
  const [activeCat, setActiveCat] = useState('');
  const specialityData = useSpecialityData(visitId);
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
      save.mutate({ visitId, speciality, data: values }, { onSuccess: () => toast.success('Speciality Data Added') });
    } catch (error) {
      toast.error('error in adding the speciality data');
    }
  };

  const fetchData = specialityData?.data?.data as Record<string, unknown> | undefined;
  const specialityDataFetched = useRef(false);

  useEffect(() => {
    if (!specialityDataFetched.current && fetchData) {
      setValues(fetchData);
      specialityDataFetched.current = true;
    }
  }, [fetchData]);

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
          <h3 className="text-sm font-semibold leading-tight">Specialities Specific Consultation</h3>
          <p className="text-xs text-muted-foreground">{specialtyLabel(speciality)}</p>
        </div>
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
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Categories — pick one to add its inputs
              </p>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${categoryKeys.length}, minmax(0, 1fr))` }}
              >
                {categoryKeys.map((catKey, ci) => {
                  const isActive = catKey === active;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setActiveCat(catKey)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm text-left'
                          : 'border-border bg-card text-left text-foreground hover:border-primary/40 hover:bg-primary/10',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold',
                          isActive ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary',
                        )}
                      >
                        {String(ci + 1).padStart(2, '0')}
                      </span>
                      {categoryLabels[catKey] ?? catKey}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeGroups.map((group, gi) => {
            // Plain checkboxes (no nested fields) get their own grid: one column per checkbox.
            const plainCheckboxes = group.inputs.filter(
              (f) => f.type === 'checkbox' && !(f.fields && f.fields.length > 0),
            );
            const otherInputs = group.inputs.filter((f) => !plainCheckboxes.includes(f));
            return (
              <div key={gi} className="mt-5 space-y-3">
                {group.heading && (
                  <div className="flex items-center gap-2 border-l-4 border-primary bg-primary/10 px-3 py-2">
                    <h4 className="text-xs font-bold text-primary">{group.heading}</h4>
                  </div>
                )}
                {otherInputs.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {otherInputs.map((field) => (
                      <SpecialtyFieldInput
                        key={field.key}
                        field={field}
                        values={values}
                        setValue={setValue}
                      />
                    ))}
                  </div>
                )}
                {plainCheckboxes.length > 0 && (
                  <div
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${plainCheckboxes.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {plainCheckboxes.map((field) => (
                      <SpecialtyFieldInput
                        key={field.key}
                        field={field}
                        values={values}
                        setValue={setValue}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {categoryKeys.length > 0 && (
            <div className="mt-6 flex justify-end border-t border-primary/15 pt-4">
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!visitId || save.isPending}
                onClick={handleSave}
              >
                {save.isPending ? 'Saving…' : 'Save specialty details'}
              </Button>
            </div>
          )}
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

  // 1. Checkbox — inline label + (optional) nested fields.
  // Only checkboxes WITH nested fields span the full row; plain ones sit in the grid.
  if (field.type === 'checkbox') {
    const hasNested = Boolean(field.fields && field.fields.length > 0);
    return (
      <div
        className={cn(
          'space-y-2 rounded-lg border bg-card p-3',
          hasNested && 'col-span-full',
        )}
      >
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={Boolean(value)}
            onChange={(e) => setValue(field.key, field.unit ? { value: e.target.checked, unit: field.unit } : e.target.checked)} />
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

  // 2. Table — a log of rows; each row = one value per column. User adds rows.
  if (field.type === 'table') {
    const cols = field.columns ?? [];
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [{}];

    const updateCell = (ri: number, colKey: string, v: unknown) => {
      const next = rows.map((r, i) => (i === ri ? { ...r, [colKey]: v } : r));
      setValue(field.key, next);
    };
    const addRow = () => setValue(field.key, [...rows, {}]);
    const removeRow = (ri: number) =>
      setValue(field.key, rows.filter((_, i) => i !== ri));

    return (
      <div className="col-span-full space-y-2">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>

        {rows.map((row, ri) => (
          <div key={ri} className="flex items-end gap-2 rounded-lg border bg-card p-2">
            {cols.map((c) => (
              <div key={c.key} className="grid flex-1 gap-1">
                <Label className="text-[11px] text-muted-foreground">{c.label}</Label>
                {c.type === 'select' ? (
                  <Select
                    value={(row[c.key] as string) || undefined}
                    onValueChange={(v) => updateCell(ri, c.key, v)}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {(c.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={c.type === 'number' ? 'number' : c.type === 'datetime' ? 'datetime-local' : 'text'}
                    className="h-8"
                    value={(row[c.key] as string | number) ?? ''}
                    onChange={(e) => updateCell(ri, c.key, e.target.value)}
                  />
                )}
              </div>
            ))}
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(ri)}
                className="mb-1.5 text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Remove row"
              >
                <Trash className="h-4 w-4" />
              </button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        ))}
      </div>
    );
  }

  const control =
    field.type === 'select' ? (
      <Select value={(value as string) || undefined} onValueChange={(v) => setValue(field.key, v)}>
        <SelectTrigger className="h-8 w-full bg-white">
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
        className="h-8 bg-white"
        value={
          (field.unit
            ? (value as { value?: string | number } | undefined)?.value
            : (value as string | number)) ?? ''
        }
        onChange={(e) =>
          setValue(
            field.key,
            field.unit ? { value: e.target.value, unit: field.unit } : e.target.value,
          )
        }
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





