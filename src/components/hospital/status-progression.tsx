'use client';

import { ClipboardCheck, UserCheck, Stethoscope, CheckCircle2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { key: 'booked', icon: ClipboardCheck, label: 'Booked' },
  { key: 'confirmed', icon: ShieldCheck, label: 'Confirmed' },
  { key: 'checked_in', icon: UserCheck, label: 'Arrived' },
  { key: 'in_consultation', icon: Stethoscope, label: 'With Doctor' },
  { key: 'completed', icon: CheckCircle2, label: 'Completed' },
] as const;

const statusOrder: Record<string, number> = {
  booked: 0,
  confirmed: 1,
  checked_in: 2,
  in_consultation: 3,
  completed: 4,
  cancelled: -1,
  no_show: -1,
};

interface StatusProgressionProps {
  status: string;
}

export function StatusProgression({ status }: StatusProgressionProps) {
  const currentStep = statusOrder[status] ?? -1;

  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center rounded-full bg-error-container px-2.5 py-0.5 text-[10px] font-bold text-on-error-container">
        Cancelled
      </span>
    );
  }

  // Pre-booking: the patient-app booking exists but the fee is unpaid, so the
  // patient hasn't entered the five-step queue yet.
  if (status === 'pending_payment') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Pending Payment
      </span>
    );
  }

  if (status === 'no_show') {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
        No Show
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index <= currentStep;
        return (
          <div key={step.key} className="flex items-center">
            <div
              title={step.label}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                isCompleted
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-high text-on-surface-variant'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-3',
                  index < currentStep ? 'bg-primary' : 'bg-surface-container'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
