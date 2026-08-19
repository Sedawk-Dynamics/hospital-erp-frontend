// Follow-up intervals — "come back in 2 weeks" turned into a date.
//
// The prescription pad has had quick-pick intervals since it was written; the
// discharge summary offered a bare date field, so a doctor signing a discharge
// had to work out "3 months from today" in their head and type it. Same
// question, two different answers, and the harder one at the point where the
// patient is walking out of the building.
//
// The arithmetic lived inline in the pad. Shared here so both screens resolve
// an interval the same way, and so a third screen that needs it does not invent
// a third version.
//
// NOTE: this resolves an interval TO a date. Storing the interval itself —
// "after 3 months" with no fixed day — is a separate change; the schema keeps a
// date only.

/** The intervals offered as one-tap choices. */
export const FOLLOW_UP_PRESETS = [
  { label: '3 Days', value: 3, unit: 'days' },
  { label: '5 Days', value: 5, unit: 'days' },
  { label: '1 Week', value: 1, unit: 'weeks' },
  { label: '2 Weeks', value: 2, unit: 'weeks' },
  { label: '1 Month', value: 1, unit: 'months' },
  { label: '3 Months', value: 3, unit: 'months' },
  { label: '6 Months', value: 6, unit: 'months' },
] as const;

export type FollowUpUnit = 'days' | 'weeks' | 'months';
export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number];

/** yyyy-MM-dd in LOCAL time — what a native date input expects. */
function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * The date `value` `unit` from today, as a yyyy-MM-dd string.
 *
 * Returns '' for a non-positive or unparseable value so a half-typed box
 * clears the date rather than jumping to today.
 *
 * Month arithmetic is left to the Date object, which clamps overflow — 31
 * January plus one month lands on 28 February (or 29 in a leap year), not on
 * 3 March. That is the answer a clinician means.
 */
export function dateAfterInterval(value: number | string, unit: FollowUpUnit): string {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return '';

  const d = new Date();
  if (unit === 'days') d.setDate(d.getDate() + n);
  else if (unit === 'weeks') d.setDate(d.getDate() + n * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + n);
  return toDateInputValue(d);
}

/** Convenience for a preset button. */
export function dateAfterPreset(preset: { value: number; unit: string }): string {
  return dateAfterInterval(preset.value, preset.unit as FollowUpUnit);
}
