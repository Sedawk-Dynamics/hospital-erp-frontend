import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PharmacySale } from '@/hooks/use-pharmacy';
import { PharmacyReceiptDialog } from './pharmacy-receipt-dialog';

// Gap 345 — the receipt, a reprint and the credit note print the server's words.

const sale = (over: Record<string, unknown> = {}): PharmacySale =>
  ({
    hospital: { name: 'City Hospital' },
    creditNotes: [],
    bill: {
      id: 'b1', billNumber: 'PH-1', billDate: '2026-11-25T06:00:00Z', status: 'paid', subtotal: 42, discountAmount: 0, taxAmount: 2,
      totalAmount: 42, amountPaid: 42, balanceDue: 0, payments: [],
      billItems: [{
        id: 'i1', description: 'Dolo 650 (Batch BN1) — 2 strips (20 tablets)', quantity: 20, quantityText: '2 strips (20 tablets)',
        rateUnit: 'tablet', unitPrice: 2.1, discountAmount: 0, totalAmount: 42, taxPercent: 5, gstTreatment: 'taxable',
      }],
    },
    ...over,
  }) as unknown as PharmacySale;

describe('pharmacy receipt quantities', () => {
  it('prints packs and single units, and what the rate is for', () => {
    render(<PharmacyReceiptDialog sale={sale()} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('2 strips (20 tablets)')).toBeInTheDocument();
    expect(screen.getByText('/tablet')).toBeInTheDocument();
    expect(screen.getByText(/Rate is per single unit/)).toBeInTheDocument();
  });

  it('reprints a bill from before the words were kept exactly as it was', () => {
    const s = sale();
    Object.assign(s.bill.billItems[0], { quantityText: null, rateUnit: null, description: 'Dolo 650 — 2 strips of 10 tablets' });
    render(<PharmacyReceiptDialog sale={s} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Dolo 650 — 2 strips of 10 tablets')).toBeInTheDocument();
  });

  it('prints the returned quantity on the credit note, at the original rate', () => {
    render(
      <PharmacyReceiptDialog
        open
        onOpenChange={vi.fn()}
        initialCreditNoteId="cn1"
        sale={sale({
          creditNotes: [{
            id: 'cn1', creditNoteNumber: 'CN/1', noteType: 'credit', issueDate: '2026-11-25T07:00:00Z', reason: 'sales_return', reasonNote: null,
            taxableValue: -5.63, cgstAmount: -0.34, sgstAmount: -0.33, igstAmount: 0, cessAmount: 0, taxAmount: -0.67, totalAmount: -6.3,
            withinTimeLimit: true,
            items: [{
              id: 'ci', description: 'Dolo 650 — returned 3 tablets (loose) of 2 strips (20 tablets)', quantity: -3, quantityText: '3 tablets (loose)',
              taxPercent: 12, taxableValue: -5.63, taxAmount: -0.67, totalAmount: -6.3, hsnSacCode: '3004', gstTreatment: 'taxable',
            }],
          }],
        })}
      />,
    );
    expect(screen.getByText('3 tablets (loose)')).toBeInTheDocument();
    expect(screen.getByText(/GST 12%/)).toBeInTheDocument();
  });
});
