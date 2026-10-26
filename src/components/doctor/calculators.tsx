'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import CalculatorDialog from './calculator-dialog';

export default function Calculators() {
    const [open,setOpen]=useState<boolean>(false);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline">Calculators</h1>
          <p className="text-sm text-on-surface-variant">
            Build specialty-based calculators — add input fields and a formula once, then use them during OPD consultations.
          </p>
        </div>
        <Button onClick={()=>setOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> Add Calculator
        </Button>
      </div>
      <CalculatorDialog open={open} onOpenChange={setOpen}/>
    </div>
  );
}
