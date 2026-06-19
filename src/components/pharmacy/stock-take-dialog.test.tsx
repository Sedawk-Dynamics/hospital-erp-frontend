import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useBatches = vi.fn();
const useFormulary = vi.fn();
const useReconcileStockTake = vi.fn();

vi.mock('@/hooks/use-pharmacy', () => ({
  useBatches: (...a: unknown[]) => useBatches(...a),
  useFormulary: (...a: unknown[]) => useFormulary(...a),
  useReconcileStockTake: (...a: unknown[]) => useReconcileStockTake(...a),
}));

import { StockTakeDialog } from './stock-take-dialog';

const BATCHES = [
  { id: 'b1', batchNumber: 'BN-100', quantityInStock: 100, sellingPrice: 12, expiryDate: '2027-01-01', drug: { drugName: 'Amoxicillin' } },
  { id: 'b2', batchNumber: 'BN-050', quantityInStock: 50, sellingPrice: 20, expiryDate: '2027-06-01', drug: { drugName: 'Telma 40' } },
];

describe('StockTakeDialog (G4 — physical count flags variance before write)', () => {
  beforeEach(() => {
    useBatches.mockReturnValue({ data: { data: BATCHES }, isLoading: false });
    useFormulary.mockReturnValue({ data: { data: [] } });
    useReconcileStockTake.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('lists each in-stock batch with its system quantity', () => {
    render(<StockTakeDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.getByText('BN-100')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('disables Apply until at least one physical count is entered', async () => {
    render(<StockTakeDialog open onOpenChange={vi.fn()} />);
    const apply = screen.getByRole('button', { name: /apply corrections/i });
    expect(apply).toBeDisabled();

    const countInputs = screen.getAllByPlaceholderText('—');
    await userEvent.type(countInputs[0], '90');
    expect(apply).toBeEnabled();
  });

  it('flags a variance (Δ) when the counted qty differs from the system qty', async () => {
    render(<StockTakeDialog open onOpenChange={vi.fn()} />);
    const countInputs = screen.getAllByPlaceholderText('—');

    // count 90 vs system 100 -> short by 10
    await userEvent.type(countInputs[0], '90');
    // the -10 delta surfaces (row badge and/or net-delta summary)
    expect(screen.getAllByText('-10').length).toBeGreaterThan(0);
    // summary footer reflects 1 counted / 1 variance and the value impact (10 x 12)
    expect(screen.getByText('₹-120.00')).toBeInTheDocument();
  });

  it('shows a zero delta (no correction) when the count matches the system', async () => {
    render(<StockTakeDialog open onOpenChange={vi.fn()} />);
    const countInputs = screen.getAllByPlaceholderText('—');

    // count 50 vs system 50 -> exact match
    await userEvent.type(countInputs[1], '50');
    // a zero delta is shown (Δ cell + "Variances: 0" summary)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    // and because there is no variance, no value-impact (₹) line is rendered
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });
});
