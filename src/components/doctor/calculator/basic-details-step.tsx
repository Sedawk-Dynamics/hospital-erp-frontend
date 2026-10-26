'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BASIC_FIELDS } from './calculator-types';
import { type CalculatorBasicInfo } from '@/lib/schema/calculator-schema';

export default function BasicDetailsStep() {
  const { register } = useFormContext<CalculatorBasicInfo>();

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {BASIC_FIELDS.map((field) => (
        <div key={field.key} className={`space-y-1.5 ${field.span ?? ''}`}>
          <Label>{field.label}</Label>
          {field.type === 'textarea' ? (
            <Textarea rows={2} placeholder={field.placeholder} {...register(field.key)} />
          ) : field.type === 'select' ? (
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register(field.key)}
            >
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={field.type === 'number' ? 'number' : 'text'}
              min={field.min}
              max={field.max}
              placeholder={field.placeholder}
              {...register(field.key)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
