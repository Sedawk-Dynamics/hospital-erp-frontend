'use client';

import { useEffect, useRef, useState } from 'react';
import dicomParser from 'dicom-parser';
import { Loader2, AlertTriangle, ImageOff } from 'lucide-react';

interface DicomRendererProps {
  fileUrl: string;
  // Initial window center / width; if null, derive from the DICOM tags
  // and fall back to a sensible default for the modality.
  initialWC?: number | null;
  initialWW?: number | null;
  zoom?: number;
  className?: string;
}

interface DicomMeta {
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  pixelRepresentation: number; // 0 = unsigned, 1 = signed
  samplesPerPixel: number;
  photometricInterpretation: string;
  windowCenter: number | null;
  windowWidth: number | null;
  rescaleSlope: number;
  rescaleIntercept: number;
  transferSyntaxUid: string;
}

/**
 * Lightweight DICOM renderer for uncompressed transfer syntaxes
 * (Implicit/Explicit VR Little Endian — covers the bulk of CT/MR/X-ray
 * exports). For JPEG / JPEG-2000 / RLE encoded pixel data we set an
 * `unsupported` state and the parent shows the "Open OHIF" fallback.
 *
 * Pure dicom-parser + canvas; no Cornerstone/WASM dependency.
 */
export function DicomRenderer({
  fileUrl,
  initialWC = null,
  initialWW = null,
  zoom = 1,
  className = '',
}: DicomRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelStateRef = useRef<{
    pixels: Int16Array | Uint16Array | Uint8Array;
    meta: DicomMeta;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [wc, setWc] = useState<number>(0);
  const [ww, setWw] = useState<number>(1);
  const [showControls, setShowControls] = useState(true);

  // --- Fetch + parse on URL change ---
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUnsupported(false);
    pixelStateRef.current = null;

    (async () => {
      try {
        const buf = await fetch(fileUrl).then((r) => {
          if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
          return r.arrayBuffer();
        });
        if (cancelled) return;

        const byteArray = new Uint8Array(buf);
        const dataSet = dicomParser.parseDicom(byteArray);

        const transferSyntaxUid = dataSet.string('x00020010') ?? '';
        const compressedSyntaxes = [
          '1.2.840.10008.1.2.4.50', // JPEG Baseline
          '1.2.840.10008.1.2.4.51', // JPEG Extended
          '1.2.840.10008.1.2.4.57', // JPEG Lossless
          '1.2.840.10008.1.2.4.70', // JPEG Lossless SV1
          '1.2.840.10008.1.2.4.80', // JPEG-LS Lossless
          '1.2.840.10008.1.2.4.90', // JPEG 2000 Lossless
          '1.2.840.10008.1.2.4.91', // JPEG 2000
          '1.2.840.10008.1.2.5', // RLE
        ];
        if (compressedSyntaxes.includes(transferSyntaxUid)) {
          setUnsupported(true);
          setLoading(false);
          return;
        }

        const rows = dataSet.uint16('x00280010') ?? 0;
        const columns = dataSet.uint16('x00280011') ?? 0;
        const bitsAllocated = dataSet.uint16('x00280100') ?? 8;
        const bitsStored = dataSet.uint16('x00280101') ?? bitsAllocated;
        const highBit = dataSet.uint16('x00280102') ?? bitsStored - 1;
        const pixelRepresentation = dataSet.uint16('x00280103') ?? 0;
        const samplesPerPixel = dataSet.uint16('x00280002') ?? 1;
        const photometricInterpretation =
          dataSet.string('x00280004') ?? 'MONOCHROME2';
        const windowCenterStr = dataSet.string('x00281050');
        const windowWidthStr = dataSet.string('x00281051');
        const windowCenter = windowCenterStr ? parseFloat(windowCenterStr.split('\\')[0] ?? '') : null;
        const windowWidth = windowWidthStr ? parseFloat(windowWidthStr.split('\\')[0] ?? '') : null;
        const rescaleSlope = parseFloat(dataSet.string('x00281053') ?? '1');
        const rescaleIntercept = parseFloat(dataSet.string('x00281052') ?? '0');

        if (!rows || !columns) {
          setError('Missing image dimensions');
          setLoading(false);
          return;
        }

        const pixelDataElement = dataSet.elements.x7fe00010;
        if (!pixelDataElement) {
          setError('No pixel data');
          setLoading(false);
          return;
        }

        const numPixels = rows * columns * samplesPerPixel;
        let pixels: Int16Array | Uint16Array | Uint8Array;
        if (bitsAllocated === 16) {
          if (pixelRepresentation === 1) {
            pixels = new Int16Array(
              dataSet.byteArray.buffer,
              pixelDataElement.dataOffset,
              numPixels,
            );
          } else {
            pixels = new Uint16Array(
              dataSet.byteArray.buffer,
              pixelDataElement.dataOffset,
              numPixels,
            );
          }
        } else {
          pixels = new Uint8Array(
            dataSet.byteArray.buffer,
            pixelDataElement.dataOffset,
            numPixels,
          );
        }

        const meta: DicomMeta = {
          rows,
          columns,
          bitsAllocated,
          bitsStored,
          highBit,
          pixelRepresentation,
          samplesPerPixel,
          photometricInterpretation,
          windowCenter,
          windowWidth,
          rescaleSlope: isNaN(rescaleSlope) ? 1 : rescaleSlope,
          rescaleIntercept: isNaN(rescaleIntercept) ? 0 : rescaleIntercept,
          transferSyntaxUid,
        };

        pixelStateRef.current = { pixels, meta };

        // Initial WC/WW: from DICOM tags → from initialWC/WW prop → from data range
        const seedWC = initialWC ?? windowCenter;
        const seedWW = initialWW ?? windowWidth;
        if (seedWC != null && seedWW != null && seedWW > 0) {
          setWc(seedWC);
          setWw(seedWW);
        } else {
          // Compute min/max for a reasonable default
          let min = Infinity;
          let max = -Infinity;
          for (let i = 0; i < pixels.length; i += 1) {
            const v = pixels[i] * meta.rescaleSlope + meta.rescaleIntercept;
            if (v < min) min = v;
            if (v > max) max = v;
          }
          setWc((min + max) / 2);
          setWw(Math.max(1, max - min));
        }

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load DICOM';
        setError(message);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, initialWC, initialWW]);

  // --- Render whenever pixel data or WC/WW changes ---
  useEffect(() => {
    const state = pixelStateRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas) return;
    const { pixels, meta } = state;
    canvas.width = meta.columns;
    canvas.height = meta.rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(meta.columns, meta.rows);
    const data = img.data;
    const halfWW = ww / 2;
    const wcLow = wc - halfWW;
    const invert = meta.photometricInterpretation === 'MONOCHROME1';
    const isColor = meta.samplesPerPixel === 3;

    if (isColor) {
      for (let i = 0; i < meta.rows * meta.columns; i += 1) {
        data[i * 4 + 0] = pixels[i * 3 + 0] as number;
        data[i * 4 + 1] = pixels[i * 3 + 1] as number;
        data[i * 4 + 2] = pixels[i * 3 + 2] as number;
        data[i * 4 + 3] = 255;
      }
    } else {
      for (let i = 0; i < pixels.length; i += 1) {
        const raw = pixels[i] * meta.rescaleSlope + meta.rescaleIntercept;
        let mapped = ((raw - wcLow) / ww) * 255;
        if (mapped < 0) mapped = 0;
        else if (mapped > 255) mapped = 255;
        if (invert) mapped = 255 - mapped;
        const out = mapped | 0;
        data[i * 4 + 0] = out;
        data[i * 4 + 1] = out;
        data[i * 4 + 2] = out;
        data[i * 4 + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
  }, [wc, ww, loading]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center text-white/70 ${className}`} style={{ minHeight: 400 }}>
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span className="text-sm">Loading DICOM…</span>
      </div>
    );
  }

  if (unsupported) {
    return (
      <div className={`flex flex-col items-center justify-center text-white/80 px-6 py-12 ${className}`} style={{ minHeight: 400 }}>
        <ImageOff className="h-10 w-10 mb-3 opacity-60" />
        <p className="text-sm font-medium">Compressed transfer syntax</p>
        <p className="text-xs opacity-70 mt-1 text-center max-w-md">
          This file uses JPEG/JPEG-2000/RLE encoding which this lightweight viewer doesn&apos;t decode.
          Use the &quot;Open OHIF&quot; button at the top of the page for full rendering.
        </p>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-80 mt-3">
          Download .dcm
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center text-white/80 px-6 py-12 ${className}`} style={{ minHeight: 400 }}>
        <AlertTriangle className="h-10 w-10 mb-3 text-amber-400" />
        <p className="text-sm">Couldn&apos;t render DICOM</p>
        <p className="text-xs opacity-70 mt-1">{error}</p>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-80 mt-3">
          Download .dcm
        </a>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center ${className}`} style={{ minHeight: 400 }}>
      <canvas
        ref={canvasRef}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          maxWidth: '100%',
          maxHeight: 480,
          imageRendering: 'pixelated',
        }}
        className="bg-black"
      />
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/85 text-white text-xs px-3 py-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="opacity-70">Window Center</span>
            <input
              type="range"
              min={-2000}
              max={4000}
              step={1}
              value={Math.round(wc)}
              onChange={(e) => setWc(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono w-12 text-right">{Math.round(wc)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="opacity-70">Window Width</span>
            <input
              type="range"
              min={1}
              max={4000}
              step={1}
              value={Math.round(ww)}
              onChange={(e) => setWw(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono w-12 text-right">{Math.round(ww)}</span>
          </label>
          <button
            type="button"
            onClick={() => setShowControls(false)}
            className="ml-auto opacity-60 hover:opacity-100"
          >
            Hide
          </button>
        </div>
      )}
      {!showControls && (
        <button
          type="button"
          onClick={() => setShowControls(true)}
          className="absolute bottom-2 right-2 text-[10px] uppercase tracking-wide bg-zinc-900/80 text-white px-2 py-1 rounded"
        >
          Show W/L
        </button>
      )}
    </div>
  );
}
