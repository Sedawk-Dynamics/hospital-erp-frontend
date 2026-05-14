'use client';

import { HeartPulse, AlertTriangle, Edit2 } from 'lucide-react';
import { useState } from 'react';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useLowStockItems, useUpdateItem, type InventoryItem,
} from '@/hooks/use-inventory';

export default function LowStockPage() {
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const { data, isLoading } = useLowStockItems({ limit: 100 });
  const items = data?.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h1 className="font-headline text-xl font-bold flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-red-600" />
          Low Stock Alerts
        </h1>
        <p className="text-xs text-muted-foreground">
          Items where current stock is at or below the configured reorder threshold.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title="No low-stock items"
            description="All inventory items are above their reorder thresholds."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead className="text-right">Shortfall</TableHead>
                <TableHead className="text-right">Adjust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const shortfall = item.minimumStockThreshold - item.currentStock;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="font-mono text-xs">{item.itemCode ?? '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-right text-red-700 font-semibold">
                      <AlertTriangle className="inline mr-1 h-3 w-3" />
                      {item.currentStock}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.minimumStockThreshold}</TableCell>
                    <TableCell className="text-right text-amber-700">{shortfall > 0 ? shortfall : 0}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditItem(item)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {editItem && (
        <ThresholdDialog item={editItem} onClose={() => setEditItem(null)} />
      )}
    </div>
  );
}

function ThresholdDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [threshold, setThreshold] = useState(item.minimumStockThreshold);
  const update = useUpdateItem();

  const handleSave = async () => {
    if (threshold < 0) {
      toast.error('Threshold must be ≥ 0');
      return;
    }
    try {
      await update.mutateAsync({ id: item.id, minimumStockThreshold: threshold });
      toast.success('Threshold updated');
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust threshold</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">{item.itemName}</p>
          <div>
            <label className="text-xs font-medium">Reorder threshold</label>
            <Input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              When stock drops to or below this, the item appears in this alert list.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
