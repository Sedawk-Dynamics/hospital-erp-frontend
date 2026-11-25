'use client';

import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** Small labelled field wrapper for the dense ICU grids. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export interface IcuFormProps {
  admissionId?: string;
  weight?: number;
  /** Called after a successful save — e.g. to close the modal. */
  onSaved?: () => void;
}
