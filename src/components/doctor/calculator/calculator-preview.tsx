'use client';

import { Parser } from 'expr-eval';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type CalculatorFormValues } from '@/lib/schema/calculator-schema';
import { useEffect, useState } from 'react';

export default function CalculatorPreview() {
  const { watch } = useFormContext<CalculatorFormValues>();
  const variables = watch('variables') ?? [];
  const expression = watch('expression');
  const resultUnit = watch('resultUnit');
  const resultDecimals = watch('resultDecimals');
  const [calculatedResult, setCalculatedResult] = useState<number>();

  const displayResult =
    typeof calculatedResult === 'number' && Number.isFinite(calculatedResult)
      ? calculatedResult.toFixed(resultDecimals ?? 2)
      : '—';
  const [previewVal, setPreviewVal] = useState<Record<string, string>>({});

  const handleChange = (id: string, value: string) => {
  setPreviewVal((prev) => ({ ...prev, [id]: value }));
};

useEffect(() => {
  try {
    const scope: Record<string, number> = {};
    for (const id in previewVal) scope[id] = Number(previewVal[id]);

    const result = Parser.evaluate(expression, scope);
    setCalculatedResult(result);
  } catch {
    setCalculatedResult(undefined);
  }
}, [previewVal, expression]);


  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3">
        <Label className="text-base">Preview</Label>
        <p className="text-xs text-on-surface-variant">
          Try the calculator with sample values to see how it works.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {variables.map((v, i) => (
          <div key={i} className="space-y-1.5">
            <Label className="text-xs">
              {v.name || v.variableId || `Variable ${i + 1}`}
              {v.unit ? ` (${v.unit})` : ''}
            </Label>
            <Input type="number"  placeholder="Enter value" onChange={(e)=>handleChange(v.variableId,e.target.value)} />
          </div>
        ))}
        {variables.length === 0 && (
          <p className="text-sm text-on-surface-variant sm:col-span-3">
            Add variables above to see preview inputs.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-md border bg-card p-3">
        <div>
          <p className="text-xs text-on-surface-variant">Result </p>
          <p className="font-mono text-xs text-on-surface-variant">{expression || '—'}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-semibold">{displayResult}</span>
          {resultUnit && displayResult !== '—' ? (
            <span className="ml-1 text-sm text-on-surface-variant">{resultUnit}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
