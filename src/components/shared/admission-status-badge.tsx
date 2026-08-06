import { cn } from '@/lib/utils';

/**
 * The admission's status as the ward and the counter should read it.
 *
 * "Ready to Discharge" is NOT an AdmissionStatus — it is derived server-side
 * from a published discharge summary on a still-admitted patient. The DB status
 * stays `admitted` on purpose: the patient is still in the bed, eMAR is still
 * administering, pharmacy / indents / OT / NDPS still resolve their charges
 * through `status: 'admitted'`, and room charges still accrue. Only the label
 * changes, so nobody reads them as a plain in-patient and forgets the bill.
 */
export type AdmissionStatusLike = 'admitted' | 'discharged' | 'transferred' | 'absconded' | string;

const STATUS_STYLES: Record<string, string> = {
  ready: 'bg-amber-100 text-amber-800',
  admitted: 'bg-primary/10 text-primary',
  discharged: 'bg-emerald-100 text-emerald-700',
  transferred: 'bg-blue-100 text-blue-700',
  absconded: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  ready: 'Ready to Discharge',
  admitted: 'Admitted',
  discharged: 'Discharged',
  transferred: 'Transferred',
  absconded: 'Absconded',
};

/** The key a row should be bucketed under — `ready` outranks `admitted`. */
export function admissionStatusKey(
  status: AdmissionStatusLike | null | undefined,
  dischargeReady?: boolean | null,
): string {
  if (dischargeReady && status === 'admitted') return 'ready';
  return status ?? 'admitted';
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
