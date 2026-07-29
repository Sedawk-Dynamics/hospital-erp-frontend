import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Admission care type — IP / Emergency / Day Care. All three run the same IP
// flow; this is only a tag + filter dimension. Null/unknown → IP.
export const ADMISSION_TYPES = ['ip', 'emergency', 'daycare'] as const;
export type AdmissionType = (typeof ADMISSION_TYPES)[number];

export const ADMISSION_TYPE_LABELS: Record<AdmissionType, string> = {
  ip: 'IP',
  emergency: 'Emergency',
  daycare: 'Day Care',
};

export const ADMISSION_TYPE_OPTIONS: { value: AdmissionType; label: string }[] =
  ADMISSION_TYPES.map((v) => ({ value: v, label: ADMISSION_TYPE_LABELS[v] }));

const TYPE_STYLES: Record<AdmissionType, string> = {
  ip: 'bg-blue-100 text-blue-700',
  emergency: 'bg-red-100 text-red-700',
  daycare: 'bg-amber-100 text-amber-700',
};

export function normalizeAdmissionType(v: unknown): AdmissionType {
  return (ADMISSION_TYPES as readonly string[]).includes(v as string) ? (v as AdmissionType) : 'ip';
}

export function AdmissionTypeBadge({
  type,
  className,
}: {
  type: string | null | undefined;
  className?: string;
}) {
  const t = normalizeAdmissionType(type);
  return (
    <Badge variant="outline" className={cn('capitalize', TYPE_STYLES[t], className)}>
      {ADMISSION_TYPE_LABELS[t]}
    </Badge>
  );
}
