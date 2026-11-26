// G-4: a client-side GSTIN check for immediate feedback on a buyer's number.
// The server repeats it (shared/gst.ts checkGstin) and is the one that counts.

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** null when valid, otherwise why not. A blank is not checked (it means B2C). */
export function gstinProblem(raw: string): string | null {
  const g = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!g) return null;
  if (g.length !== 15) return `A GSTIN is 15 characters (this has ${g.length})`;
  if (!SHAPE.test(g)) return 'This does not match the GSTIN format';
  const state = Number(g.slice(0, 2));
  if (!(state >= 1 && state <= 38) && state !== 97 && state !== 99) return `"${g.slice(0, 2)}" is not a GST state code`;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARSET.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36] === g[14] ? null : 'The check digit does not match — re-check the number';
}
