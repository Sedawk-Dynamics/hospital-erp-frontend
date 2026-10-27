'use client';

import { Plus, Calculator as CalculatorIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCalculators } from '@/hooks/use-calculator';
import CalculatorDialog from './calculator-dialog';

export default function Calculators() {
  const [open, setOpen] = useState<boolean>(false);
  const { data: calculators, isLoading } = useCalculators();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Calculators</h1>
          <p className="text-sm text-on-surface-variant">
            Build specialty-based calculators — add input fields and a formula once, then use them during OPD consultations.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> Add Calculator
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : !calculators || calculators.length === 0 ? (
        <div className="flex flex-col items-center h-screen justify-center rounded-lg border border-dashed text-center">
          <CalculatorIcon className="mb-3 size-10 text-on-surface-variant" />
          <p className="text-sm text-on-surface-variant">No calculators added yet.</p>
          <p className="text-xs text-on-surface-variant">
            Click “Add Calculator” to create your first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 py-10">
          {calculators.map((calc) => (
            <Card key={calc.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{calc.name}</CardTitle>
                  <Badge variant="secondary" className="capitalize">
                    {calc.scope}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-mono text-xs text-on-surface-variant">{calc.expression}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">
                    {calc.variables.length} variable{calc.variables.length === 1 ? '' : 's'}
                  </Badge>
                  {calc.specialties.length > 0 ? (
                    calc.specialties.map((s) => (
                      <Badge key={s} variant="outline" className="capitalize">
                        {s.replace(/_/g, ' ')}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">All specialties</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CalculatorDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}




























































