'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ============================================================
// Unified barcode / DataMatrix scanner
// ============================================================
// One component, three inputs, one callback (onScan):
//   • USB 1D scanner  — acts as a keyboard; types into the field + Enter.
//   • USB 2D scanner  — same keyboard-wedge behaviour (DataMatrix as a string).
//   • Phone camera    — html5/ZXing in-browser decode of 1D + 2D (DataMatrix/QR).
// All paths converge on onScan(rawValue); the caller parses/resolves it. ZXing is
// lazy-loaded only when the camera is opened, so it never weighs down first paint.

interface ScannerControls {
  stop: () => void;
}

export function BarcodeScanner({
  onScan,
  placeholder = 'Scan or type a barcode…',
  disabled,
  autoFocus,
  cameraLabel = 'Camera',
}: {
  onScan: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  cameraLabel?: string;
}) {
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  const submit = (v: string) => {
    const code = v.trim();
    if (!code) return;
    onScan(code);
    setValue('');
  };

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

function CameraScanDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  // Keep the latest callback in a ref so the camera effect depends only on `open`.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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
          (result, _err, ctrl) => {
            if (result) {
              ctrl?.stop();
              onDetectedRef.current(result.getText());
            }
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
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan with camera</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {/* Aiming guide */}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400/70" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
          {error ? (
            <p className="text-xs text-red-500">{error}. Use a USB scanner or type the code instead.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Point the rear camera at the 1D barcode or 2D DataMatrix and hold steady.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
