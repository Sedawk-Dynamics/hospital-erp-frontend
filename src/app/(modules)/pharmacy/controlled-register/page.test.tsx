import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * The Controlled-Drug Register is now the only home for the statutory NDPS
 * records. /inventory/ndps was deleted: moving stock is the transfer board's
 * job for every schedule alike, and Form 3C / 3E / disposal / sub-stores are
 * records rather than movements, so they came here — the inspector's view.
 *
 * This pins that they actually arrived. A merge that loses Form 3C loses the
 * document an inspector asks for first.
 */

vi.mock('@/components/pharmacy/pharmacy-admin-guard', () => ({
  PharmacyAdminGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mocks spread the REAL module via importOriginal and override only what this
// file needs. A bare vi.mock replaces the whole module, and vitest shares that
// across files in a worker — which is how these mocks broke record-vitals and
// frontdesk-register tests that passed on their own.
vi.mock('@/hooks/use-pharmacy', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useControlledRegister: () => ({ data: undefined, isLoading: false, isFetching: false }),
  useControlledDrugOptions: () => ({ data: [] }),
}));
vi.mock('@/hooks/use-ndps', () => ({
  useNdpsLocations: () => ({ data: [] }),
  useNdpsStockByLocation: () => ({ data: undefined, isLoading: false }),
  useNdpsDailyBalances: () => ({ data: { items: [], total: 0 }, isLoading: false }),
  useNdpsReceiveConsignment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNdpsConsumption: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNdpsDisposal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNdpsCreateLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNdpsRunDailyClose: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNdpsVerifyDaily: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useNdpsUploadEvidence: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-users', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useUsersList: () => ({ data: { data: [] } }),
}));
vi.mock('@/hooks/use-hospital', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  usePatientSearch: () => ({ data: [] }),
}));

import ControlledRegisterPage from './page';

describe('Controlled-Drug Register — the statutory home', () => {
  it('carries the actions that used to live on the NDPS page', () => {
    render(<ControlledRegisterPage />);
    expect(screen.getByRole('button', { name: /Receive \(Form 3C\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Administer \(Form 3E\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disposal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New sub-store/i })).toBeInTheDocument();
  });

  it('offers the inspector views as tabs beside the ledger', () => {
    render(<ControlledRegisterPage />);
    expect(screen.getByRole('tab', { name: /Ledger/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Stock by location/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Daily account \(3H\)/i })).toBeInTheDocument();
  });

  it('offers Form 35 as its own document, not just the house register', () => {
    render(<ControlledRegisterPage />);
    expect(screen.getByRole('button', { name: /Print Form 35/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register \(PDF\)/i })).toBeInTheDocument();
  });
});
