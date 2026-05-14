'use client';

import { useState } from 'react';
import { Truck, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import { formatDateTimeAmPm, toInputDateStr } from '@/lib/date-utils';
import {
  useInventoryItems, useStockTransactions, useCreateStockTransaction,
  useSuppliers,
} from '@/hooks/use-inventory';

export default function StockInPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useStockTransactions({
    transactionType: 'stock_in',
    limit: 50,
  });
  const transactions = data?.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5" /> Stock In
          </h1>
          <p className="text-xs text-muted-foreground">
            Record incoming stock with batch, supplier, expiry, and unit cost.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Record Stock In
        </Button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState icon={Truck} title="No stock-in records" description="Receive your first batch." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.inventoryItem?.itemName}</TableCell>
                  <TableCell className="font-mono text-xs">{t.batchNumber ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.expiryDate ? new Date(t.expiryDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="text-sm">{t.supplier?.name ?? '-'}</TableCell>
                  <TableCell className="text-right">{t.quantity}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {t.unitCost ? `₹${Number(t.unitCost).toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.totalCost ? `₹${Number(t.totalCost).toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTimeAmPm(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {dialogOpen && <StockInDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}

function StockInDialog({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const { data: itemsResp } = useInventoryItems({ search: search || undefined, limit: 20, isActive: true });
  const items = itemsResp?.data ?? [];
  const { data: suppliersResp } = useSuppliers({ limit: 100, isActive: true });
  const suppliers = suppliersResp?.data ?? [];

  const create = useCreateStockTransaction();

  const handleSubmit = async () => {
    if (!itemId) { toast.error('Select an item'); return; }
    if (quantity <= 0) { toast.error('Quantity must be positive'); return; }
    try {
      await create.mutateAsync({
        inventoryItemId: itemId,
        transactionType: 'stock_in',
        quantity,
        batchNumber: batchNumber || undefined,
        expiryDate: expiryDate || undefined,
        supplierId: supplierId || undefined,
        unitCost,
        notes: notes || undefined,
      });
      toast.success('Stock received');
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed');
    }
  };

  const selectedItem = items.find((i) => i.id === itemId);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Stock In</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Search item</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Item name or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {items.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setItemId(it.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${itemId === it.id ? 'bg-primary/10' : ''}`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{it.itemName}</span>
                    <span className="text-xs text-muted-foreground">Current: {it.currentStock}</span>
                  </div>
                  {it.itemCode && <div className="text-xs text-muted-foreground font-mono">{it.itemCode}</div>}
                </button>
              ))}
            </div>
          )}
          {selectedItem && (
            <div className="bg-muted/40 rounded-md p-2 text-xs">
              Selected: <b>{selectedItem.itemName}</b> · current stock {selectedItem.currentStock}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Batch number</label>
              <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Expiry date</label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Quantity *</label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Unit cost (₹)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={unitCost ?? ''}
                onChange={(e) => setUnitCost(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Supplier</label>
            <Select value={supplierId ?? ''} onValueChange={(v) => setSupplierId(v || null)}>
              <SelectTrigger><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
