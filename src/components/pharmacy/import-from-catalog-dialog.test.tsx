import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useDrugMasterSearch = vi.fn();
const useDrugMonograph = vi.fn();
vi.mock('@/hooks/use-drug-master', () => ({
  useDrugMasterSearch: (...args: unknown[]) => useDrugMasterSearch(...args),
  useDrugMonograph: (...args: unknown[]) => useDrugMonograph(...args),
}));
const mutation = { mutateAsync: vi.fn(), isPending: false };
vi.mock('@/hooks/use-pharmacy', () => ({
  useImportFormularyItem: () => mutation,
  useImportFormularyBulk: () => mutation,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { ImportFromCatalogDialog } from './import-from-catalog-dialog';

const row = (over: Record<string, unknown>) => ({
  genericName: null,
  manufacturer: 'Maker',
  dosageForm: 'tablet',
  strength: null,
  packSizeLabel: 'strip of 10 tablets',
  packSize: 10,
  hsnCode: null,
  gtin: null,
  mrp: '10',
  schedule: null,
  productForm: 'Tablet',
  ...over,
});

const RESULTS = [
  row({ id: 'd1', name: 'Dolo 650 Tablet', genericName: 'Paracetamol (650mg)', type: 'drug', rxRequired: false }),
  row({ id: 'd2', name: 'Augmentin 625 Duo Tablet', genericName: 'Amoxycillin (500mg) + Clavulanic Acid (125mg)', type: 'drug', rxRequired: true }),
  row({ id: 'o1', name: 'Aadvik Camel Milk Powder', type: 'otc', rxRequired: false, dosageForm: 'other' }),
];

const MONOGRAPH = {
  id: 'd1', name: 'Dolo 650 Tablet', kind: 'drug', sourceId: 'DRS1', sourceRelease: '2026-06',
  genericName: 'Paracetamol (650mg)', saltComposition: 'Paracetamol (650mg)', manufacturer: 'Micro Labs Ltd',
  productForm: 'Tablet', packageType: 'Strip', packQuantity: '15', packSizeLabel: 'strip of 15 tablets', mrp: '33.6',
  rxRequired: false, habitForming: false, therapeuticClass: 'PAIN ANALGESICS', chemicalClass: null, actionClass: null,
  productCategory: null, categoryPath: null, storage: null, countryOfOrigin: 'India', description: 'Pain relief',
  sideEffects: null, safetyAdvice: null, scheduleResolved: 'OTC', isDiscontinued: false, sections: [],
};

async function openAndSearch() {
  render(<ImportFromCatalogDialog />);
  fireEvent.click(screen.getByRole('button', { name: /import from catalog/i }));
  fireEvent.change(screen.getByPlaceholderText(/search brand or composition/i), { target: { value: 'dolo' } });
  // The search box is debounced.
  await screen.findByText('Dolo 650 Tablet', {}, { timeout: 2000 });
}

describe('ImportFromCatalogDialog', () => {
  beforeEach(() => {
    useDrugMasterSearch.mockReset().mockReturnValue({ data: RESULTS, isFetching: false });
    useDrugMonograph.mockReset().mockReturnValue({ data: MONOGRAPH, isLoading: false, isError: false });
  });

  it('marks the OTC product and the prescription-only drug, and only those', async () => {
    await openAndSearch();
    expect(screen.getAllByText('OTC')).toHaveLength(1);
    expect(screen.getAllByText('Rx')).toHaveLength(1);
  });

  it("opens a product's monograph in place, and closes it again", async () => {
    await openAndSearch();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[0]);
    expect(useDrugMonograph).toHaveBeenCalledWith('d1');
    expect(await screen.findByText('PAIN ANALGESICS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(screen.queryByText('PAIN ANALGESICS')).not.toBeInTheDocument();
  });
});
