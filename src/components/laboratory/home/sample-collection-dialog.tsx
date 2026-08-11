'use client';

// Extracted verbatim from the Laboratory home page, which had grown to
// 2,056 lines holding the shell, seven tabs, four dialogs and the shared
// table primitives in one file. No behaviour changed in the move.

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useCollectSample,
  type LabOrder
} from '@/hooks/use-lab';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


// ============================================================
// Sample Collection Dialog
// ============================================================
export function SampleCollectionDialog({
  order,
  onOpenChange,
}: {
  order: LabOrder | null;
  onOpenChange: (open: boolean) => void;
}) {
  const collectMutation = useCollectSample();
  const [sampleType, setSampleType] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');

  const handle = async () => {
    if (!order) return;
    if (!sampleType.trim()) { toast.error('Sample type is required'); return; }
    try {
      await collectMutation.mutateAsync({
        labOrderId: order.id,
        sampleType: sampleType.trim(),
        barcode: barcode || undefined,
        notes: notes || undefined,
      });
      toast.success('Sample collected');
      setSampleType(''); setBarcode(''); setNotes('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to collect sample');
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect Sample</DialogTitle>
          <DialogDescription>
            Record sample details. Status will move to <code>sample_collected → in_transit → received → processing</code> through subsequent steps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Sample Type *</Label>
            <Input value={sampleType} onChange={(e) => setSampleType(e.target.value)} placeholder="e.g., blood, urine, swab" />
          </div>
          <div>
            <Label>Barcode</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter barcode" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={collectMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={collectMutation.isPending}>
            {collectMutation.isPending ? 'Saving…' : 'Mark Collected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
