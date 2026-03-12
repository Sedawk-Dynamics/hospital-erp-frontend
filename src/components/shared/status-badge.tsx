'use client';

import { Badge } from '@/components/ui/badge';
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
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  muted: 'bg-muted text-muted-foreground',
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
    <Badge
      className={cn(
        'font-medium border-0',
        variantStyles[resolvedVariant],
        className
      )}
    >
      {displayText}
    </Badge>
  );
}
