import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AdmissionBillDocumentView } from './admission-bill-document';
import type { AdmissionBillDocument } from '@/hooks/use-ip-billing';
import type { PdfTemplate } from '@/hooks/use-hospital-branding';
import { DEFAULT_PDF_TEMPLATE } from '@/lib/pdf-theme';

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

/**
 * A line with no tax position — a pending charge, or a bill raised before any
 * of the GST work existed. The layout must fall back to what it always was.
 */
function noTax(amount: number) {
  return {
    hsnSac: null, gstTreatment: null, treatmentLabel: null,
    taxRatePercent: 0, taxableValue: amount, taxAmount: 0,
    cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0,
    igstRate: 0, igstAmount: 0, cessAmount: 0,
  };
}

/** An unregistered hospital: no document type, no numbers, no tax columns. */
const NO_GST = {
  registered: false,
  documentType: null, documentLabel: null, invoiceNumbers: [], financialYear: null,
  supplierGstin: null, supplierStateCode: null, supplierStateName: null,
  recipientGstin: null, placeOfSupplyStateCode: null, placeOfSupplyStateName: null,
  isInterState: false, hasTax: false, hasClassifiedLines: false,
  taxSummary: [], notes: [],
  totals: { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cessAmount: 0, taxAmount: 0 },
  taxAmountInWords: '', copyMarking: null,
};

/** A template override on top of the product defaults. */
function withTemplate(over: Partial<PdfTemplate>): PdfTemplate {
  return { ...DEFAULT_PDF_TEMPLATE, ...over };
}

function makeDoc(over: Partial<AdmissionBillDocument> = {}): AdmissionBillDocument {
  return {
    hospital: BRANDING,
    // Served with the document, exactly as the API does it.
    template: DEFAULT_PDF_TEMPLATE,
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
    bills: [{
      billNumber: 'IPW-1', status: 'paid', totalAmount: 3000,
      invoiceNumber: null, gstDocumentType: null,
    }],
    gst: NO_GST,
    groups: [
      {
        category: 'room', label: 'Room / Bed Charges', total: 1500,
        lines: [{
          description: 'Day-care bed', category: 'room', quantity: 1,
          unitPrice: 1500, totalAmount: 1500, status: 'posted',
          at: '2026-08-01T09:30:00Z', ...noTax(1500),
        }],
      },
      {
        category: 'pharmacy', label: 'Pharmacy & Medicines', total: 2000,
        lines: [{
          description: 'Injection Ceftriaxone 1g', category: 'pharmacy', quantity: 2,
          unitPrice: 1000, totalAmount: 2000, status: 'pending',
          at: '2026-08-02T09:30:00Z', ...noTax(2000),
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

  // -- Printing ------------------------------------------------------------
  // This document is only ever shown inside a dialog, and printing it produced
  // a blank sheet. See tests/unit/lib/print-isolation.test.ts for the stylesheet
  // half of the fix; these two pin what the document itself must do.

  it('marks itself as the document being printed', () => {
    // The print rules use this marker to tell which of several stacked dialogs
    // holds the thing being printed.
    const { container } = render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(container.querySelector('#ip-bill-print')).toHaveClass('print-document');
  });

  it('does not position itself absolutely to reach the page origin', () => {
    // Its nearest positioned ancestor is the transformed dialog popup, so
    // `top: 0` would mean the middle of the dialog — and going out of flow
    // collapses the popup, which clips the bill away to nothing. That was the
    // blank sheet. The popup is returned to the normal flow instead.
    const { container } = render(<AdmissionBillDocumentView doc={makeDoc()} />);
    const style = container.querySelector('style')!.textContent!;
    expect(style).toContain('@media print');
    expect(style).not.toMatch(/position:\s*absolute/);
  });

  // -- The PDF Builder template -------------------------------------------
  // This view and /bill-document/pdf must be two renderings of ONE definition.
  // Everything the PDF honours is honoured here, so a hospital that restyles
  // the bill sees the change on screen and on paper.

  it('takes the page size and margin from the template', () => {
    const doc = makeDoc({
      template: withTemplate({ page: { size: 'A5', orientation: 'landscape', margin: 20 } }),
    });
    const { container } = render(<AdmissionBillDocumentView doc={doc} />);
    // Sizes are in pt so the on-screen document is the same physical size as
    // the PDF; px would render it ~1.33x too large.
    expect(container.querySelector<HTMLElement>('#ip-bill-print')!.style.padding).toBe('20pt');
    expect(container.querySelector('style')!.textContent).toContain('@page { size: A5 landscape');
  });

  it('takes the typeface and body size from the template', () => {
    const doc = makeDoc({
      template: withTemplate({ typography: { fontFamily: 'Times', baseFontSize: 11, lineGap: 4 } }),
    });
    const { container } = render(<AdmissionBillDocumentView doc={doc} />);
    const root = container.querySelector<HTMLElement>('#ip-bill-print')!;
    expect(root.style.fontFamily).toContain('Times');
    expect(root.style.fontSize).toBe('11pt');
  });

  it('lets the template override the document title', () => {
    const doc = makeDoc({
      template: withTemplate({
        header: { ...DEFAULT_PDF_TEMPLATE.header, titleOverride: 'TAX INVOICE' },
      }),
    });
    render(<AdmissionBillDocumentView doc={doc} />);
    expect(screen.getByText('TAX INVOICE')).toBeInTheDocument();
    expect(screen.queryByText(/Day Care · Final Bill/)).not.toBeInTheDocument();
  });

  it('drops the letterhead for pre-printed stationery', () => {
    const doc = makeDoc({
      template: withTemplate({
        header: { ...DEFAULT_PDF_TEMPLATE.header, showLetterhead: false },
      }),
    });
    render(<AdmissionBillDocumentView doc={doc} />);
    // The title still prints — only the hospital's letterhead is left off.
    expect(screen.queryByText('Green city Hospital')).not.toBeInTheDocument();
    expect(screen.getByText(/Day Care · Final Bill/)).toBeInTheDocument();
  });

  it('stamps the watermark when the template turns it on', () => {
    const doc = makeDoc({
      template: withTemplate({
        watermark: { enabled: true, text: 'DUPLICATE', opacity: 0.3, angle: -20, color: '#dc2626', fontSize: 70 },
      }),
    });
    render(<AdmissionBillDocumentView doc={doc} />);
    const mark = screen.getByText('DUPLICATE');
    expect(mark).toBeInTheDocument();
    expect(mark.style.opacity).toBe('0.3');
    expect(mark.style.transform).toBe('rotate(-20deg)');
  });

  it('leaves the watermark off by default', () => {
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.queryByText('COPY')).not.toBeInTheDocument();
  });

  it('draws the signing lines the template asks for', () => {
    const doc = makeDoc({
      template: withTemplate({
        signature: { enabled: true, labels: ['Billing Officer', 'Patient / Attendant'], height: 60 },
      }),
    });
    render(<AdmissionBillDocumentView doc={doc} />);
    expect(screen.getByText('Billing Officer')).toBeInTheDocument();
    expect(screen.getByText('Patient / Attendant')).toBeInTheDocument();
  });

  it('prints custom blocks on the side of the body they belong to', () => {
    const doc = makeDoc({
      template: withTemplate({
        blocks: [
          { id: 'a', position: 'before_body', heading: 'Notice', text: 'Carry your policy card.' },
          { id: 'b', position: 'after_body', heading: 'Terms', text: 'Bills once settled are not refundable.' },
        ],
      }),
    });
    const { container } = render(<AdmissionBillDocumentView doc={doc} />);
    const text = container.textContent!;
    expect(text).toContain('Carry your policy card.');
    expect(text).toContain('Bills once settled are not refundable.');
    // Order matters — a "before body" note that prints after the charges is
    // not the block the hospital configured.
    expect(text.indexOf('Carry your policy card.')).toBeLessThan(text.indexOf('Bill of Charges'));
    expect(text.indexOf('Bills once settled are not refundable.')).toBeGreaterThan(
      text.indexOf('Bill of Charges'),
    );
  });

  it('prefers the template footer text over the hospital default', () => {
    const doc = makeDoc({
      template: withTemplate({
        footer: { ...DEFAULT_PDF_TEMPLATE.footer, footerTextOverride: 'Subject to Pune jurisdiction.' },
      }),
    });
    render(<AdmissionBillDocumentView doc={doc} />);
    expect(screen.getByText('Subject to Pune jurisdiction.')).toBeInTheDocument();
    expect(screen.queryByText('Computer-generated bill.')).not.toBeInTheDocument();
  });

  it('can drop the footer entirely', () => {
    const doc = makeDoc({
      template: withTemplate({
        footer: { ...DEFAULT_PDF_TEMPLATE.footer, showFooter: false },
      }),
    });
    render(<AdmissionBillDocumentView doc={doc} />);
    expect(screen.queryByText('Computer-generated bill.')).not.toBeInTheDocument();
  });

  it('still prints at the product defaults when no template is served', () => {
    // An older cached response, or any path that does not carry one, must not
    // throw — it prints the way an uncustomised hospital's bill prints.
    const doc = makeDoc({ template: null });
    render(<AdmissionBillDocumentView doc={doc} />);
    expect(screen.getByText(/Day Care · Final Bill/)).toBeInTheDocument();
    expect(screen.getByText('Green city Hospital')).toBeInTheDocument();
  });
  // ── The GST document ─────────────────────────────────────────────────────
  //
  // The layout follows what KIND of document this is, and the difference is not
  // cosmetic: a bill of supply may not carry tax columns, a tax invoice must
  // carry the split against each line, and a hospital that is not registered
  // must print exactly what it printed before any of this existed.

  /** A mixed stay — an exempt medicine beside a taxed room, the ordinary case. */
  function taxedDoc(over: Record<string, unknown> = {}) {
    return makeDoc({
      documentTitle: 'Invoice-cum-Bill of Supply',
      groups: [
        {
          category: 'room', label: 'Room / Bed Charges', total: 8400,
          lines: [{
            description: 'Deluxe AC room', category: 'room', quantity: 1,
            unitPrice: 8000, totalAmount: 8400, status: 'posted',
            at: '2026-08-01T09:30:00Z',
            hsnSac: '996311', gstTreatment: 'taxable', treatmentLabel: 'Taxable',
            taxRatePercent: 5, taxableValue: 8000, taxAmount: 400,
            cgstRate: 2.5, cgstAmount: 200, sgstRate: 2.5, sgstAmount: 200,
            igstRate: 0, igstAmount: 0, cessAmount: 0,
          }],
        },
        {
          category: 'pharmacy', label: 'Pharmacy & Medicines', total: 240,
          lines: [{
            description: 'Injection Ceftriaxone 1g', category: 'pharmacy', quantity: 2,
            unitPrice: 120, totalAmount: 240, status: 'posted',
            at: '2026-08-02T09:30:00Z',
            hsnSac: '30042090', gstTreatment: 'exempt', treatmentLabel: 'Exempt',
            taxRatePercent: 0, taxableValue: 240, taxAmount: 0,
            cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0,
            igstRate: 0, igstAmount: 0, cessAmount: 0,
          }],
        },
      ],
      gst: {
        ...NO_GST,
        registered: true,
        documentType: 'invoice_cum_bill_of_supply',
        documentLabel: 'Invoice-cum-Bill of Supply',
        invoiceNumbers: ['INV/2026-27/000003'],
        financialYear: '2026-27',
        supplierGstin: '27AAPFU0939F1ZV',
        supplierStateCode: '27',
        supplierStateName: 'Maharashtra',
        placeOfSupplyStateCode: '27',
        placeOfSupplyStateName: 'Maharashtra',
        hasTax: true,
        hasClassifiedLines: true,
        taxSummary: [
          {
            label: 'Taxable', treatment: 'taxable', ratePercent: 5, taxableValue: 8000,
            cgstAmount: 200, sgstAmount: 200, igstAmount: 0, cessAmount: 0, taxAmount: 400,
          },
          {
            label: 'Exempt', treatment: 'exempt', ratePercent: 0, taxableValue: 240,
            cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cessAmount: 0, taxAmount: 0,
          },
        ],
        notes: ['Tax is not payable on reverse charge basis.'],
        totals: {
          taxableValue: 8240, cgstAmount: 200, sgstAmount: 200,
          igstAmount: 0, cessAmount: 0, taxAmount: 400,
        },
      },
      ...over,
    });
  }

  it('prints the legacy four columns for a hospital that is not registered', () => {
    // Nothing about a hospital outside GST should move because of this work.
    render(<AdmissionBillDocumentView doc={makeDoc()} />);
    expect(screen.queryByRole('columnheader', { name: 'HSN / SAC' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'CGST' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Particulars' })).toBeInTheDocument();
  });

  it('names the document by what it legally is, and quotes its number', () => {
    render(<AdmissionBillDocumentView doc={taxedDoc()} />);
    // The name appears twice on purpose — as the title, and as the label on the
    // number the document was issued under.
    expect(screen.getAllByText(/Invoice-cum-Bill of Supply/).length).toBe(2);
    expect(screen.getAllByText('INV/2026-27/000003').length).toBeGreaterThan(0);
    expect(screen.getByText('27AAPFU0939F1ZV')).toBeInTheDocument();
    expect(screen.getByText('Maharashtra (27)')).toBeInTheDocument();
  });

  it('carries HSN, taxable value and the split against each line', () => {
    render(<AdmissionBillDocumentView doc={taxedDoc()} />);
    // CGST and SGST head both the charge table and the summary below it.
    expect(screen.getByRole('columnheader', { name: 'HSN / SAC' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Taxable' })).toBeInTheDocument();
    for (const header of ['CGST', 'SGST']) {
      expect(screen.getAllByRole('columnheader', { name: header }).length).toBe(2);
    }
    expect(screen.getByText('996311')).toBeInTheDocument();
    // The rate belongs against the line too, not only in the total.
    expect(screen.getAllByText(/2\.5%/).length).toBe(2);
  });

  // An exemption stated twice reads as two exemptions rather than one untaxed
  // line, so the word goes on one cell and the other holds a dash.
  it('says once, in words, that an exempt line carries no tax', () => {
    render(<AdmissionBillDocumentView doc={taxedDoc()} />);
    const exemptCells = screen.getAllByText('Exempt');
    expect(exemptCells.length).toBe(2); // the line, and its row in the summary
  });

  it('summarises the bill one row per rate, and adds it up', () => {
    render(<AdmissionBillDocumentView doc={taxedDoc()} />);
    expect(screen.getByText('Tax Summary')).toBeInTheDocument();
    // "Value", not "Taxable Value": the table has a row per TREATMENT as well
    // as per rate, so an exempt row sits under the same column as a taxed one.
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('₹8,240.00')).toBeInTheDocument();
    expect(screen.getByText(/reverse charge/)).toBeInTheDocument();
  });

  // An exempt supply has a VALUE — it is in Amount on the same row — but it has
  // no TAXABLE value. Printing one under that heading beside an "Exempt" cell
  // made the row contradict itself, and made the column stop summing to the tax
  // below it.
  it('leaves the taxable column empty on an exempt line, and fills it on a taxed one', () => {
    render(<AdmissionBillDocumentView doc={taxedDoc()} />);

    // By COLUMN, not by row: the exempt line's money is still on the row, in
    // Amount. What must be empty is the cell under "Taxable".
    const headers = [...screen.getAllByRole('columnheader')].map((h) => h.textContent);
    const taxableCol = headers.indexOf('Taxable');
    expect(taxableCol).toBeGreaterThan(-1);

    const cellsOf = (label: string) =>
      [...screen.getByText(label).closest('tr')!.querySelectorAll('td')].map((c) => c.textContent);

    const exempt = cellsOf('Injection Ceftriaxone 1g');
    expect(exempt[taxableCol]).toBe('—');
    // ...and the line's own money is untouched, in the last column.
    expect(exempt[exempt.length - 1]).toBe('₹240.00');

    expect(cellsOf('Deluxe AC room')[taxableCol]).toBe('₹8,000.00');
  });

  // A total under a column has to sum that column, or it is not a total of
  // anything the reader can see.
  it('foots the taxable column to zero for a group that is entirely exempt', () => {
    render(<AdmissionBillDocumentView doc={taxedDoc()} />);
    const cells = [
      ...screen.getByText('Pharmacy & Medicines total').closest('tr')!.querySelectorAll('td'),
    ].map((c) => c.textContent);
    // The label cell spans the first four columns, so Taxable is the second
    // cell in the DOM even though it is the fifth column on the page.
    expect(cells[1]).toBe('₹0.00');
    // Zero taxable, and the group's actual money still stated beside it.
    expect(cells[cells.length - 1]).toBe('₹240.00');
  });

  it('bills a patient from another state IGST, with no CGST/SGST columns', () => {
    const doc = taxedDoc();
    doc.gst.isInterState = true;
    doc.gst.placeOfSupplyStateCode = '29';
    doc.gst.placeOfSupplyStateName = 'Karnataka';
    doc.gst.taxSummary = [{
      label: 'Taxable', treatment: 'taxable', ratePercent: 5, taxableValue: 8000,
      cgstAmount: 0, sgstAmount: 0, igstAmount: 400, cessAmount: 0, taxAmount: 400,
    }];
    doc.gst.totals = {
      taxableValue: 8000, cgstAmount: 0, sgstAmount: 0,
      igstAmount: 400, cessAmount: 0, taxAmount: 400,
    };
    doc.groups[0].lines[0] = {
      ...doc.groups[0].lines[0],
      cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0,
      igstRate: 5, igstAmount: 400,
    };
    render(<AdmissionBillDocumentView doc={doc} />);
    expect(screen.getAllByRole('columnheader', { name: 'IGST' }).length).toBe(2);
    expect(screen.queryByRole('columnheader', { name: 'CGST' })).not.toBeInTheDocument();
    expect(screen.getByText('Karnataka (29)')).toBeInTheDocument();
  });

  // A bill of supply is the document for an EXEMPT supply. Tax columns on one
  // would claim the hospital charged tax it never did.
  it('shows HSN but no tax columns on an all-exempt bill of supply', () => {
    const doc = taxedDoc();
    doc.gst.documentType = 'bill_of_supply';
    doc.gst.documentLabel = 'Bill of Supply';
    doc.gst.hasTax = false;
    render(<AdmissionBillDocumentView doc={doc} />);
    expect(screen.getByRole('columnheader', { name: 'HSN / SAC' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'CGST' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tax Summary')).not.toBeInTheDocument();
  });
});
