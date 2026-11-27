/**
 * Pharmacy unit helpers — ONE way to word a quantity (gap #345).
 *
 * Stock, prices, prescription and bill quantities are always counted in BASE
 * (loose) units — individual tablets / capsules — never in packs. A pack is
 * `packSize` base units bundled together. Nothing here changes a count; it only
 * says how one READS:
 *
 *   20 tablets, strip of 10  → "2 strips (20 tablets)"
 *    5 tablets, strip of 10  → "5 tablets (loose)"
 *   15 tablets, strip of 10  → "1 strip + 5 tablets (15 tablets)"
 *    2 bottles, no pack      → "2 bottles"
 *
 * The backend's pharmacy.units.ts carries the same rules and words the bill,
 * receipt, credit note, stock list and ledger; this copy words a quantity while
 * it is being typed. Both run the same table of cases (pharmacy-units.test.ts
 * here, tests/unit/modules/pharmacy/units.test.ts there) — change both together.
 */

export interface UnitSource {
  looseUnitLabel?: string | null;
  unitOfMeasurement?: string | null;
  dosageForm?: string | null;
  drugName?: string | null;
  packSize?: number | null;
}

/** How an item's base count is worded. `packSize` 1 = sold only as a whole unit. */
export interface QtyUnits {
  packSize: number;
  packNoun: string;
  looseNoun: string;
}

/** Measures that take no plural: "100 ml", never "100 mls". */
const MEASURES = new Set(['ml', 'l', 'g', 'gm', 'kg', 'mg', 'mcg', 'iu', 'cc']);

const SYNONYMS: Record<string, string> = {
  tab: 'tablet', cap: 'capsule', btl: 'bottle', pc: 'piece', pcs: 'piece',
  no: 'unit', nos: 'unit', amp: 'ampoule', gram: 'gm', millilitre: 'ml', milliliter: 'ml',
};

/** Nouns that name a loose unit, so they cannot also name the pack holding it. */
const LOOSE_ONLY = new Set([
  'tablet', 'capsule', 'softgel', 'lozenge', 'suppository', 'piece', 'unit', 'ml', 'l', 'g', 'gm', 'mg', 'drop',
]);

/** Loose noun for an item with a pack breakdown but no configured label. */
const FORM_LOOSE: Record<string, string> = {
  tablet: 'tablet', capsule: 'capsule', syrup: 'ml', suspension: 'ml', solution: 'ml', drops: 'ml',
  inhaler: 'puff', cream: 'tube', ointment: 'tube', gel: 'tube', powder: 'sachet',
};

/** The whole container, for an item sold only whole — never "ml" for a bottle. */
const FORM_WHOLE: Record<string, string> = {
  tablet: 'tablet', capsule: 'capsule', syrup: 'bottle', suspension: 'bottle', solution: 'bottle',
  drops: 'bottle', inhaler: 'inhaler', cream: 'tube', ointment: 'tube', gel: 'tube', powder: 'sachet',
};

/** The backend's inferLooseUnitLabel, rule for rule. */
function inferLooseNoun(dosageForm?: string | null, name?: string | null): string {
  const hay = `${String(dosageForm ?? '').toLowerCase()} ${String(name ?? '').toLowerCase()}`;
  if (/\bsoftgel/.test(hay)) return 'softgel';
  if (/\bcapsule|\bcap\b/.test(hay)) return 'capsule';
  if (/\bsachet/.test(hay)) return 'sachet';
  if (/\blozenge/.test(hay)) return 'lozenge';
  if (/\bsuppositor/.test(hay)) return 'suppository';
  if (/\btablet|\btab\b|\bdt\b|\bchewable|\bpill/.test(hay)) return 'tablet';
  return '';
}

/** "Strip (UQC PAC)" → "strip"; "strip of 10 tablets" → "strip"; "Tablets" → "tablet"; "10x10" → "". */
export function unitNoun(raw?: string | null): string {
  let s = (raw ?? '').toLowerCase().replace(/\(.*?(\)|$)/g, ' ').split(/\bof\b/)[0].trim().replace(/\s+/g, ' ');
  if (!s || !/^[a-z]/.test(s)) return '';
  if (SYNONYMS[s]) return SYNONYMS[s];
  if (/ies$/.test(s)) s = `${s.slice(0, -3)}y`;
  else if (/(x|ch|sh|ss)es$/.test(s)) s = s.slice(0, -2);
  else if (/[^s]s$/.test(s)) s = s.slice(0, -1);
  return SYNONYMS[s] ?? s;
}

export function qtyUnitsOf(drug: UnitSource | null | undefined): QtyUnits {
  const form = String(drug?.dosageForm ?? '').toLowerCase();
  const configured = unitNoun(drug?.looseUnitLabel);
  const inferred = inferLooseNoun(drug?.dosageForm, drug?.drugName);
  const uom = unitNoun(drug?.unitOfMeasurement);
  const packSize = Math.trunc(Number(drug?.packSize ?? 0));
  if (packSize > 1) {
    const looseNoun = configured || inferred || FORM_LOOSE[form] || 'unit';
    // A "Tablet" unit of measurement on a pack of 10 names the tablet, not the pack.
    const packNoun = uom && uom !== looseNoun && !LOOSE_ONLY.has(uom) ? uom : 'pack';
    return { packSize, packNoun, looseNoun };
  }
  const single = configured || uom || inferred || FORM_WHOLE[form] || 'unit';
  return { packSize: 1, packNoun: single, looseNoun: single };
}

/** Pluralise a unit noun for a count. */
export function pluralizeUnit(count: number, unit: string): string {
  if (Math.abs(count) === 1 || MEASURES.has(unit.toLowerCase())) return unit;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  if (/(x|ch|sh|ss)$/i.test(unit)) return `${unit}es`;
  if (/s$/i.test(unit)) return unit;
  return `${unit}s`;
}

/** "<n> <unit(s)>" — a bare count of one unit. */
export function formatSaleQty(count: number, unit: string): string {
  return `${count} ${pluralizeUnit(count, unit)}`;
}

/**
 * A base-unit count in words — packs AND the individual units they hold. Never
 * a fractional pack: 15 tablets of a 10-strip is "1 strip + 5 tablets".
 */
export function formatQty(baseQty: number, units: QtyUnits): string {
  const n = Math.round(Number(baseQty) || 0);
  if (n < 0) return `-${formatQty(-n, units)}`;
  const { packSize, packNoun, looseNoun } = units;
  if (packSize <= 1 || n === 0) return formatSaleQty(n, looseNoun);
  const packs = Math.floor(n / packSize);
  const loose = n % packSize;
  if (packs === 0) return `${formatSaleQty(n, looseNoun)} (loose)`;
  if (loose === 0) return `${formatSaleQty(packs, packNoun)} (${formatSaleQty(n, looseNoun)})`;
  return `${formatSaleQty(packs, packNoun)} + ${formatSaleQty(loose, looseNoun)} (${formatSaleQty(n, looseNoun)})`;
}

/** The same, straight from the drug. */
export function formatDrugQty(baseQty: number, drug: UnitSource | null | undefined): string {
  return formatQty(baseQty, qtyUnitsOf(drug));
}

// ── Selling: one unit for the quantity field, the clamp and its message ──────

export type SaleUnit = 'pack' | 'loose';

/**
 * #345 (client's answer: "round off prices", never above MRP). A pharmacy sale
 * rounds to the rupee. A bill with loose tablets rounds DOWN: a tablet's price
 * is the strip's MRP split and rounded to paise, so the tablets can add up to a
 * few paise more than the strip's MRP, and rounding up would add more. Whole
 * strips only round to the nearest rupee as before. A total under one rupee is
 * left as it is rather than rounded to nothing.
 */
export function roundPharmacyTotal(total: number, hasLooseUnits: boolean): { rounded: number; roundOff: number } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rounded = hasLooseUnits ? Math.floor(r2(total) + 1e-9) : Math.round(total);
  if (total > 0 && rounded <= 0) return { rounded: r2(total), roundOff: 0 };
  return { rounded, roundOff: r2(rounded - total) };
}

/** Base units a typed quantity stands for. */
export function toBaseQty(quantity: number, saleUnit: SaleUnit, packSize: number): number {
  return saleUnit === 'loose' ? quantity : quantity * (packSize > 0 ? packSize : 1);
}

/** The most that can be typed, in the unit the field is counting in. */
export function maxSaleQty(availableBase: number, saleUnit: SaleUnit, packSize: number): number {
  const pack = packSize > 0 ? packSize : 1;
  return saleUnit === 'loose' ? availableBase : Math.floor(availableBase / pack);
}

/**
 * Why a quantity cannot be sold, in the unit the field is counting in. Says the
 * stock too, because 45 tablets is "4 strips" to a field that counts strips.
 */
export function clampMessage(availableBase: number, saleUnit: SaleUnit, units: QtyUnits): string {
  const stock = formatQty(availableBase, units);
  if (units.packSize <= 1 || saleUnit === 'loose') return `Max available: ${stock}`;
  const packs = maxSaleQty(availableBase, 'pack', units.packSize);
  if (packs === 0) return `Only ${stock} in this batch — less than one ${units.packNoun}. Sell it by the ${units.looseNoun}.`;
  const whole = formatQty(packs * units.packSize, units);
  return whole === stock
    ? `Max available: ${whole}`
    : `Max available by the ${units.packNoun}: ${whole}. In stock: ${stock} — sell the rest by the ${units.looseNoun}.`;
}

// ── A prescribed count ──────────────────────────────────────────────────────
// A dose count ("30 drops", "20 ml") is not a stock count, so it keeps the
// dosage form's own noun rather than the container the item is stocked in.

const DOSE_FORM_BASE_UNIT: Record<string, string> = {
  tablet: 'tablet', capsule: 'capsule', syrup: 'ml', suspension: 'ml', solution: 'ml', drops: 'drop',
  injection: 'ml', inhaler: 'puff', cream: 'application', ointment: 'application', gel: 'application', powder: 'sachet',
};

/** The base (loose) unit noun: the hospital's label, else the dosage form's. */
export function looseUnitLabel(dosageForm?: string | null, configured?: string | null): string {
  return unitNoun(configured) || DOSE_FORM_BASE_UNIT[String(dosageForm ?? '').toLowerCase()] || 'unit';
}

/** "<n> tablets" — a count rendered with its (pluralised) base unit. */
export function formatBaseQty(count: number, dosageForm?: string | null, configured?: string | null): string {
  return formatSaleQty(count, looseUnitLabel(dosageForm, configured));
}

/** "1 strip = 10 tablets", or null when the item is not sold in multi-unit packs. */
export function packSummary(drug: UnitSource): string | null {
  const u = qtyUnitsOf(drug);
  if (u.packSize <= 1) return null;
  return `1 ${u.packNoun} = ${formatSaleQty(u.packSize, u.looseNoun)}`;
}
