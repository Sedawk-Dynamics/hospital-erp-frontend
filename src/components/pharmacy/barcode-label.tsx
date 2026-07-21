'use client';

import { useMemo } from 'react';
import { toSVG } from 'bwip-js/browser';

// A printable shelf label for one stock batch.
//
// Two symbols, which is what pharmacy label software does:
//  • Code-128 — the short internal key. Reads on any scanner, including the
//    cheap 1D lasers still on most counters.
//  • DataMatrix — carries product + batch + expiry so the label self-describes
//    without a lookup. GS1 DataMatrix (used whenever the drug has a real GTIN)
//    is the healthcare standard: tiny footprint, Reed-Solomon error correction.
//
// Storage location is printed as TEXT and deliberately not encoded — it is the
// one field that changes when stock moves, so an encoded copy would start lying
// the moment a batch is re-racked. It is re-read from the record on every scan.
//
// Rendered as SVG so it stays sharp at any printer DPI; thermal label printers
// and A4 laser both come out clean.

export interface BatchLabel {
  batchId: string;
  drugName: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  batchNumber: string;
  expiryDate: string;
  mrp?: number | null;
  sellingPrice?: number | null;
  storageLocation?: string | null;
  code128: string;
  dataMatrix: string;
  dataMatrixFormat: 'gs1datamatrix' | 'datamatrix';
}

type RenderOptions = Parameters<typeof toSVG>[0];

function svg(opts: RenderOptions): string | null {
  try {
    return toSVG(opts);
  } catch {
    // A symbol that can't encode (bad characters, over-long payload) must not
    // take the whole print sheet down with it — the rest of the label is still
    // useful, and a missing symbol is visible to whoever is printing.
    return null;
  }
}

/** Expiry is printed MM/YYYY — the convention on medicine packs. */
function expLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export function BarcodeLabel({ label }: { label: BatchLabel }) {
  const code128Svg = useMemo(
    () =>
      svg({
        bcid: 'code128',
        text: label.code128,
        scale: 2,
        height: 9,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      }),
    [label.code128],
  );

  const dmSvg = useMemo(
    () =>
      svg({
        bcid: label.dataMatrixFormat,
        text: label.dataMatrix,
        scale: 2,
        parsefnc: label.dataMatrixFormat === 'gs1datamatrix',
        paddingwidth: 0,
        paddingheight: 0,
      }),
    [label.dataMatrix, label.dataMatrixFormat],
  );

  const title = [label.drugName, label.strength].filter(Boolean).join(' ');
  const sub = [label.genericName, label.dosageForm].filter(Boolean).join(' · ');
  const price = label.mrp ?? label.sellingPrice;

  return (
    <div className="barcode-label flex h-[25mm] w-[50mm] flex-col justify-between overflow-hidden border border-black/15 bg-white p-[1.5mm] text-black">
      <div className="min-w-0">
        <div className="truncate text-[7pt] font-bold leading-tight">{title}</div>
        {sub && <div className="truncate text-[5pt] leading-tight text-black/60">{sub}</div>}
      </div>

      <div className="flex items-end gap-[1.5mm]">
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-[5.5pt] leading-tight">
            <span>
              B: <span className="font-semibold">{label.batchNumber}</span>
            </span>
            <span>
              EXP <span className="font-semibold">{expLabel(label.expiryDate)}</span>
            </span>
          </div>
          {code128Svg ? (
            <div
              className="mt-[0.5mm] [&>svg]:h-[6mm] [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: code128Svg }}
            />
          ) : (
            <div className="mt-[0.5mm] text-[5pt] text-red-600">barcode failed to render</div>
          )}
          <div className="truncate font-mono text-[5pt] leading-tight">{label.code128}</div>
        </div>

        {dmSvg && (
          <div
            className="shrink-0 [&>svg]:h-[11mm] [&>svg]:w-[11mm]"
            dangerouslySetInnerHTML={{ __html: dmSvg }}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between text-[5.5pt] leading-tight">
        {/* Live location — printed, never encoded. */}
        <span className="truncate font-semibold">{label.storageLocation || '—'}</span>
        {price != null && <span className="shrink-0">₹{Number(price).toFixed(2)}</span>}
      </div>
    </div>
  );
}
