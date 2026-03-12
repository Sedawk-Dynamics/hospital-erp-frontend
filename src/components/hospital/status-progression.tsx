'use client';

import { ClipboardCheck, UserCheck, Stethoscope, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { key: 'scheduled', icon: ClipboardCheck, label: 'Registered' },
  { key: 'checked_in', icon: UserCheck, label: 'Arrived' },
  { key: 'in_progress', icon: Stethoscope, label: 'With Doctor' },
  { key: 'completed', icon: CheckCircle2, label: 'Completed' },
] as const;

const statusOrder: Record<string, number> = {
  scheduled: 0,
  checked_in: 1,
  in_progress: 2,
  completed: 3,
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
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        Cancelled
      </span>
    );
  }

  if (status === 'no_show') {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
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
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-3',
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
