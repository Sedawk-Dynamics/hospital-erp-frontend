'use client';

import { Loader2, Barcode, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { useBatchLabels } from '@/hooks/use-pharmacy';
import { BarcodeLabel } from './barcode-label';

// View the internal barcode + unique number for one or many batches.
//
// Display only — the codes are rendered large enough to scan straight off the
// screen, and the unique number can be copied for typing into anything that
// takes it by hand.

export function BarcodeViewDialog({
  batchIds,
  open,
  onOpenChange,
}: {
  batchIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: labels = [], isLoading } = useBatchLabels(open ? batchIds : []);
  const [copied, setCopied] = useState<string | null>(null);

  const copyAll = async () => {
    const text = labels.map((l) => `${l.drugName}\t${l.batchNumber}\t${l.code128}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied('all');
      setTimeout(() => setCopied(null), 1500);
      toast.success(`Copied ${labels.length} code${labels.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-4 w-4 text-primary" />
            {labels.length > 1 ? `Barcodes · ${labels.length} batches` : 'Batch barcode'}
          </DialogTitle>
          <DialogDescription>
            Each batch carries a Code-128 of its unique number plus a DataMatrix holding
            product, batch and expiry. Both scan directly from this screen.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating codes…
            </div>
          ) : labels.length === 0 ? (
            <EmptyState
              icon={Barcode}
              title="Nothing to show"
              description="No batches were selected."
            />
          ) : (
            labels.map((l) => <BarcodeLabel key={l.batchId} label={l} />)
          )}
        </div>

        <DialogFooter>
          {labels.length > 0 && (
            <Button variant="outline" onClick={copyAll}>
              {copied === 'all' ? (
                <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
              )}
              Copy numbers
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
