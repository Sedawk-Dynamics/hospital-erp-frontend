import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const useReturnDetail = vi.fn();
vi.mock('@/hooks/use-pharmacy', () => ({
  useReturnDetail: (...args: unknown[]) => useReturnDetail(...args),
}));

import { ReturnReceiptDialog } from './return-receipt-dialog';

const RETURN_DATA = {
  hospital: { name: 'Indus Multispeciality', address: 'MG Road', city: 'Vijayawada', state: 'AP', phone: '0866-000' },
  billNumber: 'PH-2026-014',
  return: {
    id: 'ret-abcdef12-0000',
    createdAt: '2026-06-19T05:30:00Z',
    returnType: 'patient_return',
    quantity: 5,
    refundAmount: 75,
    reason: 'extra strips',
    refund: { status: 'completed' },
    drug: { drugName: 'Dolo 650' },
    drugBatch: { batchNumber: 'B-771', drug: { drugName: 'Dolo 650' } },
    batchNumber: 'B-771',
    patient: { firstName: 'Asha', lastName: 'Rao' },
  },
};

describe('ReturnReceiptDialog (G3/G14 — printable return acknowledgement)', () => {
  beforeEach(() => useReturnDetail.mockReset());

  it('shows a loading placeholder until the return loads', () => {
    useReturnDetail.mockReturnValue({ data: undefined, isLoading: true });
    render(<ReturnReceiptDialog returnId="ret-1" open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('renders the acknowledgement with patient, drug, qty and refund', () => {
    useReturnDetail.mockReturnValue({ data: RETURN_DATA, isLoading: false });
    render(<ReturnReceiptDialog returnId="ret-1" open onOpenChange={vi.fn()} />);

    expect(screen.getByText('RETURN ACKNOWLEDGEMENT')).toBeInTheDocument();
    expect(screen.getByText('Indus Multispeciality')).toBeInTheDocument();
    expect(screen.getByText('PH-2026-014')).toBeInTheDocument(); // bill reference (G3)
    expect(screen.getByText('Dolo 650')).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    // partial quantity returned (G14: 5 of a line)
    expect(screen.getByText('5')).toBeInTheDocument();
    // refund amount formatted
    expect(screen.getByText('₹75.00')).toBeInTheDocument();
    // return id is shown truncated + uppercased
    expect(screen.getByText('RET-ABCD')).toBeInTheDocument();
  });

  it('enables the Print button once the return is loaded', () => {
    useReturnDetail.mockReturnValue({ data: RETURN_DATA, isLoading: false });
    render(<ReturnReceiptDialog returnId="ret-1" open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /print/i })).toBeEnabled();
  });

  // G-5 (gap #266): a B2B credit note registered on the IRP prints its IRN + QR.
  it('prints the IRN, ack and QR of a registered credit note, and flags a cancelled one', () => {
    const creditNote = {
      id: 'cn-1', creditNoteNumber: 'CN/26-27/0001', issueDate: '2026-11-24T06:00:00Z',
      taxableValue: -400, cgstAmount: 0, sgstAmount: 0, igstAmount: -72, cessAmount: 0, taxAmount: -72, totalAmount: -472,
      irn: 'a'.repeat(64), irnAckNo: '112010000000123', irnAckDate: '2026-11-24T06:05:00Z',
      irnQrPayload: 'x.y.SANDBOX-NOT-SIGNED', irnStatus: 'registered', irnCancelledAt: null,
    };
    useReturnDetail.mockReturnValue({ data: { ...RETURN_DATA, invoiceNumber: 'INV/1', creditNote }, isLoading: false });
    const { unmount } = render(<ReturnReceiptDialog returnId="ret-1" open onOpenChange={vi.fn()} />);
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument();
    expect(screen.getByText(/112010000000123/)).toBeInTheDocument();
    // The QR itself (qrcode.react draws its modules as crisp-edged paths).
    expect(document.body.querySelector('path[shape-rendering="crispEdges"]')).toBeTruthy();
    expect(screen.getByText(/SANDBOX IRN/)).toBeInTheDocument();
    unmount();

    useReturnDetail.mockReturnValue({
      data: { ...RETURN_DATA, invoiceNumber: 'INV/1', creditNote: { ...creditNote, irnStatus: 'cancelled', irnCancelledAt: '2026-11-24T08:00:00Z' } },
      isLoading: false,
    });
    render(<ReturnReceiptDialog returnId="ret-1" open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/CANCELLED on the e-invoice portal/)).toBeInTheDocument();
  });

  it('does not show a refund line when nothing was refunded', () => {
    useReturnDetail.mockReturnValue({
      data: { ...RETURN_DATA, return: { ...RETURN_DATA.return, refundAmount: 0, refund: null } },
      isLoading: false,
    });
    render(<ReturnReceiptDialog returnId="ret-1" open onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Refund')).not.toBeInTheDocument();
  });
});
