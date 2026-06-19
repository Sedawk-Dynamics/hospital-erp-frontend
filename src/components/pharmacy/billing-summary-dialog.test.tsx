import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const useIpBillingSummary = vi.fn();
vi.mock('@/hooks/use-pharmacy', () => ({
  useIpBillingSummary: (...a: unknown[]) => useIpBillingSummary(...a),
}));

import { BillingSummaryDialog } from './billing-summary-dialog';

const SUMMARY = {
  patient: { id: 'p1', mrn: 'MRN1', firstName: 'Asha', lastName: 'Rao' },
  admission: { id: 'a1', billingCategory: 'insurance', depositAmount: 1000, admissionDate: '2026-06-01T00:00:00Z' },
  category: 'insurance',
  isTpa: true,
  insurance: { insurer: 'Acme Ins', tpa: 'MediTPA', policyNumber: 'POL1', planName: 'Gold' },
  bills: [],
  categoryTotals: [{ category: 'pharmacy', amount: 370 }],
  pharmacySplit: { reimbursable: 320, nonReimbursable: 50, takeHome: 120 },
  totals: { totalBilled: 370, totalPaid: 0, balanceDue: 370, deposit: 1000, available: 630 },
};

describe('BillingSummaryDialog (4.1 / TPA reimbursable split)', () => {
  beforeEach(() => useIpBillingSummary.mockReset());

  it('shows the reimbursable / non-reimbursable / take-home split for a TPA patient', () => {
    useIpBillingSummary.mockReturnValue({ data: SUMMARY, isLoading: false });
    render(<BillingSummaryDialog patientId="p1" open onOpenChange={vi.fn()} />);

    expect(screen.getByText(/reimbursable split/i)).toBeInTheDocument();
    expect(screen.getByText(/Reimbursable \(claim TPA\):/i)).toBeInTheDocument();
    expect(screen.getByText('₹320.00')).toBeInTheDocument();
    expect(screen.getByText(/Non-reimbursable \(patient pays\):/i)).toBeInTheDocument();
    expect(screen.getByText('₹50.00')).toBeInTheDocument();
    expect(screen.getByText(/Take-home \(TTO\):/i)).toBeInTheDocument();
    expect(screen.getByText('₹120.00')).toBeInTheDocument();
  });

  it('hides the split panel when there are no pharmacy dispenses', () => {
    useIpBillingSummary.mockReturnValue({
      data: { ...SUMMARY, pharmacySplit: { reimbursable: 0, nonReimbursable: 0, takeHome: 0 } },
      isLoading: false,
    });
    render(<BillingSummaryDialog patientId="p1" open onOpenChange={vi.fn()} />);
    expect(screen.queryByText(/reimbursable split/i)).not.toBeInTheDocument();
  });
});
