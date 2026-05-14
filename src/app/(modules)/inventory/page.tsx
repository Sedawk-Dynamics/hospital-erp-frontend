'use client';

import { useState } from 'react';
import {
  ClipboardList, Search, Plus, Edit2, AlertTriangle,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';
import {
  useInventoryItems, useCreateItem, useUpdateItem,
  type InventoryCategory, type InventoryItem, type CreateItemInput,
} from '@/hooks/use-inventory';

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'drug', label: 'Drug' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'surgical_supply', label: 'Surgical Supply' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

export default function StockRegisterPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | InventoryCategory>('all');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useInventoryItems({
    search: search || undefined,
    category: category === 'all' ? undefined : category,
    isActive: true,
    limit: 50,
  });
  const items = data?.data ?? [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Stock Register
          </h1>
          <p className="text-xs text-muted-foreground">
            Master list of all inventory items: name, category, stock, threshold.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Item
        </Button>
      </div>

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
                <TableHead className="text-right">Actions</TableHead>
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

      {(createOpen || editItem) && (
        <ItemDialog
          item={editItem}
          onClose={() => {
            setCreateOpen(false);
            setEditItem(null);
          }}
        />
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
