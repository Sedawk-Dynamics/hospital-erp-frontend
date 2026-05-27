'use client';

// PDF viewer backed by pdfjs-dist. Renders one page at a time into a canvas
// so we can give the user our own zoom + page-navigation toolbar (the native
// browser PDF chrome is inconsistent across browsers, and we want a unified
// look on the dark radiology shell).
//
// pdfjs-dist hits `window` on import — keep this file in a 'use client'
// component and lazy-load the lib inside the effect so SSR doesn't choke.

import { useEffect, useRef, useState } from 'react';
import {
  Loader2, AlertTriangle, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import { ViewerShell, ViewerToolButton, ViewerToolDivider } from './viewer-shell';
import type { RadiologyFile, StudyMetadata, ViewerEvents } from './viewer-types';

interface PdfViewerProps {
  file: RadiologyFile;
  studyMetadata?: StudyMetadata;
  userRole?: string;
  canDownload?: boolean;
  dense?: boolean;
  events?: ViewerEvents;
  className?: string;
}

export function PdfViewer({
  file, studyMetadata, userRole, canDownload, dense, events, className,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [fitMode, setFitMode] = useState<'page' | 'width' | 'custom'>('page');

  // ─── Load document on URL change ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageNum(1);

    (async () => {
      try {
        // Dynamic import — pdfjs-dist needs `window`. Pin to the legacy
        // build for stability with Next.js / Turbopack.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        // Worker setup — Next 16 + Turbopack don't support the `?url` import
        // pattern, so we load the worker from a pinned CDN copy. If your
        // environment is offline, copy /node_modules/pdfjs-dist/legacy/
        // build/pdf.worker.min.mjs into /public/pdf/ and change workerSrc
        // to '/pdf/pdf.worker.min.mjs'.
        const PDFJS_VERSION = (pdfjs as any).version ?? '4.10.38';
        (pdfjs as any).GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

        const doc = await (pdfjs as any).getDocument({
          url: file.fileUrl,
          // Permissive CMap lookup, helpful for non-Latin reports.
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/',
          cMapPacked: true,
          withCredentials: false,
        }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setPageCount(doc.numPages);
        setLoading(false);
        events?.onLoaded?.({ fileType: 'pdf', count: doc.numPages });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load PDF';
        setError(message);
        setLoading(false);
        events?.onError?.({ message, cause: err });
      }
    })();

    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy?.();
      pdfDocRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.fileUrl]);

  // ─── Render current page whenever page/scale/doc changes ─────────
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || loading) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDocRef.current.getPage(pageNum);
        if (cancelled) return;
        const container = canvasRef.current!.parentElement!;
        const cw = container.clientWidth - 24;
        const ch = container.clientHeight - 24;
        const viewport0 = page.getViewport({ scale: 1 });
        // Compute scale based on fit mode.
        let effective = scale;
        if (fitMode === 'page') {
          effective = Math.min(cw / viewport0.width, ch / viewport0.height);
        } else if (fitMode === 'width') {
          effective = cw / viewport0.width;
        }
        const viewport = page.getViewport({ scale: effective });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        // Account for devicePixelRatio for crisp text.
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to render page';
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, scale, fitMode, loading]);

  // ─── Keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setPageNum((p) => Math.min(pageCount, p + 1));
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPageNum((p) => Math.max(1, p - 1));
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setFitMode('custom'); setScale((s) => Math.min(4, s * 1.2));
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setFitMode('custom'); setScale((s) => Math.max(0.25, s / 1.2));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pageCount]);

  const toolbar = (
    <>
      <ViewerToolButton title="Previous page (←)" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>
        <ChevronLeft className="size-3.5" />
      </ViewerToolButton>
      <span className="text-xs text-zinc-300 px-1 font-mono">
        <input
          type="number"
          min={1}
          max={pageCount}
          value={pageNum}
          onChange={(e) => {
            const v = Math.max(1, Math.min(pageCount, parseInt(e.target.value || '1', 10)));
            setPageNum(v);
          }}
          className="w-12 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 border border-zinc-700 text-center"
        />
        <span className="ml-1">/ {pageCount}</span>
      </span>
      <ViewerToolButton title="Next page (→)" onClick={() => setPageNum((p) => Math.min(pageCount, p + 1))} disabled={pageNum >= pageCount}>
        <ChevronRight className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolDivider />
      <ViewerToolButton title="Zoom out (-)" onClick={() => { setFitMode('custom'); setScale((s) => Math.max(0.25, s / 1.2)); }}>
        <ZoomOut className="size-3.5" />
      </ViewerToolButton>
      <span className="text-[11px] text-zinc-400 font-mono px-1">
        {Math.round((fitMode === 'custom' ? scale : 1) * 100)}%
      </span>
      <ViewerToolButton title="Zoom in (+)" onClick={() => { setFitMode('custom'); setScale((s) => Math.min(4, s * 1.2)); }}>
        <ZoomIn className="size-3.5" />
      </ViewerToolButton>
      <ViewerToolDivider />
      <ViewerToolButton title="Fit page" active={fitMode === 'page'} onClick={() => setFitMode('page')}>
        <Maximize2 className="size-3.5" />Fit
      </ViewerToolButton>
      <ViewerToolButton title="Fit width" active={fitMode === 'width'} onClick={() => setFitMode('width')}>
        Width
      </ViewerToolButton>
    </>
  );

  return (
    <ViewerShell
      title={file.fileName ?? 'PDF Report'}
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
      <div className="h-full w-full overflow-auto bg-zinc-900 flex items-start justify-center py-3 px-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <Loader2 className="size-6 animate-spin mr-2" />
            <span className="text-sm">Loading PDF…</span>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-300 text-center px-6 py-8">
            <AlertTriangle className="size-10 mb-3 text-amber-400" />
            <p className="text-sm">Couldn&apos;t render PDF</p>
            <p className="text-xs opacity-70 mt-1">{error}</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="shadow-lg bg-white"
          />
        )}
      </div>
    </ViewerShell>
  );
}
