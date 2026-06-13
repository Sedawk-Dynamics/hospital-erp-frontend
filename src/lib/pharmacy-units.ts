/**
 * Pharmacy unit helpers — keep "how many tablets per pack" and "is this count
 * tablets or packs?" consistent everywhere the pharmacist sees a drug.
 *
 * Stock, prices and prescription quantities are always counted in BASE (loose)
 * units — i.e. individual tablets / capsules / ml — never in packs/strips. A
 * pack is just `packSize` base units bundled together. These helpers turn a
 * drug's dosage form + configured loose-unit label into a human label and a
 * "1 pack = N tablets" summary string.
 */

// Singular base-unit noun per dosage form. Liquids count in ml; solids in
// pieces. Falls back to a generic "unit".
const DOSE_FORM_BASE_UNIT: Record<string, string> = {
  tablet: 'tablet',
  capsule: 'capsule',
  syrup: 'ml',
  suspension: 'ml',
  solution: 'ml',
  drops: 'drop',
  injection: 'ml',
  inhaler: 'puff',
  cream: 'application',
  ointment: 'application',
  gel: 'application',
  powder: 'sachet',
};

/**
 * The base (loose) unit noun for a drug. Prefers the hospital-configured
 * `looseUnitLabel`; otherwise derives one from the dosage form; else "unit".
 */
export function looseUnitLabel(dosageForm?: string | null, configured?: string | null): string {
  if (configured && configured.trim()) return configured.trim();
  if (!dosageForm) return 'unit';
  return DOSE_FORM_BASE_UNIT[dosageForm.toLowerCase()] || 'unit';
}

/** Pluralise a unit noun for a count (naive but fine for these short nouns). */
export function pluralizeUnit(count: number, unit: string): string {
  if (count === 1) return unit;
  if (/(ml|sachet|puff|drop)$/i.test(unit)) return `${unit}s`;
  if (/y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

/** "<n> tablets" — a count rendered with its (pluralised) base unit. */
export function formatBaseQty(count: number, dosageForm?: string | null, configured?: string | null): string {
  const unit = looseUnitLabel(dosageForm, configured);
  return `${count} ${pluralizeUnit(count, unit)}`;
}

/**
 * "1 pack = 10 tablets" summary, or null when the drug isn't sold in multi-unit
 * packs (packSize ≤ 1). Surfaced wherever the pharmacist needs to know how many
 * loose units a pack/strip holds.
 */
export function packSummary(
  packSize?: number | null,
  dosageForm?: string | null,
  configured?: string | null,
): string | null {
  if (!packSize || packSize <= 1) return null;
  const unit = looseUnitLabel(dosageForm, configured);
  return `1 pack = ${packSize} ${pluralizeUnit(packSize, unit)}`;
}
