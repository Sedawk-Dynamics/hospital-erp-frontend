import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/pharmacy/pharmacy-admin-guard', () => ({
  PharmacyAdminGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mut = () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
const useStockHolds = vi.fn();
const collectMutate = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/use-pharmacy', () => ({
  useFormulary: () => ({ data: { data: [] } }),
  useBatchesByDrug: () => ({ data: [] }),
  useStockHolds: (...a: unknown[]) => useStockHolds(...a),
  usePrePackHold: () => mut(),
  useCollectHold: () => ({ mutateAsync: collectMutate, isPending: false }),
  useReleaseHold: () => mut(),
}));
vi.mock('@/hooks/use-hospital', () => ({ usePatientSearch: () => ({ data: [] }) }));

import PrePackPage from './page';

const HELD = {
  id: 'h1', status: 'held', createdAt: '2026-06-19T05:30:00Z', collectedAt: null, notes: null,
  patient: { mrn: 'MRN1', name: 'Asha Rao' },
  items: [{ id: 'i1', drugName: 'Amoxicillin', strength: '500mg', batchNumber: 'B1', quantity: 10, unitPrice: 5 }],
  total: 50,
};

describe('PrePackPage (OP pre-packing — Stock Hold)', () => {
  beforeEach(() => {
    useStockHolds.mockReset();
    collectMutate.mockClear();
  });

  it('shows an empty state when there are no holds', () => {
    useStockHolds.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
    render(<PrePackPage />);
    expect(screen.getByText(/No pre-packed holds/i)).toBeInTheDocument();
  });

  it('lists a held pre-pack with its total and Collect/Release actions', () => {
    useStockHolds.mockReturnValue({ data: { items: [HELD], total: 1 }, isLoading: false });
    render(<PrePackPage />);
    expect(screen.getByText(/Asha Rao \(MRN1\)/)).toBeInTheDocument();
    expect(screen.getByText('₹50.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Collect/i })).toBeInTheDocument();
  });

  it('collects a hold as a cash sale for its total', async () => {
    useStockHolds.mockReturnValue({ data: { items: [HELD], total: 1 }, isLoading: false });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PrePackPage />);
    await userEvent.click(screen.getByRole('button', { name: /Collect/i }));
    expect(collectMutate).toHaveBeenCalledWith({ id: 'h1', payments: [{ method: 'cash', amount: 50 }] });
  });

  it('opens the pre-pack dialog', async () => {
    useStockHolds.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
    render(<PrePackPage />);
    await userEvent.click(screen.getByRole('button', { name: /Pre-pack/i }));
    expect((await screen.findAllByText(/Pre-pack a prescription/i)).length).toBeGreaterThan(0);
  });
});
