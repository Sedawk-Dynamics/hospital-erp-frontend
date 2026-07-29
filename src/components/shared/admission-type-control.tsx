'use client';

import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AdmissionTypeBadge,
  ADMISSION_TYPE_OPTIONS,
  ADMISSION_TYPE_LABELS,
  normalizeAdmissionType,
} from './admission-type-badge';
import { useChangeAdmissionType } from '@/hooks/use-clinical';
import { getApiErrorMessage } from '@/lib/utils';

/**
 * The admission-type tag with an inline "convert" dropdown (IP ⇄ Emergency ⇄
 * Day Care). When `editable` is false it renders just the badge. Doctors,
 * nurses and front desk can convert; the backend gates by role.
 */
export function AdmissionTypeControl({
  admissionId,
  type,
  editable = true,
}: {
  admissionId: string;
  type: string | null | undefined;
  editable?: boolean;
}) {
  const change = useChangeAdmissionType();
  const current = normalizeAdmissionType(type);

  if (!editable) return <AdmissionTypeBadge type={current} />;

  const onPick = async (t: string) => {
    if (t === current) return;
    try {
      await change.mutateAsync({ id: admissionId, admissionType: t });
      toast.success(`Converted to ${ADMISSION_TYPE_LABELS[normalizeAdmissionType(t)]}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err) || 'Could not change the admission type');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-0.5 rounded outline-none hover:opacity-80"
        title="Change admission type"
      >
        <AdmissionTypeBadge type={current} />
        {change.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ADMISSION_TYPE_OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onPick(o.value)}
            disabled={change.isPending}
          >
            {o.value === current ? '✓ ' : '  '}
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
