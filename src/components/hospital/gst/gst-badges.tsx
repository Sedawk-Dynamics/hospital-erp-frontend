'use client';

import { GST_DOCUMENT_LABELS, GST_TREATMENT_LABELS } from '@/types';

// ============================================================
// The small GST bits that belong on every billing screen.
//
// Kept in one place because they are read by staff who are not accountants:
// "Bill of Supply" has to mean the same thing on the worklist, on the bill and
// on the printed document, and three components each writing their own label is
// how one of them ends up saying something the law does not recognise.
// ============================================================

/**
 * What the bill IS, and the number it was issued under.
 *
 * A draft shows nothing at all rather than "—". It has not been issued; there
 * is no document yet to name, and an empty dash invites the reader to wonder
 * what went wrong.
 */
export function DocumentBadge({
  documentType,
  invoiceNumber,
  className = '',
}: {
  documentType?: string | null;
  invoiceNumber?: string | null;
  className?: string;
}) {
  if (!documentType && !invoiceNumber) return null;
  const label = documentType ? (GST_DOCUMENT_LABELS[documentType] ?? documentType) : 'Issued';
  // A tax invoice carries tax; the other two do not, and the colour says which
  // at a glance without anybody reading the words.
  const tone =
    documentType === 'tax_invoice'
      ? 'border-primary/30 bg-primary/10 text-primary'
      : documentType === 'invoice_cum_bill_of_supply'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-border bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`}>
      <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
        {label}
      </span>
      {invoiceNumber ? (
        <span className="font-mono text-[11px] text-muted-foreground">{invoiceNumber}</span>
      ) : null}
    </span>
  );
}

/**
 * How a line is treated, and at what rate.
 *
 * A line with NO treatment reads "Unclassified" in red rather than falling back
 * to exempt. Nothing established a position for it, and showing 0% would be the
 * screen inventing one — which is exactly what the unmapped-items report exists
 * to catch.
 */
export function TreatmentBadge({
  treatment,
  ratePercent,
  requiresResolution,
  reason,
}: {
  treatment?: string | null;
  ratePercent?: number;
  requiresResolution?: boolean;
  /** The engine's own words for why. Shown on hover in place of a guess. */
  reason?: string | null;
}) {
  if (!treatment) {
    return (
      <span className="inline-flex items-center rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
        Unclassified
      </span>
    );
  }
  const label = GST_TREATMENT_LABELS[treatment] ?? treatment;
  const taxable = treatment === 'taxable';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${
        requiresResolution
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : taxable
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-muted text-muted-foreground'
      }`}
      // The engine's own reason, whenever it gave one. Two different things
      // reach `requiresResolution` — a rate somebody typed on an unapproved
      // item, and a line nothing classified at all — and a badge that named
      // only the first was telling the desk the wrong story about the second.
      title={reason ?? (requiresResolution ? 'Nothing has established a tax position for this line' : undefined)}
    >
      {label}
      {taxable && ratePercent != null ? ` ${ratePercent}%` : ''}
      {requiresResolution ? ' ⚠' : ''}
    </span>
  );
}
