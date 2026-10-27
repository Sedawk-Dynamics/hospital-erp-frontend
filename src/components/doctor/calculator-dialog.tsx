'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import BasicDetailsStep from './calculator/basic-details-step';
import VariablesStep from './calculator/variables-step';
import FormulaBandsStep from './calculator/formula-bands-step';
import CalculatorPreview from './calculator/calculator-preview';
import { FormProvider, useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import { type CalculatorFormValues, calculatorSchema } from '@/lib/schema/calculator-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateCalculator, type CreateCalculatorInput } from '@/hooks/use-calculator';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { title: 'Basic details', subtitle: 'Name, department and result formatting.' },
  { title: 'Variables & formula', subtitle: 'The inputs, the expression and how to read the result.' },
];

// Starting form values. One blank variable, no bands.
const DEFAULT_VALUES: CalculatorFormValues = {
  name: '',
  department: 'all',
  description: '',
  resultUnit: '',
  resultDecimals: 2,
  expression: '',
  variables: [
    { variableId: '', name: '', unit: '', min: undefined, max: undefined, step: undefined, defaultValue: undefined },
  ],
  bands: [],
};

export default function CalculatorDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);

  const methods = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorSchema) as unknown as Resolver<CalculatorFormValues>,
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const createCalculator = useCreateCalculator();

  const name = methods.watch('name');
  const expression = methods.watch('expression');

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep(0);
      methods.reset(DEFAULT_VALUES);
    }
    onOpenChange(next);
  };

  const onSubmit = async (values: CalculatorFormValues) => {
    const payload: CreateCalculatorInput = {
      name: values.name,
      description: values.description || undefined,
      expression: values.expression,
      resultUnit: values.resultUnit || undefined,
      resultDecimals: values.resultDecimals,
      specialties: values.department && values.department !== 'all' ? [values.department] : [],
      scope: 'personal',
      variables: values.variables,
      bands: values.bands,
    };
    try {
      await createCalculator.mutateAsync(payload);
      toast.success('Calculator created');
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create calculator');
    }
  };

  const isLast = step === STEPS.length - 1;
  const canNext = step === 0 ? (name ?? '').trim().length > 0 : true;
  const canCreate = (name ?? '').trim().length > 0 && (expression ?? '').trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Calculator</DialogTitle>
          <DialogDescription>{STEPS[step].subtitle}</DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
        <div className="flex items-center gap-2 pb-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                  i === step
                    ? 'bg-primary text-primary-foreground'
                    : i < step
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>
                {s.title}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        <div className="space-y-6 pt-2">
          {step === 0 && <BasicDetailsStep />}
          {step === 1 && (
            <>
              <VariablesStep />
              <FormulaBandsStep />
              <CalculatorPreview />
            </>
          )}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            {isLast ? (
              <Button type="submit" disabled={!canCreate || createCalculator.isPending}>
                {createCalculator.isPending ? 'Creating…' : 'Create calculator'}
              </Button>
            ) : (
              <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}










































