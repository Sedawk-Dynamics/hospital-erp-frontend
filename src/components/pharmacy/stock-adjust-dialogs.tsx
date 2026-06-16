'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDateTime, toInputDateStr } from '@/lib/date-utils';
import {
  useAdjustBatchStock,
  useStockAdjustments,
  type DrugBatch,
  type StockAdjustment,
} from '@/hooks/use-pharmacy';
import { ClipboardList } from 'lucide-react';

/**
 * G4: deliberate, reason-stamped stock-count correction for a single batch. The
 * operator enters the physically-counted quantity; the delta vs. the system
 * count is shown before saving, and the whole change is audited.
 */
export function AdjustStockDialog({
  batch,
  onOpenChange,
}: {
  batch: DrugBatch | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [count, setCount] = useState('');
  const [reason, setReason] = useState('');
  const adjust = useAdjustBatchStock();

  const system = batch?.quantityInStock ?? 0;
  const counted = count === '' ? null : Math.max(0, parseInt(count, 10) || 0);
  const delta = counted == null ? null : counted - system;

  async function handleSave() {
    if (!batch) return;
    if (counted == null) return toast.error('Enter the counted quantity');
    if (!reason.trim()) return toast.error('A reason is required');
    try {
      const res = await adjust.mutateAsync({
        id: batch.id,
        physicalCount: counted,
        reason: reason.trim(),
      });
      toast.success(`Stock adjusted ${res.from} → ${res.to} (${res.delta >= 0 ? '+' : ''}${res.delta})`);
      setCount('');
      setReason('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust stock');
    }
  }

  return (
    <Dialog
      open={!!batch}
      onOpenChange={(open) => {
        if (!open) {
          setCount('');
          setReason('');
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock count</DialogTitle>
          <DialogDescription>
            {batch?.drug?.drugName ?? 'Drug'} · batch{' '}
            <span className="font-mono">{batch?.batchNumber}</span>. The change is logged with your
            name and reason.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">System count</span>
            <span className="font-semibold">{system}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="physicalCount">Physical / corrected count *</Label>
            <Input
              id="physicalCount"
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="Counted units"
            />
          </div>
          {delta != null && delta !== 0 && (
            <div
              className={cn(
                'rounded-md px-3 py-2 text-sm',
                delta > 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700',
              )}
            >
              Discrepancy: {delta > 0 ? '+' : ''}
              {delta} ({delta > 0 ? 'surplus found' : 'shortfall'})
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="adjustReason">Reason *</Label>
            <Textarea
              id="adjustReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. physical count correction, damaged units, data-entry error"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={adjust.isPending}>
            {adjust.isPending ? 'Saving…' : 'Save adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** G4: stock discrepancy report — every manual count correction in a window. */
export function StockAdjustmentsLogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { data, isLoading } = useStockAdjustments({
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    limit: 100,
  });
  const rows: StockAdjustment[] = data?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock adjustment log</DialogTitle>
          <DialogDescription>
            Every manual count correction, with who changed what, from/to and why.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="adjFrom" className="text-xs">From</Label>
            <Input id="adjFrom" type="date" max={toInputDateStr()} value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adjTo" className="text-xs">To</Label>
            <Input id="adjTo" type="date" max={toInputDateStr()} value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8" />
          </div>
          {(fromDate || toDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); }}>
              Clear
            </Button>
          )}
        </div>

        <div className="mt-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No adjustments" description="No manual stock corrections in this range." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Drug / Batch</TableHead>
                  <TableHead className="text-right">From → To</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(a.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{a.drugName ?? '-'}</div>
                      {a.batchNumber && <div className="text-xs text-muted-foreground font-mono">{a.batchNumber}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {a.from} → {a.to}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono font-medium',
                        (a.delta ?? 0) > 0 ? 'text-emerald-600' : (a.delta ?? 0) < 0 ? 'text-amber-600' : '',
                      )}
                    >
                      {(a.delta ?? 0) > 0 ? '+' : ''}
                      {a.delta}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={a.reason ?? ''}>
                      {a.reason ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.user ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
