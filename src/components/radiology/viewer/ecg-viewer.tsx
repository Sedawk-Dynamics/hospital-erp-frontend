'use client';

// ECG viewer with two modes:
//
//   1. PDF / image / scanned trace → defer to the PDF/Image viewer.
//      We don't try to OCR a printed strip; the doctor reads it directly.
//
//   2. Raw waveform (HL7 aECG / CSV / JSON) → SVG plot rendered on a
//      standard 25 mm/s × 10 mm/mV medical grid. Lays out 12 leads in a
//      3×4 panel (I/II/III, aVR/aVL/aVF, V1–V3, V4–V6) plus an optional
//      rhythm strip (lead II) along the bottom. Shows HR + intervals from
//      file metadata in the top-right.
//
// No D3 — the plot is straight SVG. Keeps deps light and lets us inherit
// the dark viewer shell without theme acrobatics.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, FileText, Image as ImageIcon, FileWarning } from 'lucide-react';
import { ViewerShell } from './viewer-shell';
import type { RadiologyFile, StudyMetadata, ViewerEvents } from './viewer-types';
import type { ParsedEcg, ParsedEcgLead } from './ecg-parsers';
import { parseEcgBlob } from './ecg-parsers';
import { PdfViewer } from './pdf-viewer';
import { ImageViewer } from './image-viewer';

interface EcgViewerProps {
  file: RadiologyFile;
  studyMetadata?: StudyMetadata;
  userRole?: string;
  canDownload?: boolean;
  dense?: boolean;
  events?: ViewerEvents;
  className?: string;
}

export function EcgViewer(props: EcgViewerProps) {
  const { file } = props;
  // Route by extension/MIME — for the print-style ECGs (PDF/JPG) the
  // existing viewers do the right thing.
  const name = (file.fileName ?? file.fileUrl).toLowerCase();
  if (file.mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    return <PdfViewer {...props} />;
  }
  if ((file.mimeType ?? '').startsWith('image/') || /\.(jpe?g|png|tiff?|bmp|webp)$/.test(name)) {
    return <ImageViewer {...props} />;
  }
  return <RawEcgViewer {...props} />;
}

function RawEcgViewer({
  file, studyMetadata, userRole, canDownload, dense, events, className,
}: EcgViewerProps) {
  const [parsed, setParsed] = useState<ParsedEcg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gain, setGain] = useState(1); // mV gain multiplier
  const [speed, setSpeed] = useState(25); // mm/s

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setParsed(null);
    (async () => {
      try {
        const res = await fetch(file.fileUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const blob = await res.blob();
        const ecg = await parseEcgBlob(blob, file.fileName);
        if (cancelled) return;
        if (!ecg) {
          setError('Could not parse ECG waveform. The file may be a vendor proprietary format.');
          setLoading(false);
          return;
        }
        setParsed(ecg);
        setLoading(false);
        events?.onLoaded?.({
          fileType: 'ecg',
          count: ecg.leads.length,
          metadata: { samplingRate: ecg.samplingRate, ...ecg.meta },
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load ECG';
        setError(message);
        setLoading(false);
        events?.onError?.({ message, cause: err });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.fileUrl]);

  const toolbar = parsed && (
    <>
      <span className="text-xs text-zinc-300">Speed</span>
      <select
        value={speed}
        onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-1.5 py-0.5"
      >
        <option value={12.5}>12.5 mm/s</option>
        <option value={25}>25 mm/s</option>
        <option value={50}>50 mm/s</option>
      </select>
      <span className="text-xs text-zinc-300 ml-2">Gain</span>
      <select
        value={gain}
        onChange={(e) => setGain(parseFloat(e.target.value))}
        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-1.5 py-0.5"
      >
        <option value={0.5}>5 mm/mV</option>
        <option value={1}>10 mm/mV</option>
        <option value={2}>20 mm/mV</option>
      </select>
      <div className="ml-auto flex items-center gap-3 text-[11px] text-zinc-400">
        <span>{parsed.samplingRate} Hz</span>
        <span>{parsed.leads.length} leads</span>
        {parsed.meta.heartRate ? <span>HR <b className="text-zinc-200">{Math.round(parsed.meta.heartRate)}</b></span> : null}
        {parsed.meta.pr ? <span>PR <b className="text-zinc-200">{Math.round(parsed.meta.pr)}</b>ms</span> : null}
        {parsed.meta.qrs ? <span>QRS <b className="text-zinc-200">{Math.round(parsed.meta.qrs)}</b>ms</span> : null}
        {parsed.meta.qt ? <span>QT <b className="text-zinc-200">{Math.round(parsed.meta.qt)}</b>ms</span> : null}
        {parsed.meta.qtc ? <span>QTc <b className="text-zinc-200">{Math.round(parsed.meta.qtc)}</b>ms</span> : null}
      </div>
    </>
  );

  return (
    <ViewerShell
      title={file.fileName ?? 'ECG'}
      subtitle={parsed?.meta.rhythm ?? undefined}
      metadata={studyMetadata}
      sizeBytes={file.sizeBytes}
      downloadUrl={file.fileUrl}
      downloadFileName={file.fileName}
      userRole={userRole}
      canDownload={canDownload}
      onClose={events?.onClose}
      toolbar={toolbar}
      dense={dense}
      className={className}
    >
      <div className="h-full w-full overflow-auto bg-zinc-950">
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <Loader2 className="size-6 animate-spin mr-2" />
            <span className="text-sm">Loading ECG…</span>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-300 text-center px-6 py-8">
            <FileWarning className="size-10 mb-3 text-amber-400" />
            <p className="text-sm">Couldn&apos;t parse ECG</p>
            <p className="text-xs opacity-70 mt-1 max-w-md">{error}</p>
            <p className="text-[10px] opacity-50 mt-3">
              Supported: HL7 aECG XML, CSV (header row + time + lead cols), JSON (leads object).
              Vendor proprietary formats need conversion to one of those first.
            </p>
          </div>
        ) : parsed ? (
          <EcgPlot ecg={parsed} mmPerSec={speed} gain={gain} />
        ) : null}
      </div>
    </ViewerShell>
  );
}

// ─── SVG plotter ────────────────────────────────────────────────────

/**
 * 3-column × 4-row 12-lead layout + bottom rhythm strip (lead II).
 *
 * Coordinate system: 1 mm = 4 SVG units (we render at higher density so
 * the canvas stays crisp when zoomed in via the browser). At 25 mm/s
 * standard speed, 1 second = 100 SVG units.
 */
function EcgPlot({ ecg, mmPerSec, gain }: { ecg: ParsedEcg; mmPerSec: number; gain: number }) {
  const PX_PER_MM = 4;
  const VOLT_TO_MM = (() => {
    // 10 mm/mV is standard. Convert sample value to mm offset.
    // Our raw samples are in microvolts (uV) — 1000 uV = 1 mV = 10 mm baseline.
    // gain multiplies the height.
    return (10 * gain) / 1000;
  })();
  const TIME_TO_MM = (1 / ecg.samplingRate) * mmPerSec * 1000; // mm per sample
  // Standard short-rhythm panel: 2.5 s per lead × 4 columns = 10 s total.
  // Each panel is ~250 mm wide and ~30 mm tall.
  const PANEL_WIDTH_MM = (2.5 * mmPerSec);
  const PANEL_HEIGHT_MM = 30;
  const ROW_GAP_MM = 5;
  const COL_GAP_MM = 5;

  // The classic 3×4 layout: [I, II, III] / [aVR, aVL, aVF] / [V1, V2, V3] / [V4, V5, V6]
  // Adjust if fewer leads.
  const order = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
  const present = new Map(ecg.leads.map((l) => [l.name.toUpperCase(), l]));
  const grid: Array<Array<ParsedEcgLead | null>> = [];
  // 4 columns × 3 rows = 12 cells
  for (let row = 0; row < 3; row += 1) {
    const cols: Array<ParsedEcgLead | null> = [];
    for (let col = 0; col < 4; col += 1) {
      const name = order[col * 3 + row];
      cols.push(present.get(name?.toUpperCase() ?? '') ?? null);
    }
    grid.push(cols);
  }
  const rhythm = present.get('II') ?? ecg.leads[0] ?? null;

  // Bounds
  const totalCols = 4;
  const totalRows = 3;
  const plotWidthMm = totalCols * PANEL_WIDTH_MM + (totalCols - 1) * COL_GAP_MM + 20;
  const plotHeightMm = totalRows * PANEL_HEIGHT_MM + (totalRows - 1) * ROW_GAP_MM + (rhythm ? PANEL_HEIGHT_MM + ROW_GAP_MM : 0) + 30;

  const W = plotWidthMm * PX_PER_MM;
  const H = plotHeightMm * PX_PER_MM;

  // Build a path string for a single lead within a panel rectangle.
  const buildPath = (lead: ParsedEcgLead, panelX: number, panelY: number, panelW: number, panelH: number, durationSec: number) => {
    const maxSamples = Math.min(lead.samples.length, Math.floor(durationSec * ecg.samplingRate));
    const midY = panelY + panelH / 2;
    let d = '';
    for (let i = 0; i < maxSamples; i += 1) {
      // x = panelX + (sample index × time→mm) * PX_PER_MM
      const x = panelX + i * TIME_TO_MM * PX_PER_MM;
      const v = lead.samples[i];
      const yOffsetMm = v * VOLT_TO_MM;
      const y = midY - yOffsetMm * PX_PER_MM;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
      if (x > panelX + panelW * PX_PER_MM) break;
    }
    return d;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ minWidth: W, background: '#0a0a0a' }}
      preserveAspectRatio="xMinYMin meet"
    >
      <defs>
        <pattern id="ecg-grid-sm" width={PX_PER_MM} height={PX_PER_MM} patternUnits="userSpaceOnUse">
          <path d={`M ${PX_PER_MM} 0 L 0 0 0 ${PX_PER_MM}`} fill="none" stroke="#7f1d1d" strokeWidth="0.4" />
        </pattern>
        <pattern id="ecg-grid-lg" width={PX_PER_MM * 5} height={PX_PER_MM * 5} patternUnits="userSpaceOnUse">
          <rect width={PX_PER_MM * 5} height={PX_PER_MM * 5} fill="url(#ecg-grid-sm)" />
          <path d={`M ${PX_PER_MM * 5} 0 L 0 0 0 ${PX_PER_MM * 5}`} fill="none" stroke="#dc2626" strokeWidth="0.8" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={W} height={H} fill="url(#ecg-grid-lg)" />

      {/* 12-lead panels */}
      {grid.map((rowArr, rowIdx) =>
        rowArr.map((lead, colIdx) => {
          const panelX = (10 + colIdx * (PANEL_WIDTH_MM + COL_GAP_MM)) * PX_PER_MM;
          const panelY = (10 + rowIdx * (PANEL_HEIGHT_MM + ROW_GAP_MM)) * PX_PER_MM;
          const panelW = PANEL_WIDTH_MM;
          const panelH = PANEL_HEIGHT_MM;
          return (
            <g key={`${rowIdx}-${colIdx}`}>
              <text
                x={panelX + 6}
                y={panelY + 14}
                fontSize="12"
                fontWeight="bold"
                fill="#fef3c7"
              >
                {order[colIdx * 3 + rowIdx]}
              </text>
              {lead ? (
                <path
                  d={buildPath(lead, panelX, panelY, panelW, panelH, 2.5)}
                  stroke="#fef3c7"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : (
                <text x={panelX + 6} y={panelY + 30} fontSize="9" fill="#6b7280">no data</text>
              )}
            </g>
          );
        }),
      )}

      {/* Rhythm strip — bottom row, 10s of lead II */}
      {rhythm && (
        <g>
          <text
            x={10 * PX_PER_MM}
            y={(10 + 3 * (PANEL_HEIGHT_MM + ROW_GAP_MM) + 14) * PX_PER_MM / PX_PER_MM}
            fontSize="12"
            fontWeight="bold"
            fill="#fef3c7"
          >
            II (rhythm)
          </text>
          <path
            d={buildPath(
              rhythm,
              10 * PX_PER_MM,
              (10 + 3 * (PANEL_HEIGHT_MM + ROW_GAP_MM)) * PX_PER_MM,
              4 * PANEL_WIDTH_MM + 3 * COL_GAP_MM,
              PANEL_HEIGHT_MM,
              10,
            )}
            stroke="#fef3c7"
            strokeWidth="1.4"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Calibration pulse — 1 mV rectangle at the top-left to confirm gain */}
      <g transform={`translate(${5 * PX_PER_MM}, ${5 * PX_PER_MM})`}>
        <path
          d={`M 0 ${PANEL_HEIGHT_MM * PX_PER_MM / 2} L 0 ${(PANEL_HEIGHT_MM / 2 - 10 * gain) * PX_PER_MM} L ${5 * PX_PER_MM} ${(PANEL_HEIGHT_MM / 2 - 10 * gain) * PX_PER_MM} L ${5 * PX_PER_MM} ${PANEL_HEIGHT_MM * PX_PER_MM / 2}`}
          stroke="#fef3c7"
          strokeWidth="1"
          fill="none"
        />
        <text x={6 * PX_PER_MM} y={PANEL_HEIGHT_MM * PX_PER_MM / 2 - 4} fontSize="8" fill="#fef3c7">1 mV</text>
      </g>
    </svg>
  );
}
