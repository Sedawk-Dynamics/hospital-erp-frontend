'use client';

import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ShieldCheck, QrCode, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DrugSchedule } from '@/hooks/use-pharmacy';

/**
 * Three independent facts about a medicine, shown as three chips because
 * collapsing any two of them misleads:
 *
 *   ScheduleBadge    what the counter must collect (Drugs & Cosmetics Rules)
 *   ControlledBadge  whether the NDPS list names it, and which register
 *   QrBadge          whether the pack must be scanned (Schedule H2)
 *
 * Tramadol is Schedule H1 — prescription plus a register line — AND a
 * psychotropic, so it belongs in the controlled register, yet never needs safe
 * custody. Dolo 650 is on the H2 anti-counterfeiting list yet is plain OTC.
 * One chip could not say either of those things.
 *
 * Advisory only for now — nothing here blocks a sale.
 */

const SCHEDULE_STYLE: Record<DrugSchedule, { label: string; className: string; title: string }> = {
  X: {
    label: 'Schedule X',
    className: 'bg-error/15 text-error border-error/30',
    title:
      'Schedule X — prescription required in duplicate; the pharmacy retains one copy for 2 years and keeps the stock under lock and key.',
  },
  H1: {
    label: 'Schedule H1',
    className: 'bg-warning/15 text-warning border-warning/30',
    title:
      'Schedule H1 — prescription required, and the sale must be entered in the H1 register (kept for 3 years).',
  },
  H: {
    label: 'Schedule H',
    className: 'bg-info/15 text-info border-info/30',
    title: 'Schedule H — prescription drug. To be sold on the prescription of a registered medical practitioner.',
  },
  // Kept only so a row overridden to H2 by hand before the classifier stopped
  // treating it as a schedule still renders. Nothing produces this any more —
  // the QR obligation is QrBadge.
  H2: {
    label: 'Schedule H2',
    className: 'bg-primary/15 text-primary border-primary/30',
    title: 'Schedule H2 — a QR/barcode tracking obligation, not a prescription gate.',
  },
  G: {
    label: 'Schedule G',
    className: 'bg-muted text-muted-foreground border-border',
    title:
      'Schedule G — not a prescription drug. The pack carries the caution "it is dangerous to take this preparation except under medical supervision".',
  },
  OTC: {
    label: 'OTC',
    className: 'bg-success/10 text-success border-success/25',
    title: 'Not listed in any schedule — sold over the counter.',
  },
};

export function ScheduleBadge({
  schedule,
  reason,
  source,
  className,
  showOtc = false,
}: {
  schedule?: DrugSchedule | null;
  reason?: string | null;
  source?: 'auto' | 'inherited' | 'manual' | null;
  className?: string;
  /** OTC is the common case, so it is hidden unless a caller asks for it. */
  showOtc?: boolean;
}) {
  if (!schedule) return null;
  if (schedule === 'OTC' && !showOtc) return null;
  const style = SCHEDULE_STYLE[schedule];
  if (!style) return null;

  // The reason is the useful tooltip when we have one — it explains WHICH salt
  // put the drug in this schedule, which is what a pharmacist actually asks.
  const title = [style.title, reason, source === 'manual' ? 'Set manually by a pharmacy administrator.' : null]
    .filter(Boolean)
    .join('\n\n');

  return (
    <Badge variant="outline" className={cn('gap-1 text-[10px] font-semibold', style.className, className)} title={title}>
      {schedule === 'X' ? <ShieldAlert className="h-3 w-3 shrink-0" /> : null}
      {schedule === 'H2' ? <QrCode className="h-3 w-3 shrink-0" /> : null}
      {style.label}
      {source === 'manual' ? <span className="opacity-70">•</span> : null}
    </Badge>
  );
}

/**
 * Schedule H2 — the ~300 formulations notified under Rule 96(6)-(7) whose packs
 * carry a QR/barcode so they can be authenticated. It rides ALONGSIDE the
 * schedule: a drug can be OTC and QR-tracked, or Schedule H and QR-tracked.
 */
export function QrBadge({
  requiresQrScan,
  className,
}: {
  requiresQrScan?: boolean | null;
  className?: string;
}) {
  if (!requiresQrScan) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-[10px] font-semibold bg-primary/15 text-primary border-primary/30',
        className,
      )}
      title="Schedule H2 formulation — the pack carries a QR/barcode to be scanned at sale so it can be authenticated. This is an anti-counterfeiting obligation, not a prescription requirement."
    >
      <QrCode className="h-3 w-3 shrink-0" />
      QR tracked
    </Badge>
  );
}

export function ControlledBadge({
  controlledClass,
  vaultControlled,
  className,
}: {
  controlledClass?: 'narcotic' | 'psychotropic' | null;
  vaultControlled?: boolean;
  className?: string;
}) {
  if (!controlledClass) return null;
  const vaulted = Boolean(vaultControlled);
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-[10px] font-semibold',
        vaulted
          ? 'bg-error/10 text-error border-error/40'
          : 'bg-warning/10 text-warning border-warning/30',
        className,
      )}
      title={
        vaulted
          ? 'NDPS controlled substance held in the narcotic safe. Issue requires vault custody and a witness co-sign.'
          : 'Named in the NDPS list, so it appears in the controlled-drug register — but it is dispensed normally under its own schedule, not from the safe.'
      }
    >
      {vaulted ? <Lock className="h-3 w-3 shrink-0" /> : <ShieldCheck className="h-3 w-3 shrink-0" />}
      {controlledClass === 'narcotic' ? 'Narcotic' : 'Psychotropic'}
      {vaulted ? ' · Vault' : null}
    </Badge>
  );
}
