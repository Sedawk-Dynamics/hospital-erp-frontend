'use client';

import { useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/date-utils';
import type { PharmacyCreditNote, PharmacySale } from '@/hooks/use-pharmacy';
import { amountInWords as inWords } from '@/lib/amount-in-words';
import { CreditNoteIrnBlock } from './credit-note-irn';

const num = (n: number | string | null | undefined): number => {
  if (n == null) return 0;
  return typeof n === 'string' ? Number(n) : n;
};
const inr = (n: number | string | null | undefined) =>
  `₹${num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Friendly labels for the split-payment tender breakdown on the receipt.
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  upi: 'UPI',
  net_banking: 'Bank Transfer',
  insurance: 'Insurance',
  cheque: 'Cheque',
  other: 'Other',
};

function ageFromDob(dob: string | null): string {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return years > 0 ? `${years}y` : '';
}

// G-7: why a credit note was raised, in the counter's words.
const CREDIT_REASON_LABELS: Record<string, string> = {
  cancellation: 'Invoice cancelled',
  sales_return: 'Goods returned',
  post_supply_discount: 'Discount after sale',
  reversal: 'Reversal',
  correction: 'Correction',
};

export function PharmacyReceiptDialog({
  sale,
  open,
  onOpenChange,
  initialCreditNoteId,
}: {
  sale: PharmacySale | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** G-7: open straight on this credit note (e.g. from a return). */
  initialCreditNoteId?: string | null;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  // G-7: which document is on screen - the invoice, or one of its credit
  // notes. A cancelled sale opens on its credit note: the invoice it voided
  // has no lines left, and reprinting it as a Tax Invoice was the bug.
  const [picked, setPicked] = useState<{ billId: string; view: string } | null>(null);
  const notes = sale?.creditNotes ?? [];
  const defaultView =
    (initialCreditNoteId && notes.some((n) => n.id === initialCreditNoteId) ? initialCreditNoteId : null) ??
    (sale?.bill.status === 'cancelled' && notes.length ? notes[notes.length - 1].id : 'invoice');
  const view = picked && picked.billId === sale?.bill.id ? picked.view : defaultView;
  const activeNote = view === 'invoice' ? null : (notes.find((n) => n.id === view) ?? null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=420,height=800');
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>${activeNote?.creditNoteNumber ?? sale?.bill.billNumber ?? 'Invoice'}</title>${printStyles}</head><body>${html}</body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 150);
  };

  const bill = sale?.bill;
  const hospital = sale?.hospital;
  const gst = sale?.gst;

  // Everything below comes off the server's GST block rather than being worked
  // out here. This screen used to halve `taxAmount` into CGST and SGST, which
  // disagreed with the stored split by a paisa on any odd amount, and would
  // have printed a CGST/SGST pair on an inter-State supply that carries IGST.
  const totals = gst?.totals;
  const taxable = totals ? totals.taxableValue : num(bill?.totalAmount) - num(bill?.taxAmount);
  // What the law calls this piece of paper. A sale with nothing taxable is
  // issued as a Bill of Supply, and a receipt that calls itself a tax invoice
  // regardless is a document claiming something that did not happen.
  const docLabel = (gst?.documentLabel ?? 'Tax Invoice').toUpperCase();
  // The consecutive number allotted for the financial year — the number the
  // return is filed under. `billNumber` is this system's internal handle and
  // appears beside it, not in place of it.
  const invoiceNumber = gst?.invoiceNumbers?.[0] ?? null;
  // "Paid" can exceed the total when the cashier tenders extra; show the change.
  const change = Math.max(0, num(bill?.amountPaid) - num(bill?.totalAmount));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b bg-surface-container-low px-4 py-2 sticky top-0 z-10">
          <p className="text-sm font-medium">
            {activeNote ? `Credit Note ${activeNote.creditNoteNumber}` : `Invoice ${bill?.billNumber ?? ''}`}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} disabled={!bill}>
              <Printer className="size-3.5" /> Print / Save PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {bill && notes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
            <Button
              size="sm"
              variant={view === 'invoice' ? 'default' : 'outline'}
              onClick={() => setPicked({ billId: bill.id, view: 'invoice' })}
            >
              Invoice
            </Button>
            {notes.map((n) => (
              <Button
                key={n.id}
                size="sm"
                variant={view === n.id ? 'default' : 'outline'}
                onClick={() => setPicked({ billId: bill.id, view: n.id })}
              >
                Credit Note {n.creditNoteNumber}
              </Button>
            ))}
          </div>
        )}

        {bill && sale && activeNote && (
          <div className="p-4">
            <div ref={printRef}>
              <CreditNoteReceipt
                note={activeNote}
                sale={sale}
                originalInvoiceNumber={sale.originalInvoiceNumber ?? invoiceNumber ?? bill.billNumber}
              />
            </div>
          </div>
        )}

        {bill && sale && !activeNote && (
          <div className="p-4">
            <div ref={printRef}>
              <div className="receipt">
                {/* Header */}
                <div className="center">
                  <h1>{hospital?.name ?? 'Pharmacy'}</h1>
                  {(hospital?.address || hospital?.city) && (
                    <p className="muted">
                      {[hospital?.address, hospital?.city, hospital?.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {hospital?.phone && <p className="muted">Ph: {hospital.phone}</p>}
                  <p className="title">PHARMACY {docLabel}</p>
                  {/* Rule 46 wants the copy marked, and section 10.2 puts it in
                      the title band. The copy handed over is always the
                      original; only the phrase changes with the document. */}
                  {gst?.copyMarking && <p className="muted xs">{gst.copyMarking}</p>}
                  {gst?.supplierGstin && (
                    <p className="muted xs">
                      GSTIN: {gst.supplierGstin}
                      {/* Gap #311: unverified / SANDBOX caption from the server. */}
                      {gst.supplierGstinCaption ? ` (${gst.supplierGstinCaption})` : ''}
                      {gst.supplierStateName ? ` · ${gst.supplierStateName}` : ''}
                    </p>
                  )}
                </div>

                <div className="rule" />

                {/* G-7: a voided invoice says so, and names the note that reversed it. */}
                {bill.status === 'cancelled' && (
                  <p className="center bold">
                    CANCELLED{notes.length ? ` - see Credit Note ${notes.map((n) => n.creditNoteNumber).join(', ')}` : ''}
                  </p>
                )}

                {/* Meta */}
                <div className="meta">
                  <div>
                    <span className="muted">{invoiceNumber ? 'Invoice No:' : 'Bill No:'}</span>{' '}
                    <b>{invoiceNumber ?? bill.billNumber}</b>
                  </div>
                  <div>
                    <span className="muted">Date:</span> {formatDateTime(bill.billDate)}
                  </div>
                </div>
                {invoiceNumber && (
                  <div className="meta">
                    <div>
                      <span className="muted">Bill Ref:</span> {bill.billNumber}
                    </div>
                    {gst?.placeOfSupplyStateName && (
                      <div>
                        <span className="muted">Place of Supply:</span> {gst.placeOfSupplyStateName}
                      </div>
                    )}
                  </div>
                )}
                {bill.patient && (
                  <div className="meta">
                    <div>
                      <span className="muted">Patient:</span>{' '}
                      <b>
                        {bill.patient.firstName} {bill.patient.lastName ?? ''}
                      </b>
                      {(bill.patient.gender || bill.patient.dateOfBirth) && (
                        <span className="muted">
                          {' '}
                          ({[bill.patient.gender, ageFromDob(bill.patient.dateOfBirth)].filter(Boolean).join(' / ')})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="muted">MRN:</span> {bill.patient.mrn}
                    </div>
                  </div>
                )}

                {/* G-4: Rule 46(e) - a B2B invoice names the registered buyer. */}
                <BuyerBlock gst={gst} />

                <div className="rule" />

                {/* Items */}
                <table>
                  <thead>
                    <tr>
                      <th className="l">Item</th>
                      <th className="r">Qty</th>
                      <th className="r">Rate</th>
                      <th className="r">Disc</th>
                      <th className="r">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.billItems.map((it) => (
                      <tr key={it.id}>
                        <td className="l">
                          {it.description}
                          {/* HSN against the line it belongs to — Rule 46(g),
                              and Rule 49 wants it on a bill of supply too. An
                              exempt line says so rather than reading "GST 0%",
                              which claims a rate was charged. */}
                          <div className="muted xs">
                            {[
                              it.hsnSacCode ? `HSN ${it.hsnSacCode}` : null,
                              it.gstTreatment === 'taxable' || num(it.taxPercent) > 0
                                ? `GST ${num(it.taxPercent)}%`
                                : it.gstTreatment
                                  ? it.gstTreatment.replace(/_/g, ' ')
                                  : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </td>
                        <td className="r">{it.quantity}</td>
                        <td className="r">{num(it.unitPrice).toFixed(2)}</td>
                        <td className="r">{num(it.discountAmount) > 0 ? num(it.discountAmount).toFixed(2) : '-'}</td>
                        <td className="r">{num(it.totalAmount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="rule" />

                {/* Totals */}
                <div className="totals">
                  <Row label="Sub Total (MRP)" value={inr(bill.subtotal)} />
                  {num(bill.discountAmount) > 0 && (
                    <Row label="Discount" value={`- ${inr(bill.discountAmount)}`} />
                  )}
                  {(gst?.hasTax ?? num(bill.taxAmount) > 0) && (
                    <>
                      <Row label="Taxable Value" value={inr(taxable)} muted />
                      {/* A supply is either within the state or across it, never
                          both. Printing the pair that does not apply as ₹0.00
                          invites a reader to add it in. */}
                      {gst?.isInterState ? (
                        <Row label="IGST" value={inr(totals?.igstAmount ?? bill.taxAmount)} muted />
                      ) : (
                        <>
                          <Row label="CGST" value={inr(totals?.cgstAmount ?? 0)} muted />
                          <Row label="SGST" value={inr(totals?.sgstAmount ?? 0)} muted />
                        </>
                      )}
                      {num(totals?.cessAmount) > 0 && (
                        <Row label="Cess" value={inr(totals?.cessAmount)} muted />
                      )}
                    </>
                  )}
                  {/* Section 6.9 — without it the grand total does not agree
                      with the lines above. Never applied to the tax figures. */}
                  {num(bill.roundOff) !== 0 && (
                    <Row
                      label="Round off"
                      value={`${num(bill.roundOff) > 0 ? '+ ' : '- '}${inr(Math.abs(num(bill.roundOff)))}`}
                      muted
                    />
                  )}
                  <div className="rule thin" />
                  <Row label="Grand Total" value={inr(bill.totalAmount)} bold />
                  <Row label="Paid" value={inr(bill.amountPaid)} />
                  {/* G7: per-tender breakdown for split payments */}
                  {(bill.payments?.length ?? 0) > 1 &&
                    bill.payments.map((p) => (
                      <Row
                        key={p.id}
                        label={`• ${PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}`}
                        value={inr(p.amount)}
                        muted
                      />
                    ))}
                  {change > 0 && <Row label="Change" value={inr(change)} />}
                  {num(bill.balanceDue) > 0 && <Row label="Balance Due" value={inr(bill.balanceDue)} bold />}
                </div>

                {/* The rate-wise summary section 10.1 item 7 requires and the
                    worked example in 3.6 prints. A counter sale routinely
                    carries three different rates, and a single "Incl. GST" line
                    cannot show which value sat at which. */}
                {(gst?.taxSummary?.length ?? 0) > 1 && (
                  <>
                    <div className="rule" />
                    <table>
                      <thead>
                        <tr>
                          <th className="l">Rate</th>
                          <th className="r">Taxable</th>
                          {gst!.isInterState ? (
                            <th className="r">IGST</th>
                          ) : (
                            <>
                              <th className="r">CGST</th>
                              <th className="r">SGST</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {gst!.taxSummary.map((r) => (
                          <tr key={`${r.treatment}:${r.ratePercent}`}>
                            <td className="l">
                              {r.treatment === 'taxable' ? `${r.ratePercent}%` : r.label}
                            </td>
                            <td className="r">{num(r.taxableValue).toFixed(2)}</td>
                            {gst!.isInterState ? (
                              <td className="r">{num(r.igstAmount).toFixed(2)}</td>
                            ) : (
                              <>
                                <td className="r">{num(r.cgstAmount).toFixed(2)}</td>
                                <td className="r">{num(r.sgstAmount).toFixed(2)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <div className="rule" />
                {/* Section 10.1 item 8. What stops a printed bill being altered
                    after it is handed over. */}
                <p className="muted xs">{inWords(num(bill.totalAmount))}</p>
                {gst?.taxAmountInWords ? (
                  <p className="muted xs">Tax: {gst.taxAmountInWords}</p>
                ) : null}

                {/* Gap 347: the receipt named nobody; the Dispensing Records
                    tab already shows this pharmacist. */}
                {sale.dispensedBy && (
                  <p className="muted xs">
                    Dispensed by <b>{sale.dispensedBy}</b>
                  </p>
                )}

                <div className="rule" />
                <p className="center muted xs">
                  {/* 345: each line names the unit it was sold in (strips, bottles, tablets). */}
                  Qty is in base units; each line names the unit it was sold in.
                </p>
                <p className="center muted xs">
                  GST is inclusive in MRP. Goods once sold are returnable only per policy.
                </p>
                {/* Rule 46(o)'s reverse-charge line and the exemption note the
                    rest of the bill relies on — the server's words, so the
                    receipt and the hospital's other bills say the same thing. */}
                {gst?.notes?.map((n) => (
                  <p key={n} className="center muted xs">
                    {n}
                  </p>
                ))}
                <p className="center muted xs">Get well soon — Thank you!</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BuyerBlock({ gst }: { gst: PharmacySale['gst'] }) {
  if (!gst?.recipientGstin) return null;
  return (
    <div className="meta">
      <div>
        <span className="muted">Buyer:</span> <b>{gst.recipientLegalName ?? '—'}</b>
        <div className="xs">GSTIN {gst.recipientGstin}</div>
        {gst.recipientAddress && <div className="muted xs">{gst.recipientAddress}</div>}
      </div>
    </div>
  );
}

/**
 * G-7: the Credit Note — its own number and date, the invoice it reverses,
 * the reason, and the tax taken back split the same way the invoice charged
 * it. Amounts are stored negative on the note; printed as positive credits.
 */
function CreditNoteReceipt({
  note,
  sale,
  originalInvoiceNumber,
}: {
  note: PharmacyCreditNote;
  sale: PharmacySale;
  originalInvoiceNumber: string;
}) {
  const abs = (v: number | string | null | undefined) => Math.abs(num(v));
  const hospital = sale.hospital;
  const gst = sale.gst;
  const isIgst = abs(note.igstAmount) > 0;
  const patient = sale.bill.patient;
  return (
    <div className="receipt">
      <div className="center">
        <h1>{hospital?.name ?? 'Pharmacy'}</h1>
        {(hospital?.address || hospital?.city) && (
          <p className="muted">{[hospital?.address, hospital?.city, hospital?.state].filter(Boolean).join(', ')}</p>
        )}
        <p className="title">{note.noteType === 'debit' ? 'DEBIT NOTE' : 'CREDIT NOTE'}</p>
        {gst?.supplierGstin && (
          <p className="muted xs">
            GSTIN: {gst.supplierGstin}
            {gst.supplierGstinCaption ? ` (${gst.supplierGstinCaption})` : ''}
            {gst.supplierStateName ? ` · ${gst.supplierStateName}` : ''}
          </p>
        )}
      </div>
      <div className="rule" />
      <div className="meta">
        <div>
          <span className="muted">Credit Note No:</span> <b>{note.creditNoteNumber}</b>
        </div>
        <div>
          <span className="muted">Date:</span> {formatDateTime(note.issueDate)}
        </div>
      </div>
      <div className="meta">
        <div>
          <span className="muted">Against Invoice:</span> <b>{originalInvoiceNumber}</b>
        </div>
        <div>
          <span className="muted">dated</span> {formatDateTime(sale.bill.billDate)}
        </div>
      </div>
      <div className="meta">
        <div>
          <span className="muted">Reason:</span> {CREDIT_REASON_LABELS[note.reason] ?? note.reason}
          {note.reasonNote ? ` — ${note.reasonNote}` : ''}
        </div>
      </div>
      {patient && (
        <div className="meta">
          <div>
            <span className="muted">Patient:</span>{' '}
            <b>
              {patient.firstName} {patient.lastName ?? ''}
            </b>
          </div>
          <div>
            <span className="muted">MRN:</span> {patient.mrn}
          </div>
        </div>
      )}
      <BuyerBlock gst={gst} />
      {/* G-5 (gap #266): a B2B note registered on the IRP prints its IRN and QR. */}
      <CreditNoteIrnBlock note={note} />
      <div className="rule" />
      <table>
        <thead>
          <tr>
            <th className="l">Item</th>
            <th className="r">Qty</th>
            <th className="r">Taxable</th>
            <th className="r">GST</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {note.items.map((it) => (
            <tr key={it.id}>
              <td className="l">
                {it.description}
                <div className="muted xs">
                  {[
                    it.hsnSacCode ? `HSN ${it.hsnSacCode}` : null,
                    num(it.taxPercent) > 0 ? `GST ${num(it.taxPercent)}%` : (it.gstTreatment?.replace(/_/g, ' ') ?? null),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </td>
              <td className="r">{abs(it.quantity)}</td>
              <td className="r">{abs(it.taxableValue).toFixed(2)}</td>
              <td className="r">{abs(it.taxAmount).toFixed(2)}</td>
              <td className="r">{abs(it.totalAmount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rule" />
      <div className="totals">
        <Row label="Taxable Value" value={inr(abs(note.taxableValue))} muted />
        {isIgst ? (
          <Row label="IGST" value={inr(abs(note.igstAmount))} muted />
        ) : (
          <>
            <Row label="CGST" value={inr(abs(note.cgstAmount))} muted />
            <Row label="SGST" value={inr(abs(note.sgstAmount))} muted />
          </>
        )}
        {abs(note.cessAmount) > 0 && <Row label="Cess" value={inr(abs(note.cessAmount))} muted />}
        <Row label="Total tax reversed" value={inr(abs(note.taxAmount))} />
        <div className="rule thin" />
        <Row label="Total Credit" value={inr(abs(note.totalAmount))} bold />
      </div>
      <div className="rule" />
      <p className="muted xs">{inWords(abs(note.totalAmount))}</p>
      {!note.withinTimeLimit && (
        <p className="center muted xs">
          Issued after the section 34 time limit — the amount is refunded, but the tax cannot be reduced.
        </p>
      )}
      <p className="center muted xs">This credit note reverses the supply on the invoice named above.</p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`trow${bold ? ' bold' : ''}${muted ? ' muted' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const printStyles = `<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #111827; background: #fff; margin: 0; padding: 8px; }
  @media print { @page { margin: 4mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  .receipt { max-width: 360px; margin: 0 auto; font-size: 12px; }
  h1 { font-size: 16px; margin: 0; }
  .title { font-weight: 700; letter-spacing: 0.05em; margin-top: 6px; font-size: 12px; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .muted { color: #6b7280; }
  .xs { font-size: 10px; }
  .rule { border-top: 1px dashed #9ca3af; margin: 8px 0; }
  .rule.thin { border-top: 1px solid #e5e7eb; margin: 4px 0; }
  .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 3px 2px; font-size: 11px; vertical-align: top; }
  thead th { border-bottom: 1px solid #9ca3af; font-size: 10px; text-transform: uppercase; color: #4b5563; }
  .l { text-align: left; }
  .r { text-align: right; white-space: nowrap; }
  .totals { font-size: 12px; }
  .trow { display: flex; justify-content: space-between; padding: 1px 0; }
  .trow.bold { font-weight: 700; font-size: 13px; }
  .trow.muted { color: #6b7280; font-size: 11px; }
  p { margin: 2px 0; }
</style>`;
