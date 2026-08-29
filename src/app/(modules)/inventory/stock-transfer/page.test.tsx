import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Stock Transfer is the one place stock moves.
 *
 * Transfers, the ward shelf they fill, the ledger of every movement, and the
 * statutory NDPS records — all on one page. These pin that each tab is
 * actually there, because a merge that quietly drops one loses a capability
 * nobody notices until an inspector asks.
 */

vi.mock('@/components/shared/stock-transfer-board', () => ({
  StockTransferBoard: () => <div>transfer board</div>,
}));
vi.mock('@/components/pharmacy/ward-stock-board', () => ({
  useWardOptions: () => [{ id: 'w1', name: 'ICU 1' }],
  WardStockPanel: () => <div>ward stock panel</div>,
  WardLedgerPanel: () => <div>ward ledger panel</div>,
}));
vi.mock('@/components/pharmacy/ndps-statutory', () => ({
  ReceiveDialog: () => null,
  ConsumptionDialog: () => null,
  DisposalDialog: () => null,
  LocationDialog: () => null,
}));

import StockTransferPage from './page';

describe('Stock Transfer — the one place stock moves', () => {
  it('offers transfers, the ward shelf, the ledger and the NDPS records', () => {
    render(<StockTransferPage />);
    for (const name of [/Transfers/i, /Ward stock/i, /Ledger/i, /NDPS records/i]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });

  it('opens on transfers, which is what most people came for', () => {
    render(<StockTransferPage />);
    expect(screen.getByText('transfer board')).toBeInTheDocument();
  });

  it('asks which ward once you are looking at ward stock', async () => {
    render(<StockTransferPage />);
    await userEvent.click(screen.getByRole('tab', { name: /Ward stock/i }));
    expect(await screen.findByLabelText('Ward')).toBeInTheDocument();
    // Nothing is shown until a ward is chosen — a shelf with no ward named is
    // a shelf belonging to nobody.
    expect(screen.getByText(/Pick a ward/i)).toBeInTheDocument();
  });

  it('shows the shelf once a ward is chosen', async () => {
    render(<StockTransferPage />);
    await userEvent.click(screen.getByRole('tab', { name: /Ward stock/i }));
    await userEvent.selectOptions(await screen.findByLabelText('Ward'), 'w1');
    expect(await screen.findByText('ward stock panel')).toBeInTheDocument();
  });

  it('says the NDPS records are narcotics only', async () => {
    // They refuse anything not on the narcotic list, which is correct and was
    // only confusing when it was not said out loud.
    render(<StockTransferPage />);
    await userEvent.click(screen.getByRole('tab', { name: /NDPS records/i }));
    expect(await screen.findByText(/Narcotics only/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Receive \(Form 3C\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Administer \(Form 3E\)/i })).toBeInTheDocument();
  });
});
