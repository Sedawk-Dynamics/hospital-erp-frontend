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
import { abgVentSchema, AbgVentValues } from '@/lib/schema/icu-schema';
import { useSaveAbgVent } from '@/hooks/use-icu';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';


const VENT_MODES = ['PRVC', 'VCV', 'PCV', 'PSV', 'NIV-BiPAP', 'HFNC'];

export function AbgVentForm({ admissionId, weight, onSaved }: IcuFormProps) {
  const { register, handleSubmit, control, reset } = useForm({ resolver: zodResolver(abgVentSchema) });

  const save=useSaveAbgVent();

  const onSave = (values: AbgVentValues) => {
    save.mutate({ admissionId: admissionId!, ...values }, {
      onSuccess: () => { toast.success('Abg Vent saved'); reset(); onSaved?.(); },
      onError: (e) => toast.error(getApiErrorMessage(e) ?? 'Save failed'),
    });
    console.log('abg-vent', { admissionId, weight, ...values });
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-primary">Blood gas values</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="pH (7.35–7.45)"><Input type="number" step="0.01" placeholder="7.35–7.45" className="h-8" {...register('ph', { valueAsNumber: true })} /></Field>
          <Field label="PaO₂ (mmHg)"><Input type="number" placeholder="mmHg" className="h-8" {...register('paO2Mmhg', { valueAsNumber: true })} /></Field>
          <Field label="PaCO₂ (mmHg)"><Input type="number" placeholder="mmHg" className="h-8" {...register('paCo2Mmhg', { valueAsNumber: true })} /></Field>
          <Field label="HCO₃ (mEq/L)"><Input type="number" placeholder="mEq/L" className="h-8" {...register('hco3Meql', { valueAsNumber: true })} /></Field>
          <Field label="Base Excess (mEq/L)"><Input type="number" placeholder="mEq/L" className="h-8" {...register('baseExcessMeql', { valueAsNumber: true })} /></Field>
          <Field label="Lactate (mmol/L)"><Input type="number" step="0.1" placeholder="mmol/L" className="h-8" {...register('lactateMmoll', { valueAsNumber: true })} /></Field>
          <Field label="FiO₂ (%)"><Input type="number" placeholder="%" className="h-8" {...register('fio2Pct', { valueAsNumber: true })} /></Field>
          <Field label="Sodium — Na⁺ (mEq/L)"><Input type="number" placeholder="mEq/L" className="h-8" {...register('sodiumMeql', { valueAsNumber: true })} /></Field>
          <Field label="Chloride — Cl⁻ (mEq/L)"><Input type="number" placeholder="mEq/L" className="h-8" {...register('chlorideMeql', { valueAsNumber: true })} /></Field>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-primary">Ventilator settings</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Mode">
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    {VENT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Tidal volume (mL)"><Input type="number" placeholder="mL" className="h-8" {...register('tidalVolumeMl', { valueAsNumber: true })} /></Field>
          <Field label="PEEP (cmH₂O)"><Input type="number" placeholder="cmH₂O" className="h-8" {...register('peepCmh2o', { valueAsNumber: true })} /></Field>
          <Field label="Peak pressure — PIP (cmH₂O)"><Input type="number" placeholder="cmH₂O" className="h-8" {...register('pipCmh2o', { valueAsNumber: true })} /></Field>
          <Field label="Plateau pressure — Pplat (cmH₂O)"><Input type="number" placeholder="cmH₂O" className="h-8" {...register('pplatCmh2o', { valueAsNumber: true })} /></Field>
          <Field label="Breathing rate (breaths/min)"><Input type="number" placeholder="breaths/min" className="h-8" {...register('breathingRatePerMin', { valueAsNumber: true })} /></Field>
          <Field label="ETT cuff pressure (cmH₂O)"><Input type="number" placeholder="cmH₂O" className="h-8" {...register('ettCuffCmh2o', { valueAsNumber: true })} /></Field>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">Save ABG + Vent</Button>
      </div>
    </form>
  );
}
