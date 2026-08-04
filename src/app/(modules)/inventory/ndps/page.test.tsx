import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The page is wrapped in NdpsGuard (it was PharmacyAdminGuard once). Leaving
// the real guard in place renders nothing, because the test user holds no
// narcotics permission — which made every assertion here fail on an empty DOM.
vi.mock('@/components/pharmacy/ndps-guard', () => ({
  NdpsGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const stub = { data: undefined, isLoading: false };
const mutation = () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });

const useNdpsStockByLocation = vi.fn();
const useNdpsRegister = vi.fn();
const useNdpsDailyBalances = vi.fn();
vi.mock('@/hooks/use-ndps', () => ({
  useNdpsLocations: () => ({ data: [{ id: 'v1', name: 'Central Vault', type: 'main_vault' }, { id: 'icu', name: 'ICU Cart A', type: 'sub_store' }] }),
  useNdpsStockByLocation: (...a: unknown[]) => useNdpsStockByLocation(...a),
  useNdpsRegister: (...a: unknown[]) => useNdpsRegister(...a),
  useNdpsDailyBalances: (...a: unknown[]) => useNdpsDailyBalances(...a),
  useNdpsReceiveConsignment: () => mutation(),
  useNdpsTransfer: () => mutation(),
  useNdpsConsumption: () => mutation(),
  useNdpsDisposal: () => mutation(),
  useNdpsCreateLocation: () => mutation(),
  useNdpsRunDailyClose: () => mutation(),
  useNdpsVerifyDaily: () => mutation(),
  useNdpsUploadEvidence: () => mutation(),
}));
vi.mock('@/hooks/use-pharmacy', () => ({ useFormulary: () => ({ data: { data: [] } }) }));
vi.mock('@/hooks/use-users', () => ({ useUsersList: () => ({ data: { data: [] } }) }));
vi.mock('@/hooks/use-hospital', () => ({ usePatientSearch: () => ({ data: [] }) }));

import NdpsPage from './page';

describe('NdpsPage (Narcotic Accounting — Inspector + lifecycle)', () => {
  beforeEach(() => {
    useNdpsStockByLocation.mockReturnValue(stub);
    useNdpsRegister.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
    useNdpsDailyBalances.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
  });

  it('renders the lifecycle action toolbar', () => {
    render(<NdpsPage />);
    expect(screen.getByRole('button', { name: /Receive \(3C\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consume \(3E\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disposal/i })).toBeInTheDocument();
  });

  it('shows the Inspector stock-by-location breakdown', () => {
    useNdpsStockByLocation.mockReturnValue({
      data: { items: [{ drugId: 'd1', drugName: 'Morphine', strength: '10mg', total: 58, locations: [{ locationId: 'v1', name: 'Central Vault', type: 'main_vault', quantity: 50 }, { locationId: 'icu', name: 'ICU Cart A', type: 'sub_store', quantity: 8 }] }] },
      isLoading: false,
    });
    render(<NdpsPage />);
    expect(screen.getByText('Morphine 10mg')).toBeInTheDocument();
    expect(screen.getByText('Total: 58')).toBeInTheDocument();
    expect(screen.getByText('Central Vault: 50')).toBeInTheDocument();
    expect(screen.getByText('ICU Cart A: 8')).toBeInTheDocument();
  });

  it('opens the Form 3C receive dialog from the toolbar', async () => {
    render(<NdpsPage />);
    await userEvent.click(screen.getByRole('button', { name: /Receive \(3C\)/i }));
    expect(await screen.findByText(/Receive NDPS consignment/i)).toBeInTheDocument();
    expect(screen.getByText(/Form 3C consignment no/i)).toBeInTheDocument();
  });

  it('disposal dialog offers an evidence photo upload', async () => {
    render(<NdpsPage />);
    await userEvent.click(screen.getByRole('button', { name: /Disposal/i }));
    expect(await screen.findByText(/broken \/ spoiled disposal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload photo/i })).toBeInTheDocument();
  });
});
