'use client';

import { useForm, Controller, type Control } from 'react-hook-form';
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
import { fastHugSepsisSchema, type FastHugSepsisValues } from '@/lib/schema/icu-schema';
import { useSaveFastHugSepsis } from '@/hooks/use-icu';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

/** Yes/No dropdown bound to a react-hook-form field. */
function YesNo({ control, name }: { control: Control<any>; name: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value as string | undefined} onValueChange={field.onChange}>
          <SelectTrigger className="h-8 w-full"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      )}
    />
  );
}

export function FastHugSepsisForm({ admissionId, weight, onSaved }: IcuFormProps) {
  const { register, handleSubmit, control, reset } = useForm({ resolver: zodResolver(fastHugSepsisSchema) });

  const save = useSaveFastHugSepsis();

  const onSave = (values: FastHugSepsisValues) => {
    save.mutate({ admissionId: admissionId!, ...values }, {
      onSuccess: () => { toast.success('FAST-HUG + Sepsis saved'); reset(); onSaved?.(); },
      onError: (e) => toast.error(getApiErrorMessage(e) ?? 'Save failed'),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-primary">FAST-HUG</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Feeding"><Input className="h-8" {...register('feeding')} /></Field>
          <Field label="Analgesia"><Input className="h-8" {...register('analgesia')} /></Field>
          <Field label="Sedation"><Input className="h-8" {...register('sedation')} /></Field>
          <Field label="Thromboembolism prophylaxis"><Input className="h-8" {...register('thromboprophylaxis')} /></Field>
          <Field label="Head of bed"><Input className="h-8" {...register('headOfBed')} /></Field>
          <Field label="Ulcer prophylaxis"><Input className="h-8" {...register('ulcerProphylaxis')} /></Field>
          <Field label="Glucose control"><Input className="h-8" {...register('glucoseControl')} /></Field>
          <Field label="Bowel care"><Input className="h-8" {...register('bowelCare')} /></Field>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-primary">Sepsis bundle</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Blood cultures done?"><YesNo control={control} name="bloodCulturesDone" /></Field>
          <Field label="Blood cultures time"><Input type="time" className="h-8" {...register('bloodCulturesTime')} /></Field>
          <Field label="Antibiotics given?"><YesNo control={control} name="antibioticsGiven" /></Field>
          <Field label="Antibiotic name"><Input className="h-8" {...register('antibioticName')} /></Field>
          <Field label="Lactate done?"><YesNo control={control} name="lactateDone" /></Field>
          <Field label="Lactate value"><Input type="number" step="0.1" className="h-8" {...register('lactateMmoll', { valueAsNumber: true })} /></Field>
          <Field label="Fluid bolus given?"><YesNo control={control} name="fluidBolusGiven" /></Field>
          <Field label="Bolus volume (mL)"><Input type="number" className="h-8" {...register('bolusVolumeMl', { valueAsNumber: true })} /></Field>
          <Field label="Vasopressors started?"><YesNo control={control} name="vasopressorsStarted" /></Field>
          <Field label="MAP target reached?"><YesNo control={control} name="mapTargetReached" /></Field>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">Save FAST-HUG + Sepsis</Button>
      </div>
    </form>
  );
}
