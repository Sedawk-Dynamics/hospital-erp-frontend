import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AdmissionBillDocumentView } from './admission-bill-document';
import type { AdmissionBillDocument } from '@/hooks/use-ip-billing';

// The printed IP / Emergency / Day Care bill. Everything asserted here was a
// real defect at some point: a blank letterhead for non-admin users, an interim
// bill that read as final, unbilled charges shown without a marker, and a
// settled stay printing a balance because a counter concession was ignored.

const BRANDING = {
  name: 'Green city Hospital',
  tagline: 'Care first',
  logoUrl: null,
  showLogo: false,
  headerStyle: 'centered' as const,
  addressLine1: '12 Ring Road',
  addressLine2: null,
  city: 'Pune',
  state: 'MH',
  pincode: '411001',
  country: 'India',
  phone: '+91 7567202234',
  altPhone: null,
  email: 'hospital1@email.com',
  website: null,
  registrationNo: 'REG-99',
  gstin: 'GST-42',
  accreditation: null,
  footerText: 'Computer-generated bill.',
  accentColor: '#0f766e',
  show: {
    tagline: true, address: true, phone: true, email: true,
    website: true, registrationNo: true, gstin: true, accreditation: true,
  },
};

function makeDoc(over: Partial<AdmissionBillDocument> = {}): AdmissionBillDocument {
  return {
    hospital: BRANDING,
    admissionId: 'adm-1',
    admissionType: 'daycare',
    admissionTypeLabel: 'Day Care',
    isPaid: true,
    isDischarged: true,
    documentTitle: 'Final Bill',
    patient: {
      id: 'p1', name: 'Asha Rao', mrn: 'MRN-1', age: '41Y',
      gender: 'female', phone: '9000000001', address: '4 Test Lane, Pune',
      bloodGroup: null,
    },
    admission: {
      ipNumber: 'ADM12345', admittedOn: '2026-08-01T09:30:00Z',
      dischargedOn: '2026-08-03T09:30:00Z', lengthOfStayDays: 2,
      ward: 'General', bed: 'G03', doctor: 'Dr. Rao',
      billingCategory: 'cash', reason: 'Day-care procedure',
    },
    bills: [{ billNumber: 'IPW-1', status: 'paid', totalAmount: 3000 }],
    groups: [
      {
        category: 'room', label: 'Room / Bed Charges', total: 1500,
        lines: [{
          description: 'Day-care bed', category: 'room', quantity: 1,
          unitPrice: 1500, totalAmount: 1500, status: 'posted',
          at: '2026-08-01T09:30:00Z',
        }],
      },
      {
        category: 'pharmacy', label: 'Pharmacy & Medicines', total: 2000,
        lines: [{
          description: 'Injection Ceftriaxone 1g', category: 'pharmacy', quantity: 2,
          unitPrice: 1000, totalAmount: 2000, status: 'pending',
          at: '2026-08-02T09:30:00Z',
        }],
      },
    ],
    payments: [{
      date: '2026-08-03T09:30:00Z', amount: 3000, method: 'cash',
      type: 'regular', reference: null, receiptNumber: 'RCPT-1',
    }],
    totals: {
      grossCharges: 3500, posted: 1500, pending: 2000, discount: 500, tax: 0,
      insuranceCovered: 0, deposit: 0, depositApplied: 0, depositRefunded: 0,
      paid: 3000, cashPaid: 3000, netPayable: 3000, balanceDue: 0, refundable: 0,
    },
    generatedAt: '2026-08-03T10:00:00Z',
    ...over,
  } as AdmissionBillDocument;
}

describe('AdmissionBillDocumentView', () => {
  it('renders the letterhead carried on the document', () => {
    // Regression: this used to be fetched from the admin-only
    // GET /hospital-branding, so doctors and nurses printed a blank header.
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.getByText('Green city Hospital')).toBeInTheDocument();
    expect(screen.getByText(/12 Ring Road/)).toBeInTheDocument();
    expect(screen.getByText(/Reg\. No: REG-99/)).toBeInTheDocument();
  });

  it('falls back gracefully when no branding is attached', () => {
    render(<AdmissionBillDocumentView doc={makeDoc({ hospital: null })} />);
    expect(screen.getByText('Hospital')).toBeInTheDocument();
  });

  it('titles a discharged stay as the final bill, with no interim warning', () => {
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.getByText(/Day Care · Final Bill/)).toBeInTheDocument();
    expect(screen.queryByText(/still admitted/i)).not.toBeInTheDocument();
  });

  it('warns that an undischarged stay is still accruing', () => {
    // A bill handed over mid-stay must never read as if it were complete.
    render(
      <AdmissionBillDocumentView
        doc={makeDoc({ isDischarged: false, documentTitle: 'Interim Bill' })}
      />,
    );
    expect(screen.getByText(/Interim Bill/)).toBeInTheDocument();
    expect(screen.getByText(/charges may still be added/i)).toBeInTheDocument();
  });

  it('marks charges that have accrued but are not yet billed', () => {
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.getByText('unbilled')).toBeInTheDocument();
  });

  it('shows the concession and the net it produces', () => {
    // The ledger totals line items only; a counter concession lives on the bill
    // header. Missing it printed a settled stay as still owing.
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('− ₹500.00')).toBeInTheDocument();
    // ₹3,000.00 appears twice (net payable and paid at counter), so scope the
    // assertion to the Net payable row rather than the whole document.
    const netRow = screen.getByText('Net payable').closest('tr')!;
    expect(within(netRow).getByText('₹3,000.00')).toBeInTheDocument();
  });

  it('reports tax as included rather than adding it again', () => {
    // BillItem.totalAmount already contains item tax; adding the header tax on
    // top double-counted it.
    render(<AdmissionBillDocumentView doc={makeDoc({
      totals: { ...makeDoc().totals, tax: 120 },
    })} />);
    expect(screen.getByText('(of which tax)')).toBeInTheDocument();
  });

  it('stamps a settled bill as paid and shows a zero balance', () => {
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.getByText(/Paid in full/i)).toBeInTheDocument();
    expect(screen.getByText('Balance due')).toBeInTheDocument();
    expect(screen.getByText('₹0.00')).toBeInTheDocument();
  });

  it('does not stamp paid when a balance remains', () => {
    render(<AdmissionBillDocumentView doc={makeDoc({
      isPaid: false,
      totals: { ...makeDoc().totals, balanceDue: 700, paid: 2300, cashPaid: 2300 },
    })} />);
    expect(screen.queryByText(/Paid in full/i)).not.toBeInTheDocument();
    expect(screen.getByText('₹700.00')).toBeInTheDocument();
  });

  it('lists every charge group with its own subtotal', () => {
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.getByText('Room / Bed Charges')).toBeInTheDocument();
    expect(screen.getByText('Pharmacy & Medicines')).toBeInTheDocument();
    expect(screen.getByText('Room / Bed Charges total')).toBeInTheDocument();
    expect(screen.getByText('Injection Ceftriaxone 1g')).toBeInTheDocument();
  });

  it('says so plainly when a stay has no charges', () => {
    render(<AdmissionBillDocumentView doc={makeDoc({ groups: [] })} />);
    expect(screen.getByText(/No charges recorded for this stay/i)).toBeInTheDocument();
  });

  it('lists payments with their receipt number', () => {
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    const section = screen.getByText('Payments Received').closest('section')!;
    expect(within(section).getByText('RCPT-1')).toBeInTheDocument();
    // The mode is uppercased with CSS, so the DOM text is still 'cash'.
    expect(within(section).getByText('cash')).toBeInTheDocument();
  });

  it('shows the care type and stay details in the header card', () => {
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('MRN-1')).toBeInTheDocument();
    expect(screen.getByText('ADM12345')).toBeInTheDocument();
    expect(screen.getByText('2 day(s)')).toBeInTheDocument();
    expect(screen.getByText('General / G03')).toBeInTheDocument();
  });
});
