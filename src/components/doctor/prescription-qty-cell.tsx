'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { calcQuantity } from '@/lib/dosage-calc';
import type { MedicineFormData } from './consultation-completion/consultation-completion-schema';

/**
 * Auto-calculated dispense-quantity cell shared by the consultation
 * prescription step and the standalone prescription pad.
 *
 * The number shown is the total units the course needs — dose pattern ×
 * duration × per-intake dose (e.g. `1-1-1` for `3 days` with dose 2 → 18). That
 * value is what the pharmacist bills, so surfacing it here keeps doctor and
 * pharmacy in agreement.
 *
 * A doctor can type to override; clearing the field reverts to `undefined` so
 * the auto value (recomputed by the submit builder) is used again.
 */
export function QtyCell({
  index,
  med,
  onUpdate,
  compact = false,
}: {
  index: number;
  med: MedicineFormData;
  onUpdate: (index: number, field: keyof MedicineFormData, value: any) => void;
  compact?: boolean;
}) {
  const autoQty = calcQuantity(med.frequency, med.durationValue, med.durationUnit, med.doseQuantity);
  const isManual = typeof med.quantity === 'number' && !Number.isNaN(med.quantity);
  const display = isManual ? med.quantity : autoQty ?? '';

  return (
    <div className="flex flex-col items-stretch">
      <Input
        type="number"
        min={0}
        placeholder={autoQty != null ? String(autoQty) : '—'}
        title="Total units to dispense (auto = dose × duration). Edit to override."
        className={cn(
          'border-dashed text-center',
          compact ? 'h-7 text-[11px] px-1' : 'h-8 text-xs',
        )}
        value={display === '' ? '' : String(display)}
        onChange={(e) => {
          const raw = e.target.value;
          onUpdate(index, 'quantity', raw === '' ? undefined : Number(raw));
        }}
      />
      {!isManual && autoQty != null && (
        <span
          className={cn(
            'mt-0.5 text-center uppercase tracking-wide text-primary/70',
            compact ? 'text-[8px]' : 'text-[9px]',
          )}
        >
          auto
        </span>
      )}
    </div>
  );
}
