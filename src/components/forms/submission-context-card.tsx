'use client';

import {
  Workflow,
  User,
  Stethoscope,
  Calendar,
  ClipboardList,
  BedDouble,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTimeAmPm, formatTime24 } from '@/lib/date-utils';
import { TRIGGER_LABELS, type FormSubmission } from '@/types/forms';

// ─────────────────────────────────────────────────────────
// Read-only "Where did this form come from?" card.
// Shows the workflow purpose (trigger), who filled it,
// the patient, and any linked entity (appointment / visit / admission).
//
// Use anywhere a form submission is displayed so the viewer can answer:
//   - What workflow generated this?
//   - Who filled it?
//   - Which patient + which encounter?
// ─────────────────────────────────────────────────────────

interface SubmissionContextCardProps {
  submission: FormSubmission;
  /** Compact mode shrinks padding/typography for use in tight spaces */
  compact?: boolean;
}

export function SubmissionContextCard({
  submission: s,
  compact = false,
}: SubmissionContextCardProps) {
  const triggerLabel = s.trigger ? TRIGGER_LABELS[s.trigger] : 'Manual / On-demand';

  const items: Array<{
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
  }> = [];

  // Purpose / trigger
  items.push({
    icon: Workflow,
    label: 'Purpose',
    value: triggerLabel,
  });

  // Patient
  if (s.patient) {
    items.push({
      icon: User,
      label: 'Patient',
      value: (
        <span>
          {s.patient.firstName} {s.patient.lastName || ''}{' '}
          <span className="text-muted-foreground font-normal">({s.patient.mrn})</span>
        </span>
      ),
    });
  }

  // Submitter
  if (s.submitter) {
    items.push({
      icon: ClipboardList,
      label: 'Filled by',
      value: `${s.submitter.firstName} ${s.submitter.lastName || ''}`.trim(),
    });
  }

  // Submitted at
  items.push({
    icon: Clock,
    label: 'Submitted',
    value: formatDateTimeAmPm(s.submittedAt),
  });

  // Linked appointment
  if (s.appointment) {
    const apt = s.appointment;
    const doctorName = apt.doctor?.user
      ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
      : 'Doctor';
    items.push({
      icon: Calendar,
      label: 'Appointment',
      value: (
        <span>
          {formatDate(apt.appointmentDate)} {formatTime24(apt.startTime)}
          <span className="text-muted-foreground"> · </span>
          {doctorName}
          {apt.doctor?.specialization && (
            <span className="text-muted-foreground"> · {apt.doctor.specialization}</span>
          )}
          {apt.reason && (
            <span className="text-muted-foreground italic block mt-0.5">
              Reason: {apt.reason}
            </span>
          )}
        </span>
      ),
    });
  }

  // Linked visit (only if no appointment shown — visit is usually tied to an appointment)
  if (s.visit && !s.appointment) {
    items.push({
      icon: Stethoscope,
      label: 'Visit',
      value: (
        <span>
          {s.visit.visitType.toUpperCase()}
          <span className="text-muted-foreground"> · {formatDate(s.visit.visitDate)}</span>
          {s.visit.chiefComplaint && (
            <span className="text-muted-foreground italic block mt-0.5">
              Complaint: {s.visit.chiefComplaint}
            </span>
          )}
        </span>
      ),
    });
  }

  // Linked admission
  if (s.admission) {
    items.push({
      icon: BedDouble,
      label: 'Admission',
      value: (
        <span>
          Admitted {formatDate(s.admission.admissionDate)}
          {s.admission.dischargeDate && (
            <>
              <span className="text-muted-foreground"> → </span>
              Discharged {formatDate(s.admission.dischargeDate)}
            </>
          )}
          <span className="text-muted-foreground"> · {s.admission.status}</span>
        </span>
      ),
    });
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-primary/20 bg-primary/5',
        compact ? 'px-3 py-2' : 'px-4 py-3',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 font-bold uppercase tracking-wider text-primary mb-2',
          compact ? 'text-[9px]' : 'text-[10px]',
        )}
      >
        <Workflow className="h-3 w-3" />
        Workflow context
      </div>
      <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-start gap-2">
              <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 leading-tight">
                <p
                  className={cn(
                    'font-label uppercase tracking-wider text-muted-foreground',
                    compact ? 'text-[9px]' : 'text-[10px]',
                  )}
                >
                  {item.label}
                </p>
                <div className={cn('font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
                  {item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
