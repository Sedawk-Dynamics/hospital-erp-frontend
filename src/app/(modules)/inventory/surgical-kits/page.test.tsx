import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/pharmacy/pharmacy-admin-guard', () => ({
  PharmacyAdminGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mut = () => ({ mutateAsync: vi.fn().mockResolvedValue({ consumedTotal: 0 }), isPending: false });
const useKitTemplates = vi.fn();
const useKitIssues = vi.fn();
vi.mock('@/hooks/use-ot-kits', () => ({
  useKitTemplates: (...a: unknown[]) => useKitTemplates(...a),
  useKitIssues: (...a: unknown[]) => useKitIssues(...a),
  useCreateKitTemplate: () => mut(),
  useDeleteKitTemplate: () => mut(),
  useIssueKit: () => mut(),
  useReconcileKit: () => mut(),
  useCancelKit: () => mut(),
}));
vi.mock('@/hooks/use-pharmacy', () => ({ useFormulary: () => ({ data: { data: [] } }) }));
vi.mock('@/hooks/use-hospital', () => ({ usePatientSearch: () => ({ data: [] }) }));

import SurgicalKitsPage from './page';

const ISSUE = {
  id: 'i1', surgeryName: 'Hernia repair', status: 'issued', issuedAt: '2026-06-19T05:30:00Z', reconciledAt: null,
  patient: { mrn: 'MRN1', name: 'Asha Rao' },
  items: [
    { id: 'it1', drugName: 'Suture', strength: null, batchNumber: 'B1', issuedQty: 4, returnedQty: 0, consumedQty: 4, unitPrice: 50 },
  ],
};

describe('SurgicalKitsPage (OT — issue bulk / reconcile net)', () => {
  beforeEach(() => {
    useKitTemplates.mockReturnValue({ data: [{ id: 't1', name: "Dr Sharma's Hernia Kit", surgeryType: 'Hernia', items: [{ id: 'ti', drug: { drugName: 'Suture' }, quantity: 4 }], isActive: true }], isLoading: false });
    useKitIssues.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
  });

  it('shows an empty state when there are no active issues', () => {
    render(<SurgicalKitsPage />);
    expect(screen.getByText(/No kit issues/i)).toBeInTheDocument();
  });

  it('lists an active issue with a Reconcile action', () => {
    useKitIssues.mockReturnValue({ data: { items: [ISSUE], total: 1 }, isLoading: false });
    render(<SurgicalKitsPage />);
    expect(screen.getByText('Hernia repair')).toBeInTheDocument();
    expect(screen.getByText(/Asha Rao \(MRN1\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconcile/i })).toBeInTheDocument();
  });

  it('opens the reconcile dialog computing consumed = issued − returned', async () => {
    useKitIssues.mockReturnValue({ data: { items: [ISSUE], total: 1 }, isLoading: false });
    render(<SurgicalKitsPage />);
    await userEvent.click(screen.getByRole('button', { name: /Reconcile/i }));
    expect(await screen.findByText(/Post-op reconciliation/i)).toBeInTheDocument();
    // nothing returned yet → use 4
    expect(screen.getByText('use 4')).toBeInTheDocument();
  });
});
