import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaimBillCard } from '@/components/insurance/claim-bill-card';
import type { InsuranceClaimBill } from '@/hooks/use-insurance';

const bill: InsuranceClaimBill = {
  id: 'bill-1',
  billNumber: 'IPB-0001',
  billDate: '2026-09-23T09:00:00.000Z',
  status: 'draft',
  subtotal: '11000',
  discountAmount: '500',
  taxAmount: '0',
  totalAmount: '10500',
  insuranceCoveredAmount: '9000',
  patientPayableAmount: '1500',
  amountPaid: '1000',
  balanceDue: '500',
  taxableValue: '0',
  cgstAmount: '0',
  sgstAmount: '0',
  igstAmount: '0',
  cessAmount: '0',
  roundOff: '0',
  billItems: [
    {
      id: 'line-1',
      description: 'Room charges',
      category: 'room',
      quantity: 2,
      unitPrice: '4500',
      discountPercent: '0',
      discountAmount: '0',
      taxPercent: '0',
      taxAmount: '0',
      totalAmount: '9000',
      taxableValue: '0',
      cgstAmount: '0',
      sgstAmount: '0',
      igstAmount: '0',
      cessAmount: '0',
      isReimbursable: true,
      tpaCategory: 'room_rent',
      createdAt: '2026-09-23T09:00:00.000Z',
    },
    {
      id: 'line-2',
      description: 'Patient convenience item',
      category: 'consumable',
      quantity: 1,
      unitPrice: '1500',
      discountPercent: '0',
      discountAmount: '0',
      taxPercent: '0',
      taxAmount: '0',
      totalAmount: '1500',
      taxableValue: '0',
      cgstAmount: '0',
      sgstAmount: '0',
      igstAmount: '0',
      cessAmount: '0',
      isReimbursable: false,
      createdAt: '2026-09-23T09:05:00.000Z',
    },
  ],
  payments: [
    {
      id: 'payment-1',
      paymentDate: '2026-09-23T10:00:00.000Z',
      amount: '1000',
      paymentMethod: 'upi',
      paymentSource: 'frontdesk',
      paymentType: 'regular',
      status: 'completed',
      transactionId: 'UPI-REF-1',
    },
  ],
};

describe('ClaimBillCard', () => {
  it('shows the complete bill to the TPA reviewer', () => {
    render(<ClaimBillCard bill={bill} />);

    expect(screen.getByText('Complete Hospital Bill')).toBeInTheDocument();
    expect(screen.getByText(/IPB-0001/)).toBeInTheDocument();
    expect(screen.getByText('Room charges')).toBeInTheDocument();
    expect(screen.getByText('Patient convenience item')).toBeInTheDocument();
    expect(screen.getByText('TPA eligible')).toBeInTheDocument();
    expect(screen.getAllByText('Patient payable')).toHaveLength(2);
    expect(screen.getByText('Payments recorded against this bill')).toBeInTheDocument();
    expect(screen.getByText('UPI-REF-1')).toBeInTheDocument();
    expect(screen.getAllByText('₹10,500')).not.toHaveLength(0);
  });
});
