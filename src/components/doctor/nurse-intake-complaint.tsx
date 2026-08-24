'use client';

// What the nurse was told at intake, shown to the doctor.
//
// `Visit.nurseChiefComplaint` (+ who recorded it and when) has existed for a
// while and the nurse writes it from the vitals screen. The doctor's half was
// built into `SoapNoteFormDialog` — which has ZERO call sites, so it never
// rendered anywhere and the doctor has never actually seen one.
//
// The two complaints are kept as separate fields on purpose: the patient's
// words at the door and the clinician's reading of the problem are different
// statements, and one shared box meant whoever saved last replaced the other.
// So this panel does NOT edit the nurse's text. It shows it with attribution
// and offers to carry it into the doctor's own Chief Complaint, which the
// doctor then rewrites freely — the nurse's record stays as recorded.

import { ClipboardList, CornerDownRight } from 'lucide-react';
import { useVisit } from '@/hooks/use-clinical';
import { formatDateTimeAmPm } from '@/lib/date-utils';

export function NurseIntakeComplaint({
  visitId,
  /** Called with the nurse's text when the doctor chooses to use it. */
  onUse,
  /**
   * The doctor's current chief complaint. Used only to decide whether the
   * "Use this" action is worth offering — there is nothing to copy if the
   * doctor has already written the same thing.
   */
  currentValue,
  className,
}: {
  visitId?: string | null;
  onUse?: (text: string) => void;
  currentValue?: string;
  className?: string;
}) {
  const { data: visit } = useVisit(visitId ?? null);

  const text = visit?.nurseChiefComplaint?.trim() ?? '';
  if (!text) return null;

  const by = visit?.nurseChiefComplaintBy;
  const who = by ? `${by.firstName} ${by.lastName ?? ''}`.trim() : null;
  const when = visit?.nurseChiefComplaintAt;

  // Nothing to offer if the doctor's box already holds this text.
  const canUse = !!onUse && currentValue?.trim() !== text;

  return (
    <div
      className={`rounded-lg border border-tertiary/30 bg-tertiary/5 px-3 py-2 ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-tertiary">
          <ClipboardList className="h-3.5 w-3.5" />
          Recorded at intake
        </div>
        {canUse && (
          <button
            type="button"
            onClick={() => onUse?.(text)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10"
          >
            <CornerDownRight className="h-3 w-3" />
            Use this
          </button>
        )}
      </div>

      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{text}</p>

      {(who || when) && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {who ? `by ${who}` : 'by nursing'}
          {when ? ` · ${formatDateTimeAmPm(when)}` : ''}
        </p>
      )}
    </div>
  );
}
