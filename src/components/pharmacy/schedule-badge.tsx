'use client';

import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ShieldCheck, QrCode, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DrugSchedule } from '@/hooks/use-pharmacy';

/**
 * The drug's schedule under the Drugs & Cosmetics Rules 1945, and — separately —
 * whether the NDPS list names it.
 *
 * These are two independent facts and the UI shows them as two chips, because
 * collapsing them misleads: tramadol is Schedule H1 (so the counter needs a
 * prescription and a register line) AND a psychotropic (so it belongs in the
 * controlled-drug register), while never needing safe custody.
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
  H2: {
    label: 'Schedule H2',
    className: 'bg-primary/15 text-primary border-primary/30',
    title: 'Schedule H2 — a named formulation carrying a QR/barcode tracking obligation. Not a prescription gate.',
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
