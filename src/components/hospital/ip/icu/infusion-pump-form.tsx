'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, type IcuFormProps } from './field';
import { zodResolver } from '@hookform/resolvers/zod';
import { infusionPumpSchema, type InfusionPumpValues } from '@/lib/schema/icu-schema';
import { useSaveInfusionPump } from '@/hooks/use-icu';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

export function InfusionPumpForm({ admissionId, onSaved }: IcuFormProps) {
  const { register, handleSubmit, reset } = useForm({ resolver: zodResolver(infusionPumpSchema) });

  const save = useSaveInfusionPump();

  const onSave = (values: InfusionPumpValues) => {
    save.mutate({ admissionId: admissionId!, ...values }, {
      onSuccess: () => { toast.success('Infusion pump saved'); reset(); onSaved?.(); },
      onError: (e) => toast.error(getApiErrorMessage(e) ?? 'Save failed'),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-primary">Noradrenaline calculator</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Drug amount in syringe (mg)"><Input type="number" className="h-8" {...register('noradSyringeMg', { valueAsNumber: true })} /></Field>
          <Field label="Dose (mcg/kg/min)"><Input type="number" step="0.01" className="h-8" {...register('noradDoseMcgKgMin', { valueAsNumber: true })} /></Field>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">Save Infusion Pump</Button>
      </div>
    </form>
  );
}
