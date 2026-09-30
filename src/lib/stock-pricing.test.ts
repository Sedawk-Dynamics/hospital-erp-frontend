import { describe, expect, it } from 'vitest';
import {
  PACKAGING_UNITS,
  normalizePackagingUnit,
  packagingUnitWithUqc,
  sellingPriceAfterMrpChange,
  toSmallestUnitPrice,
} from './stock-pricing';

describe('stock inward pricing', () => {
  it('normalizes package pricing to the smallest sellable unit', () => {
    expect(toSmallestUnitPrice(120, 10)).toBe(12);
    expect(toSmallestUnitPrice(33.6, 15)).toBe(2.24);
    expect(toSmallestUnitPrice(12, 1)).toBe(12);
  });

  it('normalizes packaging names and preserves their UQC labels', () => {
    expect(normalizePackagingUnit('Strip (UQC PAC)')).toBe('strip');
    expect(normalizePackagingUnit('ml')).toBe('ml');
    expect(packagingUnitWithUqc('ampoule')).toBe('Ampoule (UQC NOS)');
    expect(PACKAGING_UNITS.map((unit) => packagingUnitWithUqc(unit.value))).toEqual([
      'Box (UQC BOX)', 'Strip (UQC PAC)', 'Tablet (UQC TBS)',
      'Capsule (UQC NOS)', 'Bottle (UQC BTL)', 'Vial (UQC NOS)',
      'Ampoule (UQC NOS)', 'Tube (UQC TUB)', 'Sachet (UQC NOS)',
      'ml (UQC MLT)', 'gm (UQC GMS)', 'Piece (UQC PCS)',
    ]);
  });

  it('keeps sell price synced to MRP until the user overrides it', () => {
    expect(sellingPriceAfterMrpChange('', '', '100')).toBe('100');
    expect(sellingPriceAfterMrpChange('100', '100', '110')).toBe('110');
    expect(sellingPriceAfterMrpChange('100', '95', '110')).toBe('95');
  });
});
