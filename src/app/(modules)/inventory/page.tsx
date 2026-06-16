'use client';

import { useState } from 'react';
import {
  ClipboardList, Search, Plus, Edit2, AlertTriangle, Truck, PackagePlus,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  useInventoryItems, useCreateItem, useUpdateItem,
  useStockTransactions, useCreateStockTransaction, useSuppliers,
  type InventoryCategory, type InventoryItem, type CreateItemInput,
} from '@/hooks/use-inventory';

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'drug', label: 'Drug' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'surgical_supply', label: 'Surgical Supply' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

type StockTab = 'items' | 'stock-in';

export default function StockRegisterPage() {
  const [tab, setTab] = useState<StockTab>('items');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | InventoryCategory>('all');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Stock-in dialog. When opened from a row, the item is pre-selected.
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockInItem, setStockInItem] = useState<InventoryItem | null>(null);

  const { data, isLoading } = useInventoryItems({
    search: search || undefined,
    category: category === 'all' ? undefined : category,
    isActive: true,
    limit: 50,
  });
  const items = data?.data ?? [];

  const openStockIn = (item?: InventoryItem | null) => {
    setStockInItem(item ?? null);
    setStockInOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Stock Register
          </h1>
          <p className="text-xs text-muted-foreground">
            Add items and record incoming stock in one place — items master + stock-in log.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openStockIn(null)}>
            <Truck className="mr-1.5 h-4 w-4" /> Record Stock In
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Item
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as StockTab)}>
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="stock-in">Stock In Log</TabsTrigger>
        </TabsList>

        {/* ── Items master ── */}
        <TabsContent value="items" className="mt-3 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v as 'all' | InventoryCategory)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No items"
                description="Add inventory items to start tracking stock."
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> New Item
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder At</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const low = item.currentStock <= item.minimumStockThreshold;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.itemName}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[300px]">{item.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.itemCode ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.unitOfMeasurement ?? '-'}</TableCell>
                        <TableCell className="text-right">
                          <span className={low ? 'text-red-700 font-semibold' : ''}>
                            {item.currentStock}
                            {low && <AlertTriangle className="inline ml-1 h-3 w-3" />}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.minimumStockThreshold}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.costPerUnit ? `₹${Number(item.costPerUnit).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              title="Record stock in for this item"
                              onClick={() => openStockIn(item)}
                            >
                              <PackagePlus className="mr-1 h-3.5 w-3.5" /> Stock In
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Edit item" onClick={() => setEditItem(item)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Stock-in receipts log ── */}
        <TabsContent value="stock-in" className="mt-3">
          <StockInLog onRecord={() => openStockIn(null)} />
        </TabsContent>
      </Tabs>

      {(createOpen || editItem) && (
        <ItemDialog
          item={editItem}
          onClose={() => {
            setCreateOpen(false);
            setEditItem(null);
          }}
        />
      )}
      {stockInOpen && (
        <StockInDialog
          initialItem={stockInItem}
          onClose={() => { setStockInOpen(false); setStockInItem(null); }}
        />
      )}
    </div>
  );
}

// Recent stock-in receipts (moved here from the standalone Stock In page).
function StockInLog({ onRecord }: { onRecord: () => void }) {
  const { data, isLoading } = useStockTransactions({ transactionType: 'stock_in', limit: 50 });
  const transactions = data?.data ?? [];

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No stock-in records"
          description="Receive your first batch."
          action={
            <Button size="sm" onClick={onRecord}>
              <Truck className="mr-1.5 h-4 w-4" /> Record Stock In
            </Button>
          }
        />
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
  );
}

function ItemDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const isEdit = !!item;
  const [form, setForm] = useState<CreateItemInput & { isActive?: boolean }>({
    itemName: item?.itemName ?? '',
    itemCode: item?.itemCode ?? undefined,
    category: item?.category ?? 'drug',
    description: item?.description ?? undefined,
    unitOfMeasurement: item?.unitOfMeasurement ?? undefined,
    minimumStockThreshold: item?.minimumStockThreshold ?? 10,
    currentStock: item?.currentStock ?? 0,
    costPerUnit: item?.costPerUnit ? Number(item.costPerUnit) : undefined,
    sellingPricePerUnit: item?.sellingPricePerUnit ? Number(item.sellingPricePerUnit) : undefined,
  });

  const create = useCreateItem();
  const update = useUpdateItem();

  const handleSubmit = async () => {
    if (!form.itemName.trim()) {
      toast.error('Item name is required');
      return;
    }
    try {
      if (isEdit && item) {
        await update.mutateAsync({ id: item.id, ...form });
        toast.success('Item updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Item created');
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to save item');
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'New Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Name *</label>
              <Input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Code</label>
              <Input value={form.itemCode ?? ''} onChange={(e) => setForm({ ...form, itemCode: e.target.value || undefined })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Category *</label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as InventoryCategory })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Unit (e.g. box, ml, kg)</label>
              <Input
                value={form.unitOfMeasurement ?? ''}
                onChange={(e) => setForm({ ...form, unitOfMeasurement: e.target.value || undefined })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Reorder threshold</label>
              <Input
                type="number"
                min={0}
                value={form.minimumStockThreshold ?? 10}
                onChange={(e) => setForm({ ...form, minimumStockThreshold: Number(e.target.value) || 0 })}
              />
            </div>
            {!isEdit && (
              <div>
                <label className="text-xs font-medium">Initial stock</label>
                <Input
                  type="number"
                  min={0}
                  value={form.currentStock ?? 0}
                  onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Cost per unit (₹)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.costPerUnit ?? ''}
                onChange={(e) => setForm({ ...form, costPerUnit: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Selling price (₹)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.sellingPricePerUnit ?? ''}
                onChange={(e) => setForm({ ...form, sellingPricePerUnit: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <Textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value || undefined })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {isEdit ? 'Save Changes' : 'Create Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Record incoming stock (moved here from the standalone Stock In page). When
// opened from a row, `initialItem` pre-selects that item.
function StockInDialog({ initialItem, onClose }: { initialItem: InventoryItem | null; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [itemId, setItemId] = useState<string | null>(initialItem?.id ?? null);
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

  // Prefer the pre-selected item; otherwise resolve from the search results.
  const selectedItem = (initialItem && initialItem.id === itemId)
    ? initialItem
    : items.find((i) => i.id === itemId) ?? null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Stock In</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {selectedItem ? (
            <div className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
              <span>
                Item: <b>{selectedItem.itemName}</b>
                <span className="ml-2 text-xs text-muted-foreground">current stock {selectedItem.currentStock}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setItemId(null)}>Change</Button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium">Search item</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Item name or code"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
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
            </>
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
