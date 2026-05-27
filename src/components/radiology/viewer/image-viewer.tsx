'use client';

// Standard image viewer (JPG/PNG/TIFF/scanned films). Shares the same
// dark shell, toolbar tools, and keyboard shortcuts as the DICOM viewer.
// Implementation is CSS-transform-based — for raster images that's plenty
// snappy and avoids canvas redraws on every gesture.

import { useEffect, useRef, useState } from 'react';
import {
  Loader2, AlertTriangle, ZoomIn, ZoomOut, RotateCw,
  PencilOff, RefreshCw, Hand,
} from 'lucide-react';
import { ViewerShell, ViewerToolButton, ViewerToolDivider } from './viewer-shell';
import type { RadiologyFile, StudyMetadata, ViewerEvents } from './viewer-types';

interface ImageViewerProps {
  file: RadiologyFile;
  studyMetadata?: StudyMetadata;
  userRole?: string;
  canDownload?: boolean;
  dense?: boolean;
  events?: ViewerEvents;
  className?: string;
}

export function ImageViewer({
  file, studyMetadata, userRole, canDownload, dense, events, className,
}: ImageViewerProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [inverted, setInverted] = useState(false);

  const dragRef = useRef<null | { startX: number; startY: number; startPan: { x: number; y: number } }>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setInverted(false);
  }, [file.fileUrl]);

  // ─── Keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(8, z * 1.2)); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom((z) => Math.max(0.1, z / 1.2)); }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); setInverted(false);
      }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); setInverted((v) => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan } };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({ x: drag.startPan.x + (e.clientX - drag.startX), y: drag.startPan.y + (e.clientY - drag.startY) });
  };
  const onMouseUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.1, Math.min(8, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  const toolbar = (
    <>
      <ViewerToolButton title="Pan" active>
        <Hand className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Zoom in (+)" onClick={() => setZoom((z) => Math.min(8, z * 1.2))}>
        <ZoomIn className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Zoom out (-)" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}>
        <ZoomOut className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolDivider />
      <ViewerToolButton title="Rotate 90°" onClick={() => setRotation((r) => (r + 90) % 360)}>
        <RotateCw className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton title="Invert (I)" active={inverted} onClick={() => setInverted((v) => !v)}>
        <PencilOff className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolButton
        title="Reset view (R)"
        onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); setInverted(false); }}
      >
        <RefreshCw className="size-3.5" />
      </ViewerToolButton>
      <span className="text-[11px] text-zinc-400 font-mono ml-1">Zoom {Math.round(zoom * 100)}%</span>
    </>
  );

  return (
    <ViewerShell
      title={file.fileName ?? 'Image'}
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
      <div
        className="relative h-full w-full overflow-hidden bg-black flex items-center justify-center"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
            <Loader2 className="size-6 animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300">
            <AlertTriangle className="size-10 mb-3 text-amber-400" />
            <p className="text-sm">Couldn&apos;t load image</p>
            <p className="text-xs opacity-70 mt-1">{error}</p>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={file.fileUrl}
          alt={file.fileName ?? 'image'}
          onLoad={() => {
            setLoading(false);
            events?.onLoaded?.({ fileType: 'image' });
          }}
          onError={() => {
            setLoading(false);
            setError('The image failed to load. Check CORS / network.');
            events?.onError?.({ message: 'Image load failed' });
          }}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            filter: inverted ? 'invert(100%)' : undefined,
            transformOrigin: 'center center',
            maxWidth: '100%',
            maxHeight: '100%',
            transition: 'transform 0.06s linear',
          }}
        />
      </div>
    </ViewerShell>
  );
}
