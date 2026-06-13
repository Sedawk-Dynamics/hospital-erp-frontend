/**
 * Dosage → quantity calculation (frontend).
 *
 * Mirrors `backend/src/modules/prescriptions/dosage-calc.ts` — keep the two in
 * sync. Doctors prescribe in the Indian "M-A-N" notation (Morning-Afternoon-
 * Night), e.g. `1-1-1` = one unit at each time of day. Combined with a duration
 * this yields the total units to dispense: `(1+1+1) × 3 days = 9 tablets`. That
 * number auto-fills the doctor's Qty field and flows to the pharmacist so they
 * bill the right count.
 *
 * A per-intake **dose** multiplier scales it further — how many units the patient
 * takes at each occasion (default `1`). So `1-1-1` for `3 days` with a dose of `2`
 * is `(1+1+1) × 3 × 2 = 18`.
 *
 * Two entry points:
 *  - `calcQuantity(frequency, durationValue, durationUnit, dose)` — for the live
 *    doctor form, where duration is a number + unit dropdown.
 *  - `calcQuantityFromStrings(frequency, duration, dose)` — for the pharmacy side,
 *    where the encoded strings ("1-1-1 - After Meal", "3 days") are read back
 *    off a stored PrescriptionItem.
 */

/** Parse a single dose slot — a plain number ("1", "2") or a fraction ("1/2"). */
function parseDoseToken(token: string): number | null {
  const t = token.trim();
  if (!t) return 0; // empty slot counts as zero doses
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const denom = Number(frac[2]);
    return denom === 0 ? null : Number(frac[1]) / denom;
  }
  if (/^\d*\.?\d+$/.test(t)) return Number(t);
  return null; // non-numeric token → not an M-A-N pattern
}

/**
 * Total doses-per-day implied by a frequency string.
 *  - `1-1-1`            → 3
 *  - `1/2-0-1/2`        → 1
 *  - `Stat`             → 1
 *  - `SOS` / As Needed  → null (PRN — can't be derived)
 *  - `BD`, `Q6H`, …     → null
 */
export function parseFrequencyPerDay(frequency?: string | null): number | null {
  if (!frequency) return null;
  const raw = frequency.trim();
  const lower = raw.toLowerCase();

  if (lower.includes('sos') || lower.includes('as needed') || lower.includes('prn')) {
    return null;
  }
  if (lower === 'stat') return 1;

  // Strip any " - After Meal" style timing suffix the UI appends.
  const code = raw.split(' - ')[0].trim();
  const segments = code.split('-');
  if (segments.length < 2) return null;

  let sum = 0;
  for (const seg of segments) {
    const val = parseDoseToken(seg);
    if (val === null) return null;
    sum += val;
  }
  return sum > 0 ? sum : null;
}

const UNIT_MULTIPLIER: Record<string, number> = {
  day: 1,
  days: 1,
  week: 7,
  weeks: 7,
  month: 30,
  months: 30,
  year: 365,
  years: 365,
};

/** Convert a duration value + unit (from the form) into a day count. */
export function durationToDays(value?: string | number | null, unit?: string | null): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const mult = UNIT_MULTIPLIER[(unit ?? 'days').toLowerCase()] ?? 1;
  return n * mult;
}

/** Parse an encoded duration string ("7 days", "2 weeks", "1 month", "5"). */
export function parseDurationDays(duration?: string | null): number | null {
  if (!duration) return null;
  const m = String(duration)
    .trim()
    .toLowerCase()
    .match(/(\d*\.?\d+)\s*(day|week|month|year)?/);
  if (!m) return null;
  const unit = m[2] ? `${m[2]}s` : 'days';
  return durationToDays(m[1], unit);
}

/**
 * Normalise a per-intake dose multiplier. Anything missing, non-numeric, or
 * ≤ 0 falls back to `1` (the default single-unit dose).
 */
export function parseDoseMultiplier(dose?: number | string | null): number {
  if (dose === null || dose === undefined || dose === '') return 1;
  const n = typeof dose === 'string' ? Number(dose) : dose;
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

/** Round up — the patient needs enough to finish the course. */
function totalUnits(perDay: number | null, days: number | null, dose: number): number | null {
  if (perDay === null || days === null) return null;
  const total = Math.ceil(perDay * days * dose);
  return total > 0 ? total : null;
}

/**
 * Total units to dispense from the live doctor form (duration as value + unit).
 * Returns `null` when it can't be derived (PRN frequency or no duration).
 * `dose` is the per-intake multiplier (default 1).
 */
export function calcQuantity(
  frequency?: string | null,
  durationValue?: string | number | null,
  durationUnit?: string | null,
  dose?: number | string | null,
): number | null {
  return totalUnits(
    parseFrequencyPerDay(frequency),
    durationToDays(durationValue, durationUnit),
    parseDoseMultiplier(dose),
  );
}

/** Total units to dispense from stored strings (pharmacy / read-back side). */
export function calcQuantityFromStrings(
  frequency?: string | null,
  duration?: string | null,
  dose?: number | string | null,
): number | null {
  return totalUnits(
    parseFrequencyPerDay(frequency),
    parseDurationDays(duration),
    parseDoseMultiplier(dose),
  );
}
