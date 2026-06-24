'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ============================================================
// Unified barcode / DataMatrix scanner
// ============================================================
// One component, one callback (onScan), that reads BOTH 1D and 2D codes through
// either of two inputs:
//   • Scanner — a USB / handheld 1D or 2D scanner acting as a keyboard (types the
//     code into the field, ending in Enter). Also accepts manual typing.
//   • Camera  — phone / laptop / USB webcam decoded in-browser via ZXing (1D + 2D
//     DataMatrix / QR). Lazy-loaded so it never weighs down first paint.
// All paths converge on onScan(rawValue); the caller parses/resolves it.
//
// Default layout shows the input + a camera-popup button. With `withModeSwitch`
// it instead shows a Scanner/Camera toggle (default Scanner) — one combined
// control where the camera runs inline while in Camera mode.

interface ScannerControls {
  stop: () => void;
}

export type ScanMode = 'scanner' | 'camera';

export function BarcodeScanner({
  onScan,
  placeholder = 'Scan or type a barcode…',
  disabled,
  autoFocus,
  cameraLabel = 'Camera',
  withModeSwitch = false,
  defaultMode = 'scanner',
}: {
  onScan: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  cameraLabel?: string;
  // Render a Scanner/Camera toggle (one combined control) instead of the default
  // input + camera-button layout. Other call sites keep the default look.
  withModeSwitch?: boolean;
  defaultMode?: ScanMode;
}) {
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [mode, setMode] = useState<ScanMode>(defaultMode);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dedupe repeat camera reads of the same code (continuous inline decoding).
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 });

  const submit = (v: string) => {
    const code = v.trim();
    if (!code) return;
    onScan(code);
    setValue('');
  };
  const submitFromCamera = (v: string) => {
    const code = v.trim();
    if (!code) return;
    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.t < 2500) return;
    lastRef.current = { code, t: now };
    onScan(code);
  };

  // Keep the keyboard-wedge field focused while in Scanner mode so a handheld
  // scanner's keystrokes land here, not in some other form field.
  useEffect(() => {
    if (withModeSwitch && mode === 'scanner') inputRef.current?.focus();
  }, [withModeSwitch, mode]);

  if (withModeSwitch) {
    return (
      <div className="space-y-2">
        {/* Scanner / Camera switch — defaults to Scanner */}
        <div className="inline-flex items-center gap-0.5 rounded-md border p-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode('scanner')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition',
              mode === 'scanner' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <ScanLine className="h-3.5 w-3.5" /> Scanner
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode('camera')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition',
              mode === 'camera' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Camera className="h-3.5 w-3.5" /> Camera
          </button>
        </div>

        {mode === 'scanner' ? (
          <div>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                disabled={disabled}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit(value);
                  }
                }}
                placeholder={placeholder}
                className="h-9 pl-8 font-mono text-xs"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              USB / handheld scanner (1D or 2D) — or type the code and press Enter.
            </p>
          </div>
        ) : (
          <CameraScanView active onDetected={submitFromCamera} />
        )}
      </div>
    );
  }

  // Default layout: text field + camera-popup button (unchanged for existing callers).
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <ScanLine className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // USB scanners send the code as keystrokes ending in Enter.
            if (e.key === 'Enter') {
              e.preventDefault();
              submit(value);
            }
          }}
          placeholder={placeholder}
          className="h-9 pl-8 font-mono text-xs"
        />
      </div>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setCameraOpen(true)}>
        <Camera className="mr-1.5 h-4 w-4" /> {cameraLabel}
      </Button>
      <CameraScanDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetected={(code) => { setCameraOpen(false); submit(code); }}
      />
    </div>
  );
}

// Live camera decode (1D + 2D) rendered inline. Runs while `active`; calls
// onDetected for every decode (the caller dedupes / decides whether to stop).
function CameraScanView({
  active,
  onDetected,
}: {
  active: boolean;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setStarting(true);
    setError(null);

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        const hints = new Map<number, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reader = new BrowserMultiFormatReader(hints as any);
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result) => {
            if (result) onDetectedRef.current(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not start the camera');
          setStarting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active]);

  return (
    <div className="space-y-1.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400/70" />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
      {error ? (
        <p className="text-[11px] text-red-500">{error}. Switch to Scanner and use a USB scanner or type the code.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Point the camera (phone / laptop / USB webcam) at a 1D barcode or 2D DataMatrix and hold steady.
        </p>
      )}
    </div>
  );
}

function CameraScanDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDetected: (code: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan with camera</DialogTitle>
        </DialogHeader>
        <CameraScanView active={open} onDetected={onDetected} />
      </DialogContent>
    </Dialog>
  );
}
