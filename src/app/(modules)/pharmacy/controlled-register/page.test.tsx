import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * The Controlled-Drug Register is the inspector's READ view: the ledger, the
 * balances and the documents.
 *
 * Everything that MOVES stock — including the statutory NDPS actions — is on
 * Inventory → Stock Transfer, so there is one page for doing and one for
 * reading. These tests pin both halves of that: the reading is here, and the
 * doing is not.
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
  it('is a READ view — the statutory actions live on Stock Transfer now', () => {
    // They moved so that every stock action is on one page. Asserting their
    // ABSENCE matters: a stray copy here is how two screens start disagreeing
    // about the same narcotic.
    render(<ControlledRegisterPage />);
    expect(screen.queryByRole('button', { name: /Receive \(Form 3C\)/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Administer \(Form 3E\)/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New sub-store/i })).not.toBeInTheDocument();
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
