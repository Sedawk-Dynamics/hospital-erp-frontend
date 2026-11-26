'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { VAR_FIELDS } from './calculator-types';
import { type CalculatorFormValues } from '@/lib/schema/calculator-schema';

// A blank row in the schema's shape — numeric fields start undefined (empty),
// not "", so they pass zod's number coercion.
const BLANK_VARIABLE = {
  variableId: '',
  name: '',
  unit: '',
  min: undefined,
  max: undefined,
  step: undefined,
  defaultValue: undefined,
};

export default function VariablesStep() {
  const { control, register } = useFormContext<CalculatorFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'variables' });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Variables</Label>
          <p className="text-xs text-on-surface-variant">
            The inputs this calculator asks for. Use each Variable ID in the formula.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => append({ ...BLANK_VARIABLE })}
        >
          <Plus className="size-4" /> Add variable
        </Button>
      </div>

      {fields.map((row, index) => (
        <div key={row.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-10">
          {VAR_FIELDS.map((field) => (
            <div key={field.key} className={`space-y-1.5 ${field.span}`}>
              <Label className="text-xs">{field.label}</Label>
              <Input
                type={field.type}
                placeholder={field.placeholder}
                {...register(`variables.${index}.${field.key}`)}
              />
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
  );
}
