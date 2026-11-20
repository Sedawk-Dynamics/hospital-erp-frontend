// One money formatter for every screen (gap item 289): ₹ with Indian digit
// grouping and paise, e.g. ₹1,23,456.78. Exports (CSV / spreadsheets) keep
// plain numbers and must not use this.

const INR = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** ₹1,23,456.78. Anything that is not a finite number reads as ₹0.00. */
export function formatINR(
  value: number | string | null | undefined,
  opts: { whole?: boolean } = {},
): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const body = (opts.whole ? INR_WHOLE : INR).format(Math.abs(safe));
  // Sign before the symbol: −₹500.00, not ₹-500.00.
  return `${safe < 0 ? '-' : ''}₹${body}`;
}
