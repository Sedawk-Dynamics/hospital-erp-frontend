import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
const registerData: { current: unknown } = { current: undefined };
vi.mock('@/hooks/use-pharmacy', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useControlledRegister: () => ({ data: registerData.current, isLoading: false, isFetching: false }),
  useControlledDrugOptions: () => ({ data: [] }),
}));

// The two document buttons go through api-client, which is the entire point of
// the fix — a raw window.open carries neither the bearer token nor the tenant.
const apiGet = vi.fn();
vi.mock('@/lib/api-client', () => ({ default: { get: (...a: unknown[]) => apiGet(...a) } }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));
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

const ROW = {
  occurredAt: '2026-08-20T04:30:00.000Z',
  txnId: 'txn-1',
  txnType: 'dispense',
  drugId: 'drug-1',
  itemName: 'Morphine 10mg',
  apiStrength: 'Morphine 10mg',
  batchNumber: 'B-1',
  expiryDate: '2027-01-31',
  qtyIn: 0,
  qtyOut: 2,
  transferQty: 0,
  opening: 10,
  closing: 8,
  patientOrDept: 'Ward 2',
  prescriber: 'Dr Rao (REG-1)',
  verification: null,
};

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

  describe('the two statutory documents', () => {
    // Both buttons were `window.open('/api/v1/...')`, which could not work three
    // times over: the path is relative, so it hit the Next server on :5173 and
    // returned that app's 404 (confirmed), and a raw browser navigation carries
    // neither the bearer token nor X-Tenant-Id, so aimed at the API it was a 401
    // (also confirmed). The backend was fine all along — both formats return a
    // valid PDF over HTTP.
    beforeEach(() => {
      vi.clearAllMocks();
      registerData.current = { rows: [ROW], window: { from: '2026-08-01', to: '2026-08-31' } };
      apiGet.mockResolvedValue({ data: new Blob(['%PDF-1.3'], { type: 'application/pdf' }) });
      // jsdom implements neither.
      global.URL.createObjectURL = vi.fn(() => 'blob:mock');
      global.URL.revokeObjectURL = vi.fn();
      window.open = vi.fn(() => ({}) as Window);
    });
    afterEach(() => {
      registerData.current = undefined;
    });

    it('fetches the register through the API client, not a bare browser navigation', async () => {
      render(<ControlledRegisterPage />);
      await userEvent.click(screen.getByRole('button', { name: /Register \(PDF\)/i }));

      await waitFor(() => expect(apiGet).toHaveBeenCalled());
      const [url, opts] = apiGet.mock.calls[0] as [string, { responseType: string; params: Record<string, string> }];
      // A relative '/api/v1/...' path is the bug — this must be the client's
      // own base URL, which is where the token and tenant header are attached.
      expect(url).toBe('/pharmacy/controlled-register/pdf');
      expect(opts.responseType).toBe('blob');
      expect(opts.params.format).toBeUndefined();
    });

    it('asks for Form 35 by format, carrying the same filters', async () => {
      render(<ControlledRegisterPage />);
      await userEvent.click(screen.getByRole('button', { name: /Print Form 35/i }));

      await waitFor(() => expect(apiGet).toHaveBeenCalled());
      const [url, opts] = apiGet.mock.calls[0] as [string, { params: Record<string, string> }];
      expect(url).toBe('/pharmacy/controlled-register/pdf');
      expect(opts.params.format).toBe('form35');
      // The document must cover the period on screen, not a default window.
      expect(opts.params.fromDate).toBeTruthy();
      expect(opts.params.toDate).toBeTruthy();
    });

    it('opens the PDF it fetched', async () => {
      render(<ControlledRegisterPage />);
      await userEvent.click(screen.getByRole('button', { name: /Register \(PDF\)/i }));

      await waitFor(() => expect(window.open).toHaveBeenCalledWith('blob:mock', '_blank'));
    });

    it('says so when the document cannot be generated', async () => {
      // It failed silently before, which is exactly why it read as "nothing
      // happens when I click it".
      apiGet.mockRejectedValue(new Error('boom'));
      render(<ControlledRegisterPage />);
      await userEvent.click(screen.getByRole('button', { name: /Print Form 35/i }));

      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(String(toastError.mock.calls[0][0])).toMatch(/Form 35/i);
    });
  });
});
