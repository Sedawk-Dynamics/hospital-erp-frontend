'use client';

import { useState } from 'react';
import { Printer, Loader2, Tag } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';
import { useBatchLabels } from '@/hooks/use-pharmacy';
import { BarcodeLabel } from './barcode-label';

// Print shelf labels for one or many batches.
//
// Copies matter: a batch is usually put away across several shelf positions, and
// each pack the pharmacy repackages needs its own label — so the same batch is
// legitimately printed N times. The sheet lays labels out at a fixed 50×25mm so
// they line up with standard label stock; browsers print it as-is via @media print.

export function PrintLabelsDialog({
  batchIds,
  open,
  onOpenChange,
}: {
  batchIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copies, setCopies] = useState('1');
  const { data: labels = [], isLoading } = useBatchLabels(open ? batchIds : []);

  const n = Math.min(Math.max(parseInt(copies, 10) || 1, 1), 50);
  const sheet = labels.flatMap((l) => Array.from({ length: n }, () => l));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Print shelf labels
          </DialogTitle>
          <DialogDescription>
            Each label carries a Code-128 (reads on any scanner) and a DataMatrix holding
            product, batch and expiry. Storage location is printed as text and re-read on
            every scan, so moving stock never invalidates a label.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-3 print:hidden">
          <div className="w-32">
            <Label htmlFor="copies">Copies each</Label>
            <Input
              id="copies"
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            {labels.length} batch{labels.length === 1 ? '' : 'es'} · {sheet.length} label
            {sheet.length === 1 ? '' : 's'} at 50×25&nbsp;mm
          </p>
        </div>

        <div className="max-h-[52vh] overflow-y-auto rounded-lg bg-muted/30 p-3 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Building labels…
            </div>
          ) : labels.length === 0 ? (
            <EmptyState icon={Tag} title="Nothing to print" description="No batches were selected." />
          ) : (
            <div className="label-sheet flex flex-wrap gap-2 print:gap-0">
              {sheet.map((l, i) => (
                <BarcodeLabel key={`${l.batchId}-${i}`} label={l} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => window.print()} disabled={isLoading || labels.length === 0}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
        </DialogFooter>

        {/* Print only the sheet: strip the dialog chrome, backdrop and shadows so
            the labels land on the page at their true physical size. */}
        <style jsx global>{`
          @media print {
            body * { visibility: hidden !important; }
            .label-sheet, .label-sheet * { visibility: visible !important; }
            .label-sheet {
              position: absolute;
              inset: 0;
              display: flex;
              flex-wrap: wrap;
              align-content: flex-start;
            }
            .barcode-label {
              break-inside: avoid;
              border-color: rgba(0, 0, 0, 0.25) !important;
            }
            @page { margin: 5mm; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
