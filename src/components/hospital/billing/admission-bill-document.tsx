'use client';

import { Fragment, forwardRef } from 'react';
import { resolveLogoUrl } from '@/hooks/use-branding';
import type { AdmissionBillDocument } from '@/hooks/use-ip-billing';
import {
  buildHtmlTheme,
  lineHeightFor,
  DEFAULT_PDF_TEMPLATE,
  type PdfHtmlTheme,
} from '@/lib/pdf-theme';

// ============================================================
// The printed bill for an IP / Emergency / Day Care stay.
//
// Rendered from the `ip_bill` template in the PDF Builder — the same resolved
// template the server hands to PDFKit — so this view and
// /billing/admissions/:id/bill-document/pdf are two renderings of ONE
// definition. Change the page size, font, accent, table density, watermark or
// signature block in the builder and both move together.
//
// Sizes are in `pt`, not `px`. PDFKit works in points; 1pt is 1/72in in CSS
// too, so a 9pt line here is physically the same as a 9pt line in the PDF.
// Rendering in px would have made this ~1.33x larger than the document it is
// supposed to match.
//
// What is deliberately NOT mirrored: `footer.showPageNumbers`. Counting pages
// needs CSS Paged Media margin boxes, which browsers do not implement — the
// PDF, which can count, still honours the setting.
// ============================================================

const fmtMoney = (n: number) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';
const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const dash = (v?: string | number | null) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

const pt = (n: number) => `${n}pt`;

export const AdmissionBillDocumentView = forwardRef<HTMLDivElement, { doc: AdmissionBillDocument }>(
  function AdmissionBillDocumentView({ doc }, ref) {
    // Branding rides on the document — GET /hospital-branding is admin-only, so
    // fetching it here blanked the letterhead for doctors, nurses and front desk.
    const h = doc.hospital;
    // Same for the template. A document served without one still prints, at the
    // product defaults, rather than throwing.
    const tpl = doc.template ?? DEFAULT_PDF_TEMPLATE;
    const theme = buildHtmlTheme(tpl, h);
    const { accent, ink, muted, soft, softBorder, hairline } = theme;

    const sh = h?.show;
    const logo = h?.showLogo && h.logoUrl ? resolveLogoUrl(h.logoUrl) : null;
    // 'inherit' means "whatever the letterhead is set to" — the template can
    // override the layout for this document type alone.
    const headerStyle = tpl.header.headerStyle === 'inherit' ? h?.headerStyle : tpl.header.headerStyle;
    const leftLayout = headerStyle === 'left';

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

    const title = tpl.header.titleOverride ?? `${doc.admissionTypeLabel} · ${doc.documentTitle}`;
    const subtitle = doc.bills.length ? doc.bills.map((b) => b.billNumber).join(', ') : '';
    // The same two meta items the PDF puts in the strip.
    const meta = [
      { label: 'IP No', value: dash(a.ipNumber) },
      { label: 'Date', value: fmtDate(doc.generatedAt) },
    ];

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

    const footerText =
      tpl.footer.footerTextOverride || h?.footerText || 'This is a computer-generated bill.';
    const before = tpl.blocks.filter((b) => b.position === 'before_body');
    const after = tpl.blocks.filter((b) => b.position === 'after_body');
    const wm = tpl.watermark;

    return (
      <div
        id="ip-bill-print"
        ref={ref}
        // `print-document` is the marker the print rules in globals.css look
        // for: it tells them which dialog holds the thing being printed, so a
        // dialog stacked underneath (Generate Bill → Print Bill) is left off
        // the page instead of padding it out with blank sheets.
        className="print-document relative mx-auto bg-white shadow-sm ring-1 ring-black/5 print:shadow-none print:ring-0"
        style={{
          // The page the template asks for, at its own margin, so what is on
          // screen is already laid out to the paper it will print on.
          width: pt(theme.page.width),
          maxWidth: '100%',
          padding: pt(theme.margin),
          fontFamily: theme.fontFamily,
          fontSize: pt(theme.size.body),
          lineHeight: lineHeightFor(theme),
          color: ink,
        }}
      >
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #ip-bill-print, #ip-bill-print * { visibility: visible !important; }
            /* The page box already carries the template's margin, so the
               document must not add it a second time. */
            #ip-bill-print { width: 100% !important; max-width: none !important; padding: 0 !important; }
            .no-print { display: none !important; }
            /* The PDF stamps the watermark on EVERY page. An absolutely
               positioned one would print once, in the middle of the whole
               document. Chrome repeats a fixed element on each sheet, which is
               the closest HTML gets — and it works here only because the print
               rules have already taken the transform off the dialog popup (a
               transformed ancestor would capture the fixed positioning). */
            #ip-bill-watermark { position: fixed !important; inset: 0 !important; }
            @page { size: ${tpl.page.size} ${tpl.page.orientation}; margin: ${theme.margin}pt; }
          }
        `}</style>

        {/* Watermark — diagonal, behind the content, opacity capped server-side
            so an amount underneath stays readable. */}
        {wm.enabled && wm.text.trim() && (
          <div
            id="ip-bill-watermark"
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ display: 'grid', placeItems: 'center', zIndex: 0 }}
          >
            <span
              style={{
                transform: `rotate(${wm.angle}deg)`,
                color: wm.color ?? accent,
                opacity: wm.opacity,
                fontSize: pt(wm.fontSize),
                fontWeight: 700,
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
              }}
            >
              {wm.text}
            </span>
          </div>
        )}

        <div className="relative" style={{ zIndex: 1 }}>
          {/* Letterhead. A document printed on pre-printed stationery already
              carries it, so the template can turn it off and leave the title. */}
          {tpl.header.showLetterhead && (
            <>
              {/* Slim accent rule across the very top — the letterhead cue. */}
              <div style={{ height: pt(3), backgroundColor: accent, marginBottom: pt(8) }} />
              <header
                style={{
                  display: 'flex',
                  gap: pt(10),
                  alignItems: leftLayout ? 'center' : 'stretch',
                  flexDirection: leftLayout ? 'row' : 'column',
                  textAlign: leftLayout ? 'left' : 'center',
                }}
              >
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt=""
                    style={{
                      objectFit: 'contain',
                      height: pt(leftLayout ? 66 : 58),
                      width: leftLayout ? pt(66) : 'auto',
                      alignSelf: leftLayout ? 'flex-start' : 'center',
                    }}
                  />
                )}
                <div style={{ minWidth: 0, flex: leftLayout ? 1 : undefined }}>
                  <h1 style={{ fontSize: pt(leftLayout ? 18 : 19), fontWeight: 700, color: ink, lineHeight: 1.15 }}>
                    {h?.name ?? 'Hospital'}
                  </h1>
                  {sh?.tagline && h?.tagline && (
                    <p style={{ fontSize: pt(9), fontStyle: 'italic', color: accent }}>{h.tagline}</p>
                  )}
                  {addressLine && <p style={{ fontSize: pt(8.5), color: muted }}>{addressLine}</p>}
                  {contact && <p style={{ fontSize: pt(8.5), color: muted }}>{contact}</p>}
                  {reg && <p style={{ fontSize: pt(8.5), color: muted }}>{reg}</p>}
                </div>
              </header>
              {/* Hairline divider under the letterhead. */}
              <div style={{ borderTop: `0.6pt solid ${hairline}`, marginTop: pt(6), marginBottom: pt(6) }} />
            </>
          )}

          {/* Accent title bar. */}
          {tpl.header.showTitleBar && (
            <div
              style={{
                backgroundColor: accent,
                borderRadius: pt(3),
                height: pt(22),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <h2
                style={{
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: pt(11.5),
                  textTransform: 'uppercase',
                  letterSpacing: pt(0.8),
                }}
              >
                {title}
              </h2>
            </div>
          )}

          {/* Meta strip — bill number on the left, IP No / date on the right. */}
          {tpl.header.showMetaStrip && (subtitle || meta.length > 0) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: pt(8),
                height: pt(16),
                padding: `0 ${pt(8)}`,
                backgroundColor: soft,
                border: `0.4pt solid ${softBorder}`,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: pt(8), color: ink }}>{subtitle}</span>
              <span style={{ fontSize: pt(8), color: muted }}>
                {meta.map((m) => `${m.label}: ${m.value}`).join('    •    ')}
              </span>
            </div>
          )}

          {/* An undischarged stay is still accruing — never let an interim bill
              read as if it were the final one. */}
          {!doc.isDischarged && (
            <p
              style={{
                marginTop: pt(4),
                textAlign: 'center',
                fontSize: pt(theme.size.tiny),
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: pt(0.4),
                color: '#b45309',
              }}
            >
              Patient still admitted — charges may still be added
            </p>
          )}

          {before.map((b) => (
            <CustomBlock key={b.id} theme={theme} heading={b.heading} text={b.text} />
          ))}

          {/* Patient / admission card. */}
          <div
            style={{
              marginTop: pt(10),
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              backgroundColor: soft,
              border: `0.5pt solid ${softBorder}`,
            }}
          >
            {info.map(([label, value]) => (
              <div key={label} style={{ minWidth: 0, padding: `${pt(4)} ${pt(8)}` }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: pt(theme.size.tiny),
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: muted,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: pt(theme.size.body),
                    color: ink,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Charges. */}
          <section style={{ marginTop: pt(12) }}>
            <SectionHeading theme={theme}>Bill of Charges</SectionHeading>

            {doc.groups.length === 0 ? (
              <p style={{ fontStyle: 'italic', fontSize: pt(theme.size.small), color: muted }}>
                No charges recorded for this stay.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: pt(theme.size.small) }}>
                <thead>
                  <tr>
                    {(
                      [
                        ['Particulars', 'left', undefined],
                        ['Qty', 'right', '10%'],
                        ['Rate', 'right', '16%'],
                        ['Amount', 'right', '18%'],
                      ] as const
                    ).map(([label, align, width]) => (
                      <th
                        key={label}
                        style={{
                          ...headerCellStyle(theme),
                          textAlign: align,
                          width,
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.groups.map((g) => (
                    // A keyed Fragment, not `<>`: the shorthand cannot take a key,
                    // so React saw an unkeyed list of group blocks here.
                    <Fragment key={g.category}>
                      <tr style={{ backgroundColor: soft }}>
                        <td colSpan={4} style={{ ...bodyCellStyle(theme), fontWeight: 700 }}>
                          {g.label}
                        </td>
                      </tr>
                      {g.lines.map((l, i) => (
                        <tr
                          key={`${g.category}-${i}`}
                          className="break-inside-avoid"
                          // Zebra striping is a template setting, so the whole
                          // app restyles from one place.
                          style={{
                            backgroundColor:
                              tpl.table.zebraRows && i % 2 === 1 ? soft : 'transparent',
                          }}
                        >
                          <td style={{ ...bodyCellStyle(theme), paddingLeft: pt(12) }}>
                            {l.description}
                            {/* Accrued but not yet posted to a bill — say so rather
                                than letting an interim bill look complete. */}
                            {l.status === 'pending' && (
                              <span
                                style={{
                                  marginLeft: pt(3),
                                  fontSize: pt(theme.size.tiny),
                                  textTransform: 'uppercase',
                                  color: '#b45309',
                                }}
                              >
                                unbilled
                              </span>
                            )}
                          </td>
                          <td style={{ ...bodyCellStyle(theme), textAlign: 'right' }}>{l.quantity}</td>
                          <td style={{ ...bodyCellStyle(theme), textAlign: 'right' }}>{fmtMoney(l.unitPrice)}</td>
                          <td style={{ ...bodyCellStyle(theme), textAlign: 'right' }}>{fmtMoney(l.totalAmount)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} style={{ ...bodyCellStyle(theme), textAlign: 'right', fontWeight: 700 }}>
                          {g.label} total
                        </td>
                        <td style={{ ...bodyCellStyle(theme), textAlign: 'right', fontWeight: 700 }}>
                          {fmtMoney(g.total)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Summary. */}
          <section
            className="break-inside-avoid"
            style={{ marginTop: pt(12), display: 'flex', justifyContent: 'flex-end' }}
          >
            <table style={{ width: pt(240), fontSize: pt(theme.size.body) }}>
              <tbody>
                <SumRow theme={theme} label="Gross charges" value={fmtMoney(t.grossCharges)} />
                {t.discount > 0 && <SumRow theme={theme} label="Discount" value={`− ${fmtMoney(t.discount)}`} />}
                {/* Tax is already inside the line amounts — informational, not added. */}
                {t.tax > 0 && <SumRow theme={theme} label="(of which tax)" value={fmtMoney(t.tax)} />}
                {t.insuranceCovered > 0 && (
                  <SumRow theme={theme} label="Covered by insurer / TPA" value={`− ${fmtMoney(t.insuranceCovered)}`} />
                )}
                <SumRow theme={theme} label="Net payable" value={fmtMoney(t.netPayable)} bold border />
                {t.deposit > 0 && <SumRow theme={theme} label="Deposit received" value={`− ${fmtMoney(t.deposit)}`} />}
                {t.cashPaid > 0 && <SumRow theme={theme} label="Paid at counter" value={`− ${fmtMoney(t.cashPaid)}`} />}
                {t.depositRefunded > 0 && (
                  <SumRow theme={theme} label="Deposit refunded" value={fmtMoney(t.depositRefunded)} />
                )}
                <SumRow
                  theme={theme}
                  label="Balance due"
                  value={fmtMoney(t.balanceDue)}
                  bold
                  border
                  tone={t.balanceDue > 0 ? 'due' : 'paid'}
                />
                {t.balanceDue <= 0 && t.refundable > 0 && (
                  <SumRow theme={theme} label="Refundable to patient" value={fmtMoney(t.refundable)} tone="paid" />
                )}
              </tbody>
            </table>
          </section>

          {doc.isPaid && (
            <div style={{ marginTop: pt(6), display: 'flex', justifyContent: 'flex-end' }}>
              <span
                style={{
                  border: `1.5pt solid #047857`,
                  borderRadius: pt(2),
                  padding: `${pt(3)} ${pt(10)}`,
                  fontSize: pt(theme.size.heading),
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: pt(1),
                  color: '#047857',
                }}
              >
                Paid in full
              </span>
            </div>
          )}

          {/* Payments. */}
          {doc.payments.length > 0 && (
            <section className="break-inside-avoid" style={{ marginTop: pt(14) }}>
              <SectionHeading theme={theme}>Payments Received</SectionHeading>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: pt(theme.size.small) }}>
                <thead>
                  <tr>
                    {(['Date', 'Mode', 'Receipt / Ref', 'Amount'] as const).map((label, i) => (
                      <th
                        key={label}
                        style={{ ...headerCellStyle(theme), textAlign: i === 3 ? 'right' : 'left' }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.payments.map((pay, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: tpl.table.zebraRows && i % 2 === 1 ? soft : 'transparent',
                      }}
                    >
                      <td style={bodyCellStyle(theme)}>{fmtDateTime(pay.date)}</td>
                      <td style={{ ...bodyCellStyle(theme), textTransform: 'uppercase' }}>
                        {pay.method.replace(/_/g, ' ')}
                      </td>
                      <td style={bodyCellStyle(theme)}>{dash(pay.receiptNumber ?? pay.reference)}</td>
                      <td style={{ ...bodyCellStyle(theme), textAlign: 'right' }}>{fmtMoney(pay.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {after.map((b) => (
            <CustomBlock key={b.id} theme={theme} heading={b.heading} text={b.text} />
          ))}

          {/* Signature block — off by default; a hospital that wants the bill
              counter-signed turns it on and names the lines. */}
          {tpl.signature.enabled && tpl.signature.labels.length > 0 && (
            <div
              className="break-inside-avoid"
              style={{
                marginTop: pt(16),
                display: 'grid',
                gridTemplateColumns: `repeat(${tpl.signature.labels.length}, 1fr)`,
                minHeight: pt(tpl.signature.height),
                alignItems: 'end',
              }}
            >
              {tpl.signature.labels.map((label, i) => (
                <div key={`${label}-${i}`} style={{ padding: `0 ${pt(8)}`, textAlign: 'center' }}>
                  {/* The space above the rule is left blank — that is where the pen goes. */}
                  <div style={{ borderTop: `0.7pt solid ${hairline}`, marginBottom: pt(4) }} />
                  <span style={{ fontSize: pt(theme.size.tiny), color: muted }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {tpl.footer.showFooter && (
            <footer style={{ marginTop: pt(18) }}>
              {/* Thin accent rule above the footer. */}
              <div style={{ borderTop: `0.6pt solid ${tintForFooter(accent)}`, marginBottom: pt(4) }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: pt(10),
                  fontSize: pt(7),
                  color: muted,
                }}
              >
                <span>
                  {h?.name ?? 'Hospital'}
                  {tpl.footer.showGeneratedAt ? `  ·  Generated ${fmtDateTime(doc.generatedAt)}` : ''}
                </span>
              </div>
              {(sh?.footer ?? true) && (
                <p style={{ marginTop: pt(3), textAlign: 'center', fontSize: pt(6.8), color: muted }}>
                  {footerText}
                </p>
              )}
            </footer>
          )}
        </div>
      </div>
    );
  },
);

/** Matches `tintHex(accent, 0.55)` used for the PDF's footer rule. */
function tintForFooter(accent: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(accent);
  if (!m) return accent;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.55);
  const to2 = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to2(mix((n >> 16) & 255))}${to2(mix((n >> 8) & 255))}${to2(mix(n & 255))}`;
}

/** The left-accent-ruled section heading the PDF draws. */
function SectionHeading({ theme, children }: { theme: PdfHtmlTheme; children: React.ReactNode }) {
  return (
    <h3
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: pt(6),
        marginBottom: pt(4),
        fontSize: pt(theme.size.heading),
        fontWeight: 700,
        textTransform: 'uppercase',
        color: theme.ink,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: pt(3),
          alignSelf: 'stretch',
          minHeight: pt(theme.size.heading + 2),
          backgroundColor: theme.accent,
        }}
      />
      {children}
    </h3>
  );
}

/** Header cell styled by the template's `headerFill` and `gridLines`. */
function headerCellStyle(theme: PdfHtmlTheme): React.CSSProperties {
  const t = theme.template.table;
  const fill = t.headerFill === 'accent' ? theme.accent : t.headerFill === 'muted' ? theme.soft : 'transparent';
  return {
    backgroundColor: fill,
    color: t.headerFill === 'accent' ? '#ffffff' : theme.ink,
    fontWeight: 700,
    fontSize: pt(theme.size.tiny),
    textTransform: 'uppercase',
    padding: `0 ${pt(4)}`,
    height: pt(theme.rowHeight),
    ...gridBorders(theme),
  };
}

function bodyCellStyle(theme: PdfHtmlTheme): React.CSSProperties {
  return {
    padding: `0 ${pt(4)}`,
    height: pt(theme.rowHeight),
    ...gridBorders(theme),
  };
}

/** `gridLines`: none / horizontal rules only / a full grid. */
function gridBorders(theme: PdfHtmlTheme): React.CSSProperties {
  const g = theme.template.table.gridLines;
  if (g === 'none') return {};
  if (g === 'all') return { border: `0.4pt solid ${theme.hairline}` };
  return { borderBottom: `0.4pt solid ${theme.hairline}` };
}

function CustomBlock({
  theme,
  heading,
  text,
}: {
  theme: PdfHtmlTheme;
  heading: string | null;
  text: string;
}) {
  if (!heading && !text) return null;
  return (
    <section className="break-inside-avoid" style={{ marginTop: pt(12) }}>
      {heading && <SectionHeading theme={theme}>{heading}</SectionHeading>}
      {text && (
        <p style={{ fontSize: pt(theme.size.small), color: theme.ink, whiteSpace: 'pre-wrap' }}>{text}</p>
      )}
    </section>
  );
}

function SumRow({
  theme,
  label,
  value,
  bold,
  border,
  tone,
}: {
  theme: PdfHtmlTheme;
  label: string;
  value: string;
  bold?: boolean;
  border?: boolean;
  tone?: 'due' | 'paid';
}) {
  return (
    <tr style={border ? { borderTop: `0.5pt solid ${theme.hairline}` } : undefined}>
      <td
        style={{
          padding: `${pt(2)} ${pt(6)} ${pt(2)} 0`,
          textAlign: 'right',
          fontWeight: bold ? 700 : undefined,
        }}
      >
        {label}
      </td>
      <td
        style={{
          width: pt(90),
          padding: `${pt(2)} 0`,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: bold ? 700 : undefined,
          color: tone === 'due' ? '#b91c1c' : tone === 'paid' ? '#047857' : undefined,
        }}
      >
        {value}
      </td>
    </tr>
  );
}
