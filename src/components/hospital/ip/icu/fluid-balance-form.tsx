'use client';

import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, type IcuFormProps } from './field';
import { zodResolver } from '@hookform/resolvers/zod';
import { fluidBalanceSchema, type FluidBalanceValues } from '@/lib/schema/icu-schema';
import { useSaveAbgVent, useSaveFluidBalance } from '@/hooks/use-icu';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

export function FluidBalanceForm({ admissionId, weight, onSaved }: IcuFormProps) {
  const { register, handleSubmit, control, reset } = useForm({ resolver: zodResolver(fluidBalanceSchema) });

  const save = useSaveFluidBalance();

  const onSave = (values: FluidBalanceValues) => {
    save.mutate({ admissionId: admissionId!, ...values }, {
      onSuccess: () => { toast.success('Fluid balance saved'); reset(); onSaved?.(); },
      onError: (e) => toast.error(getApiErrorMessage(e) ?? 'Save failed'),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <Field label="Hour (IST) — HH:MM">
        <Input type="time" className="h-8 sm:w-40" {...register('hour')} />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="IV Cryst (mL)"><Input type="number" placeholder="mL" className="h-8" {...register('ivCrystMl', { valueAsNumber: true })} /></Field>
        <Field label="Blood Prod (mL)"><Input type="number" placeholder="mL" className="h-8" {...register('bloodProdMl', { valueAsNumber: true })} /></Field>
        <Field label="Carrier Med (mL)"><Input type="number" placeholder="mL" className="h-8" {...register('carrierMedMl', { valueAsNumber: true })} /></Field>
        <Field label="Enteral (mL)"><Input type="number" placeholder="mL" className="h-8" {...register('enteralMl', { valueAsNumber: true })} /></Field>
        <Field label="Foley Urine (mL)"><Input type="number" placeholder="mL" className="h-8" {...register('foleyUrineMl', { valueAsNumber: true })} /></Field>
        <Field label="Drains / ICD (mL)"><Input type="number" placeholder="mL" className="h-8" {...register('drainsIcdMl', { valueAsNumber: true })} /></Field>
      </div>

      <Field label="Urine Character">
        <Controller
          control={control}
          name="urineCharacter"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clear_amber">Clear Amber (Normal)</SelectItem>
                <SelectItem value="hazy_cloudy">Hazy / Cloudy (UTI suspect)</SelectItem>
                <SelectItem value="hematuria">Hematuria (Gross red)</SelectItem>
                <SelectItem value="concentrated_dark">Concentrated / Dark tea</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="sm">Save Fluid Balance</Button>
      </div>
    </form>
  );
}
