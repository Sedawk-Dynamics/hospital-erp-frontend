'use client';

import { QRCodeSVG } from 'qrcode.react';
import { formatDateTime } from '@/lib/date-utils';

// ============================================================
// G-5 (gap #266): the e-invoice block on a printed credit / debit note.
//
// A note against a B2B invoice, once registered on the IRP, carries its IRN,
// acknowledgement and the portal's signed QR — the same as the invoice it
// adjusts. A cancelled IRN, or one from the QA sandbox, must never pass for a
// live e-invoice on paper, so both say so.
//
// Uses only the `center` / `muted` / `xs` classes both receipt stylesheets
// define, plus inline styles, because the print window copies the markup
// into a bare document.
// ============================================================

export interface NoteIrnFields {
  irn?: string | null;
  irnAckNo?: string | null;
  irnAckDate?: string | null;
  irnQrPayload?: string | null;
  irnStatus?: string | null;
  irnCancelledAt?: string | null;
}

export function CreditNoteIrnBlock({ note }: { note: NoteIrnFields }) {
  if (!note.irn) return null;
  const cancelled = note.irnStatus === 'cancelled' || !!note.irnCancelledAt;
  const sandbox = !!note.irnQrPayload?.endsWith('.SANDBOX-NOT-SIGNED');
  return (
    <div className="center" style={{ margin: '6px 0' }}>
      {note.irnQrPayload && !cancelled ? (
        <div style={{ display: 'inline-block', margin: '4px 0' }}>
          <QRCodeSVG value={note.irnQrPayload} size={112} level="M" />
        </div>
      ) : null}
      <p className="xs" style={{ wordBreak: 'break-all', margin: '2px 0' }}>
        <span className="muted">IRN:</span> {note.irn}
      </p>
      {note.irnAckNo ? (
        <p className="xs" style={{ margin: '2px 0' }}>
          <span className="muted">Ack No:</span> {note.irnAckNo}
          {note.irnAckDate ? (
            <>
              {' '}
              <span className="muted">Ack Date:</span> {formatDateTime(note.irnAckDate)}
            </>
          ) : null}
        </p>
      ) : null}
      {cancelled ? (
        <p className="xs" style={{ fontWeight: 700, margin: '2px 0' }}>
          The IRN for this note was CANCELLED on the e-invoice portal
          {note.irnCancelledAt ? ` on ${formatDateTime(note.irnCancelledAt)}` : ''}: this is no longer a valid e-invoice.
        </p>
      ) : null}
      {sandbox ? (
        <p className="xs" style={{ fontWeight: 700, margin: '2px 0' }}>
          SANDBOX IRN — not registered with the government portal. For testing only.
        </p>
      ) : null}
    </div>
  );
}
