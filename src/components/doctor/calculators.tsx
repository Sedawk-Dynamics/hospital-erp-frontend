'use client';

import { Plus, Calculator as CalculatorIcon, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, useCalculators } from '@/hooks/use-calculator';
import CalculatorDialog from './calculator-dialog';

export default function Calculators() {
  const [open, setOpen] = useState<boolean>(false);
  const { data: calculators, isLoading } = useCalculators();
  const [editing,setEditing]=useState<Calculator | null>(null);

  

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Calculators</h1>
          <p className="text-sm text-on-surface-variant">
            Build specialty-based calculators — add input fields and a formula once, then use them during OPD consultations.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {calculators.map((calc) => (
            <Card
              key={calc.id}
              className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalculatorIcon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate text-base leading-tight">{calc.name}</CardTitle>
                      <Badge
                        variant={calc.scope === 'shared' ? 'default' : 'secondary'}
                        className="shrink-0 capitalize"
                      >
                        {calc.scope}
                      </Badge>
                    </div>
                    {calc.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                        {calc.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="mt-auto space-y-3">
                <div className="rounded-md bg-surface-container-low px-3 py-2">
                  <p className="truncate font-mono text-xs text-on-surface-variant">
                    {calc.expression}
                    {calc.resultUnit ? (
                      <span className="text-on-surface-variant/70"> → {calc.resultUnit}</span>
                    ) : null}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">
                    {calc.variables.length} variable{calc.variables.length === 1 ? '' : 's'}
                  </Badge>
                  {calc.bands.length > 0 ? (
                    <Badge variant="outline">
                      {calc.bands.length} band{calc.bands.length === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
                </div>

                <Button onClick={()=>{setEditing(calc);setOpen(true)}} variant="outline" size="sm" className="w-full gap-1.5">
                  <Pencil className="size-4" /> Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CalculatorDialog open={open} onOpenChange={setOpen} calculator={editing} />
    </div>
  );
}




























































