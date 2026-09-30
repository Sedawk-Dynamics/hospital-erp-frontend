'use client';

import { ReceiptText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { InsuranceClaim } from '@/hooks/use-insurance';

type ClaimBill = NonNullable<InsuranceClaim['bill']>;

function inr(value: number | string | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function labelize(value: string | null | undefined) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ClaimBillCard({ bill }: { bill: ClaimBill }) {
  const items = bill.billItems ?? [];
  const payments = bill.payments ?? [];
  const hasGstDetail =
    Number(bill.taxAmount ?? 0) !== 0 ||
    !!bill.invoiceNumber ||
    !!bill.billOfSupplyNumber;

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-primary" /> Complete Hospital Bill
            </CardTitle>
            <CardDescription>
              {bill.billNumber}
              {bill.billDate ? ` · ${formatDate(bill.billDate)}` : ''}
              {' · '}All hospital charges, payer classification, tax and payment totals
            </CardDescription>
          </div>
          {bill.status && <Badge variant="outline">{labelize(bill.status)}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Service / Item</th>
                <th className="px-3 py-2 text-left">TPA Classification</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-on-surface-variant">
                    No bill lines have been posted yet.
                  </td>
                </tr>
              ) : items.map((item, index) => {
                const patientOnly = item.isReimbursable === false;
                return (
                  <tr key={item.id} className="align-top">
                    <td className="px-3 py-3 text-on-surface-variant">{index + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{item.description}</div>
                      <div className="mt-0.5 text-xs text-on-surface-variant">
                        {labelize(item.category)}
                        {item.hsnSacCode ? ` · HSN/SAC ${item.hsnSacCode}` : ''}
                        {item.gstTreatment ? ` · ${labelize(item.gstTreatment)}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className={patientOnly
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-800'}
                      >
                        {patientOnly ? 'Patient payable' : 'TPA eligible'}
                      </Badge>
                      {item.tpaCategory && (
                        <div className="mt-1 text-xs text-on-surface-variant">{labelize(item.tpaCategory)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{inr(item.unitPrice)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {Number(item.discountAmount) > 0 ? inr(item.discountAmount) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {Number(item.taxAmount) > 0
                        ? <><div>{inr(item.taxAmount)}</div><div className="text-xs text-on-surface-variant">{Number(item.taxPercent)}%</div></>
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{inr(item.totalAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <BillStat label="TPA / insurance share" value={inr(bill.insuranceCoveredAmount)} tone="text-emerald-700" />
              <BillStat label="Patient payable" value={inr(bill.patientPayableAmount)} tone="text-amber-700" />
              <BillStat label="Amount received" value={inr(bill.amountPaid)} tone="text-teal-700" />
              <BillStat label="Balance due" value={inr(bill.balanceDue)} tone="text-rose-700" />
            </div>

            {hasGstDetail && (
              <div className="rounded-lg border bg-surface-container-low/40 p-3 text-xs">
                <div className="mb-2 font-semibold text-on-surface">Tax document</div>
                <div className="grid gap-1 sm:grid-cols-2">
                  <DetailRow label="Document type" value={labelize(bill.gstDocumentType)} />
                  <DetailRow label="Invoice #" value={bill.invoiceNumber ?? '—'} />
                  <DetailRow label="Bill of supply #" value={bill.billOfSupplyNumber ?? '—'} />
                  <DetailRow label="Taxable value" value={inr(bill.taxableValue)} />
                  <DetailRow label="CGST" value={inr(bill.cgstAmount)} />
                  <DetailRow label="SGST" value={inr(bill.sgstAmount)} />
                  <DetailRow label="IGST" value={inr(bill.igstAmount)} />
                  <DetailRow label="Cess" value={inr(bill.cessAmount)} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-3 text-sm">
            <div className="mb-2 font-semibold">Bill totals</div>
            <DetailRow label="Subtotal" value={inr(bill.subtotal)} />
            <DetailRow label="Discount" value={Number(bill.discountAmount ?? 0) > 0 ? `− ${inr(bill.discountAmount)}` : inr(0)} tone="text-emerald-700" />
            <DetailRow label="Tax" value={inr(bill.taxAmount)} />
            {Number(bill.roundOff ?? 0) !== 0 && <DetailRow label="Round off" value={inr(bill.roundOff)} />}
            <div className="my-2 border-t" />
            <DetailRow label="Bill total" value={inr(bill.totalAmount)} tone="text-base font-bold" />
          </div>
        </div>

        {payments.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-semibold">Payments recorded against this bill</div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-3 py-2">{formatDateTime(payment.paymentDate)}</td>
                      <td className="px-3 py-2">{labelize(payment.paymentMethod)}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{payment.transactionId ?? payment.notes ?? '—'}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{labelize(payment.status)}</Badge></td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-on-surface-variant">
          This is the complete hospital bill. The claim amount can be lower when patient-payable or non-reimbursable lines are excluded.
        </p>
      </CardContent>
    </Card>
  );
}

function BillStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-surface-container-low/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">{label}</div>
      <div className={cn('mt-1 font-bold tabular-nums', tone)}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-on-surface-variant">{label}</span>
      <span className={cn('text-right font-medium', tone)}>{value ?? '—'}</span>
    </div>
  );
}
