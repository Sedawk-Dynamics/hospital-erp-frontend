'use client';

import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/date-utils';
import type { PharmacySale } from '@/hooks/use-pharmacy';

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

export function PharmacyReceiptDialog({
  sale,
  open,
  onOpenChange,
}: {
  sale: PharmacySale | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=420,height=800');
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>${sale?.bill.billNumber ?? 'Invoice'}</title>${printStyles}</head><body>${html}</body></html>`,
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
          <p className="text-sm font-medium">Invoice {bill?.billNumber}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} disabled={!bill}>
              <Printer className="size-3.5" /> Print / Save PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {bill && (
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
                  {gst?.supplierGstin && (
                    <p className="muted xs">
                      GSTIN: {gst.supplierGstin}
                      {gst.supplierStateName ? ` · ${gst.supplierStateName}` : ''}
                    </p>
                  )}
                </div>

                <div className="rule" />

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

                <div className="rule" />
                <p className="center muted xs">
                  Qty is in individual units (tablets / caps / ml), not packs.
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
