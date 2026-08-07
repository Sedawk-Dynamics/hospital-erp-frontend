'use client';

// ============================================================
// Set / change the treating consultant on an admission, inline.
//
// `Admission.doctorId` is nullable so the front desk can open an emergency
// admission before a consultant is named — the common case for a walk-in
// trauma. But nothing in the app could fill it in afterwards, so the stay had
// nobody answerable for it and never appeared on any doctor's list.
//
// Read-only surfaces just render the name; where the caller is allowed to
// change it, this becomes a picker.
// ============================================================

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAssignAdmissionDoctor } from '@/hooks/use-clinical';
import type { DoctorProfile } from '@/types';

export interface AdmissionDoctorControlProps {
  admissionId: string;
  /** Current consultant, if any. */
  doctor?: { id?: string; user?: { firstName?: string | null; lastName?: string | null } | null } | null;
  /** False on read-only surfaces — renders just the name. */
  editable?: boolean;
  className?: string;
}

const nameOf = (d?: { user?: { firstName?: string | null; lastName?: string | null } | null } | null) =>
  d?.user ? `Dr. ${d.user.firstName ?? ''} ${d.user.lastName ?? ''}`.trim() : '';

export function AdmissionDoctorControl({
  admissionId,
  doctor,
  editable = false,
  className,
}: AdmissionDoctorControlProps) {
  const assign = useAssignAdmissionDoctor();
  const [open, setOpen] = useState(false);
  // Only fetch the doctor list once the picker is actually opened — this
  // renders on every row of the IP ledger.
  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => apiGet<DoctorProfile[]>('/appointments/doctors', { params: { limit: 100 } }),
    enabled: open,
  });
  const doctors = doctorsData?.data ?? [];

  const current = nameOf(doctor);

  if (!editable) {
    return current ? (
      <span className={className}>{current}</span>
    ) : (
      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[10px] text-amber-800">
        Unassigned
      </Badge>
    );
  }

  const choose = async (doctorId: string | null) => {
    try {
      await assign.mutateAsync({ id: admissionId, doctorId });
      toast.success(doctorId ? 'Consultant assigned' : 'Consultant cleared');
      setOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not change the consultant'));
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'text-left text-sm hover:text-primary hover:underline'}
        title="Set the treating consultant"
      >
        {current || (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <UserPlus className="h-3 w-3" /> Assign doctor
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={doctor?.id ?? null}
        onValueChange={(v: string | null) => choose(v && v !== '__none__' ? v : null)}
      >
        <SelectTrigger className="h-8 min-w-[170px] text-xs">
          <SelectValue placeholder="Select a consultant">
            {() => current || 'Select a consultant'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— No consultant —</SelectItem>
          {doctors.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {nameOf(d) || d.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {assign.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
