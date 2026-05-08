'use client';

// ───────────────────────────────────────────────────────────────────────
// Consultation Summary Panel
//
// Renders the patient-facing consultation summary composed from the per-section
// pin entries the doctor flagged inside the consultation form. Three modes:
//
//   • view (read-only)        — used inside the patient portal
//   • doctor + active note    — adds a "Sign & Finalize" button
//   • doctor + finalized note — locked, shows signer + sign timestamp
//
// The pin rows live on ProgressNote.pins and are returned by the standard
// /progress-notes endpoints (and the patient-portal mirror endpoint).
// ───────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Lock, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiPatch } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  CONSULTATION_PIN_SECTIONS,
  CONSULTATION_PIN_SECTION_LABELS,
  type ConsultationPinSection,
} from './consultation-completion/consultation-completion-schema';
import type { ProgressNote, ProgressNotePinEntry } from '@/hooks/use-doctor';
import { doctorKeys } from '@/hooks/use-doctor';
import { cn } from '@/lib/utils';

export interface ConsultationSummaryPanelProps {
  note: ProgressNote | null | undefined;
  /** Set true on the doctor's consultation page; false on the patient portal. */
  canSign?: boolean;
  /** Show the "Awaiting doctor sign-off" disclaimer on the patient view. */
  patientView?: boolean;
}

const PIN_SECTION_SET = new Set<ConsultationPinSection>(CONSULTATION_PIN_SECTIONS);

function isConsultationSection(s: string): s is ConsultationPinSection {
  return PIN_SECTION_SET.has(s as ConsultationPinSection);
}

export function ConsultationSummaryPanel({
  note,
  canSign,
  patientView,
}: ConsultationSummaryPanelProps) {
  const queryClient = useQueryClient();
  const [signing, setSigning] = useState(false);

  // Filter to consultation-relevant pin sections only — IP discharge sections
  // (hospital_course, procedure, medication, general) are skipped here so the
  // OP-flow summary stays focused.
  const orderedPins = useMemo(() => {
    const pins = (note?.pins ?? []) as ProgressNotePinEntry[];
    const bySection = new Map<ConsultationPinSection, ProgressNotePinEntry[]>();
    for (const p of pins) {
      if (!isConsultationSection(p.dischargeSection)) continue;
      const arr = bySection.get(p.dischargeSection) ?? [];
      arr.push(p);
      bySection.set(p.dischargeSection, arr);
    }
    return CONSULTATION_PIN_SECTIONS.flatMap((section) =>
      (bySection.get(section) ?? []).map((p) => ({ section, pin: p })),
    );
  }, [note]);

  const isFinalized = note?.status === 'finalized' || !!note?.signedAt;
  const signerName = note?.signer
    ? `Dr. ${note.signer.firstName ?? ''} ${note.signer.lastName ?? ''}`.trim()
    : null;

  const handleSign = async () => {
    if (!note?.id) return;
    setSigning(true);
    try {
      await apiPatch(`/progress-notes/${note.id}/sign`);
      toast.success('Consultation summary signed and finalized');
      queryClient.invalidateQueries({ queryKey: doctorKeys.progressNotes.all });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to sign consultation');
    } finally {
      setSigning(false);
    }
  };

  // Empty / unsigned-no-pins states
  if (!note || orderedPins.length === 0) {
    return (
      <section className="rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4 border-primary/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Pin className="h-4 w-4 text-primary/70" />
          <h2 className="font-headline text-sm font-bold">Consultation Summary</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {patientView
            ? 'Your doctor has not published a consultation summary yet.'
            : note
              ? 'No sections were pinned during this consultation. Edit the consultation to pin sections you want the patient to see.'
              : 'No consultation note recorded yet.'}
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'rounded-xl bg-surface-container-lowest shadow-sanctuary border-l-4',
        isFinalized ? 'border-primary' : 'border-secondary',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-3">
        <div
          className={cn(
            'p-2 rounded-lg',
            isFinalized ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary',
          )}
        >
          {isFinalized ? <Lock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-headline text-base font-bold">Consultation Summary</h2>
          <p className="font-label text-[11px] text-on-surface-variant">
            {isFinalized
              ? signerName && note.signedAt
                ? `Signed by ${signerName} · ${formatDateTimeAmPm(note.signedAt)}`
                : 'Signed and finalized'
              : 'Draft — awaiting doctor sign-off'}
          </p>
        </div>
        {isFinalized ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" />
            Finalized
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 text-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Draft
          </span>
        )}
      </div>

      {/* Pinned sections */}
      <ul className="px-5 py-4 space-y-3">
        {orderedPins.map(({ section, pin }) => (
          <li
            key={pin.id}
            className="rounded-lg border border-outline-variant/30 bg-background/60 p-3"
          >
            <p className="font-label text-[10px] uppercase tracking-widest text-primary font-bold mb-1.5">
              {CONSULTATION_PIN_SECTION_LABELS[section]}
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{pin.content}</p>
          </li>
        ))}
      </ul>

      {/* Actions / disclosure */}
      {patientView && !isFinalized ? (
        <div className="border-t border-outline-variant/30 px-5 py-3 bg-secondary/5">
          <p className="text-xs text-secondary font-medium">
            This summary is still a draft and may change before your doctor signs and publishes it.
          </p>
        </div>
      ) : null}

      {canSign && !isFinalized ? (
        <div className="flex items-center gap-3 border-t border-outline-variant/30 px-5 py-3 bg-background/60">
          <p className="flex-1 text-xs text-muted-foreground">
            Once you sign, this summary becomes read-only and visible to the patient via their
            portal.
          </p>
          <Button onClick={handleSign} disabled={signing} className="h-8 gap-1.5">
            {signing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {signing ? 'Signing…' : 'Sign & Finalize'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
