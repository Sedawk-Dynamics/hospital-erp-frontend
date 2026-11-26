import { describe, it, expect } from 'vitest';
import { poItemsSummary, poLineLabel } from './po-items';

// Gap 302: first item with quantity, then "and N more".
describe('poItemsSummary', () => {
  it('shows the first item and "and N more" for a multi-item PO', () => {
    expect(
      poItemsSummary([
        { itemName: 'Paracetamol 500 mg', quantityOrdered: 20 },
        { itemName: 'Ibuprofen 400 mg', quantityOrdered: 10 },
      ]),
    ).toBe('Paracetamol 500 mg × 20 and 1 more');
  });

  it('shows just the item for a single-item PO', () => {
    expect(poItemsSummary([{ itemName: 'Gauze', quantityOrdered: 5 }])).toBe('Gauze × 5');
  });

  it('never prints undefined', () => {
    expect(poLineLabel({ drug: { drugName: 'Amoxicillin' }, quantityOrdered: 3 })).toBe('Amoxicillin × 3');
    expect(poLineLabel({})).toBe('Unnamed item');
    expect(poItemsSummary(undefined, 2)).toBe('2 items');
  });
});
