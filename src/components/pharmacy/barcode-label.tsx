'use client';

import { useMemo } from 'react';
import { toSVG } from 'bwip-js/browser';

// On-screen barcode card for one stock batch.
//
// Two symbols, which is what pharmacy systems carry:
//  • Code-128 — the short internal key. Reads on any scanner, including the
//    cheap 1D lasers still on most counters.
//  • DataMatrix — carries product + batch + expiry so the code self-describes
//    without a lookup. GS1 DataMatrix (used whenever the drug has a real GTIN)
//    is the healthcare standard: tiny footprint, Reed-Solomon error correction.
//
// Storage location is shown as TEXT and deliberately not encoded — it is the one
// field that changes when stock moves, so an encoded copy would start lying the
// moment a batch is re-racked. It is re-read from the record on every scan.
//
// Rendered as SVG so it stays sharp at any zoom level and scans cleanly straight
// off the screen.

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
    // take the whole view down with it — the rest of the card is still useful,
    // and a missing symbol is visible to whoever is looking.
    return null;
  }
}

/** Expiry reads MM/YYYY — the convention on medicine packs. */
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
        scale: 3,
        height: 14,
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
        scale: 4,
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
    <div className="rounded-xl border bg-surface-container-lowest p-4 shadow-sanctuary">
      {/* Identity */}
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight">{title}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>

      {/* Facts */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        <Fact label="Batch" value={label.batchNumber} mono />
        <Fact label="Expiry" value={expLabel(label.expiryDate)} />
        <Fact label="Location" value={label.storageLocation || '—'} />
        <Fact label={label.mrp != null ? 'MRP' : 'Price'} value={price != null ? `₹${Number(price).toFixed(2)}` : '—'} />
      </div>

      {/* The codes — big enough to scan straight off the screen */}
      <div className="mt-4 flex flex-wrap items-end gap-5 rounded-lg bg-white p-4">
        <div className="min-w-0 flex-1">
          {code128Svg ? (
            <div
              className="[&>svg]:h-[52px] [&>svg]:w-full [&>svg]:max-w-[340px]"
              dangerouslySetInnerHTML={{ __html: code128Svg }}
            />
          ) : (
            <p className="text-xs text-red-600">Barcode could not be rendered</p>
          )}
          <p className="mt-1 font-mono text-sm font-semibold tracking-wider text-black">
            {label.code128}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-black/50">Code-128 · unique number</p>
        </div>

        {dmSvg && (
          <div className="shrink-0 text-center">
            <div
              className="[&>svg]:h-[76px] [&>svg]:w-[76px]"
              dangerouslySetInnerHTML={{ __html: dmSvg }}
            />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-black/50">
              {label.dataMatrixFormat === 'gs1datamatrix' ? 'GS1 DataMatrix' : 'DataMatrix'}
            </p>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        The 2D code carries product, batch and expiry. Location is shown as text and read
        live on every scan, so moving stock never makes this code wrong.
      </p>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`truncate font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
