'use client';

import { ShieldAlert, Lock, FileCheck2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
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
  witnessOptions,
  witnessId,
  onWitnessChange,
  enforced,
}: {
  lines: ControlledLine[];
  /** True when either an in-system or an outside prescription is attached. */
  hasRx: boolean;
  witnessOptions: WitnessOption[];
  witnessId: string | null;
  onWitnessChange: (id: string | null) => void;
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
  const witnessMissing = enforced && needsWitness && !witnessId;

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
            <Label htmlFor="controlled-witness" className="text-xs">
              Witness {enforced ? '*' : '(recommended)'}
            </Label>
            <Select
              value={witnessId ?? ''}
              onValueChange={(v: string | null) => onWitnessChange(v || null)}
            >
              <SelectTrigger
                id="controlled-witness"
                className={witnessMissing ? 'border-error' : undefined}
              >
                <SelectValue placeholder="Select a second person to co-sign" />
              </SelectTrigger>
              <SelectContent>
                {witnessOptions.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.role ? ` · ${w.role}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Must be someone other than you — that is the point of a witness.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
