'use client';

// The °C / °F switch that sits beside a temperature field.
//
// It lives outside the field's <label> on purpose: a button inside a label
// steals the click that should focus the input.

import type { TempUnit } from '@/lib/vitals-temperature';

export function TemperatureUnitToggle({
  value,
  onChange,
  className,
}: {
  value: TempUnit;
  onChange: (unit: TempUnit) => void;
  className?: string;
}) {
  return (
    <span className={`inline-flex overflow-hidden rounded border ${className ?? ''}`}>
      {(['C', 'F'] as const).map((u) => (
        <button
          key={u}
          type="button"
          // No aria-label: the visible "°C" / "°F" already names the button,
          // and overriding it with a sentence makes the control harder to
          // reach by name, not easier. aria-pressed is what carries the state.
          aria-pressed={value === u}
          onClick={() => onChange(u)}
          className={
            value === u
              ? 'bg-primary px-1.5 text-[10px] font-semibold text-on-primary'
              : 'px-1.5 text-[10px] text-on-surface-variant hover:bg-surface-container'
          }
        >
          °{u}
        </button>
      ))}
    </span>
  );
}
