import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const gstProfile = vi.fn();
vi.mock('@/hooks/use-gst-profile', () => ({
  useGstProfile: () => gstProfile(),
}));

import { BillSummaryPanel } from './bill-generator-dialog';

/** The stay this was reported on: consultation plus two ward medicines. */
const allExempt = {
  subtotal: 2313,
  discountAmount: 0,
  taxableValue: 2313, // the header's undifferentiated sum — see the panel
  taxAmount: 0,
  cgstAmount: 0,
  sgstAmount: 0,
  igstAmount: 0,
  totalAmount: 2313,
  amountPaid: 0,
  balanceDue: 2313,
  billItems: [
    { id: '1', description: 'Doctor visit', quantity: 1, unitPrice: 700, discountAmount: 0, taxPercent: 0, taxAmount: 0, totalAmount: 700, gstTreatment: 'exempt', taxableValue: 700 },
    { id: '2', description: 'Dolo 120 Suspension', quantity: 15, unitPrice: 100, discountAmount: 0, taxPercent: 0, taxAmount: 0, totalAmount: 1500, gstTreatment: 'exempt', taxableValue: 1500 },
    { id: '3', description: 'Dolo-T Tablet', quantity: 10, unitPrice: 11.3, discountAmount: 0, taxPercent: 0, taxAmount: 0, totalAmount: 113, gstTreatment: 'exempt', taxableValue: 113 },
  ],
};

const mixed = {
  ...allExempt,
  taxAmount: 100,
  cgstAmount: 50,
  sgstAmount: 50,
  billItems: [
    ...allExempt.billItems,
    { id: '4', description: 'nursing feed', quantity: 1, unitPrice: 5000, discountAmount: 0, taxPercent: 2, taxAmount: 100, totalAmount: 5100, gstTreatment: 'taxable', taxableValue: 5000 },
  ],
};

beforeEach(() => {
  gstProfile.mockReturnValue({ data: { registered: true } });
});

describe('BillSummaryPanel — what the tax rows mean', () => {
  // A bill of nothing but exempt healthcare shows a column of dashes and four
  // zeroes. To the person at the counter that reads as "the tax has not
  // loaded" rather than "no tax is due", which is what was reported.
  it('says why there is no tax when every line is exempt', () => {
    render(<BillSummaryPanel bill={allExempt} />);
    expect(screen.getByText(/No GST is due/)).toBeInTheDocument();
    expect(screen.getByText(/every line on this bill is exempt or nil-rated/)).toBeInTheDocument();
  });

  // "No tax because we are not registered" and "no tax because these supplies
  // are exempt" are different statements, and the wrong one is worse than none.
  it('says the other thing entirely when the hospital is not registered', () => {
    gstProfile.mockReturnValue({ data: { registered: false } });
    render(<BillSummaryPanel bill={allExempt} />);
    expect(screen.getByText(/not registered under GST/)).toBeInTheDocument();
    expect(screen.queryByText(/every line on this bill is exempt/)).not.toBeInTheDocument();
  });

  it('stays quiet when there IS tax — the figures speak for themselves', () => {
    render(<BillSummaryPanel bill={mixed} />);
    expect(screen.queryByText(/No GST is due/)).not.toBeInTheDocument();
    expect(screen.queryByText(/not registered under GST/)).not.toBeInTheDocument();
  });

  // The split is the other half of the same fix: the header's taxable_value is
  // every line's value including the exempt ones, so read raw it claimed the
  // whole stay was taxable.
  it('splits the value by treatment rather than calling all of it taxable', () => {
    render(<BillSummaryPanel bill={mixed} />);
    const row = (label: string) =>
      screen.getByText(label).parentElement?.textContent ?? '';
    expect(row('Taxable value')).toContain('5,000');
    expect(row('Exempt / nil-rated')).toContain('2,313');
  });

  it('reports an all-exempt bill as nil taxable, not as its subtotal', () => {
    render(<BillSummaryPanel bill={allExempt} />);
    const row = (label: string) =>
      screen.getByText(label).parentElement?.textContent ?? '';
    expect(row('Taxable value')).toContain('₹0');
    expect(row('Exempt / nil-rated')).toContain('2,313');
  });
});
