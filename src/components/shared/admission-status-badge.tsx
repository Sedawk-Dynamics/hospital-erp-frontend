import { cn } from '@/lib/utils';

/**
 * The admission's status as the ward and the counter should read it.
 *
 * `ready_to_discharge` is a real AdmissionStatus: the doctor has published the
 * discharge summary and the patient is clinically cleared, but they are STILL
 * IN THE BED until Front Desk / Billing clears the final bill. It is an ACTIVE
 * admission everywhere in the backend (see shared/admission-status.ts) — eMAR
 * still administers, the bed still reads occupied, room charges still accrue.
 * Only `discharged` ends the stay.
 */
export type AdmissionStatusLike =
  | 'admitted'
  | 'ready_to_discharge'
  | 'discharged'
  | 'transferred'
  | 'absconded'
  | string;

const STATUS_STYLES: Record<string, string> = {
  ready_to_discharge: 'bg-amber-100 text-amber-800',
  admitted: 'bg-primary/10 text-primary',
  discharged: 'bg-emerald-100 text-emerald-700',
  transferred: 'bg-blue-100 text-blue-700',
  absconded: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  ready_to_discharge: 'Ready to Discharge',
  admitted: 'Admitted',
  discharged: 'Discharged',
  transferred: 'Transferred',
  absconded: 'Absconded',
};

/**
 * The key a row is bucketed under. `dischargeReady` is still honoured so a
 * client reading an older payload (flag only, status not yet migrated) lands on
 * the same bucket.
 */
export function admissionStatusKey(
  status: AdmissionStatusLike | null | undefined,
  dischargeReady?: boolean | null,
): string {
  if (status === 'ready_to_discharge') return 'ready_to_discharge';
  if (dischargeReady && status === 'admitted') return 'ready_to_discharge';
  return status ?? 'admitted';
}

/** True while the patient still occupies a bed. Mirrors the backend set. */
export function isActiveAdmissionStatus(status: AdmissionStatusLike | null | undefined): boolean {
  return status === 'admitted' || status === 'ready_to_discharge';
}

export function admissionStatusLabel(
  status: AdmissionStatusLike | null | undefined,
  dischargeReady?: boolean | null,
): string {
  const key = admissionStatusKey(status, dischargeReady);
  return STATUS_LABELS[key] ?? String(status ?? '—').replace(/_/g, ' ');
}

export function AdmissionStatusBadge({
  status,
  dischargeReady,
  className,
}: {
  status: AdmissionStatusLike | null | undefined;
  dischargeReady?: boolean | null;
  className?: string;
}) {
  const key = admissionStatusKey(status, dischargeReady);
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        STATUS_STYLES[key] ?? 'bg-slate-100 text-slate-600',
        className,
      )}
    >
      {admissionStatusLabel(status, dischargeReady)}
    </span>
  );
}
