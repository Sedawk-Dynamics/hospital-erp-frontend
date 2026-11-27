import { describe, it, expect } from 'vitest';
import {
  clampMessage, formatBaseQty, formatDrugQty, formatQty, maxSaleQty, packSummary, pluralizeUnit, qtyUnitsOf, toBaseQty, unitNoun,
} from './pharmacy-units';

// Gap 345 — the SAME table runs on the server
// (hospital-erp-backend tests/unit/modules/pharmacy/units.test.ts), so the POS
// and the bill cannot word one item two ways. Change both together.

const STRIP = { drugName: 'Dolo 650 Tablet', dosageForm: 'tablet', unitOfMeasurement: 'Strip (UQC PAC)', packSize: 10, looseUnitLabel: 'Tablet' };

const UNIT_CASES: Array<[string, Record<string, unknown>, number, string]> = [
  ['whole packs', STRIP, 20, '2 strips (20 tablets)'],
  ['one pack', STRIP, 10, '1 strip (10 tablets)'],
  ['loose only', STRIP, 5, '5 tablets (loose)'],
  ['one loose', STRIP, 1, '1 tablet (loose)'],
  ['mixed', STRIP, 15, '1 strip + 5 tablets (15 tablets)'],
  ['mixed, one left over', STRIP, 21, '2 strips + 1 tablet (21 tablets)'],
  ['nothing', STRIP, 0, '0 tablets'],
  ['negative', STRIP, -15, '-1 strip + 5 tablets (15 tablets)'],
  ['bottle sold whole', { drugName: 'Ascoril Syrup', dosageForm: 'syrup', unitOfMeasurement: 'Bottle (UQC BTL)' }, 2, '2 bottles'],
  ['syrup with no unit set is a bottle, not ml', { drugName: 'Benadryl', dosageForm: 'syrup' }, 1, '1 bottle'],
  ['tube', { drugName: 'Betnovate', dosageForm: 'cream' }, 3, '3 tubes'],
  ['vial', { drugName: 'Monocef', dosageForm: 'injection', unitOfMeasurement: 'Vial (UQC NOS)', packSize: 1 }, 4, '4 vials'],
  ['box', { drugName: 'Gloves', unitOfMeasurement: 'Box (UQC BOX)' }, 2, '2 boxes'],
  ['catalogue pack label as unit of measurement', { ...STRIP, unitOfMeasurement: 'strip of 10 tablets', looseUnitLabel: null }, 20, '2 strips (20 tablets)'],
  ['truncated catalogue label', { ...STRIP, unitOfMeasurement: 'Strip (UQC PA' }, 20, '2 strips (20 tablets)'],
  ['unusable unit of measurement', { ...STRIP, unitOfMeasurement: '10x10' }, 20, '2 packs (20 tablets)'],
  ['unit of measurement names the tablet', { ...STRIP, unitOfMeasurement: 'Tablet (UQC TBS)' }, 20, '2 packs (20 tablets)'],
  ['capsules inferred from the form', { drugName: 'Omez', dosageForm: 'capsule', packSize: 15, unitOfMeasurement: 'Strip' }, 16, '1 strip + 1 capsule (16 capsules)'],
  ['sachets', { drugName: 'ORS Sachet', packSize: 4, unitOfMeasurement: 'Box' }, 6, '1 box + 2 sachets (6 sachets)'],
  ['nothing known at all', { drugName: 'Thing' }, 3, '3 units'],
  ['pack with nothing else known', { drugName: 'Thing', packSize: 5 }, 12, '2 packs + 2 units (12 units)'],
];

describe('345 — one way to word a quantity', () => {
  it.each(UNIT_CASES)('%s', (_name, drug, qty, words) => {
    expect(formatDrugQty(qty, drug as never)).toBe(words);
  });

  it('plurals and pack summary', () => {
    expect(pluralizeUnit(2, 'ml')).toBe('ml');
    expect(pluralizeUnit(2, 'suppository')).toBe('suppositories');
    expect(unitNoun('boxes')).toBe('box');
    expect(packSummary(STRIP)).toBe('1 strip = 10 tablets');
    expect(packSummary({ dosageForm: 'syrup' })).toBeNull();
    // A prescribed count keeps the dose form's own noun.
    expect(formatBaseQty(30, 'drops')).toBe('30 drops');
  });
});

describe('345 — the POS quantity field and its clamp use one unit', () => {
  const units = qtyUnitsOf(STRIP);
  const bottle = qtyUnitsOf({ dosageForm: 'syrup', unitOfMeasurement: 'Bottle' });

  it('a typed quantity means the unit the field is in', () => {
    expect(toBaseQty(2, 'pack', 10)).toBe(20);
    expect(toBaseQty(5, 'loose', 10)).toBe(5);
    expect(toBaseQty(3, 'pack', 1)).toBe(3);
  });

  it('the most that can be typed is in that same unit', () => {
    expect(maxSaleQty(45, 'pack', 10)).toBe(4);
    expect(maxSaleQty(45, 'loose', 10)).toBe(45);
    expect(maxSaleQty(5, 'pack', 10)).toBe(0);
    // Whatever can be typed never exceeds the stock it was clamped to.
    for (const stock of [0, 1, 9, 10, 11, 45, 100]) {
      for (const u of ['pack', 'loose'] as const) {
        expect(toBaseQty(maxSaleQty(stock, u, 10), u, 10)).toBeLessThanOrEqual(stock);
      }
    }
  });

  it('the message says the limit in the field unit, and the stock in words', () => {
    expect(clampMessage(40, 'pack', units)).toBe('Max available: 4 strips (40 tablets)');
    expect(clampMessage(45, 'pack', units)).toBe(
      'Max available by the strip: 4 strips (40 tablets). In stock: 4 strips + 5 tablets (45 tablets) — sell the rest by the tablet.',
    );
    expect(clampMessage(45, 'loose', units)).toBe('Max available: 4 strips + 5 tablets (45 tablets)');
    expect(clampMessage(5, 'pack', units)).toBe('Only 5 tablets (loose) in this batch — less than one strip. Sell it by the tablet.');
    expect(clampMessage(3, 'pack', bottle)).toBe('Max available: 3 bottles');
  });

  it('a sale in either mode reads the same for the same tablets', () => {
    expect(formatQty(toBaseQty(2, 'pack', 10), units)).toBe(formatQty(toBaseQty(20, 'loose', 10), units));
  });
});

// #345: the POS shows the same round-off the server charges.
describe('roundPharmacyTotal', () => {
  it('rounds a bill with loose tablets down and whole strips to the nearest rupee', async () => {
    const { roundPharmacyTotal } = await import('./pharmacy-units');
    expect(roundPharmacyTotal(100.05, true)).toEqual({ rounded: 100, roundOff: -0.05 });
    expect(roundPharmacyTotal(63.7, true)).toEqual({ rounded: 63, roundOff: -0.7 });
    expect(roundPharmacyTotal(63.7, false)).toEqual({ rounded: 64, roundOff: 0.3 });
    expect(roundPharmacyTotal(0.67, true)).toEqual({ rounded: 0.67, roundOff: 0 });
  });
});
