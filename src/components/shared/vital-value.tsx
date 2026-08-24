'use client';

// One way to print a vital reading, flagged when it is out of range.
//
// The doctor's consultation sidebar flags abnormal values; nothing else did.
// A doctor reading the same patient's numbers in the MRD table, the patient
// registry, the IP workspace's trend table or the vitals history drawer — the
// last of which opens straight off that flagged sidebar — saw plain text with
// nothing marking a pulse of 132 or an SpO₂ of 88.
//
// Where a flag did exist it was styled three different ways: `text-error` on
// the doctor's side, raw `text-red-600` on the nurse screens (which ignores the
// theme), and a bare bold elsewhere. Abnormal should look the same everywhere
// or it stops reading as a signal.
//
// Thresholds come from `lib/vitals-ranges` — the same table the nurse screens
// use, so a reading cannot be abnormal on one screen and normal on the next.

import { AlertTriangle } from 'lucide-react';
import {
  abnormalDirection,
  isValueAbnormal,
  vitalRangeText,
  VITAL_RANGES,
} from '@/lib/vitals-ranges';
import {
  temperatureIn,
  temperatureRangeText,
  temperatureUnitLabel,
} from '@/lib/vitals-temperature';
import { useTemperatureUnit } from '@/stores/temperature-unit-store';
import { cn } from '@/lib/utils';

export interface VitalValueProps {
  /** Field name on the Vital record — the key into VITAL_RANGES. */
  vitalKey: string;
  /** The stored value. Temperature is Celsius; Prisma Decimals arrive as strings. */
  value: number | string | null | undefined;
  /** Shown when there is no reading. */
  fallback?: string;
  /** Print the unit after the number. Off by default — most tables head their columns. */
  showUnit?: boolean;
  /** Show the warning triangle as well as the colour. */
  showIcon?: boolean;
  className?: string;
}

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function VitalValue({
  vitalKey,
  value,
  fallback = '—',
  showUnit = false,
  showIcon = false,
  className,
}: VitalValueProps) {
  const [tempUnit] = useTemperatureUnit();
  const isTemp = vitalKey === 'temperature';

  const celsius = toNumber(value);
  if (celsius === null) {
    return <span className={cn('text-muted-foreground', className)}>{fallback}</span>;
  }

  // Temperature is stored in Celsius and shown in the reader's unit — but the
  // range test stays on the Celsius value, so a Fahrenheit reader gets the same
  // flag rather than a different one.
  const shown = isTemp ? temperatureIn(celsius, tempUnit) : celsius;
  const abnormal = isValueAbnormal(vitalKey, celsius);
  const direction = abnormalDirection(vitalKey, celsius);

  const unit = isTemp ? temperatureUnitLabel(tempUnit) : VITAL_RANGES[vitalKey]?.unit;
  const range = isTemp
    ? temperatureRangeText(
        VITAL_RANGES.temperature.low ?? 35,
        VITAL_RANGES.temperature.high ?? 38,
        tempUnit,
      )
    : vitalRangeText(vitalKey);

  return (
    <span
      className={cn('inline-flex items-baseline gap-1', className)}
      // Says WHY it is flagged, in the unit being read — a red number with no
      // explanation makes the reader go looking for the range.
      title={abnormal && range ? `Outside normal (${range})${direction ? ` — ${direction}` : ''}` : undefined}
    >
      <span className={cn(abnormal && 'font-semibold text-error')}>
        {isTemp && shown !== null ? shown.toFixed(1) : shown}
      </span>
      {showUnit && unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      {abnormal && showIcon && (
        <AlertTriangle className="h-3 w-3 shrink-0 self-center text-error" aria-hidden />
      )}
      {abnormal && (
        // The colour alone is not a signal for a colour-blind reader, and a
        // title attribute is not announced by every screen reader.
        <span className="sr-only">
          {' '}
          abnormal{direction ? `, ${direction}` : ''}
          {range ? ` — normal is ${range}` : ''}
        </span>
      )}
    </span>
  );
}
