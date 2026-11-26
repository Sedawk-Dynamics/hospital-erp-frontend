// G-2: how an item form keeps a typed GST rate when its HSN changes.
//
// The forms used to overwrite the GST % with the HSN master's default every
// time the HSN box changed, so a pharmacist's 12% or 18% came back as 5% on
// save. The HSN default now only fills a blank, or replaces a value that is
// still exactly what the previous HSN filled in (i.e. nobody typed it).

/** The GST % to show after the HSN changes from `prevHsnRate` to `nextHsnRate`. */
export function gstAfterHsnChange(currentGst: string, prevHsnRate: string, nextHsnRate: string): string {
  if (!nextHsnRate) return currentGst;
  const typed = currentGst.trim();
  if (!typed) return nextHsnRate;
  if (prevHsnRate && Number(typed) === Number(prevHsnRate)) return nextHsnRate;
  return currentGst;
}

/**
 * True when a typed taxable rate disagrees with the HSN master's default — the
 * case where the form must ask why (the item's rate wins at billing).
 */
export function gstDiffersFromHsn(currentGst: string, hsnRate: number | string | null | undefined): boolean {
  const typed = currentGst.trim();
  if (!typed || hsnRate == null || hsnRate === '') return false;
  const a = Number(typed);
  const b = Number(hsnRate);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) >= 0.005;
}
