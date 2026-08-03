'use client';

import { forwardRef } from 'react';
import { resolveLogoUrl } from '@/hooks/use-branding';
import { useHospitalBranding } from '@/hooks/use-hospital-branding';
import type { AdmissionBillDocument } from '@/hooks/use-ip-billing';
import { cn } from '@/lib/utils';

// Print-ready bill for an IP / Emergency / Day Care stay. Rendered on screen and
// printed as-is — the @media print block isolates this node so the browser
// prints only the document, not the app chrome. The server PDF at
// /billing/admissions/:id/bill-document/pdf renders the same structure.

const fmtMoney = (n: number) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';
const dash = (v?: string | number | null) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

export const AdmissionBillDocumentView = forwardRef<HTMLDivElement, { doc: AdmissionBillDocument }>(
  function AdmissionBillDocumentView({ doc }, ref) {
    const { data: h } = useHospitalBranding();
    const accent = h?.accentColor && /^#[0-9a-fA-F]{6}$/.test(h.accentColor) ? h.accentColor : '#0f766e';
    const sh = h?.show;
    const logo = h?.showLogo && h.logoUrl ? resolveLogoUrl(h.logoUrl) : null;
    const leftLayout = h?.headerStyle === 'left';
    const addressLine = sh?.address
      ? [h?.addressLine1, h?.addressLine2, [h?.city, h?.state].filter(Boolean).join(', '), h?.pincode, h?.country]
          .filter(Boolean)
          .join(', ')
      : '';
    const contact = [
      sh?.phone ? h?.phone : null,
      sh?.phone ? h?.altPhone : null,
      sh?.email ? h?.email : null,
      sh?.website ? h?.website : null,
    ]
      .filter(Boolean)
      .join('  •  ');
    const reg = [
      sh?.registrationNo && h?.registrationNo ? `Reg. No: ${h.registrationNo}` : '',
      sh?.gstin && h?.gstin ? `GSTIN: ${h.gstin}` : '',
      sh?.accreditation ? h?.accreditation || '' : '',
    ]
      .filter(Boolean)
      .join('  •  ');

    const a = doc.admission;
    const p = doc.patient;
    const t = doc.totals;

    const info: Array<[string, string]> = [
      ['Patient Name', p.name],
      ['MRN / UHID', dash(p.mrn)],
      ['Age / Gender', `${dash(p.age)}${p.gender ? ' / ' + p.gender : ''}`],
      ['Phone', dash(p.phone)],
      ['IP No.', dash(a.ipNumber)],
      ['Care Type', doc.admissionTypeLabel],
      ['Admitted', fmtDateTime(a.admittedOn)],
      ['Discharged', a.dischargedOn ? fmtDateTime(a.dischargedOn) : 'Still admitted'],
      ['Length of Stay', `${a.lengthOfStayDays} day(s)`],
      ['Ward / Bed', `${dash(a.ward)} / ${dash(a.bed)}`],
      ['Consultant', dash(a.doctor)],
      ['Payment Mode', a.billingCategory.toUpperCase()],
    ];
    if (p.address) info.push(['Address', p.address]);
    if (doc.bills.length) info.push(['Bill No.', doc.bills.map((b) => b.billNumber).join(', ')]);

    return (
      <div
        id="ip-bill-print"
        ref={ref}
        style={{ ['--brand' as string]: accent }}
        className="mx-auto max-w-[820px] bg-white p-8 text-[#1a2332] shadow-sm ring-1 ring-black/5 print:max-w-none print:p-0 print:shadow-none print:ring-0"
      >
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #ip-bill-print, #ip-bill-print * { visibility: visible !important; }
            #ip-bill-print { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 13mm; }
          }
        `}</style>

        {/* Letterhead */}
        <header className={cn('flex gap-4', leftLayout ? 'items-center text-left' : 'flex-col items-center text-center')}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className={cn('object-contain', leftLayout ? 'h-16 w-16' : 'h-14')} />
          )}
          <div className={leftLayout ? 'min-w-0 flex-1' : ''}>
            <h1 className="text-[20px] font-bold tracking-tight text-[#132029]">{h?.name ?? 'Hospital'}</h1>
            {sh?.tagline && h?.tagline && (
              <p className="text-[11px] italic" style={{ color: accent }}>{h.tagline}</p>
            )}
            {addressLine && <p className="text-[11px] text-[#5b6472]">{addressLine}</p>}
            {contact && <p className="text-[11px] text-[#5b6472]">{contact}</p>}
            {reg && <p className="text-[10px] text-[#5b6472]">{reg}</p>}
          </div>
        </header>

        <div className="mt-3 flex items-center justify-center rounded py-1.5" style={{ backgroundColor: accent }}>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-white">
            {doc.admissionTypeLabel} · {doc.documentTitle}
          </h2>
        </div>
        {/* An undischarged stay is still accruing — never let an interim bill
            read as if it were the final one. */}
        {!doc.isDischarged && (
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-600">
            Patient still admitted — charges may still be added
          </p>
        )}

        {/* Patient / admission card */}
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border border-[#d3d8de] bg-[#f6f8fa] p-3">
          {info.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-wide text-[#6b7280]">{label}</span>
              <span className="block truncate text-[12px] font-medium text-[#1a2332]">{value}</span>
            </div>
          ))}
        </div>

        {/* Charges */}
        <section className="mt-4">
          <h3
            className="mb-1.5 flex items-center gap-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: accent }}
          >
            <span className="inline-block h-3 w-[3px] rounded" style={{ backgroundColor: accent }} />
            Bill of Charges
          </h3>

          {doc.groups.length === 0 ? (
            <p className="italic text-[12px] text-[#6b7280]">No charges recorded for this stay.</p>
          ) : (
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="text-white" style={{ backgroundColor: accent }}>
                  <th className="border px-2 py-1 text-left font-semibold" style={{ borderColor: accent }}>Particulars</th>
                  <th className="w-16 border px-2 py-1 text-right font-semibold" style={{ borderColor: accent }}>Qty</th>
                  <th className="w-24 border px-2 py-1 text-right font-semibold" style={{ borderColor: accent }}>Rate</th>
                  <th className="w-28 border px-2 py-1 text-right font-semibold" style={{ borderColor: accent }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.groups.map((g) => (
                  <>
                    <tr key={`${g.category}-head`} className="bg-[#eef2f5]">
                      <td colSpan={4} className="border border-[#d3d8de] px-2 py-1 font-semibold">{g.label}</td>
                    </tr>
                    {g.lines.map((l, i) => (
                      <tr key={`${g.category}-${i}`} className="bg-white break-inside-avoid">
                        <td className="border border-[#d3d8de] px-2 py-1 pl-4">
                          {l.description}
                          {/* Accrued but not yet posted to a bill — say so rather
                              than letting an interim bill look complete. */}
                          {l.status === 'pending' && (
                            <span className="ml-1 text-[10px] uppercase text-amber-600">unbilled</span>
                          )}
                        </td>
                        <td className="border border-[#d3d8de] px-2 py-1 text-right">{l.quantity}</td>
                        <td className="border border-[#d3d8de] px-2 py-1 text-right">{fmtMoney(l.unitPrice)}</td>
                        <td className="border border-[#d3d8de] px-2 py-1 text-right">{fmtMoney(l.totalAmount)}</td>
                      </tr>
                    ))}
                    <tr key={`${g.category}-total`} className="bg-white">
                      <td colSpan={3} className="border border-[#d3d8de] px-2 py-1 text-right font-semibold">
                        {g.label} total
                      </td>
                      <td className="border border-[#d3d8de] px-2 py-1 text-right font-semibold">
                        {fmtMoney(g.total)}
                      </td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Summary */}
        <section className="mt-4 flex justify-end break-inside-avoid">
          <table className="w-[330px] text-[12px]">
            <tbody>
              <SumRow label="Gross charges" value={fmtMoney(t.grossCharges)} />
              {t.discount > 0 && <SumRow label="Discount" value={`− ${fmtMoney(t.discount)}`} />}
              {/* Tax is already inside the line amounts — informational, not added. */}
              {t.tax > 0 && <SumRow label="(of which tax)" value={fmtMoney(t.tax)} />}
              {t.insuranceCovered > 0 && (
                <SumRow label="Covered by insurer / TPA" value={`− ${fmtMoney(t.insuranceCovered)}`} />
              )}
              <SumRow label="Net payable" value={fmtMoney(t.netPayable)} bold border />
              {t.deposit > 0 && <SumRow label="Deposit received" value={`− ${fmtMoney(t.deposit)}`} />}
              {t.cashPaid > 0 && <SumRow label="Paid at counter" value={`− ${fmtMoney(t.cashPaid)}`} />}
              {t.depositRefunded > 0 && <SumRow label="Deposit refunded" value={fmtMoney(t.depositRefunded)} />}
              <SumRow
                label="Balance due"
                value={fmtMoney(t.balanceDue)}
                bold
                border
                tone={t.balanceDue > 0 ? 'due' : 'paid'}
              />
              {t.balanceDue <= 0 && t.refundable > 0 && (
                <SumRow label="Refundable to patient" value={fmtMoney(t.refundable)} tone="paid" />
              )}
            </tbody>
          </table>
        </section>

        {doc.isPaid && (
          <div className="mt-2 flex justify-end">
            <span className="rounded border-2 border-emerald-600 px-4 py-1 text-[13px] font-bold uppercase tracking-widest text-emerald-700">
              Paid in full
            </span>
          </div>
        )}

        {/* Payments */}
        {doc.payments.length > 0 && (
          <section className="mt-5 break-inside-avoid">
            <h3
              className="mb-1.5 flex items-center gap-2 border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: accent }}
            >
              <span className="inline-block h-3 w-[3px] rounded" style={{ backgroundColor: accent }} />
              Payments Received
            </h3>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-[#eef2f5]">
                  <th className="border border-[#d3d8de] px-2 py-1 text-left font-semibold">Date</th>
                  <th className="border border-[#d3d8de] px-2 py-1 text-left font-semibold">Mode</th>
                  <th className="border border-[#d3d8de] px-2 py-1 text-left font-semibold">Receipt / Ref</th>
                  <th className="border border-[#d3d8de] px-2 py-1 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.payments.map((pay, i) => (
                  <tr key={i} className="bg-white">
                    <td className="border border-[#d3d8de] px-2 py-1">{fmtDateTime(pay.date)}</td>
                    <td className="border border-[#d3d8de] px-2 py-1 uppercase">{pay.method.replace(/_/g, ' ')}</td>
                    <td className="border border-[#d3d8de] px-2 py-1">{dash(pay.receiptNumber ?? pay.reference)}</td>
                    <td className="border border-[#d3d8de] px-2 py-1 text-right">{fmtMoney(pay.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-8 flex items-end justify-between border-t border-slate-200 pt-3 text-[10px] text-[#6b7280]">
          <div>
            <p>{h?.footerText || 'This is a computer-generated bill.'}</p>
            <p>Generated {fmtDateTime(doc.generatedAt)}</p>
          </div>
          <div className="text-center">
            <div className="mb-1 h-8 w-40 border-b border-slate-400" />
            <p>Authorised Signatory</p>
          </div>
        </footer>
      </div>
    );
  },
);

function SumRow({
  label,
  value,
  bold,
  border,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  border?: boolean;
  tone?: 'due' | 'paid';
}) {
  return (
    <tr className={cn(border && 'border-t border-[#d3d8de]')}>
      <td className={cn('py-1 pr-3 text-right', bold && 'font-bold')}>{label}</td>
      <td
        className={cn(
          'w-28 py-1 text-right tabular-nums',
          bold && 'font-bold',
          tone === 'due' && 'text-red-700',
          tone === 'paid' && 'text-emerald-700',
        )}
      >
        {value}
      </td>
    </tr>
  );
}
