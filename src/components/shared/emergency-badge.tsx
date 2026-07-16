import { Siren } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isEmergencyPatient } from '@/lib/emergency';

interface EmergencyBadgeProps {
  /** Pass a patient (or MRN) to auto-hide when it is not an emergency record. */
  patient?: { mrn?: string | null } | string | null;
  /** Force-render regardless of `patient` (when the caller already checked). */
  force?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

/**
 * The "EMERGENCY" highlight shown next to a casualty patient's identity across
 * the OP queue, OP consultation, IP workspace and in-patient list. Renders
 * nothing unless the patient is a temporary emergency record (or `force`).
 */
export function EmergencyBadge({
  patient,
  force,
  size = 'md',
  className,
  label = 'EMERGENCY',
}: EmergencyBadgeProps) {
  if (!force && !isEmergencyPatient(patient ?? null)) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-red-100 font-bold uppercase tracking-wide text-red-700 dark:bg-red-900/30 dark:text-red-300',
        size === 'sm' ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]',
        className,
      )}
      title="Temporary emergency / casualty patient"
    >
      <Siren className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {label}
    </span>
  );
}
