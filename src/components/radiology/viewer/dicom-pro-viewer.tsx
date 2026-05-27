'use client';

// Pro-grade DICOM viewer built on dicom-parser + canvas.
//
// Features:
//   - Multi-slice scroll (wheel + arrow keys + thumbnail strip)
//   - Cine play (forward/back + speed)
//   - Pan (left-button drag in pan mode)
//   - Zoom (wheel in zoom mode + buttons + +/- keys)
//   - Window/Level drag (right-button drag, always on; X = WW, Y = WC)
//   - Length + angle measurement tools (drawn on overlay canvas)
//   - Rotate 90° increments
//   - Invert (toggle MONOCHROME1↔MONOCHROME2)
//   - W/L presets (CT/MR/X-ray, modality-aware)
//   - Reset to defaults
//   - Live HUD: image index, zoom %, WC/WW, modality
//
// Limitation: only handles uncompressed transfer syntaxes (Implicit/Explicit
// VR Little Endian) — the bulk of routine modality exports. JPEG/JPEG2000/
// RLE encoded files surface an "unsupported transfer syntax" message; the
// roadmap is to integrate cornerstone3D for those (see comment at the top
// of viewer/index.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ZoomIn, ZoomOut, Hand, Move, Ruler, Triangle, RotateCw,
  PencilOff, RefreshCw, Play, Pause, ChevronLeft, ChevronRight,
  Layers, ImageOff, Loader2, AlertTriangle,
} from 'lucide-react';
import dicomParser from 'dicom-parser';
import { ViewerShell, ViewerToolButton, ViewerToolDivider } from './viewer-shell';
import { presetsForModality } from './dicom-presets';
import type {
  RadiologyFile, StudyMetadata, ViewerEvents, MeasurementPayload, WLPreset,
} from './viewer-types';

const COMPRESSED_TRANSFER_SYNTAXES = new Set([
  '1.2.840.10008.1.2.4.50',
  '1.2.840.10008.1.2.4.51',
  '1.2.840.10008.1.2.4.57',
  '1.2.840.10008.1.2.4.70',
  '1.2.840.10008.1.2.4.80',
  '1.2.840.10008.1.2.4.90',
  '1.2.840.10008.1.2.4.91',
  '1.2.840.10008.1.2.5',
]);

interface DicomFrame {
  pixels: Int16Array | Uint16Array | Uint8Array;
  rows: number;
  columns: number;
  rescaleSlope: number;
  rescaleIntercept: number;
  photometricInterpretation: string;
  samplesPerPixel: number;
  // Derived
  defaultWC: number;
  defaultWW: number;
  /** mm/pixel (row, column). Null when DICOM tags don't carry it. */
  pixelSpacing: [number, number] | null;
}

interface DicomFileResult {
  ok: boolean;
  unsupported?: boolean;
  error?: string;
  frame?: DicomFrame;
  meta?: {
    modality?: string;
    studyDescription?: string;
    seriesDescription?: string;
    instanceNumber?: number;
    patientName?: string;
    patientId?: string;
  };
}

type Tool = 'pan' | 'zoom' | 'length' | 'angle';

interface Measurement {
  id: string;
  kind: 'length' | 'angle';
  /** In image-space coords (pre-zoom/pan/rotate). */
  points: Array<{ x: number; y: number }>;
  display: string;
}

interface DicomProViewerProps {
  files: RadiologyFile[];           // 1+ DICOM files (single-slice if length=1)
  studyMetadata?: StudyMetadata;
  userRole?: string;
  canDownload?: boolean;
  dense?: boolean;
  events?: ViewerEvents;
  className?: string;
}

export function DicomProViewer({
  files, studyMetadata, userRole, canDownload, dense, events, className,
}: DicomProViewerProps) {
  const [frames, setFrames] = useState<Array<DicomFileResult | null>>(() =>
    files.map(() => null),
  );
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // Render state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [wc, setWc] = useState(0);
  const [ww, setWw] = useState(1);
  const [rotation, setRotation] = useState(0); // 0/90/180/270
  const [inverted, setInverted] = useState(false);
  const [tool, setTool] = useState<Tool>('pan');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [pendingPoints, setPendingPoints] = useState<Array<{ x: number; y: number }>>([]);

  // Cine
  const [cine, setCine] = useState(false);
  const [cineFps, setCineFps] = useState(10);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ─── Load all DICOM files in parallel ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFrames(files.map(() => null));

    Promise.all(files.map((f) => parseDicomUrl(f.fileUrl)))
      .then((results) => {
        if (cancelled) return;
        setFrames(results);
        const first = results.find((r) => r?.ok && r.frame);
        if (first?.frame) {
          setWc(first.frame.defaultWC);
          setWw(first.frame.defaultWW);
        }
        setLoading(false);
        const okCount = results.filter((r) => r?.ok).length;
        events?.onLoaded?.({
          fileType: 'dicom',
          count: results.length,
          metadata: { okCount, totalFiles: results.length, firstModality: first?.meta?.modality },
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        events?.onError?.({ message: String(err), cause: err });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.fileUrl).join('|')]);

  const currentResult = frames[idx] ?? null;
  const currentFrame = currentResult?.frame ?? null;

  // When switching slices, re-derive defaults if the user hasn't tuned W/L
  // for this frame yet. Heuristic: if the WC/WW match the previous frame's
  // defaults, snap to the new frame's defaults; otherwise keep the user's
  // setting so they stay in their preferred preset.
  useEffect(() => {
    // Adopt new frame's defaults the first time we visit it.
    if (!currentFrame) return;
    setWc((prev) => (prev === 0 ? currentFrame.defaultWC : prev));
    setWw((prev) => (prev === 1 ? currentFrame.defaultWW : prev));
  }, [currentFrame]);

  // ─── Render image canvas whenever inputs change ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;
    drawFrame(canvas, currentFrame, { wc, ww, inverted });
  }, [currentFrame, wc, ww, inverted]);

  // ─── Render measurement overlay ────────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    drawOverlay(overlay, measurements, pendingPoints, tool, {
      zoom, pan, rotation, frame: currentFrame,
    });
  }, [measurements, pendingPoints, tool, zoom, pan, rotation, currentFrame]);

  // ─── Cine loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!cine || files.length <= 1) return;
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % files.length);
    }, Math.max(50, 1000 / cineFps));
    return () => clearInterval(interval);
  }, [cine, cineFps, files.length]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          setIdx((i) => Math.max(0, i - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          setIdx((i) => Math.min(files.length - 1, i + 1));
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom((z) => Math.min(8, z * 1.2));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setZoom((z) => Math.max(0.1, z / 1.2));
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          resetView();
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setInverted((v) => !v);
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          if (files.length > 1) setCine((v) => !v);
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          // Keyboard W activates W/L drag intent (visual feedback). The
          // actual W/L is always available via right-button drag.
          setTool('pan');
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  // ─── Drag handling: pan, zoom-drag, W/L-drag, measure click ───────
  const dragRef = useRef<null | {
    button: number;
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
    startWC: number;
    startWW: number;
    startZoom: number;
  }>(null);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Measurement tools: capture clicks (left button only).
    if (e.button === 0 && (tool === 'length' || tool === 'angle')) {
      const needed = tool === 'length' ? 2 : 3;
      const imagePoint = canvasToImage(x, y, rect.width, rect.height);
      if (!imagePoint) return;
      const next = [...pendingPoints, imagePoint];
      if (next.length >= needed) {
        const measurement = buildMeasurement(tool, next, currentFrame?.pixelSpacing ?? null);
        setMeasurements((m) => [...m, measurement]);
        setPendingPoints([]);
        events?.onMeasurement?.({
          kind: measurement.kind,
          display: measurement.display,
          value: parseFloat(measurement.display) || 0,
          points: measurement.points,
        } as MeasurementPayload);
      } else {
        setPendingPoints(next);
      }
      return;
    }

    // Pan / zoom-drag (left button) and W/L drag (right button) start.
    el.setPointerCapture?.((e as any).pointerId);
    dragRef.current = {
      button: e.button,
      startX: e.clientX,
      startY: e.clientY,
      startPan: { ...pan },
      startWC: wc,
      startWW: ww,
      startZoom: zoom,
    };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const isLeft = drag.button === 0;
    const isRight = drag.button === 2;

    // Right-button drag is ALWAYS window/level (radiology convention).
    // dx = window width (drag right = wider), dy = window center
    // (drag down = brighter, i.e. lower WC).
    if (isRight) {
      setWw(Math.max(1, drag.startWW + dx * 4));
      setWc(drag.startWC + dy * 4);
      return;
    }
    if (isLeft && tool === 'pan') {
      setPan({ x: drag.startPan.x + dx, y: drag.startPan.y + dy });
      return;
    }
    if (isLeft && tool === 'zoom') {
      const factor = 1 + dy * -0.005;
      setZoom(Math.max(0.1, Math.min(8, drag.startZoom * factor)));
      return;
    }
    // Left-drag in length/angle mode does nothing — points are captured
    // on click in onMouseDown.
  };

  const onMouseUp = () => {
    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Wheel = scroll through slices (radiology convention). Shift+wheel = zoom.
    if (e.shiftKey || tool === 'zoom') {
      e.preventDefault();
      setZoom((z) => Math.max(0.1, Math.min(8, z * (e.deltaY < 0 ? 1.1 : 0.9))));
      return;
    }
    if (files.length > 1) {
      e.preventDefault();
      setIdx((i) => {
        const next = e.deltaY > 0 ? i + 1 : i - 1;
        return Math.max(0, Math.min(files.length - 1, next));
      });
    }
  };

  // Map a canvas-pixel coordinate to image-space (pre-zoom/pan/rotate).
  const canvasToImage = useCallback(
    (cx: number, cy: number, canvasW: number, canvasH: number) => {
      if (!currentFrame) return null;
      // The canvas displays the image scaled to fit; reverse the transform.
      const { rows, columns } = currentFrame;
      // Base scale used in display: object-contain over the canvas area.
      const baseScale = Math.min(canvasW / columns, canvasH / rows);
      const effectiveScale = baseScale * zoom;
      // Image is centered + panned; reverse.
      const dx = cx - canvasW / 2 - pan.x;
      const dy = cy - canvasH / 2 - pan.y;
      // Reverse rotation
      const rad = -(rotation * Math.PI) / 180;
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      // Convert to image coords
      const ix = rx / effectiveScale + columns / 2;
      const iy = ry / effectiveScale + rows / 2;
      return { x: ix, y: iy };
    },
    [currentFrame, zoom, pan, rotation],
  );

  // ─── Resets / presets ──────────────────────────────────────────────
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setInverted(false);
    setMeasurements([]);
    setPendingPoints([]);
    if (currentFrame) {
      setWc(currentFrame.defaultWC);
      setWw(currentFrame.defaultWW);
    }
  };

  const applyPreset = (p: WLPreset) => {
    setWc(p.wc);
    setWw(p.ww);
  };

  const modality = currentResult?.meta?.modality;
  const presets = useMemo(() => presetsForModality(modality), [modality]);

  // ─── Render error/loading branches ─────────────────────────────────
  if (loading) {
    return (
      <ViewerShell title="DICOM" dense={dense} className={className}
        downloadUrl={files[0]?.fileUrl} downloadFileName={files[0]?.fileName}
        userRole={userRole} canDownload={canDownload}
        onClose={events?.onClose}>
        <div className="flex h-full items-center justify-center text-zinc-400">
          <Loader2 className="size-6 animate-spin mr-2" />
          <span className="text-sm">Loading DICOM…</span>
        </div>
      </ViewerShell>
    );
  }

  if (currentResult?.unsupported) {
    return (
      <ViewerShell
        title={files[idx]?.fileName ?? 'DICOM'} dense={dense} className={className}
        downloadUrl={files[idx]?.fileUrl} downloadFileName={files[idx]?.fileName}
        userRole={userRole} canDownload={canDownload}
        onClose={events?.onClose}
      >
        <div className="flex h-full flex-col items-center justify-center px-6 py-8 text-zinc-300 text-center">
          <ImageOff className="size-10 mb-3 opacity-70" />
          <p className="text-sm font-medium">Compressed DICOM</p>
          <p className="text-xs opacity-70 mt-1 max-w-md">
            This file uses JPEG/JPEG-2000/RLE encoding. The built-in viewer renders uncompressed
            transfer syntaxes only — download and open in a PACS viewer such as OHIF for compressed studies.
          </p>
        </div>
      </ViewerShell>
    );
  }

  if (!currentResult?.ok || !currentFrame) {
    return (
      <ViewerShell
        title={files[idx]?.fileName ?? 'DICOM'} dense={dense} className={className}
        downloadUrl={files[idx]?.fileUrl} downloadFileName={files[idx]?.fileName}
        userRole={userRole} canDownload={canDownload}
        onClose={events?.onClose}
      >
        <div className="flex h-full flex-col items-center justify-center px-6 py-8 text-zinc-300 text-center">
          <AlertTriangle className="size-10 mb-3 text-amber-400" />
          <p className="text-sm">Couldn&apos;t render this DICOM</p>
          <p className="text-xs opacity-70 mt-1">{currentResult?.error}</p>
        </div>
      </ViewerShell>
    );
  }

  // ─── Toolbar ──────────────────────────────────────────────────────
  const toolbar = (
    <>
      <ViewerToolButton title="Pan (drag image)" active={tool === 'pan'} onClick={() => setTool('pan')}>
        <Hand className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Zoom (drag up/down)" active={tool === 'zoom'} onClick={() => setTool('zoom')}>
        <Move className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Length measurement" active={tool === 'length'} onClick={() => { setTool('length'); setPendingPoints([]); }}>
        <Ruler className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Angle measurement" active={tool === 'angle'} onClick={() => { setTool('angle'); setPendingPoints([]); }}>
        <Triangle className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolDivider />
      <ViewerToolButton title="Zoom in (+)" onClick={() => setZoom((z) => Math.min(8, z * 1.2))}>
        <ZoomIn className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Zoom out (-)" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}>
        <ZoomOut className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Rotate 90°" onClick={() => setRotation((r) => (r + 90) % 360)}>
        <RotateCw className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Invert (I)" active={inverted} onClick={() => setInverted((v) => !v)}>
        <PencilOff className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Reset view (R)" onClick={resetView}>
        <RefreshCw className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolDivider />
      {/* Presets */}
      {presets.map((p) => (
        <ViewerToolButton key={p.name} title={`${p.name} (WC ${p.wc} / WW ${p.ww})`} onClick={() => applyPreset(p)}>
          {p.shortLabel}
        </ViewerToolButton>
      ))}
      <ViewerToolDivider />
      {files.length > 1 && (
        <>
          <ViewerToolButton title="Previous slice (↑/←)" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
            <ChevronLeft className="size-3.5" />
          </ViewerToolButton>
          <span className="text-xs text-zinc-300 px-1 font-mono">
            {idx + 1}/{files.length}
          </span>
          <ViewerToolButton title="Next slice (↓/→)" onClick={() => setIdx((i) => Math.min(files.length - 1, i + 1))}>
            <ChevronRight className="size-3.5" />
          </ViewerToolButton>
          <ViewerToolButton title={cine ? 'Pause cine' : 'Play cine (P)'} active={cine} onClick={() => setCine((v) => !v)}>
            {cine ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </ViewerToolButton>
          <input
            type="number"
            min={1}
            max={60}
            value={cineFps}
            onChange={(e) => setCineFps(Math.max(1, Math.min(60, parseInt(e.target.value || '10', 10))))}
            className="w-12 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 border border-zinc-700"
            title="Cine FPS"
          />
          <span className="text-[10px] text-zinc-500 mr-1">fps</span>
        </>
      )}
    </>
  );

  const headerTitle = files[idx]?.fileName ?? currentResult?.meta?.studyDescription ?? 'DICOM Study';
  const headerSubtitle = [
    currentResult?.meta?.seriesDescription,
    currentResult?.meta?.instanceNumber != null ? `# ${currentResult.meta.instanceNumber}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <ViewerShell
      title={headerTitle}
      subtitle={headerSubtitle}
      metadata={studyMetadata}
      sizeBytes={files[idx]?.sizeBytes}
      downloadUrl={files[idx]?.fileUrl}
      downloadFileName={files[idx]?.fileName}
      userRole={userRole}
      canDownload={canDownload}
      onClose={events?.onClose}
      toolbar={toolbar}
      dense={dense}
      className={className}
    >
      <div className="flex h-full">
        {/* Thumbnail strip — only when there are multiple slices */}
        {files.length > 1 && (
          <aside className="w-20 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-900/40 p-1.5 space-y-1">
            {files.map((f, i) => {
              const ok = frames[i]?.ok;
              return (
                <button
                  key={f.fileUrl}
                  onClick={() => setIdx(i)}
                  className={`w-full aspect-square rounded border text-[10px] flex flex-col items-center justify-center
                    ${i === idx ? 'border-primary ring-1 ring-primary' : 'border-zinc-700 hover:border-zinc-500'}
                    ${ok ? 'bg-black text-zinc-300' : 'bg-zinc-800 text-zinc-500'}`}
                  title={f.fileName ?? `Slice ${i + 1}`}
                >
                  {ok ? <Layers className="size-3.5 opacity-50" /> : <ImageOff className="size-3.5" />}
                  <span className="font-mono mt-0.5">{i + 1}</span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Image area */}
        <div ref={containerRef} className="relative flex-1 min-w-0 bg-black overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 m-auto"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '100%',
              imageRendering: 'pixelated',
              cursor: tool === 'pan' ? 'grab' : tool === 'zoom' ? 'ns-resize' : 'crosshair',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* Measurement overlay — rendered on a sibling canvas at the
              same effective scale, so the measurement lines move with the
              image when the user zooms or pans. */}
          <canvas
            ref={overlayRef}
            className="absolute inset-0 m-auto pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />

          {/* HUD overlay — top-left + bottom-left + bottom-right info */}
          <div className="absolute top-2 left-2 text-[11px] text-zinc-300/90 font-mono drop-shadow space-y-0.5">
            <div>{modality ?? 'IMG'} · {currentFrame.columns}×{currentFrame.rows}</div>
            <div>WC {Math.round(wc)} · WW {Math.round(ww)}</div>
            <div>Zoom {Math.round(zoom * 100)}%</div>
          </div>
          <div className="absolute bottom-2 left-2 text-[11px] text-zinc-300/90 font-mono drop-shadow">
            {studyMetadata?.patientName ?? currentResult.meta?.patientName ?? ''}
          </div>
          <div className="absolute bottom-2 right-2 text-[10px] text-zinc-400 drop-shadow">
            ←/→ slices · wheel scroll · drag W/L (right-btn) · +/- zoom · R reset · I invert · P cine
          </div>
        </div>
      </div>
    </ViewerShell>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function parseDicomUrl(url: string): Promise<DicomFileResult> {
  try {
    const buf = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
      return r.arrayBuffer();
    });
    const byteArray = new Uint8Array(buf);
    const dataSet = dicomParser.parseDicom(byteArray);

    const tsuid = dataSet.string('x00020010') ?? '';
    if (COMPRESSED_TRANSFER_SYNTAXES.has(tsuid)) {
      return { ok: false, unsupported: true };
    }

    const rows = dataSet.uint16('x00280010') ?? 0;
    const columns = dataSet.uint16('x00280011') ?? 0;
    if (!rows || !columns) return { ok: false, error: 'Missing image dimensions' };

    const bitsAllocated = dataSet.uint16('x00280100') ?? 8;
    const pixelRepresentation = dataSet.uint16('x00280103') ?? 0;
    const samplesPerPixel = dataSet.uint16('x00280002') ?? 1;
    const photometricInterpretation = dataSet.string('x00280004') ?? 'MONOCHROME2';
    const wcStr = dataSet.string('x00281050');
    const wwStr = dataSet.string('x00281051');
    const tagWC = wcStr ? parseFloat(wcStr.split('\\')[0] ?? '') : null;
    const tagWW = wwStr ? parseFloat(wwStr.split('\\')[0] ?? '') : null;
    const rescaleSlope = parseFloat(dataSet.string('x00281053') ?? '1') || 1;
    const rescaleIntercept = parseFloat(dataSet.string('x00281052') ?? '0') || 0;

    const pixelDataElement = dataSet.elements.x7fe00010;
    if (!pixelDataElement) return { ok: false, error: 'No pixel data' };

    const numPixels = rows * columns * samplesPerPixel;
    let pixels: Int16Array | Uint16Array | Uint8Array;
    if (bitsAllocated === 16) {
      pixels = pixelRepresentation === 1
        ? new Int16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, numPixels)
        : new Uint16Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, numPixels);
    } else {
      pixels = new Uint8Array(dataSet.byteArray.buffer, pixelDataElement.dataOffset, numPixels);
    }

    // Default W/L: prefer DICOM tags, else compute from data range.
    let defaultWC = tagWC;
    let defaultWW = tagWW;
    if (defaultWC == null || defaultWW == null || defaultWW <= 0) {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < pixels.length; i += 1) {
        const v = pixels[i] * rescaleSlope + rescaleIntercept;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      defaultWC = (min + max) / 2;
      defaultWW = Math.max(1, max - min);
    }

    // Pixel Spacing (0028,0030) — "row\column" mm
    const psStr = dataSet.string('x00280030');
    let pixelSpacing: [number, number] | null = null;
    if (psStr) {
      const [a, b] = psStr.split('\\').map((s) => parseFloat(s));
      if (a && b && isFinite(a) && isFinite(b)) pixelSpacing = [a, b];
    }

    return {
      ok: true,
      frame: {
        pixels,
        rows,
        columns,
        rescaleSlope,
        rescaleIntercept,
        photometricInterpretation,
        samplesPerPixel,
        defaultWC,
        defaultWW,
        pixelSpacing,
      },
      meta: {
        modality: dataSet.string('x00080060') ?? undefined,
        studyDescription: dataSet.string('x00081030') ?? undefined,
        seriesDescription: dataSet.string('x0008103e') ?? undefined,
        instanceNumber: dataSet.intString('x00200013') ?? undefined,
        patientName: dataSet.string('x00100010') ?? undefined,
        patientId: dataSet.string('x00100020') ?? undefined,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function drawFrame(
  canvas: HTMLCanvasElement,
  frame: DicomFrame,
  opts: { wc: number; ww: number; inverted: boolean },
) {
  const { pixels, rows, columns, rescaleSlope, rescaleIntercept, photometricInterpretation, samplesPerPixel } = frame;
  const { wc, ww, inverted } = opts;
  canvas.width = columns;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(columns, rows);
  const data = img.data;
  const halfWW = ww / 2;
  const wcLow = wc - halfWW;
  const monochrome1 = photometricInterpretation === 'MONOCHROME1';
  const flip = inverted !== monochrome1; // XOR

  if (samplesPerPixel === 3) {
    for (let i = 0; i < rows * columns; i += 1) {
      const r = pixels[i * 3 + 0] as number;
      const g = pixels[i * 3 + 1] as number;
      const b = pixels[i * 3 + 2] as number;
      data[i * 4 + 0] = flip ? 255 - r : r;
      data[i * 4 + 1] = flip ? 255 - g : g;
      data[i * 4 + 2] = flip ? 255 - b : b;
      data[i * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < pixels.length; i += 1) {
      const raw = pixels[i] * rescaleSlope + rescaleIntercept;
      let mapped = ((raw - wcLow) / ww) * 255;
      if (mapped < 0) mapped = 0;
      else if (mapped > 255) mapped = 255;
      if (flip) mapped = 255 - mapped;
      const out = mapped | 0;
      data[i * 4 + 0] = out;
      data[i * 4 + 1] = out;
      data[i * 4 + 2] = out;
      data[i * 4 + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
}

/**
 * Measurement overlay — rendered in image-space so it tracks zoom/pan/rotate
 * automatically via the parent CSS transform. We size the canvas to the
 * underlying frame dimensions so 1 canvas unit = 1 image pixel.
 */
function drawOverlay(
  overlay: HTMLCanvasElement,
  measurements: Measurement[],
  pending: Array<{ x: number; y: number }>,
  tool: Tool,
  ctx2: { zoom: number; pan: { x: number; y: number }; rotation: number; frame: DicomFrame | null },
) {
  if (!ctx2.frame) return;
  overlay.width = ctx2.frame.columns;
  overlay.height = ctx2.frame.rows;
  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  // Inverse-scale stroke width so it stays at ~1.5 screen pixels regardless
  // of zoom.
  const sw = 1.5 / Math.max(0.1, ctx2.zoom);
  ctx.lineWidth = sw;
  ctx.strokeStyle = '#22d3ee'; // cyan, high contrast on grayscale
  ctx.fillStyle = '#22d3ee';
  ctx.font = `${Math.max(8, 12 / Math.max(0.1, ctx2.zoom))}px sans-serif`;

  // Drawn measurements
  for (const m of measurements) {
    if (m.kind === 'length' && m.points.length === 2) {
      const [a, b] = m.points;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillText(m.display, b.x + 4 / ctx2.zoom, b.y - 4 / ctx2.zoom);
    } else if (m.kind === 'angle' && m.points.length === 3) {
      const [a, b, c] = m.points;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.fillText(m.display, b.x + 4 / ctx2.zoom, b.y - 4 / ctx2.zoom);
    }
  }

  // Pending in-progress
  if (pending.length > 0) {
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < pending.length; i += 1) {
      const p = pending[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of pending) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 / ctx2.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function buildMeasurement(
  kind: 'length' | 'angle',
  points: Array<{ x: number; y: number }>,
  pixelSpacing: [number, number] | null,
): Measurement {
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (kind === 'length' && points.length >= 2) {
    const [a, b] = points;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const px = Math.hypot(dx, dy);
    if (pixelSpacing) {
      // pixelSpacing[0] = row spacing (Y), [1] = column spacing (X).
      const mmX = dx * pixelSpacing[1];
      const mmY = dy * pixelSpacing[0];
      const mm = Math.hypot(mmX, mmY);
      return { id, kind, points, display: `${mm.toFixed(1)} mm` };
    }
    return { id, kind, points, display: `${px.toFixed(0)} px` };
  }
  // angle: 3 points, middle is vertex
  const [a, b, c] = points;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  const cos = dot / (m1 * m2 || 1);
  const angleDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  return { id, kind, points, display: `${angleDeg.toFixed(1)}°` };
}
