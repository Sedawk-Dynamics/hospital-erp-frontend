'use client';

import { ShieldAlert, Lock, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DrugSchedule } from '@/hooks/use-pharmacy';

/**
 * What the controlled lines in this cart need before the sale can be billed.
 *
 * Replaces a hard refusal. The old behaviour threw the cashier out of the
 * counter with "dispense it via the NDPS workflow"; this tells them what is
 * missing and lets them fix it where they are.
 *
 * Renders nothing at all when the cart holds no controlled drug, which is the
 * overwhelmingly common case — the counter should not carry a compliance panel
 * for a box of paracetamol.
 */

export interface ControlledLine {
  drugName: string;
  schedule: DrugSchedule | null;
  controlledClass: 'narcotic' | 'psychotropic' | null;
  vaultControlled: boolean;
}

export interface WitnessOption {
  id: string;
  name: string;
  role?: string | null;
}

/** Mirrors the server's resolveControlRequirements, which stays authoritative. */
export function controlledLinesOf(lines: ControlledLine[]): ControlledLine[] {
  return lines.filter(
    (l) => l.vaultControlled || l.controlledClass || l.schedule === 'X' || l.schedule === 'H1',
  );
}

export function cartNeedsRx(lines: ControlledLine[]): boolean {
  return controlledLinesOf(lines).length > 0;
}

export function cartNeedsWitness(lines: ControlledLine[]): boolean {
  return lines.some((l) => l.vaultControlled);
}

export function ControlledDrugPanel({
  lines,
  hasRx,
  witnessName,
  onRequestWitness,
  enforced,
}: {
  lines: ControlledLine[];
  /** True when either an in-system or an outside prescription is attached. */
  hasRx: boolean;
  /** Who has already co-signed, if anyone. */
  witnessName: string | null;
  /** Opens the co-sign dialog, where the witness enters their own password. */
  onRequestWitness: () => void;
  /**
   * False while the hospital is still on the legacy block. The panel then
   * informs rather than demands — nothing is being enforced yet.
   */
  enforced: boolean;
}) {
  const controlled = controlledLinesOf(lines);
  if (controlled.length === 0) return null;

  const needsWitness = cartNeedsWitness(controlled);
  const rxMissing = enforced && !hasRx;
  const witnessMissing = enforced && needsWitness && !witnessName;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-warning/20 px-4 py-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
        <h3 className="flex-1 text-sm font-bold text-warning">
          Controlled {controlled.length === 1 ? 'medicine' : 'medicines'} in this sale
        </h3>
      </div>

      <ul className="space-y-1 px-4 py-2">
        {controlled.map((l, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            {l.vaultControlled ? (
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-error" />
            ) : (
              <FileCheck2 className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
            )}
            <span>
              <span className="font-medium">{l.drugName}</span>
              {l.schedule ? <span className="text-muted-foreground"> · Schedule {l.schedule}</span> : null}
              {l.vaultControlled ? (
                <span className="text-error"> · safe custody, needs a witness</span>
              ) : (
                <span className="text-muted-foreground"> · prescription + register entry</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-2 border-t border-warning/20 px-4 py-2">
        <p className={`text-xs ${rxMissing ? 'font-semibold text-error' : 'text-muted-foreground'}`}>
          {hasRx
            ? '✓ Prescription attached.'
            : enforced
              ? 'A prescription is required. Select the patient’s prescription, or record the outside prescription they presented.'
              : 'No prescription attached. Recording one keeps the register complete.'}
        </p>

        {needsWitness && (
          <div className="space-y-1.5">
            <p className={`text-xs ${witnessMissing ? 'font-semibold text-error' : 'text-muted-foreground'}`}>
              {witnessName
                ? `✓ Witnessed by ${witnessName}.`
                : enforced
                  ? 'A second authorised person must co-sign with their own password.'
                  : 'A second person would normally co-sign this hand-over.'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onRequestWitness}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {witnessName ? 'Change witness' : 'Add witness'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
