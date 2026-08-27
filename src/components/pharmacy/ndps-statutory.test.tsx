import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * These moved with the features they cover.
 *
 * They used to test /inventory/ndps. That page is gone — transfers went to the
 * stock-transfer board and these statutory surfaces went to the Controlled-Drug
 * Register — so the tests follow the components rather than being deleted with
 * the page. Losing them in the move is exactly how a merge quietly drops Form
 * 3C and disposal-evidence capture.
 */

const stub = { data: undefined, isLoading: false };
const mutation = () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });

const useNdpsStockByLocation = vi.fn();
const useNdpsDailyBalances = vi.fn();
vi.mock('@/hooks/use-ndps', () => ({
  useNdpsLocations: () => ({
    data: [
      { id: 'v1', name: 'Central Vault', type: 'main_vault' },
      { id: 'icu', name: 'ICU Cart A', type: 'sub_store' },
    ],
  }),
  useNdpsStockByLocation: (...a: unknown[]) => useNdpsStockByLocation(...a),
  useNdpsDailyBalances: (...a: unknown[]) => useNdpsDailyBalances(...a),
  useNdpsReceiveConsignment: () => mutation(),
  useNdpsConsumption: () => mutation(),
  useNdpsDisposal: () => mutation(),
  useNdpsCreateLocation: () => mutation(),
  useNdpsRunDailyClose: () => mutation(),
  useNdpsVerifyDaily: () => mutation(),
  useNdpsUploadEvidence: () => mutation(),
}));
// Mocks spread the REAL module via importOriginal and override only what this
// file needs. A bare vi.mock replaces the whole module, and vitest shares that
// across files in a worker — which is how these mocks broke record-vitals and
// frontdesk-register tests that passed on their own.
vi.mock('@/hooks/use-pharmacy', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useFormulary: () => ({ data: { data: [] } }),
}));
vi.mock('@/hooks/use-users', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useUsersList: () => ({ data: { data: [] } }),
}));
vi.mock('@/hooks/use-hospital', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  usePatientSearch: () => ({ data: [] }),
}));

import { ReceiveDialog, DisposalDialog, StockTab } from './ndps-statutory';

beforeEach(() => {
  useNdpsStockByLocation.mockReturnValue(stub);
  useNdpsDailyBalances.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
});

describe('NDPS statutory surfaces', () => {
  it('shows the inspector stock-by-location breakdown', () => {
    useNdpsStockByLocation.mockReturnValue({
      data: {
        items: [{
          drugId: 'd1', drugName: 'Morphine', strength: '10mg', total: 58,
          locations: [
            { locationId: 'v1', name: 'Central Vault', type: 'main_vault', quantity: 50 },
            { locationId: 'icu', name: 'ICU Cart A', type: 'sub_store', quantity: 8 },
          ],
        }],
      },
      isLoading: false,
    });
    render(<StockTab />);
    expect(screen.getByText('Morphine 10mg')).toBeInTheDocument();
    expect(screen.getByText('Total: 58')).toBeInTheDocument();
    expect(screen.getByText('Central Vault: 50')).toBeInTheDocument();
    expect(screen.getByText('ICU Cart A: 8')).toBeInTheDocument();
  });

  it('still captures the Form 3C consignment number on receipt', async () => {
    render(<ReceiveDialog open onOpenChange={() => {}} />);
    expect(await screen.findByText(/Receive NDPS consignment/i)).toBeInTheDocument();
    expect(screen.getByText(/Form 3C consignment no/i)).toBeInTheDocument();
  });

  it('still offers an evidence photo on a disposal', async () => {
    // Destroying a narcotic without a photograph is the record an inspector
    // queries first.
    render(<DisposalDialog open onOpenChange={() => {}} />);
    expect(await screen.findByText(/broken \/ spoiled disposal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload photo/i })).toBeInTheDocument();
  });
});
