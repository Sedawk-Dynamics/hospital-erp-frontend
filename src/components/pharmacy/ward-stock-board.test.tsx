import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * What a ward shelf has to say out loud.
 *
 * Stock can go bad after it arrives: a batch passes the pharmacy's expiry and
 * recall checks on the way out, then sits in a cupboard for weeks. The dispense
 * call refuses it now, but finding that out at the drug trolley with a patient
 * waiting is too late to be useful — the shelf has to show it, so the ward can
 * pull the boxes on a round.
 *
 * Unusable stock stays ON the list. It is still physically there and still has
 * to go back to the pharmacy, and a nurse who cannot see it cannot return it.
 */

const stock = [
  {
    id: 'ws-good', drugId: 'd1', drugBatchId: 'b1', drugName: 'Paracetamol 500',
    looseUnitLabel: null, batchNumber: 'PCM-114', expiryDate: '2027-06-30',
    sellingPrice: 10, quantityInStock: 120,
    isExpired: false, isRecalled: false, recallReason: null,
  },
  {
    id: 'ws-expired', drugId: 'd2', drugBatchId: 'b2', drugName: 'Amoxicillin 250',
    looseUnitLabel: null, batchNumber: 'AMX-009', expiryDate: '2026-01-31',
    sellingPrice: 22, quantityInStock: 14,
    isExpired: true, isRecalled: false, recallReason: null,
  },
  {
    id: 'ws-recalled', drugId: 'd3', drugBatchId: 'b3', drugName: 'Ranitidine 150',
    looseUnitLabel: null, batchNumber: 'RAN-777', expiryDate: '2027-09-30',
    sellingPrice: 8, quantityInStock: 30,
    isExpired: false, isRecalled: true, recallReason: 'NDMA contamination, lot 44',
  },
];

const ledger = [
  { id: 'l1', date: '2026-08-20T06:00:00.000Z', movementType: 'received', drugName: 'Paracetamol 500', batchNumber: 'PCM-114', quantity: 100, patient: null, patientMrn: null, reason: null },
  { id: 'l2', date: '2026-08-21T06:00:00.000Z', movementType: 'adjusted', drugName: 'Paracetamol 500', batchNumber: 'PCM-114', quantity: -3, patient: null, patientMrn: null, reason: 'breakage (100 → 97)' },
  { id: 'l3', date: '2026-08-22T06:00:00.000Z', movementType: 'adjusted', drugName: 'Paracetamol 500', batchNumber: 'PCM-114', quantity: 5, patient: null, patientMrn: null, reason: 'found in the cupboard (97 → 102)' },
];

vi.mock('@/hooks/use-pharmacy', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useWardStock: () => ({ data: stock, isLoading: false }),
  useWardLedger: () => ({ data: ledger, isLoading: false }),
  useWardStockDispense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useWardStockReturn: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useWardStockAdjust: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { WardStockPanel, WardLedgerPanel } from './ward-stock-board';

// The panel reaches for other queries besides the two mocked above (the batch
// picker in its dispense form), so it needs a client even though nothing in
// these tests fetches.
const show = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

const rowFor = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('the ward shelf', () => {
  it('marks a recalled batch, and says why', () => {
    show(<WardStockPanel wardId="w1" />);
    const row = rowFor('Ranitidine 150');
    expect(within(row).getByText(/Recalled/i)).toBeInTheDocument();
    expect(within(row).getByText(/NDMA contamination, lot 44/i)).toBeInTheDocument();
  });

  it('marks an expired batch', () => {
    show(<WardStockPanel wardId="w1" />);
    expect(within(rowFor('Amoxicillin 250')).getByText(/Expired/i)).toBeInTheDocument();
  });

  it('leaves good stock unmarked', () => {
    show(<WardStockPanel wardId="w1" />);
    const row = rowFor('Paracetamol 500');
    expect(within(row).queryByText(/Recalled|Expired/i)).not.toBeInTheDocument();
  });

  it('keeps unusable stock on the list — it still has to be sent back', () => {
    show(<WardStockPanel wardId="w1" />);
    expect(screen.getByText('Ranitidine 150')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin 250')).toBeInTheDocument();
  });
});

describe('the ward ledger', () => {
  it('shows which way a correction went', () => {
    // Both used to be stored and shown as a positive number, so breaking three
    // and finding five read identically.
    show(<WardLedgerPanel wardId="w1" />);
    expect(screen.getByText('-3')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('does not put a plus on stock coming in, which has only one direction', () => {
    show(<WardLedgerPanel wardId="w1" />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText('+100')).not.toBeInTheDocument();
  });
});
