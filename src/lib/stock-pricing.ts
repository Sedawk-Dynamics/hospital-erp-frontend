export const PACKAGING_UNITS = [
  { value: 'box', label: 'Box', uqc: 'BOX' },
  { value: 'strip', label: 'Strip', uqc: 'PAC' },
  { value: 'tablet', label: 'Tablet', uqc: 'TBS' },
  { value: 'capsule', label: 'Capsule', uqc: 'NOS' },
  { value: 'bottle', label: 'Bottle', uqc: 'BTL' },
  { value: 'vial', label: 'Vial', uqc: 'NOS' },
  { value: 'ampoule', label: 'Ampoule', uqc: 'NOS' },
  { value: 'tube', label: 'Tube', uqc: 'TUB' },
  { value: 'sachet', label: 'Sachet', uqc: 'NOS' },
  { value: 'ml', label: 'ml', uqc: 'MLT' },
  { value: 'gm', label: 'gm', uqc: 'GMS' },
  { value: 'piece', label: 'Piece', uqc: 'PCS' },
] as const;

export type PackagingUnitValue = (typeof PACKAGING_UNITS)[number]['value'];

export function normalizePackagingUnit(raw?: string | null): PackagingUnitValue | '' {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return '';
  const byName = PACKAGING_UNITS.find(
    (unit) => value === unit.value || value.startsWith(unit.label.toLowerCase()),
  );
  if (byName) return byName.value;
  // Only use an unambiguous UQC code as a fallback. NOS intentionally maps to
  // several healthcare units and therefore needs the accompanying unit name.
  const byCode = PACKAGING_UNITS.find(
    (unit) => unit.uqc !== 'NOS' && new RegExp(`\\b${unit.uqc.toLowerCase()}\\b`).test(value),
  );
  return byCode?.value ?? '';
}

export function packagingUnitLabel(value?: string | null): string {
  return PACKAGING_UNITS.find((unit) => unit.value === normalizePackagingUnit(value))?.label ?? 'unit';
}

export function packagingUnitWithUqc(value?: string | null): string | undefined {
  const unit = PACKAGING_UNITS.find((item) => item.value === normalizePackagingUnit(value));
  return unit ? `${unit.label} (UQC ${unit.uqc})` : undefined;
}

/**
 * Prices entered at stock inward are for one Primary Unit. Inventory and
 * billing store the derived price per Smallest Unit.
 */
export function toSmallestUnitPrice(
  price: number,
  packSize?: number | null,
): number {
  const divisor = packSize && packSize > 1 ? packSize : 1;
  return Math.round((price / divisor + Number.EPSILON) * 100) / 100;
}

/**
 * MRP drives selling price until the user deliberately enters a different sell
 * price. This makes repeat edits intuitive: changing MRP keeps Sell in sync only
 * while Sell is blank or still equal to the previous MRP.
 */
export function sellingPriceAfterMrpChange(
  previousMrp: string,
  previousSellingPrice: string,
  nextMrp: string,
): string {
  const sellFollowsMrp =
    previousSellingPrice.trim() === '' || previousSellingPrice === previousMrp;
  return sellFollowsMrp ? nextMrp : previousSellingPrice;
}
