'use client';

// Dark-theme host wrapper for any radiology viewer body. Renders the title
// bar (patient/study metadata + close + fullscreen) and a slot for the
// type-specific toolbar above the file canvas. Layout-only — the per-type
// viewer (DICOM/PDF/image/ECG) provides its own content + toolbar.

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StudyMetadata } from './viewer-types';
import { canRoleDownload, formatFileSize, triggerDownload } from './viewer-utils';

interface ViewerShellProps {
  /** Title displayed on the left side (typically file name or study description). */
  title: string;
  /** Optional sub-title shown beneath the title. */
  subtitle?: string;
  /** Optional study metadata badges. */
  metadata?: StudyMetadata;
  /** File size to show in the subtitle. */
  sizeBytes?: number;
  /** Direct URL for the Download button. */
  downloadUrl?: string;
  /** Filename for the download attribute. */
  downloadFileName?: string;
  /** User role (used to gate Download button). */
  userRole?: string;
  /** When false, the Download button is hidden regardless of role. */
  canDownload?: boolean;
  /** Callback when the close button is pressed (modal mode). */
  onClose?: () => void;
  /** Adaptive toolbar slot — type-specific tools. */
  toolbar?: React.ReactNode;
  /** Body content — the actual viewer canvas/iframe/SVG. */
  children: React.ReactNode;
  /** Use compact 480px height for inline embedding. Otherwise fills parent. */
  dense?: boolean;
  className?: string;
}

export function ViewerShell({
  title, subtitle, metadata, sizeBytes,
  downloadUrl, downloadFileName,
  userRole, canDownload = true,
  onClose, toolbar, children, dense, className,
}: ViewerShellProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const downloadAllowed = canDownload && canRoleDownload(userRole) && !!downloadUrl;

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {/* user-gesture / unsupported */});
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard: F = fullscreen, Esc = close. Per-viewer shortcuts (arrow keys,
  // W/L, +/-, R) are bound inside the body components themselves so they only
  // fire when that viewer has focus.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === 'Escape' && !document.fullscreenElement && onClose) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className={cn(
        // Dark theme is the industry standard for radiology viewing — keeps
        // ambient light low and lets W/L mapping show subtle gradations.
        'flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden',
        dense ? 'h-[480px]' : 'h-full',
        className,
      )}
    >
      {/* Header — title + metadata + window controls */}
      <header className="flex items-start gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{title}</p>
          {(subtitle || sizeBytes || metadata) && (
            <p className="truncate text-[11px] text-zinc-400">
              {subtitle}
              {sizeBytes ? <span className="ml-2">{formatFileSize(sizeBytes)}</span> : null}
              {metadata?.patientName && <span className="ml-2">· {metadata.patientName}</span>}
              {metadata?.patientId && <span className="ml-2 font-mono">({metadata.patientId})</span>}
              {metadata?.modality && <span className="ml-2">· {metadata.modality}</span>}
              {metadata?.bodyPart && <span className="ml-2">· {metadata.bodyPart}</span>}
              {metadata?.studyDate && <span className="ml-2">· {metadata.studyDate}</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {downloadAllowed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => triggerDownload(downloadUrl!, downloadFileName)}
              className="h-8 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
              title="Download"
            >
              <Download className="size-3.5" /> <span className="hidden sm:inline ml-1">Download</span>
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-8 w-8 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
              title="Close (Esc)"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Adaptive toolbar */}
      {toolbar && (
        <div className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-900/70 px-2 py-1 overflow-x-auto">
          {toolbar}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 relative">{children}</div>
    </div>
  );
}

/** A small button styled for the dark viewer toolbar. */
export function ViewerToolButton({
  active, title, onClick, children, disabled,
}: {
  active?: boolean;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        'text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800',
        active && 'bg-primary/20 text-primary-foreground ring-1 ring-primary/40',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}

export function ViewerToolDivider() {
  return <div className="mx-1 h-5 w-px bg-zinc-700" />;
}
