'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BAND_FIELDS } from './calculator-types';
import { type CalculatorFormValues } from '@/lib/schema/calculator-schema';

const BLANK_BAND = {
  min: undefined,
  max: undefined,
  label: '',
  color: 'emerald' as const,
  recommendation: '',
};

export default function FormulaBandsStep() {
  const { control, register } = useFormContext<CalculatorFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'bands' });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Expression *</Label>
        <Input
          placeholder="e.g. wt / (ht*ht)"
          className="font-mono py-10"
          {...register('expression')}
        />
        <p className="text-xs text-on-surface-variant">
          The math using the Variable IDs from the previous step. Supported: + − * / ( ) and numbers.
        </p>
      </div>

      {/* Interpretation bands */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Interpretation bands</Label>
            <p className="text-xs text-on-surface-variant">
              Map result ranges to a label, color and clinical recommendation.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => append({ ...BLANK_BAND })}
          >
            <Plus className="size-4" /> Add band
          </Button>
        </div>

        {fields.map((row, index) => (
          <div key={row.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-10">
            {BAND_FIELDS.map((field) => (
              <div key={field.key} className={`space-y-1.5 ${field.span}`}>
                <Label className="text-xs">{field.label}</Label>
                {field.type === 'select' ? (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...register(`bands.${index}.${field.key}`)}
                  >
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    {...register(`bands.${index}.${field.key}`)}
                  />
                )}
              </div>
            ))}
            <div className="flex items-end sm:col-span-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-rose-600 hover:text-rose-700"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                <Trash2 className="size-4" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
