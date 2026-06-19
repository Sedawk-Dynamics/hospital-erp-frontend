import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Render the guard transparently so we test the page body.
vi.mock('@/components/pharmacy/pharmacy-admin-guard', () => ({
  PharmacyAdminGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const useDistributorMappings = vi.fn();
const useDeleteDistributorMapping = vi.fn();
vi.mock('@/hooks/use-pharmacy', () => ({
  useDistributorMappings: (...a: unknown[]) => useDistributorMappings(...a),
  useDeleteDistributorMapping: (...a: unknown[]) => useDeleteDistributorMapping(...a),
}));
vi.mock('@/hooks/use-inventory', () => ({
  useSuppliers: () => ({ data: { data: [{ id: 's1', name: 'Acme Distributors' }] } }),
}));

import DistributorMappingsPage from './page';

const MAPPINGS = [
  { id: 'm1', externalName: 'CROCIN ADV 650MG', gtin: '8901234567890', supplier: 'Acme Distributors', supplierId: 's1', drugName: 'Crocin Advance 650', drugStrength: '650mg', drugFormularyId: 'f1', confidence: 100, timesSeen: 4, lastSeenAt: '2026-06-01T00:00:00Z' },
  { id: 'm2', externalName: 'TELMA 40 TAB', gtin: null, supplier: null, supplierId: null, drugName: 'Telma 40', drugStrength: '40mg', drugFormularyId: 'f2', confidence: 96, timesSeen: 1, lastSeenAt: '2026-06-10T00:00:00Z' },
];

describe('DistributorMappingsPage (Product Resolution Engine — learned mappings)', () => {
  beforeEach(() => {
    useDistributorMappings.mockReset();
    useDeleteDistributorMapping.mockReset();
    useDeleteDistributorMapping.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  });

  it('shows an empty state before anything is learned', () => {
    useDistributorMappings.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
    render(<DistributorMappingsPage />);
    expect(screen.getByText(/No learned mappings yet/i)).toBeInTheDocument();
  });

  it('lists learned mappings with their resolved drug, GTIN and usage count', () => {
    useDistributorMappings.mockReturnValue({ data: { items: MAPPINGS, total: 2 }, isLoading: false });
    render(<DistributorMappingsPage />);

    expect(screen.getByText('CROCIN ADV 650MG')).toBeInTheDocument();
    expect(screen.getByText('8901234567890')).toBeInTheDocument(); // GTIN
    expect(screen.getByText('Crocin Advance 650')).toBeInTheDocument(); // resolves to
    expect(screen.getByText('4×')).toBeInTheDocument(); // times used
    // a GTIN-less, distributor-less mapping renders "Any" + an em dash for GTIN
    expect(screen.getByText('TELMA 40 TAB')).toBeInTheDocument();
    expect(screen.getByText('Any')).toBeInTheDocument();
  });

  it('confirms then deletes a mapping', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    useDeleteDistributorMapping.mockReturnValue({ mutateAsync, isPending: false });
    useDistributorMappings.mockReturnValue({ data: { items: MAPPINGS, total: 2 }, isLoading: false });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<DistributorMappingsPage />);
    const delButtons = screen.getAllByRole('button');
    // last column buttons are the per-row deletes; click the first row's
    const trashButtons = delButtons.filter((b) => b.querySelector('svg.lucide-trash-2, svg.lucide-trash2'));
    await userEvent.click(trashButtons[0]);
    expect(mutateAsync).toHaveBeenCalledWith('m1');
  });
});
