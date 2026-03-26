'use client';

import { cn } from '@/lib/utils';

type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const statusColorMap: Record<string, StatusVariant> = {
  // General
  active: 'success',
  inactive: 'muted',
  enabled: 'success',
  disabled: 'muted',

  // Appointments
  scheduled: 'info',
  checked_in: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'muted',

  // Lab
  sample_collected: 'info',
  routine: 'default',
  stat: 'danger',

  // Billing
  draft: 'muted',
  pending: 'warning',
  partially_paid: 'warning',
  paid: 'success',
  refunded: 'info',
  failed: 'danger',

  // Queue
  waiting: 'warning',
  serving: 'info',
  skipped: 'muted',

  // Severity
  mild: 'info',
  moderate: 'warning',
  severe: 'danger',

  // Admissions
  admitted: 'info',
  discharged: 'success',
  transferred: 'warning',
  absconded: 'danger',

  // Priority
  low: 'muted',
  normal: 'default',
  high: 'warning',
  urgent: 'danger',
  emergency: 'danger',

  // Diagnoses
  resolved: 'success',
  chronic: 'warning',
  recurrence: 'info',
  critical: 'danger',

  // Prescriptions
  dispensed: 'success',
  partially_dispensed: 'warning',
  expired: 'muted',

  // Imaging
  requested: 'info',
  report_ready: 'success',

  // Insurance
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  under_review: 'warning',

  // Blood Bank
  screened: 'info',
  available: 'success',
  reserved: 'warning',
  used: 'muted',
  discarded: 'danger',
  compatible: 'success',
  incompatible: 'danger',

  // HR
  present: 'success',
  absent: 'danger',
  half_day: 'warning',
  on_leave: 'info',
  late: 'warning',
  published: 'success',

  // Tickets
  open: 'info',
  closed: 'muted',
  assigned: 'info',
  investigating: 'warning',

  // Inventory
  low_stock: 'danger',
  in_stock: 'success',
  out_of_stock: 'danger',
  received: 'success',
  ordered: 'info',
};

const variantStyles: Record<StatusVariant, string> = {
  default: 'bg-surface-container-high text-on-surface-variant',
  success: 'bg-primary/10 text-primary',
  warning: 'bg-secondary/10 text-secondary',
  danger: 'bg-error-container text-on-error-container',
  info: 'bg-primary-container/10 text-primary-container',
  muted: 'bg-surface-container-high text-on-surface-variant',
};

const dotColorMap: Record<StatusVariant, string> = {
  default: 'bg-on-surface-variant/60',
  success: 'bg-primary',
  warning: 'bg-secondary',
  danger: 'bg-error',
  info: 'bg-primary-container',
  muted: 'bg-on-surface-variant/50',
};

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const resolvedVariant = variant || statusColorMap[status.toLowerCase()] || 'default';
  const displayText = status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] font-bold font-label px-2 py-0.5 rounded-full',
        variantStyles[resolvedVariant],
        className
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', dotColorMap[resolvedVariant])} />
      {displayText}
    </span>
  );
}
