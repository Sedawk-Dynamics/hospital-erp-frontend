import { create } from 'zustand';
import type { TempUnit } from '@/lib/vitals-temperature';

// Which unit this user reads and writes temperature in.
//
// The stored value is always Celsius — see lib/vitals-temperature. The unit is
// purely how a person wants to see it, so it belongs to the person, not to the
// record. Two things were wrong before this existed:
//
//   • Every DISPLAY printed Celsius. The °C/°F toggle was on the entry forms
//     only, so a doctor reading the nurse's reading got 37.2 and no way to see
//     99.0 — the "Fahrenheit not visible in the doctor module" report.
//   • The toggle was local `useState('C')`, so it reset on every open. A nurse
//     on a Fahrenheit ward re-flipped it for every single recording.
//
// Held in localStorage rather than on the server: it is a reading preference,
// it should apply the moment it is clicked with no round trip, and it differs
// per person rather than per hospital. Same approach as the sidebar pin.

const STORAGE_KEY = 'vitals-temperature-unit';

function readStoredUnit(): TempUnit {
  if (typeof window === 'undefined') return 'C';
  try {
    return localStorage.getItem(STORAGE_KEY) === 'F' ? 'F' : 'C';
  } catch {
    return 'C';
  }
}

interface TemperatureUnitState {
  unit: TempUnit;
  setUnit: (unit: TempUnit) => void;
}

export const useTemperatureUnitStore = create<TemperatureUnitState>((set) => ({
  // Defaults to Celsius: that is what every screen showed before, so nobody's
  // display changes until they choose otherwise.
  unit: readStoredUnit(),
  setUnit: (unit) => {
    try {
      localStorage.setItem(STORAGE_KEY, unit);
    } catch {
      // A browser refusing storage should still switch the unit for this
      // session — it just will not be remembered.
    }
    set({ unit });
  },
}));

/**
 * The unit to show temperature in, and the setter behind the °C/°F toggle.
 * One preference shared by every screen that reads or records a temperature.
 */
export function useTemperatureUnit(): [TempUnit, (unit: TempUnit) => void] {
  const unit = useTemperatureUnitStore((s) => s.unit);
  const setUnit = useTemperatureUnitStore((s) => s.setUnit);
  return [unit, setUnit];
}
