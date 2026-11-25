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
import { invasiveLineSchema, type InvasiveLineValues } from '@/lib/schema/icu-schema';
import { useSaveInvasiveLine } from '@/hooks/use-icu';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

export function InvasiveLineForm({ admissionId, onSaved }: IcuFormProps) {
  const { register, handleSubmit, control, reset } = useForm({ resolver: zodResolver(invasiveLineSchema) });

  const save = useSaveInvasiveLine();

  const onSave = (values: InvasiveLineValues) => {
    save.mutate({ admissionId: admissionId!, ...values }, {
      onSuccess: () => { toast.success('Invasive line saved'); reset(); onSaved?.(); },
      onError: (e) => toast.error(getApiErrorMessage(e) ?? 'Save failed'),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Device type"><Input className="h-8" placeholder="Central line, arterial line…" {...register('deviceType')} /></Field>
        <Field label="Status">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-8 w-full"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Body site"><Input className="h-8" placeholder="Right IJV, left radial…" {...register('bodySite')} /></Field>
        <Field label="Details"><Input className="h-8" {...register('details')} /></Field>
        <Field label="Inserted on"><Input type="datetime-local" className="h-8" {...register('insertedAt')} /></Field>
        <Field label="Inserted by"><Input className="h-8" {...register('insertedBy')} /></Field>
        <Field label="Dressing due"><Input type="date" className="h-8" {...register('dressingDue')} /></Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm">Save Invasive Line</Button>
      </div>
    </form>
  );
}
